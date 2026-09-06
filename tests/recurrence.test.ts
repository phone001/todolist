import test from 'node:test';
import assert from 'node:assert/strict';
import { expandOccurrences } from '../src/core/domain/recurrence.ts';

const nonRecurring = {
  startAt: Date.UTC(2026, 8, 4, 10, 0, 0),
  endAt: null,
  timeZone: 'UTC',
  recurrenceRule: null,
  recurrenceEndAt: null,
  recurrenceCount: null,
} as const;

test('비반복: 구간과 겹치면 시작시각 1건', () => {
  const occ = expandOccurrences(
    nonRecurring,
    Date.UTC(2026, 8, 4, 0, 0, 0),
    Date.UTC(2026, 8, 5, 0, 0, 0),
  );
  assert.deepEqual(occ, [nonRecurring.startAt]);
});

test('비반복: 구간 밖이면 없음', () => {
  const occ = expandOccurrences(
    nonRecurring,
    Date.UTC(2026, 8, 10, 0, 0, 0),
    Date.UTC(2026, 8, 11, 0, 0, 0),
  );
  assert.deepEqual(occ, []);
});

test('DAILY 반복: 7일 구간에서 7건, count 로 상한', () => {
  const daily = { ...nonRecurring, recurrenceRule: 'DAILY' as const, recurrenceCount: 5 };
  const occ = expandOccurrences(
    daily,
    Date.UTC(2026, 8, 1, 0, 0, 0),
    Date.UTC(2026, 8, 30, 0, 0, 0),
  );
  assert.equal(occ.length, 5);
  assert.equal(occ[0], daily.startAt);
});

test('WEEKLY 반복: recurrenceEndAt 로 상한', () => {
  const weekly = {
    ...nonRecurring,
    recurrenceRule: 'WEEKLY' as const,
    recurrenceEndAt: Date.UTC(2026, 8, 25, 0, 0, 0),
  };
  const occ = expandOccurrences(
    weekly,
    Date.UTC(2026, 8, 1, 0, 0, 0),
    Date.UTC(2026, 11, 1, 0, 0, 0),
  );
  // 9/4, 9/11, 9/18 (9/25 10:00 > endAt 9/25 00:00 이므로 제외)
  assert.deepEqual(occ, [
    Date.UTC(2026, 8, 4, 10, 0, 0),
    Date.UTC(2026, 8, 11, 10, 0, 0),
    Date.UTC(2026, 8, 18, 10, 0, 0),
  ]);
});

test('구간 앞부분은 건너뛰고 겹치는 발생만 반환', () => {
  const daily = { ...nonRecurring, recurrenceRule: 'DAILY' as const };
  const occ = expandOccurrences(
    daily,
    Date.UTC(2026, 8, 6, 0, 0, 0),
    Date.UTC(2026, 8, 8, 0, 0, 0),
  );
  assert.deepEqual(occ, [Date.UTC(2026, 8, 6, 10, 0, 0), Date.UTC(2026, 8, 7, 10, 0, 0)]);
});

test('cap 으로 무한 전개를 방지', () => {
  const daily = { ...nonRecurring, recurrenceRule: 'DAILY' as const };
  const occ = expandOccurrences(
    daily,
    Date.UTC(2026, 8, 1, 0, 0, 0),
    Date.UTC(2030, 0, 1, 0, 0, 0),
    10,
  );
  assert.equal(occ.length, 10);
});
