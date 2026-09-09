/**
 * 브랜드 로딩 인디케이터 — 오리 순환 활동 목록·순서·타이밍 + 오리 도형 상수 (F-17).
 * 대응: nfr.md v1.5 §9 V-28 (활동 순환), logic.md v1.7 §16.9.4, plan.md v1.2 AC-30 / P-23.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ACTIVITIES,
  ACTIVITY_CROSSFADE_MS,
  ACTIVITY_VISIBLE_MS,
  DEFAULT_SEQUENCE,
  MAX_ACTIVITIES,
  MIN_ACTIVITIES,
  SEARCH_SEQUENCE,
  STATIC_FALLBACK_ACTIVITY,
  activitySequence,
  loopDurationMs,
  type ActivityId,
} from '../../src/app/components/duck/activities.ts';
import {
  DUCK_COLORS,
  DUCK_PATHS,
  DUCK_SIZE_FULLSCREEN,
  DUCK_SIZE_INLINE,
  DUCK_VIEWBOX,
} from '../../src/app/components/duck/duckGeometry.ts';

// ---------- V-28: 활동 순환 ----------

test('V-28: 기본 순환 = 4활동 정확한 순서 (P-23 범위 3~5)', () => {
  assert.deepEqual(activitySequence(), ['checkList', 'flipCalendar', 'ringBell', 'checkDone']);
  assert.deepEqual([...DEFAULT_SEQUENCE], ['checkList', 'flipCalendar', 'ringBell', 'checkDone']);
  assert.ok(DEFAULT_SEQUENCE.length >= MIN_ACTIVITIES && DEFAULT_SEQUENCE.length <= MAX_ACTIVITIES);
});

test('V-28: Search 변형은 5활동이고 첫 활동이 search', () => {
  const seq = activitySequence('search');
  assert.deepEqual(seq, ['search', 'checkList', 'flipCalendar', 'ringBell', 'checkDone']);
  assert.equal(seq[0], 'search');
  assert.deepEqual(seq, [...SEARCH_SEQUENCE]);
  assert.ok(seq.length <= MAX_ACTIVITIES);
});

test('V-28: startActivity 가 기본 순환에 있으면 그 활동을 첫 활동으로 회전', () => {
  assert.deepEqual(activitySequence('ringBell'), ['ringBell', 'checkDone', 'checkList', 'flipCalendar']);
});

test('V-28: sequence override 길이 3~5는 그대로 사용, 3 미만은 무시', () => {
  assert.deepEqual(activitySequence(undefined, ['checkDone', 'search', 'ringBell']), [
    'checkDone',
    'search',
    'ringBell',
  ]);
  // 2개 → 무시하고 기본값
  assert.deepEqual(activitySequence(undefined, ['checkDone', 'search']), [...DEFAULT_SEQUENCE]);
});

test('V-28: sequence override 5 초과는 앞 5개로 clamp (P-23)', () => {
  const long: ActivityId[] = [
    'search',
    'checkList',
    'flipCalendar',
    'ringBell',
    'checkDone',
    'checkList',
    'search',
  ];
  const seq = activitySequence(undefined, long);
  assert.equal(seq.length, MAX_ACTIVITIES);
  assert.deepEqual(seq, ['search', 'checkList', 'flipCalendar', 'ringBell', 'checkDone']);
});

test('V-28: override + startActivity 는 override 안에서 회전', () => {
  assert.deepEqual(
    activitySequence('ringBell', ['checkList', 'ringBell', 'search', 'checkDone']),
    ['ringBell', 'search', 'checkDone', 'checkList'],
  );
});

test('V-28: 결과 활동은 모두 ACTIVITIES 에 정의돼 있다', () => {
  for (const id of activitySequence('search')) {
    assert.ok(ACTIVITIES[id], `정의 누락: ${id}`);
    assert.equal(ACTIVITIES[id].id, id);
    assert.equal(typeof ACTIVITIES[id].caption, 'string');
  }
});

// ---------- V-28: 타이밍 상수 (D-06(2)) ----------

test('V-28: 활동 노출 2500ms / 크로스페이드 300ms / 기본 1루프 10s', () => {
  assert.equal(ACTIVITY_VISIBLE_MS, 2_500);
  assert.equal(ACTIVITY_CROSSFADE_MS, 300);
  assert.equal(loopDurationMs(DEFAULT_SEQUENCE), 10_000);
  assert.equal(loopDurationMs(SEARCH_SEQUENCE), 12_500);
});

test('V-28: 정적 폴백 대표 활동은 "일정 확인"(checkList)', () => {
  assert.equal(STATIC_FALLBACK_ACTIVITY, 'checkList');
});

// ---------- V-28 보조: 오리 도형 상수 (단일 출처) ----------

test('V-28 보조: duckGeometry 상수 형식 검증', () => {
  assert.match(DUCK_VIEWBOX, /^0 0 \d+ \d+$/);
  for (const [k, d] of Object.entries(DUCK_PATHS)) {
    assert.equal(typeof d, 'string', `${k} path 는 문자열`);
    assert.match(d, /^M/, `${k} path 는 M 명령으로 시작`);
  }
  for (const [k, c] of Object.entries(DUCK_COLORS)) {
    assert.match(c, /^#[0-9A-Fa-f]{6}$/, `${k} 색상은 #RRGGBB`);
  }
  assert.ok(DUCK_SIZE_INLINE < DUCK_SIZE_FULLSCREEN);
  assert.equal(DUCK_SIZE_INLINE, 72);
  assert.equal(DUCK_SIZE_FULLSCREEN, 160);
});
