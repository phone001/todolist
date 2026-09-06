import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildApp } from '../src/core/app.ts';
import { FixedClock } from '../src/core/domain/clock.ts';
import { ArrayLogger } from '../src/core/infra/fakes/fakes.ts';

const NOW = Date.UTC(2026, 8, 4, 9, 0, 0);
const SRC_DIR = fileURLToPath(new URL('../src', import.meta.url));

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (full.endsWith('.ts')) out.push(full);
  }
  return out;
}

test('V-15: 서비스 로그에 일정 제목/메모 원문이 남지 않는다', async () => {
  const logger = new ArrayLogger();
  const app = buildApp({ clock: new FixedClock(NOW, 'UTC'), logger });

  await app.settings.setShowNotificationTitle(true);
  const { id } = await app.schedules.create({
    title: '건강검진 내시경',
    memo: '민감한 개인 메모 내용',
    startAt: NOW + 60_000, // 과거 오프셋 유발용
    reminderOffsets: [10],
    notifyAtStart: true,
  });
  await app.schedules.update(id, { startAt: NOW - 60_000 }); // sync 경고/실패 경로 유발
  await app.scheduler.sync();

  const dump = logger.serialized();
  assert.ok(!dump.includes('건강검진 내시경'), '로그에 제목 원문이 없어야 한다');
  assert.ok(!dump.includes('민감한 개인 메모 내용'), '로그에 메모 원문이 없어야 한다');
});

test('V-14 (정적): 소스 어디에서도 토큰을 APP_SETTING/account 컬럼에 직접 넣지 않는다', () => {
  // account_link 레코드 형태를 만드는 유일한 지점은 AuthService 이며 tokenRef 만 기록한다.
  const authSrc = readFileSync(join(SRC_DIR, 'core/services/authService.ts'), 'utf8');
  assert.ok(authSrc.includes('tokenStore.save'), '토큰은 TokenStore 에 저장');
  assert.ok(authSrc.includes("tokenRef: TOKEN_REF"), 'DB 에는 참조 키만');
  assert.ok(!/account\.set\([^)]*accessToken/s.test(authSrc), 'account.set 에 accessToken 을 넣지 않음');
});

test('13.3 (정적): 인메모리 어댑터는 문자열 연결로 SQL 을 만들지 않는다 (동적 SQL 금지 원칙)', () => {
  // 운영 어댑터는 이 저장소에 아직 없지만, 참조 구현/도메인 유틸에 원시 SQL 조립이 없어야 한다.
  for (const file of walk(SRC_DIR)) {
    const src = readFileSync(file, 'utf8');
    assert.ok(
      !/"\s*SELECT[^"]*"\s*\+/i.test(src) && !/`SELECT[^`]*\$\{/i.test(src),
      `${file} 에 문자열 결합 SQL 로 보이는 패턴이 있음`,
    );
  }
});

test('P-13 (정적): 서비스 계층에 Date.now() 직접 호출이 없다 (Clock 포트 사용)', () => {
  for (const file of walk(join(SRC_DIR, 'core/services'))) {
    const src = readFileSync(file, 'utf8');
    assert.ok(!src.includes('Date.now('), `${file} 는 Clock 포트를 써야 한다`);
  }
});
