import test from 'node:test';
import assert from 'node:assert/strict';
import {
  startOfLocalDay,
  endOfLocalDayExclusive,
  advanceByRule,
  combineDateWithTimeOfDay,
  localWallToEpoch,
  DAY_MS,
} from '../src/core/domain/time.ts';

test('V-3: UTC 자정 계산', () => {
  const noonUtc = Date.UTC(2026, 8, 4, 12, 0, 0);
  assert.equal(startOfLocalDay(noonUtc, 'UTC'), Date.UTC(2026, 8, 4, 0, 0, 0));
});

test('V-3: Asia/Seoul(UTC+9) 자정은 전날 15:00 UTC', () => {
  // 2026-09-04 02:00 UTC == 2026-09-04 11:00 KST → 로컬 날짜는 9/4, 자정 = 9/3 15:00 UTC
  const ts = Date.UTC(2026, 8, 4, 2, 0, 0);
  assert.equal(startOfLocalDay(ts, 'Asia/Seoul'), Date.UTC(2026, 8, 3, 15, 0, 0));
});

test('V-3: Asia/Seoul 기준 9/3 23:00 UTC(= 9/4 08:00 KST)의 로컬 날짜는 9/4', () => {
  const ts = Date.UTC(2026, 8, 3, 23, 0, 0);
  assert.equal(startOfLocalDay(ts, 'Asia/Seoul'), Date.UTC(2026, 8, 3, 15, 0, 0));
});

test('AC-16: 자정 직전/직후로 날짜 경계가 바뀐다 (UTC)', () => {
  const beforeMidnight = Date.UTC(2026, 8, 4, 23, 59, 59);
  const afterMidnight = Date.UTC(2026, 8, 5, 0, 0, 1);
  assert.equal(startOfLocalDay(beforeMidnight, 'UTC'), Date.UTC(2026, 8, 4, 0, 0, 0));
  assert.equal(startOfLocalDay(afterMidnight, 'UTC'), Date.UTC(2026, 8, 5, 0, 0, 0));
});

test('endOfLocalDayExclusive = startOfLocalDay + 24h', () => {
  const ts = Date.UTC(2026, 8, 4, 8, 0, 0);
  assert.equal(endOfLocalDayExclusive(ts, 'UTC'), startOfLocalDay(ts, 'UTC') + DAY_MS);
});

test('advanceByRule DAILY/WEEKLY', () => {
  const t = Date.UTC(2026, 8, 4, 10, 0, 0);
  assert.equal(advanceByRule(t, 'DAILY', 'UTC'), t + DAY_MS);
  assert.equal(advanceByRule(t, 'WEEKLY', 'UTC'), t + 7 * DAY_MS);
});

test('advanceByRule MONTHLY 는 달 경계와 말일을 클램프한다', () => {
  const jan31 = Date.UTC(2026, 0, 31, 9, 0, 0);
  // 2월은 28일(2026 비윤년) → 2/28로 클램프
  assert.equal(advanceByRule(jan31, 'MONTHLY', 'UTC'), Date.UTC(2026, 1, 28, 9, 0, 0));
});

test('advanceByRule YEARLY', () => {
  const t = Date.UTC(2026, 8, 4, 10, 0, 0);
  assert.equal(advanceByRule(t, 'YEARLY', 'UTC'), Date.UTC(2027, 8, 4, 10, 0, 0));
});

// ---------- V-26: localWallToEpoch ----------

test('V-26: UTC 기준 wall-clock → epoch ms 왕복', () => {
  // 2026-09-06 09:30 UTC
  const expected = Date.UTC(2026, 8, 6, 9, 30, 0);
  assert.equal(localWallToEpoch(2026, 9, 6, 9, 30, 'UTC'), expected);
});

test('V-26: Asia/Seoul(UTC+9) wall-clock → epoch ms', () => {
  // 2026-09-06 09:30 KST = 2026-09-06 00:30 UTC
  const expected = Date.UTC(2026, 8, 6, 0, 30, 0);
  assert.equal(localWallToEpoch(2026, 9, 6, 9, 30, 'Asia/Seoul'), expected);
});

test('V-26: 자정(00:00) wall-clock → epoch ms (UTC)', () => {
  const expected = Date.UTC(2026, 8, 6, 0, 0, 0);
  assert.equal(localWallToEpoch(2026, 9, 6, 0, 0, 'UTC'), expected);
});

test('V-26: 월말(31일) 정규화 — Date.UTC 자동 정규화 위임', () => {
  // 4월 31일 → 5월 1일로 정규화됨
  const via = localWallToEpoch(2026, 4, 31, 0, 0, 'UTC');
  const expected = Date.UTC(2026, 4, 1, 0, 0, 0); // May 1
  assert.equal(via, expected);
});

test('V-26: 다른 타임존(America/New_York, UTC-4 EDT)에서 wall-clock 변환', () => {
  // 2026-09-06 09:00 EDT(UTC-4) = 2026-09-06 13:00 UTC
  const expected = Date.UTC(2026, 8, 6, 13, 0, 0);
  assert.equal(localWallToEpoch(2026, 9, 6, 9, 0, 'America/New_York'), expected);
});

// ---------- F-26(v1.9): combineDateWithTimeOfDay ----------

test('F-26: combineDateWithTimeOfDay — 날짜(자정) + 현재 시각(시/분) 결합 (UTC)', () => {
  const dateTs = Date.UTC(2026, 8, 20, 0, 0, 0); // 9/20 자정
  const timeOfDayTs = Date.UTC(2026, 8, 4, 14, 37, 22); // 임의의 날, 14:37:22
  const combined = combineDateWithTimeOfDay(dateTs, timeOfDayTs, 'UTC');
  assert.equal(combined, Date.UTC(2026, 8, 20, 14, 37, 0));
});

test('F-26: combineDateWithTimeOfDay — 날짜/시각이 다른 타임존이어도 그 타임존 성분을 조합', () => {
  // 선택 날짜(로컬 자정, KST) = 2026-09-20 00:00 KST
  const dateTs = Date.UTC(2026, 8, 19, 15, 0, 0); // 9/20 00:00 KST
  // 현재 시각(KST) = 2026-09-04 09:05 KST = 2026-09-04 00:05 UTC
  const timeOfDayTs = Date.UTC(2026, 8, 4, 0, 5, 0);
  const combined = combineDateWithTimeOfDay(dateTs, timeOfDayTs, 'Asia/Seoul');
  // 기대: 2026-09-20 09:05 KST = 2026-09-20 00:05 UTC
  assert.equal(combined, Date.UTC(2026, 8, 20, 0, 5, 0));
});

test('F-26: combineDateWithTimeOfDay — 동일 시각을 두 인자로 넣으면 그대로 반환', () => {
  const ts = Date.UTC(2026, 8, 4, 9, 30, 0);
  assert.equal(combineDateWithTimeOfDay(ts, ts, 'UTC'), Date.UTC(2026, 8, 4, 9, 30, 0));
});
