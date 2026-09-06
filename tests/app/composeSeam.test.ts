/**
 * 조립 지점(seam) 검증.
 * 대응: nfr.md v1.1 §9 V-19 (buildApp 후방 호환), V-24 (토큰은 TokenStore 에만, DB 미저장),
 *       overview.md v1.1 "조립 지점 리팩터", logic §16.1.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { assembleServices, buildApp, type CorePorts } from '../../src/core/app.ts';
import { InMemoryDb, seedDefaults } from '../../src/core/infra/memory/store.ts';
import {
  InMemoryAccountRepository,
  InMemoryCalendarLinkRepository,
  InMemoryCategoryRepository,
  InMemoryReminderRepository,
  InMemoryScheduleRepository,
  InMemorySettingRepository,
} from '../../src/core/infra/memory/repositories.ts';
import {
  ArrayLogger,
  FakeAuthGateway,
  FakeCalendarGateway,
  FakeNotificationGateway,
  InMemoryTokenStore,
} from '../../src/core/infra/fakes/fakes.ts';
import { FixedClock } from '../../src/core/domain/clock.ts';

const NOW = Date.UTC(2026, 8, 4, 9, 0, 0);

test('V-19: buildApp() 은 인자 없이 기존과 동일한 형태의 App 을 반환한다 (후방 호환)', () => {
  const app = buildApp();
  for (const key of [
    'db', 'clock', 'logger', 'notifications', 'calendarGateway', 'tokenStore', 'authGateway',
    'schedules', 'scheduler', 'dashboard', 'search', 'categories', 'settings', 'auth', 'calendarSync',
  ]) {
    assert.ok(key in app, `App.${key} 누락`);
  }
  assert.ok(app.db instanceof InMemoryDb);
  assert.ok(app.notifications instanceof FakeNotificationGateway);
  assert.ok(app.tokenStore instanceof InMemoryTokenStore);
});

test('V-19: buildApp({clock, notifications}) 오버라이드가 그대로 쓰인다', async () => {
  const clock = new FixedClock(NOW, 'UTC');
  const notifications = new FakeNotificationGateway('denied');
  const app = buildApp({ clock, notifications });
  assert.equal(app.clock, clock);
  assert.equal(app.notifications, notifications);
  // 알림 권한 거부 상태에서도 일정 저장은 된다.
  const { id } = await app.schedules.create({ title: '점검', startAt: NOW + 3_600_000 });
  assert.equal(typeof id, 'number');
});

test('V-19: assembleServices 는 주입한 포트로 동작하는 서비스 묶음을 만든다', async () => {
  const db = new InMemoryDb();
  seedDefaults(db, NOW);
  const ports: CorePorts = {
    clock: new FixedClock(NOW, 'UTC'),
    logger: new ArrayLogger(),
    uow: db,
    repositories: {
      schedules: new InMemoryScheduleRepository(db),
      reminders: new InMemoryReminderRepository(db),
      categories: new InMemoryCategoryRepository(db),
      settings: new InMemorySettingRepository(db),
      account: new InMemoryAccountRepository(db),
      calendarLinks: new InMemoryCalendarLinkRepository(db),
    },
    notifications: new FakeNotificationGateway('granted'),
    calendar: new FakeCalendarGateway('granted'),
    auth: new FakeAuthGateway(),
    tokenStore: new InMemoryTokenStore(),
    calendarIds: [],
  };
  const services = assembleServices(ports);
  const { id } = await services.schedules.create({
    title: '회의',
    startAt: NOW + 7_200_000,
    reminderOffsets: [10],
    notifyAtStart: true,
  });
  const page = await services.schedules.findInRange(NOW, NOW + 86_400_000);
  assert.ok(page.items.some((s) => s.id === id));
  const summary = await services.dashboard.getSummary();
  assert.equal(summary.total >= 1, true);

  // SHELL-002: 상세 화면용 단건 조회 경로
  const one = await services.schedules.getById(id);
  assert.ok(one && one.id === id);
  assert.equal(await services.schedules.getById(999_999), null);
  await services.schedules.softDelete(id);
  assert.equal(await services.schedules.getById(id), null, 'soft-deleted 는 null');
});

test('V-24: 계정 연동 시 토큰은 TokenStore 에만 저장되고 AccountRepository(DB)에는 참조만 남는다', async () => {
  const db = new InMemoryDb();
  seedDefaults(db, NOW);
  const account = new InMemoryAccountRepository(db);
  const tokenStore = new InMemoryTokenStore();
  const ports: CorePorts = {
    clock: new FixedClock(NOW, 'UTC'),
    logger: new ArrayLogger(),
    uow: db,
    repositories: {
      schedules: new InMemoryScheduleRepository(db),
      reminders: new InMemoryReminderRepository(db),
      categories: new InMemoryCategoryRepository(db),
      settings: new InMemorySettingRepository(db),
      account,
      calendarLinks: new InMemoryCalendarLinkRepository(db),
    },
    notifications: new FakeNotificationGateway('granted'),
    calendar: new FakeCalendarGateway('granted'),
    auth: new FakeAuthGateway(),
    tokenStore,
    calendarIds: [],
  };
  const services = assembleServices(ports);
  await services.auth.link();

  const stored = await account.get();
  const serialized = JSON.stringify(stored);
  assert.ok(!serialized.includes('access-1'), 'access token 이 DB 레코드에 존재하면 안 된다');
  assert.ok(!serialized.includes('refresh-1'), 'refresh token 이 DB 레코드에 존재하면 안 된다');
  assert.equal(stored.tokenRef, 'account.tokens');
  assert.equal(tokenStore.has('account.tokens'), true);
});
