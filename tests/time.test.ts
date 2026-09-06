import test from 'node:test';
import assert from 'node:assert/strict';
import {
  startOfLocalDay,
  endOfLocalDayExclusive,
  advanceByRule,
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
