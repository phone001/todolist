import test from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../src/core/app.ts';
import { FixedClock } from '../src/core/domain/clock.ts';
import { FakeNotificationGateway } from '../src/core/infra/fakes/fakes.ts';

const NOW = Date.UTC(2026, 8, 4, 9, 0, 0);
const future = (h: number) => Date.UTC(2026, 8, 4, 9 + h, 0, 0);

test('AC-05/AC-06: 사전 + 정시 알림이 각각 예약된다', async () => {
  const clock = new FixedClock(NOW, 'UTC');
  const app = buildApp({ clock });
  await app.schedules.create({
    title: '회고',
    startAt: future(1),
    reminderOffsets: [10],
    notifyAtStart: true,
  });
  const bodies = app.notifications.activeRequests().map((r) => r.body).sort();
  assert.deepEqual(bodies, ['10분 전 알림', '지금 시작']);
});

test('AC-07: 알림 권한 거부 시 일정은 저장되고 sync 는 경고를 반환', async () => {
  const clock = new FixedClock(NOW, 'UTC');
  const denied = new FakeNotificationGateway('denied');
  const app = buildApp({ clock, notifications: denied });

  await app.schedules.create({
    title: '권한없음',
    startAt: future(2),
    reminderOffsets: [15],
    notifyAtStart: true,
  });
  assert.equal(app.notifications.activeCount(), 0);

  const res = await app.scheduler.sync();
  assert.equal(res.warning, 'PERMISSION_NOTIFICATION_DENIED');

  const page = await app.schedules.findInRange(0, Number.MAX_SAFE_INTEGER);
  assert.equal(page.items.length, 1);
});

test('AC-07 후속: 권한이 부여되면 다음 sync 에서 예약된다', async () => {
  const clock = new FixedClock(NOW, 'UTC');
  const gw = new FakeNotificationGateway('denied');
  const app = buildApp({ clock, notifications: gw });
  await app.schedules.create({ title: 't', startAt: future(2), reminderOffsets: [15], notifyAtStart: true });
  assert.equal(app.notifications.activeCount(), 0);

  gw.setPermission('granted');
  await app.scheduler.sync();
  assert.equal(app.notifications.activeCount(), 2);
});

test('V-8: triggerAt 이 이미 지난 알림은 SKIPPED', async () => {
  const clock = new FixedClock(NOW, 'UTC');
  const app = buildApp({ clock });
  const { id } = await app.schedules.create({
    title: '임박',
    startAt: NOW + 3 * 60_000,
    reminderOffsets: [10],
    notifyAtStart: false,
  });
  const r = (await app.db.reminders).filter((x) => x.scheduleId === id);
  assert.equal(r[0].state, 'SKIPPED');
});

test('AC-08 / V-7: 재부팅 후 handleBootCompleted 가 OS 예약을 복원한다', async () => {
  const clock = new FixedClock(NOW, 'UTC');
  const app = buildApp({ clock });
  await app.schedules.create({
    title: '재부팅 대상',
    startAt: future(6),
    reminderOffsets: [30, 60],
    notifyAtStart: true,
  });
  assert.equal(app.notifications.activeCount(), 3);

  // 기기 재부팅: OS 예약이 전부 유실됨. 앱 DB 의 REMINDER 행은 SCHEDULED 로 남아 있음.
  app.notifications.reboot();
  assert.equal(app.notifications.activeCount(), 0);

  const result = await app.scheduler.handleBootCompleted();
  assert.equal(result.scheduled, 3);
  assert.equal(app.notifications.activeCount(), 3);
});

test('멱등성: 같은 일정에 대해 sync 를 반복해도 OS 예약이 중복되지 않는다', async () => {
  const clock = new FixedClock(NOW, 'UTC');
  const app = buildApp({ clock });
  await app.schedules.create({ title: 'i', startAt: future(4), reminderOffsets: [20], notifyAtStart: true });
  const after1 = app.notifications.scheduledLog.length;
  await app.scheduler.sync();
  await app.scheduler.sync();
  assert.equal(app.notifications.scheduledLog.length, after1);
  assert.equal(app.notifications.activeCount(), 2);
});

test('13.3: 알림 payload 는 정수 scheduleId 만, 탭 시 저장소 재조회로 검증', async () => {
  const clock = new FixedClock(NOW, 'UTC');
  const app = buildApp({ clock });
  const { id } = await app.schedules.create({ title: 'p', startAt: future(2), reminderOffsets: [10], notifyAtStart: false });
  const req = app.notifications.activeRequests()[0];
  assert.deepEqual(Object.keys(req.data), ['scheduleId']);
  assert.equal(typeof req.data.scheduleId, 'number');

  assert.equal(await app.scheduler.resolveTappedSchedule(req.data), id);
  assert.equal(await app.scheduler.resolveTappedSchedule({ scheduleId: 99999 }), null);
  assert.equal(await app.scheduler.resolveTappedSchedule({ scheduleId: "1; DROP TABLE schedule" }), null);
  assert.equal(await app.scheduler.resolveTappedSchedule('garbage'), null);
});

test('P-10-1: notif.showTitle=false 면 알림 제목이 마스킹된다', async () => {
  const clock = new FixedClock(NOW, 'UTC');
  const app = buildApp({ clock });
  await app.settings.setShowNotificationTitle(false);
  await app.schedules.create({ title: '민감한 제목', startAt: future(2), reminderOffsets: [10], notifyAtStart: true });
  const titles = app.notifications.activeRequests().map((r) => r.title);
  assert.ok(titles.every((t) => t === '일정 알림'));
  assert.ok(!app.notifications.scheduledLog.some((r) => r.title.includes('민감한')));
});
