/**
 * 부트스트랩 오케스트레이터 검증 (순수, 플랫폼 비의존).
 * 대응: nfr.md v1.1 §9 V-20 (단계 순서 / 마이그레이션 실패 → SafeMode / sync 격리), logic §16.4, E-15-1, AC-24.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  bootstrap,
  runPostRender,
  type BootstrapSteps,
  type PostRenderSteps,
} from '../../src/app/bootstrap/bootstrapSequence.ts';
import { assembleServices, type CorePorts, type CoreServices } from '../../src/core/app.ts';
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
import type { MigrationRunResult } from '../../src/core/migration/runner.ts';

function inMemoryPorts(): CorePorts {
  const db = new InMemoryDb();
  seedDefaults(db, 0);
  return {
    clock: new FixedClock(Date.UTC(2026, 8, 4, 9, 0, 0), 'UTC'),
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
}

const OK_MIGRATION: MigrationRunResult = { fromVersion: 0, toVersion: 1, applied: [1] };
const FAILED_MIGRATION: MigrationRunResult = {
  fromVersion: 0,
  toVersion: 0,
  applied: [],
  failedAt: 1,
  error: 'bad ddl',
};

function makeSteps(overrides: Partial<BootstrapSteps> & { migration?: MigrationRunResult } = {}): {
  steps: BootstrapSteps;
  order: string[];
} {
  const order: string[] = [];
  const ports = inMemoryPorts();
  const steps: BootstrapSteps = {
    async openDatabase() {
      order.push('openDatabase');
      return ports;
    },
    async runMigrations() {
      order.push('runMigrations');
      return overrides.migration ?? OK_MIGRATION;
    },
    assemble(p) {
      order.push('assemble');
      return assembleServices(p);
    },
    async loadSettings() {
      order.push('loadSettings');
    },
    ...overrides,
  };
  return { steps, order };
}

test('V-20: 정상 부트스트랩은 db-open→migrate→assemble→load-settings→ready 순서로 진행한다', async () => {
  const { steps, order } = makeSteps();
  const result = await bootstrap(steps);
  assert.equal(result.ok, true);
  assert.equal(result.phase, 'ready');
  assert.deepEqual(order, ['openDatabase', 'runMigrations', 'assemble', 'loadSettings']);
  assert.deepEqual(result.trace, ['db-open', 'migrate', 'assemble', 'load-settings', 'ready']);
  if (result.ok) {
    // 조립된 서비스가 실제로 동작한다.
    const summary = await result.services.dashboard.getSummary();
    assert.equal(typeof summary.total, 'number');
  }
});

test('V-20 / E-15-1: 마이그레이션 실패 시 서비스를 조립하지 않고 SafeMode 를 반환한다', async () => {
  const { steps, order } = makeSteps({ migration: FAILED_MIGRATION });
  const result = await bootstrap(steps);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.phase, 'safe-mode');
    assert.equal(result.errorCode, 'STORAGE_MIGRATION_FAILED');
    assert.equal(result.migration.failedAt, 1);
  }
  assert.ok(!order.includes('assemble'), 'assemble 은 호출되지 않아야 한다');
  assert.ok(!order.includes('loadSettings'));
});

test('RENDER-002 / E-15-1: openDatabase 가 throw 하면 미처리 거부 대신 SafeMode 로 수렴한다', async () => {
  const { steps, order } = makeSteps({
    async openDatabase() {
      order.push('openDatabase');
      throw new TypeError("Cannot read property 'getRandomValues' of undefined");
    },
  });
  const result = await bootstrap(steps);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.phase, 'safe-mode');
    assert.equal(result.errorCode, 'STORAGE_MIGRATION_FAILED');
    assert.match(result.migration.error ?? '', /db-open/);
    assert.match(result.migration.error ?? '', /getRandomValues/);
  }
  assert.ok(!order.includes('assemble'));
});

test('RENDER-002: loadSettings 가 throw 해도 SafeMode 로 수렴한다(무한 스피너 방지)', async () => {
  const { steps } = makeSteps({
    async loadSettings() {
      throw new Error('settings read failed');
    },
  });
  const result = await bootstrap(steps);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.phase, 'safe-mode');
    assert.match(result.migration.error ?? '', /load-settings/);
  }
});

test('V-20 / P-09: runPostRender 는 sync 실패를 격리하고 토큰 갱신 단계로 계속 진행한다', async () => {
  const { steps } = makeSteps();
  const result = await bootstrap(steps);
  assert.equal(result.ok, true);
  if (!result.ok) return;

  const calls: string[] = [];
  const postSteps: PostRenderSteps = {
    async syncReminders() {
      calls.push('sync');
      throw new Error('OS 예약 실패');
    },
    async ensureFreshToken() {
      calls.push('token');
    },
  };
  const summary = await runPostRender(result.services, postSteps);
  assert.deepEqual(calls, ['sync', 'token']);
  assert.equal(summary.reminderSync, 'failed');
  assert.equal(summary.tokenRefresh, 'ok');
});

test('V-20: runPostRender 정상 경로', async () => {
  const { steps } = makeSteps();
  const result = await bootstrap(steps);
  if (!result.ok) throw new Error('unexpected safe mode');
  const summary = await runPostRender(result.services, {
    async syncReminders(services) {
      await services.scheduler.sync();
    },
    async ensureFreshToken() {},
  });
  assert.deepEqual(summary, { reminderSync: 'ok', tokenRefresh: 'ok' });
});
