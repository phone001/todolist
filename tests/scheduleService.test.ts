import test from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../src/core/app.ts';
import { FixedClock } from '../src/core/domain/clock.ts';
import { ValidationError } from '../src/core/domain/errors.ts';

const NOW = Date.UTC(2026, 8, 4, 9, 0, 0);
const future = (h: number) => Date.UTC(2026, 8, 4, 9 + h, 0, 0);

function setup() {
  const clock = new FixedClock(NOW, 'UTC');
  return { clock, app: buildApp({ clock }) };
}

test('AC-01: 일정 생성 후 목록/대시보드에 나타나고 알림이 예약된다', async () => {
  const { app } = setup();
  const { id } = await app.schedules.create({
    title: '회의',
    startAt: future(2),
    reminderOffsets: [10],
    notifyAtStart: true,
  });
  assert.equal(id, 1);

  const page = await app.schedules.findInRange(future(0), future(24));
  assert.equal(page.items.length, 1);
  assert.equal(page.items[0].title, '회의');
  assert.equal(page.items[0].categoryId, 1); // E-06-1 기본 "기타"
  assert.equal(page.items[0].priority, 'NORMAL'); // E-07-1 기본

  // PRE(10분 전) + START = OS 예약 2건
  assert.equal(app.notifications.activeCount(), 2);
});

test('AC-02/AC-03: 검증 실패 시 ValidationError, 저장소 변경 없음', async () => {
  const { app } = setup();
  await assert.rejects(
    () => app.schedules.create({ title: '   ', startAt: future(1) }),
    ValidationError,
  );
  await assert.rejects(
    () => app.schedules.create({ title: '회의', startAt: future(2), endAt: future(1) }),
    ValidationError,
  );
  const page = await app.schedules.findInRange(0, Number.MAX_SAFE_INTEGER);
  assert.equal(page.items.length, 0);
});

test('E-01-4 / E-08-2: 과거 오프셋은 SKIPPED, 일정은 정상 저장', async () => {
  const { app } = setup();
  const { id } = await app.schedules.create({
    title: '곧 시작',
    startAt: NOW + 5 * 60_000, // 5분 뒤
    reminderOffsets: [10], // 10분 전 = 이미 과거
    notifyAtStart: false,
  });
  const reminders = await app.db.reminders.filter((r) => r.scheduleId === id);
  assert.equal(reminders.length, 1);
  assert.equal(reminders[0].state, 'SKIPPED');
  assert.equal(app.notifications.activeCount(), 0);
  const found = await app.schedules.findInRange(0, Number.MAX_SAFE_INTEGER);
  assert.equal(found.items.length, 1);
});

test('AC-04: 완료 토글이 대시보드 집계에 반영된다', async () => {
  const { app } = setup();
  const ids: number[] = [];
  for (let i = 0; i < 4; i += 1) {
    ids.push((await app.schedules.create({ title: `t${i}`, startAt: future(1 + i), notifyAtStart: false })).id);
  }
  await app.schedules.toggleDone(ids[0], true);
  let s = await app.dashboard.getSummary();
  assert.deepEqual([s.total, s.done, s.notDone, s.completionRate], [4, 1, 3, 25]);

  await app.schedules.toggleDone(ids[1], true);
  s = await app.dashboard.getSummary();
  assert.deepEqual([s.total, s.done, s.notDone, s.completionRate], [4, 2, 2, 50]);
});

test('AC-09: 시작 시각 변경 시 이전 OS 예약 취소 + 재예약', async () => {
  const { app } = setup();
  const { id } = await app.schedules.create({
    title: '이동 예정',
    startAt: future(5),
    reminderOffsets: [30],
    notifyAtStart: true,
  });
  const firstRequests = app.notifications.activeRequests().map((r) => r.at).sort();
  assert.equal(firstRequests.length, 2);
  const cancelledBefore = app.notifications.cancelledLog.length;

  await app.schedules.update(id, { startAt: future(8) });

  assert.ok(app.notifications.cancelledLog.length > cancelledBefore, '이전 예약이 취소되어야 한다');
  const secondRequests = app.notifications.activeRequests().map((r) => r.at).sort();
  assert.equal(secondRequests.length, 2);
  assert.notDeepEqual(firstRequests, secondRequests, '재예약된 시각이 달라야 한다');
});

