import test from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../src/core/app.ts';
import { FixedClock } from '../src/core/domain/clock.ts';
import { AuthService } from '../src/core/services/authService.ts';
import { InMemoryAccountRepository } from '../src/core/infra/memory/repositories.ts';
import { InMemoryDb } from '../src/core/infra/memory/store.ts';
import { ArrayLogger, FakeAuthGateway, InMemoryTokenStore } from '../src/core/infra/fakes/fakes.ts';

const NOW = Date.UTC(2026, 8, 4, 9, 0, 0);
const at = (h: number) => Date.UTC(2026, 8, 4, 10 + h, 0, 0);

test('AC-21 / V-13: 계정 연동 해제 후에도 로컬 일정 데이터는 유지된다', async () => {
  const app = buildApp({ clock: new FixedClock(NOW, 'UTC') });
  await app.schedules.create({ title: '보존 대상', startAt: at(1), notifyAtStart: false });
  await app.schedules.create({ title: '보존 대상 2', startAt: at(2), notifyAtStart: false });

  const linked = await app.auth.link();
  assert.equal(linked.state, 'LINKED');
  assert.equal(app.tokenStore.has('account.tokens'), true);

  const unlinked = await app.auth.unlink();
  assert.equal(unlinked.state, 'NONE');
  assert.equal(unlinked.subject, null);
  assert.equal(app.tokenStore.has('account.tokens'), false);
  assert.ok(app.authGateway.revoked.length >= 1);

  const page = await app.schedules.findInRange(0, Number.MAX_SAFE_INTEGER);
  assert.equal(page.items.length, 2);
});

test('V-14: 토큰 값은 AccountRepository(DB) 에 저장되지 않는다 (참조 키만)', async () => {
  const db = new InMemoryDb();
  const clock = new FixedClock(NOW, 'UTC');
  const tokenStore = new InMemoryTokenStore();
  const accountRepo = new InMemoryAccountRepository(db);
  const auth = new AuthService({
    clock,
    auth: new FakeAuthGateway(),
    tokenStore,
    account: accountRepo,
    logger: new ArrayLogger(),
  });

  await auth.link();

  const record = await accountRepo.get();
  const serialized = JSON.stringify(record);
  assert.ok(!serialized.includes('access-1'), 'accessToken 이 DB 레코드에 포함되면 안 됨');
  assert.ok(!serialized.includes('refresh-1'), 'refreshToken 이 DB 레코드에 포함되면 안 됨');
  assert.equal(record.tokenRef, 'account.tokens');
  assert.equal(record.subject, 'user-123');

  // 토큰 자체는 보안 저장소에만 존재한다.
  const stored = await tokenStore.load('account.tokens');
  assert.equal(stored?.accessToken, 'access-1');
});

test('E-12-2: 리프레시 실패 시 상태가 EXPIRED 로 강등되고 false 반환 (앱 흐름 유지)', async () => {
  const db = new InMemoryDb();
  const clock = new FixedClock(NOW, 'UTC');
  const tokenStore = new InMemoryTokenStore();
  const accountRepo = new InMemoryAccountRepository(db);
  const authGateway = new FakeAuthGateway({
    authorizeResult: {
      accessToken: 'a',
      refreshToken: 'r',
      accessTokenExpiresAt: NOW + 1000, // 곧 만료
      subject: 's',
    },
    refreshResult: async () => {
      throw new Error('network down');
    },
  });
  const auth = new AuthService({ clock, auth: authGateway, tokenStore, account: accountRepo, logger: new ArrayLogger() });

  await auth.link();
  const ok = await auth.ensureFreshToken();
  assert.equal(ok, false);
  assert.equal((await accountRepo.get()).state, 'EXPIRED');
});

test('AC-20: 계정 없이도 로컬 기능이 동작한다 (link 미호출)', async () => {
  const app = buildApp({ clock: new FixedClock(NOW, 'UTC') });
  const { id } = await app.schedules.create({ title: '로컬', startAt: at(1), notifyAtStart: false });
  await app.schedules.toggleDone(id, true);
  const s = await app.dashboard.getSummary();
  assert.equal(s.done, 1);
  assert.equal((await app.auth.getStatus()).state, 'NONE');
});
