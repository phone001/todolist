/**
 * 브랜드 로딩 인디케이터 — FSM + 타이머 + AccessibilityInfo + rAF 프레임 샘플러 배선 훅.
 * 설계 근거: document/architect/logic.md v1.7 §16.9.2 / §16.9.3 / §16.9.6 / §16.9.9,
 *           nfr.md v1.5 §13.2 / §13.3.
 * 환경 제약: react / react-native 의존 → 파이프라인 미실행(정적 리뷰). 판정 로직은 전부
 *           loadingIndicatorMachine.ts(순수 FSM, node:test V-27/V-29)로 위임한다.
 *
 * 파일명이 ".native.ts" 인 이유: core tsc(tsconfig.json)는 src/app 하위의 .tsx 와 .native.ts 를
 * 제외한다(RN 런타임 의존 코드는 셸 typecheck tsconfig.app.json 전용). RN 의존 훅이므로
 * stores.native.ts 와 동일하게 .native.ts 로 둔다.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import {
  evaluateLoading,
  isFrameDegraded,
  nextEvaluationDelay,
  type LoadingDecision,
  type LoadingEndReason,
  type LoadingMode,
  type LoadingSnapshot,
} from './loadingIndicatorMachine.ts';

/** 프레임 저하는 앱 세션 스코프 단방향 플래그(§16.9.6, nfr §13.2). 모듈 변수로 유지. */
let sessionDegraded = false;

/** 테스트/QA 훅 — 세션 강등 플래그 초기화. 프로덕션 경로에서는 호출하지 않는다. */
export function resetSessionDegraded(): void {
  sessionDegraded = false;
}

/** rAF 간격 링버퍼 상한(대략 1.5s 분량). */
const FRAME_BUFFER_MAX = 90;

export interface UseLoadingIndicatorParams {
  /** 화면/부트스트랩이 전달하는 원시 로딩 상태. */
  loading: boolean;
  /** 로딩 종료 사유. 'error' → 최소표시 무시 즉시 제거(AC-38). */
  endReason: LoadingEndReason;
}

export interface UseLoadingIndicatorResult {
  visible: boolean;
  mode: LoadingMode;
  showTimeoutHint: boolean;
  /** SVG/정적 폴백 렌더 실패 시 SvgErrorBoundary 가 호출 → mode='spinner' 로 전환. */
  notifyRenderFailed: () => void;
}

const INITIAL_DECISION: LoadingDecision = {
  visible: false,
  mode: 'animation',
  showTimeoutHint: false,
  markShownNow: false,
};

export function useLoadingIndicator({
  loading,
  endReason,
}: UseLoadingIndicatorParams): UseLoadingIndicatorResult {
  const [reduceMotion, setReduceMotion] = useState(false);
  const [decision, setDecision] = useState<LoadingDecision>(INITIAL_DECISION);

  const startedAtRef = useRef<number | null>(null);
  const endedAtRef = useRef<number | null>(null);
  const shownAtRef = useRef<number | null>(null);
  const degradedRef = useRef<boolean>(sessionDegraded);
  const renderFailedRef = useRef<boolean>(false);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastFrameRef = useRef<number | null>(null);
  const intervalsRef = useRef<number[]>([]);

  const snapshot = useCallback(
    (now: number): LoadingSnapshot => ({
      loadingStartedAt: startedAtRef.current,
      loadingEndedAt: endedAtRef.current,
      endReason,
      now,
      reduceMotion,
      degraded: degradedRef.current,
      renderFailed: renderFailedRef.current,
      shownAt: shownAtRef.current,
    }),
    [endReason, reduceMotion],
  );

  const evaluate = useCallback(() => {
    const now = Date.now();
    let snap = snapshot(now);
    let d = evaluateLoading(snap);

    // 표시 상승 에지 → shownAt 기록 후 즉시 재평가(최소표시/타임아웃 기준점 확정)
    if (d.markShownNow && shownAtRef.current === null) {
      shownAtRef.current = now;
      snap = snapshot(now);
      d = evaluateLoading(snap);
    }

    setDecision(d);

    // 로딩이 완전히 끝나고 숨겨졌으면 다음 사이클을 위해 초기화 (P-31 잔존 방지)
    if (!d.visible && !loading && startedAtRef.current !== null && endedAtRef.current !== null) {
      startedAtRef.current = null;
      endedAtRef.current = null;
      shownAtRef.current = null;
      intervalsRef.current = [];
      lastFrameRef.current = null;
    }

    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const delay = nextEvaluationDelay(snap);
    if (delay !== null) {
      timerRef.current = setTimeout(() => {
        evaluate();
      }, Math.max(0, delay));
    }
  }, [snapshot, loading]);

  // Reduce Motion 초기값 + 변경 구독 (§16.9.6, AC-33)
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => {
        if (mounted) setReduceMotion(v);
      })
      .catch(() => {
        /* 조회 실패 시 애니메이션 유지(안전값) */
      });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (v: boolean) => {
      setReduceMotion(v);
    });
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);

  // loading 에지 감지 → 타임스탬프 갱신 후 재평가
  useEffect(() => {
    const now = Date.now();
    if (loading) {
      if (startedAtRef.current === null) {
        startedAtRef.current = now;
        endedAtRef.current = null;
        shownAtRef.current = null;
        intervalsRef.current = [];
        lastFrameRef.current = null;
        renderFailedRef.current = false;
      }
    } else if (startedAtRef.current !== null && endedAtRef.current === null) {
      endedAtRef.current = now;
    }
    evaluate();
  }, [loading, endReason, reduceMotion, evaluate]);

  // rAF 프레임 샘플러 — 애니메이션이 실제로 보일 때만 동작 (§16.9.6, nfr §13.2)
  useEffect(() => {
    if (!(decision.visible && decision.mode === 'animation')) return undefined;
    if (degradedRef.current) return undefined;

    let active = true;
    const tick = (ts: number) => {
      if (!active) return;
      if (lastFrameRef.current !== null) {
        const buf = intervalsRef.current;
        buf.push(ts - lastFrameRef.current);
        if (buf.length > FRAME_BUFFER_MAX) buf.shift();
        if (!degradedRef.current && isFrameDegraded(buf)) {
          degradedRef.current = true;
          sessionDegraded = true;
          lastFrameRef.current = null;
          evaluate(); // mode → 'static'
          return;
        }
      }
      lastFrameRef.current = ts;
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      active = false;
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      lastFrameRef.current = null;
    };
  }, [decision.visible, decision.mode, evaluate]);

  // 언마운트 시 전면 해제 (P-31, nfr §13.3)
  useEffect(
    () => () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    },
    [],
  );

  const notifyRenderFailed = useCallback(() => {
    if (renderFailedRef.current) return;
    renderFailedRef.current = true;
    evaluate();
  }, [evaluate]);

  return {
    visible: decision.visible,
    mode: decision.mode,
    showTimeoutHint: decision.showTimeoutHint,
    notifyRenderFailed,
  };
}
