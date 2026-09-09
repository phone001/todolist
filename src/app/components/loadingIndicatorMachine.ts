/**
 * 브랜드 로딩 인디케이터 — 표시 상태 순수 FSM (React 비의존).
 * 설계 근거: document/architect/logic.md v1.7 §16.9.3 (지연/최소표시/타임아웃),
 *           §16.9.6 (저사양·절전 강등 판정), nfr.md v1.5 §13.2.
 *
 * 이 모듈은 react / react-native 을 import 하지 않는다 (core tsc 빌드 포함 대상).
 * 입력 스냅샷 → 출력 스냅샷의 순수 함수만 노출한다. 타이머·rAF·AccessibilityInfo 배선은
 * useLoadingIndicator.native.ts 훅이 담당하고, 판정은 전부 이 파일로 위임한다 (V-27 / V-29).
 */

/** 표시 지연(delay) 임계값 — 이 시간 내 로딩이 끝나면 인디케이터를 표시하지 않는다 (P-24, AC-32). */
export const DELAY_MS = 200;
/** 최소 표시 시간 — 일단 표시되면 성공 종료라도 이 시간까지 유지 (P-26, AC-31). */
export const MIN_DISPLAY_MS = 600;
/** 타임아웃 보조안내 임계값 — 표시 후 이 시간 초과 시 보조 문구/재시도·취소 노출 (P-28, E-17-4). */
export const TIMEOUT_HINT_MS = 10_000;
/** 활동당 노출 시간 (§16.9.3, D-06(2)). */
export const ACTIVITY_VISIBLE_MS = 2_500;
/** 활동 간 크로스페이드 시간 — 급격한 점프 방지 (R-17-3, P-25). */
export const ACTIVITY_CROSSFADE_MS = 300;

/** 프레임 저하 판정: 최근 1s 창 평균 간격 임계값 (ms) (nfr §13.2). */
export const FRAME_AVG_DEGRADED_MS = 28;
/** 프레임 저하 판정: 연속 프레임 초과 임계값 (ms) (nfr §13.2). */
export const FRAME_SPIKE_MS = 50;
/** 프레임 저하 판정: 연속 스파이크 프레임 수 (nfr §13.2). */
export const FRAME_SPIKE_RUN = 5;
/** 평균 판정에서 렌더 프레임으로 보지 않고 무시하는 간격(스톨/백그라운드 갭) 상한 (ms). */
const FRAME_STALL_MS = 250;

export type LoadingMode = 'animation' | 'static' | 'spinner';
export type LoadingEndReason = 'success' | 'error';

export interface LoadingSnapshot {
  /** 로딩 시작 시각(epoch ms). null 이면 로딩 미시작. */
  loadingStartedAt: number | null;
  /** 로딩 종료 시각(epoch ms). null 이면 로딩 진행 중. */
  loadingEndedAt: number | null;
  /** 종료 사유. 'error' 면 최소표시 무시 즉시 제거 (E-17-7, AC-38). */
  endReason: LoadingEndReason;
  /** 현재 평가 시각(epoch ms). */
  now: number;
  /** OS "동작 줄이기" 활성 (E-17-1, AC-33). */
  reduceMotion: boolean;
  /** 세션 스코프 프레임 저하 플래그(단방향) (E-17-5). */
  degraded: boolean;
  /** SVG/정적 폴백 렌더 실패 → OS 스피너 (E-17-2, AC-34). */
  renderFailed: boolean;
  /** 인디케이터가 처음 visible 된 시각(epoch ms). 훅이 상승 에지에서 기록. */
  shownAt: number | null;
}

export interface LoadingDecision {
  /** 실제 표시 여부(지연/최소표시/타임아웃 게이트 적용 결과). */
  visible: boolean;
  /** 렌더 모드 우선순위: renderFailed > (reduceMotion|degraded) > animation. */
  mode: LoadingMode;
  /** 타임아웃 보조 문구·재시도/취소 노출 여부. */
  showTimeoutHint: boolean;
  /** 이번 평가에서 visible 로 상승했으니 훅이 shownAt=now 를 기록해야 함. */
  markShownNow: boolean;
}

/** 모드 우선순위 판정 (§16.9.3 "모드 우선순위" 행). */
export function resolveMode(
  s: Pick<LoadingSnapshot, 'renderFailed' | 'reduceMotion' | 'degraded'>,
): LoadingMode {
  if (s.renderFailed) return 'spinner';
  if (s.reduceMotion || s.degraded) return 'static';
  return 'animation';
}