test('AC-10: 삭제 시 일정과 모든 알림 예약이 제거된다', async () => {
  const { app } = setup();
  const { id } = await app.schedules.create({
    title: '삭제 대상',
    startAt: future(3),
    reminderOffsets: [5, 10],
    notifyAtStart: true,
  });
  assert.equal(app.notifications.activeCount(), 3);

  await app.schedules.softDelete(id);

  assert.equal(app.notifications.activeCount(), 0);
  assert.equal((await app.db.reminders.filter((r) => r.scheduleId === id)).length, 0);
  const page = await app.schedules.findInRange(0, Number.MAX_SAFE_INTEGER);
  assert.equal(page.items.length, 0);
});

test('P-05/P-06: 완료된 미래 일정도 수정 가능, 완료 상태 유지', async () => {
  const { app } = setup();
  const { id } = await app.schedules.create({ title: '미래', startAt: future(10), notifyAtStart: false });
  await app.schedules.toggleDone(id, true);
  const updated = await app.schedules.update(id, { startAt: future(12) });
  assert.equal(updated.isDone, true);
  assert.equal(updated.startAt, future(12));
});

test('AC-11: 카테고리 필터', async () => {
  const { app } = setup();
  const work = (await app.categories.create('업무')).id;
  const hobby = (await app.categories.create('취미')).id;
  for (let i = 0; i < 3; i += 1) {
    await app.schedules.create({ title: `w${i}`, startAt: future(1 + i), categoryId: work, notifyAtStart: false });
  }
  for (let i = 0; i < 2; i += 1) {
    await app.schedules.create({ title: `h${i}`, startAt: future(1 + i), categoryId: hobby, notifyAtStart: false });
  }
  const page = await app.schedules.findInRange(future(0), future(48), { categoryId: work });
  assert.equal(page.items.length, 3);
  assert.ok(page.items.every((s) => s.categoryId === work));
});

test('AC-12 / V-18: 우선순위 정렬 HIGH > NORMAL > LOW', async () => {
  const { app } = setup();
  await app.schedules.create({ title: 'low', startAt: future(1), priority: 'LOW', notifyAtStart: false });
  await app.schedules.create({ title: 'high', startAt: future(2), priority: 'HIGH', notifyAtStart: false });
  await app.schedules.create({ title: 'normal', startAt: future(3), priority: 'NORMAL', notifyAtStart: false });
  const page = await app.schedules.findInRange(future(0), future(48), undefined, 'priority');
  assert.deepEqual(page.items.map((s) => s.title), ['high', 'normal', 'low']);
});

test('V-16: keyset 페이지네이션', async () => {
  const { app } = setup();
  for (let i = 0; i < 5; i += 1) {
    await app.schedules.create({ title: `p${i}`, startAt: future(1 + i), notifyAtStart: false });
  }
  const first = await app.schedules.findInRange(future(0), future(48), undefined, 'startAt', 2, null);
  assert.equal(first.items.length, 2);
  assert.ok(first.nextCursor);
  const second = await app.schedules.findInRange(future(0), future(48), undefined, 'startAt', 2, first.nextCursor);
  assert.deepEqual(
    second.items.map((s) => s.title),
    ['p2', 'p3'],
  );
});

test('E-05-1: 미래 일정도 완료 체크 가능', async () => {
  const { app } = setup();
  const { id } = await app.schedules.create({ title: '미래완료', startAt: future(50), notifyAtStart: false });
  const s = await app.schedules.toggleDone(id, true);
  assert.equal(s.isDone, true);
  assert.equal(s.doneAt, NOW);
});

test('STORAGE_STALE_WRITE: expectedUpdatedAt 불일치', async () => {
  const { app } = setup();
  const { id } = await app.schedules.create({ title: 'x', startAt: future(1), notifyAtStart: false });
  await assert.rejects(
    () => app.schedules.update(id, { title: 'y', expectedUpdatedAt: 12345 }),
    (err: unknown) => (err as { code?: string }).code === 'STORAGE_STALE_WRITE',
  );
});
