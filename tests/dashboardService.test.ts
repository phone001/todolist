import test from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../src/core/app.ts';
import { FixedClock } from '../src/core/domain/clock.ts';

const NOON = Date.UTC(2026, 8, 4, 12, 0, 0);

test('V-1: 집계 정확성 (총계/완료/미완료)', async () => {
  const clock = new FixedClock(NOON, 'UTC');
  const app = buildApp({ clock });
  await app.schedules.create({ title: 'a', startAt: Date.UTC(2026, 8, 4, 13), notifyAtStart: false });
  await app.schedules.create({ title: 'b', startAt: Date.UTC(2026, 8, 4, 14), notifyAtStart: false });
  const c = await app.schedules.create({ title: 'c', startAt: Date.UTC(2026, 8, 4, 15), notifyAtStart: false });
  await app.schedules.toggleDone(c.id, true);

  const s = await app.dashboard.getSummary();
  assert.deepEqual([s.total, s.done, s.notDone, s.completionRate, s.empty], [3, 1, 2, 33, false]);
});

test('V-2 / AC-15: 금일 일정 0건이면 완료율 0%, empty=true', async () => {
  const clock = new FixedClock(NOON, 'UTC');
  const app = buildApp({ clock });
  const s = await app.dashboard.getSummary();
  assert.deepEqual([s.total, s.completionRate, s.empty, s.nextScheduleId], [0, 0, true, null]);
});

test('V-3 / AC-16: 자정 경과 시 기준 날짜가 다음 날로 바뀐다', async () => {
  const clock = new FixedClock(Date.UTC(2026, 8, 4, 23, 30, 0), 'UTC');
  const app = buildApp({ clock });
  await app.schedules.create({ title: 'day4', startAt: Date.UTC(2026, 8, 4, 23, 45), notifyAtStart: false });
  await app.schedules.create({ title: 'day5', startAt: Date.UTC(2026, 8, 5, 0, 30), notifyAtStart: false });

  let s = await app.dashboard.getSummary();
  assert.equal(s.total, 1);
  assert.equal(s.date, Date.UTC(2026, 8, 4, 0, 0, 0));

  clock.set(Date.UTC(2026, 8, 5, 0, 10, 0)); // 자정 경과
  s = await app.dashboard.getSummary();
  assert.equal(s.total, 1);
  assert.equal(s.date, Date.UTC(2026, 8, 5, 0, 0, 0));
});

test('다음 예정 일정 id 를 반환 (미완료, 현재 이후)', async () => {
  const clock = new FixedClock(NOON, 'UTC');
  const app = buildApp({ clock });
  const later = await app.schedules.create({ title: 'later', startAt: Date.UTC(2026, 8, 4, 18), notifyAtStart: false });
  await app.schedules.create({ title: 'past', startAt: Date.UTC(2026, 8, 4, 8), notifyAtStart: false });
  const s = await app.dashboard.getSummary();
  assert.equal(s.nextScheduleId, later.id);
});

test('P-07: 완료율은 반올림 정수', async () => {
  const clock = new FixedClock(NOON, 'UTC');
  const app = buildApp({ clock });
  for (let i = 0; i < 3; i += 1) {
    const r = await app.schedules.create({ title: `x${i}`, startAt: Date.UTC(2026, 8, 4, 13 + i), notifyAtStart: false });
    if (i === 0) await app.schedules.toggleDone(r.id, true);
  }
  const s = await app.dashboard.getSummary();
  assert.equal(s.completionRate, 33); // 1/3 -> 33
});
