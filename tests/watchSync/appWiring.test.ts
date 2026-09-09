/**
 * V-19 확장 / V-39: `buildApp` / `assembleServices` 워치 배선 후방 호환.
 * 대응: document/architect/overview.md v1.9 §"신규", logic §17.2, nfr §9 V-39.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { assembleServices, buildApp, type CorePorts } from '../../src/core/app.ts';
import { WatchSyncService } from '../../src/core/services/watchSyncService.ts';
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
  FakeWatchSyncGateway,
  InMemoryTokenStore,
} from '../../src/core/infra/fakes/fakes.ts';
import { FixedClock } from '../../src/core/domain/clock.ts';

const NOW = Date.UTC(2026, 8, 4, 9, 0, 0);

test('V-19: watchSync 미주입 시 buildApp 은 기존 형태 + watchSync 서비스(no-op 게이트)를 반환', () => {
  const app = buildApp();
  for (const key of [
    'db', 'clock', 'logger', 'notifications', 'calendarGateway', 'tokenStore', 'authGateway',
    'schedules', 'scheduler', 'dashboard', 'search', 'categories', 'settings', 'auth', 'calendarSync',
    'watchSync',
  ]) {
    assert.ok(key in app, `App.${key} 누락`);
  }
  assert.ok(app.watchSync instanceof WatchSyncService);
});

test('V-19: watchSync 미주입 시 기존 동작 불변 (일정 생성 / 대시보드 집계)', async () => {
  const clock = new FixedClock(NOW, 'UTC');
  const app = buildApp({ clock });
  const { id } = await app.schedules.create({ title: '점검', startAt: NOW + 3_600_000, notifyAtStart: false });
  assert.equal(typeof id, 'number');
  const summary = await app.dashboard.getSummary();
  assert.equal(summary.total, 1);
  // no-op 게이트: pushSnapshot 이 throw 하지 않고 조용히 끝난다
  await assert.doesNotReject(app.watchSync.pushSnapshot());
});

test('V-19: watchSync 주입 시 pushSnapshot 이 오늘 스냅샷을 게이트로 전송', async () => {
  const clock = new FixedClock(NOW, 'UTC');
  const gateway = new FakeWatchSyncGateway(true);
  const app = buildApp({ clock, watchSync: gateway });
  const { id } = await app.schedules.create({ title: '오늘 할 일', startAt: NOW + 3_600_000, notifyAtStart: false });

  await app.watchSync.pushSnapshot();

  assert.equal(gateway.sentSnapshots.length, 1);
  assert.ok(gateway.lastSnapshot()?.today.some((i) => i.id === id));
});

test('V-19: assembleServices 는 watchSync 포트 없이도 watchSync 서비스를 조립한다', async () => {
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
  assert.ok(services.watchSync instanceof WatchSyncService);
  await assert.doesNotReject(services.watchSync.pushSnapshot());
});
