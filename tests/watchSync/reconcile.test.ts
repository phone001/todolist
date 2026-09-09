/**
 * V-38: 워치 완료 토글 LWW `resolveToggleLWW` (순수).
 * 대응: document/architect/nfr.md §9 V-38, logic §17.6, E-19-3, P-38, AC-50.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveToggleLWW } from '../../src/core/watchSync/reconcile.ts';
import type { Schedule } from '../../src/core/domain/types.ts';
import type { WatchToggleOp } from '../../src/core/watchSync/types.ts';

const BASE = 1_700_000_000_000;

function makeSchedule(over: Partial<Schedule> = {}): Schedule {
  return {
    id: 1,
    title: 'x',
    memo: null,
    categoryId: 1,
    priority: 'NORMAL',
    startAt: BASE,
    endAt: null,
    timeZone: 'UTC',
    isAllDay: false,
    isDone: false,
    doneAt: null,
    recurrenceRule: null,
    recurrenceEndAt: null,
    recurrenceCount: null,
    recurrenceParentId: null,
    source: 'LOCAL',
    notifyAtStart: true,
    createdAt: BASE,
    updatedAt: BASE,
    deletedAt: null,
    ...over,
  };
}

function makeOp(over: Partial<WatchToggleOp> = {}): WatchToggleOp {
  return {
    opId: '11111111-1111-4111-8111-111111111111',
    scheduleId: 1,
    done: true,
    watchChangedAt: BASE,
    baseUpdatedAt: BASE,
    ...over,
  };
}

test('V-38: 폰이 스냅샷 이후 미변경(updatedAt <= baseUpdatedAt) → APPLY', () => {
  const schedule = makeSchedule({ updatedAt: BASE });
  const op = makeOp({ baseUpdatedAt: BASE, watchChangedAt: BASE - 5_000 });
  assert.equal(resolveToggleLWW(op, schedule), 'APPLY');
});

test('V-38: 폰이 이후 변경 & 워치가 더 나중(watchChangedAt > updatedAt) → APPLY', () => {
  const schedule = makeSchedule({ updatedAt: BASE + 10_000 });
  const op = makeOp({ baseUpdatedAt: BASE, watchChangedAt: BASE + 20_000 });
  assert.equal(resolveToggleLWW(op, schedule), 'APPLY');
});

test('V-38 / AC-50: 폰이 이후 변경 & 워치가 더 이름(watchChangedAt < updatedAt) → SKIP_PHONE_WINS', () => {
  const schedule = makeSchedule({ updatedAt: BASE + 30_000 });
  const op = makeOp({ baseUpdatedAt: BASE, watchChangedAt: BASE + 10_000 });
  assert.equal(resolveToggleLWW(op, schedule), 'SKIP_PHONE_WINS');
});

test('V-38: 동시(watchChangedAt === updatedAt, 폰이 이후 변경) → 폰 우선(SKIP_PHONE_WINS), 결정적', () => {
  const schedule = makeSchedule({ updatedAt: BASE + 15_000 });
  const op = makeOp({ baseUpdatedAt: BASE, watchChangedAt: BASE + 15_000 });
  assert.equal(resolveToggleLWW(op, schedule), 'SKIP_PHONE_WINS');
});

test('V-38: soft-deleted 일정 → REJECT_NOT_FOUND', () => {
  const schedule = makeSchedule({ deletedAt: BASE + 1_000 });
  const op = makeOp({ baseUpdatedAt: BASE + 5_000, watchChangedAt: BASE + 9_999 });
  assert.equal(resolveToggleLWW(op, schedule), 'REJECT_NOT_FOUND');
});