/**
 * 표시 FSM — 입력 스냅샷 → 표시 결정. 순수 함수(부작용 없음).
 * 규칙 표: logic.md §16.9.3.
 */
export function evaluateLoading(s: LoadingSnapshot): LoadingDecision {
  const mode = resolveMode(s);
  const hidden: LoadingDecision = { visible: false, mode, showTimeoutHint: false, markShownNow: false };

  if (s.loadingStartedAt === null) return hidden;

  const elapsed = s.now - s.loadingStartedAt;

  // 아직 한 번도 표시된 적 없음
  if (s.shownAt === null) {
    // 표시되기 전에 로딩이 끝났다 → 한 번도 visible 되지 않는다 (E-17-3, AC-32)
    if (s.loadingEndedAt !== null) return hidden;
    // 표시 지연 임계 이내 → 아직 숨김 (P-24)
    if (elapsed < DELAY_MS) return hidden;
    // 지연 임계 경과 + 여전히 로딩 중 → 지금 표시 (상승 에지)
    return { visible: true, mode, showTimeoutHint: false, markShownNow: true };
  }

  // 이미 표시된 상태
  const shownFor = s.now - s.shownAt;
  const timeoutHint = shownFor >= TIMEOUT_HINT_MS;

  if (s.loadingEndedAt === null) {
    // 여전히 로딩 중 → 유지 (타임아웃 초과 시 보조안내)
    return { visible: true, mode, showTimeoutHint: timeoutHint, markShownNow: false };
  }

  // 로딩 종료됨
  if (s.endReason === 'error') {
    // 최소표시 무시, 즉시 제거 (E-17-7, AC-38)
    return hidden;
  }

  // 성공 종료 → 최소 표시 시간 보장 (P-26, AC-31)
  if (shownFor < MIN_DISPLAY_MS) {
    return { visible: true, mode, showTimeoutHint: timeoutHint, markShownNow: false };
  }
  return hidden;
}

/**
 * 다음 재평가까지 남은 시간(ms). 훅이 이 값으로 setTimeout 을 건다.
 * null 이면 시간 기반 재평가가 필요 없음(외부 이벤트 대기).
 */
export function nextEvaluationDelay(s: LoadingSnapshot): number | null {
  if (s.loadingStartedAt === null) return null;

  const candidates: number[] = [];

  if (s.shownAt === null) {
    if (s.loadingEndedAt !== null) return null;
    // 지연 임계 도달까지
    candidates.push(s.loadingStartedAt + DELAY_MS - s.now);
  } else {
    // 타임아웃 보조안내 도달까지
    const untilTimeout = s.shownAt + TIMEOUT_HINT_MS - s.now;
    if (untilTimeout > 0) candidates.push(untilTimeout);
    // 성공 종료 대기 중이면 최소표시 만료까지
    if (s.loadingEndedAt !== null && s.endReason === 'success') {
      const untilMin = s.shownAt + MIN_DISPLAY_MS - s.now;
      if (untilMin > 0) candidates.push(untilMin);
    }
  }

  if (candidates.length === 0) return null;
  const positive = candidates.filter((c) => c > 0);
  if (positive.length === 0) return 0;
  return Math.max(0, Math.min(...positive));
}

/**
 * 프레임 저하 휴리스틱 (nfr §13.2, logic §16.9.6, V-29).
 * - 연속 `FRAME_SPIKE_RUN` 프레임이 `FRAME_SPIKE_MS` 초과 → 저하
 * - 최근 ~1s 창 평균 간격이 `FRAME_AVG_DEGRADED_MS` 초과 → 저하
 * 스톨/백그라운드로 인한 단발 거대 간격(> `FRAME_STALL_MS`)은 평균 창에서 제외한다.
 */
export function isFrameDegraded(intervalsMs: readonly number[]): boolean {
  let run = 0;
  for (const iv of intervalsMs) {
    if (iv > FRAME_SPIKE_MS) {
      run += 1;
      if (run >= FRAME_SPIKE_RUN) return true;
    } else {
      run = 0;
    }
  }

  let acc = 0;
  let count = 0;
  for (let i = intervalsMs.length - 1; i >= 0; i -= 1) {
    const iv = intervalsMs[i];
    if (iv > FRAME_STALL_MS) break; // 렌더 프레임이 아님(스톨/백그라운드) — 창 종료
    acc += iv;
    count += 1;
    if (acc >= 1_000) break;
  }
  return count >= FRAME_SPIKE_RUN && acc / count > FRAME_AVG_DEGRADED_MS;
}
