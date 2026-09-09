/**
 * 브랜드 로딩 인디케이터 표시 FSM + 프레임 저하 판정 (F-17).
 * 대응: nfr.md v1.5 §9 V-27 (표시 FSM), V-29 (저사양·절전 강등 판정),
 *       logic.md v1.7 §16.9.3 / §16.9.6, plan.md v1.2 AC-31/32/33/38.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DELAY_MS,
  MIN_DISPLAY_MS,
  TIMEOUT_HINT_MS,
  evaluateLoading,
  isFrameDegraded,
  nextEvaluationDelay,
  resolveMode,
  type LoadingSnapshot,
} from '../../src/app/components/loadingIndicatorMachine.ts';

function snap(over: Partial<LoadingSnapshot>): LoadingSnapshot {
  return {
    loadingStartedAt: 0,
    loadingEndedAt: null,
    endReason: 'success',
    now: 0,
    reduceMotion: false,
    degraded: false,
    renderFailed: false,
    shownAt: null,
    ...over,
  };
}

// ---------- V-27: 표시 지연(delay) ----------

test('V-27: 표시 지연 임계 이내에는 visible=false (AC-32)', () => {
  const d = evaluateLoading(snap({ loadingStartedAt: 0, now: DELAY_MS - 1 }));
  assert.equal(d.visible, false);
  assert.equal(d.markShownNow, false);
});

test('V-27: 표시 지연 임계 경과 + 로딩 지속 → visible=true, markShownNow=true', () => {
  const d = evaluateLoading(snap({ loadingStartedAt: 0, now: DELAY_MS }));
  assert.equal(d.visible, true);
  assert.equal(d.markShownNow, true);
});

test('V-27: 지연 임계 내 로딩 종료 → 한 번도 표시되지 않음 (E-17-3, AC-32)', () => {
  const d = evaluateLoading(
    snap({ loadingStartedAt: 0, loadingEndedAt: DELAY_MS - 50, now: DELAY_MS + 500, shownAt: null }),
  );
  assert.equal(d.visible, false);
});

// ---------- V-27: 최소 표시 시간(min-display) ----------

test('V-27: 표시 후 성공 종료라도 최소 표시 시간 동안 유지 (AC-31)', () => {
  const d = evaluateLoading(
    snap({
      loadingStartedAt: 0,
      shownAt: 1_000,
      loadingEndedAt: 1_100,
      endReason: 'success',
      now: 1_000 + MIN_DISPLAY_MS - 1,
    }),
  );
  assert.equal(d.visible, true);
});

test('V-27: 최소 표시 시간 경과 후 성공 종료 → visible=false (AC-35)', () => {
  const d = evaluateLoading(
    snap({
      loadingStartedAt: 0,
      shownAt: 1_000,
      loadingEndedAt: 1_100,
      endReason: 'success',
      now: 1_000 + MIN_DISPLAY_MS,
    }),
  );
  assert.equal(d.visible, false);
});

test('V-27: 에러 종료는 최소 표시 시간 무시하고 즉시 제거 (AC-38, E-17-7)', () => {
  const d = evaluateLoading(
    snap({
      loadingStartedAt: 0,
      shownAt: 1_000,
      loadingEndedAt: 1_050,
      endReason: 'error',
      now: 1_060,
    }),
  );
  assert.equal(d.visible, false);
});

// ---------- V-27: 타임아웃 보조안내 ----------

test('V-27: 표시 후 10s 초과 + 로딩 지속 → showTimeoutHint=true, 계속 visible', () => {
  const d = evaluateLoading(
    snap({ loadingStartedAt: 0, shownAt: 0, loadingEndedAt: null, now: TIMEOUT_HINT_MS }),
  );
  assert.equal(d.visible, true);
  assert.equal(d.showTimeoutHint, true);
});

test('V-27: 10s 이전에는 showTimeoutHint=false', () => {
  const d = evaluateLoading(
    snap({ loadingStartedAt: 0, shownAt: 0, loadingEndedAt: null, now: TIMEOUT_HINT_MS - 1 }),
  );
  assert.equal(d.showTimeoutHint, false);
});

// ---------- V-27: 모드 우선순위 ----------

test('V-27: 모드 우선순위 renderFailed > reduceMotion|degraded > animation', () => {
  assert.equal(resolveMode({ renderFailed: true, reduceMotion: true, degraded: true }), 'spinner');
  assert.equal(resolveMode({ renderFailed: false, reduceMotion: true, degraded: false }), 'static');
  assert.equal(resolveMode({ renderFailed: false, reduceMotion: false, degraded: true }), 'static');
  assert.equal(resolveMode({ renderFailed: false, reduceMotion: false, degraded: false }), 'animation');
});

test('V-27: 로딩 미시작이면 항상 숨김', () => {
  assert.equal(evaluateLoading(snap({ loadingStartedAt: null, now: 9_999 })).visible, false);
});

// ---------- V-27: nextEvaluationDelay ----------

test('V-27: nextEvaluationDelay — 표시 전이면 지연 임계 도달까지', () => {
  assert.equal(nextEvaluationDelay(snap({ loadingStartedAt: 0, now: 50, shownAt: null })), DELAY_MS - 50);
});

test('V-27: nextEvaluationDelay — 표시 후 로딩 지속이면 타임아웃까지', () => {
  assert.equal(
    nextEvaluationDelay(snap({ loadingStartedAt: 0, shownAt: 0, loadingEndedAt: null, now: 100 })),
    TIMEOUT_HINT_MS - 100,
  );
});

test('V-27: nextEvaluationDelay — 성공 종료 대기 중이면 최소표시 만료가 더 이르다', () => {
  assert.equal(
    nextEvaluationDelay(
      snap({ loadingStartedAt: 0, shownAt: 0, loadingEndedAt: 200, endReason: 'success', now: 300 }),
    ),
    MIN_DISPLAY_MS - 300,
  );
});

test('V-27: nextEvaluationDelay — 표시 전 이미 종료면 재평가 불필요(null)', () => {
  assert.equal(
    nextEvaluationDelay(snap({ loadingStartedAt: 0, loadingEndedAt: 100, now: 200, shownAt: null })),
    null,
  );
});

// ---------- V-29: 프레임 저하 판정 ----------

test('V-29: 빈 샘플 / 정상 프레임 간격은 저하 아님', () => {
  assert.equal(isFrameDegraded([]), false);
  assert.equal(isFrameDegraded(new Array(40).fill(16)), false);
  assert.equal(isFrameDegraded(new Array(40).fill(27)), false);
});

test('V-29: 최근 1s 창 평균 간격 > 28ms → 저하 (≈지속 <36fps)', () => {
  assert.equal(isFrameDegraded(new Array(40).fill(30)), true);
});

test('V-29: 연속 5프레임 초과(> 50ms) → 저하 (평균이 정상이어도)', () => {
  const samples = [10, 10, 10, 60, 60, 60, 60, 60, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10];
  assert.equal(isFrameDegraded(samples), true);
});

test('V-29: 연속 4프레임만 초과면 그 규칙으로는 저하 아님', () => {
  assert.equal(isFrameDegraded([10, 10, 60, 60, 60, 60, 10, 10, 10, 10, 10, 10]), false);
});

test('V-29: 산발적 스파이크(연속 아님) + 평균 정상 → 저하 아님', () => {
  assert.equal(isFrameDegraded([16, 16, 16, 16, 60, 16, 16, 16, 16, 16]), false);
});

test('V-29: 스톨/백그라운드 단발 거대 간격은 평균 창에서 제외', () => {
  assert.equal(isFrameDegraded([5_000, 16, 16, 16, 16, 16, 16]), false);
});

test('V-29: 순수 함수 — 입력만으로 결정, 입력 불변', () => {
  const input = [30, 30, 30, 30, 30, 30];
  assert.equal(isFrameDegraded(input), isFrameDegraded(input));
  assert.deepEqual(input, [30, 30, 30, 30, 30, 30]);
});
