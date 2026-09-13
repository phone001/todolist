/**
 * 마이그레이션 정의 검증.
 * 대응: nfr.md v1.1 §9 V-20, database.md §6~7/§14, AC-24. (runner 자체는 tests/migrationRunner.test.ts)
 * v1.9(F-24/F-06): 마이그레이션 002(기본 유형 4종 시딩 DML)/003(recurrence_reminder_offsets 컬럼 DDL) 추가.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { runMigrations, type MigrationDb } from '../../src/core/migration/runner.ts';
import { MIGRATIONS, TARGET_SCHEMA_VERSION } from '../../src/app/adapters/sqlite/migrations.ts';

test('MIGRATIONS: 001_init 이 database.md 의 모든 테이블/트리거/FTS 를 포함한다', () => {
  assert.equal(MIGRATIONS.length, 3);
  assert.equal(MIGRATIONS[0].version, 1);
  assert.equal(TARGET_SCHEMA_VERSION, 3);
  const up = MIGRATIONS[0].up;
  for (const table of [
    'CREATE TABLE category',
    'CREATE TABLE schedule',
    'CREATE TABLE reminder',
    'CREATE TABLE app_setting',
    'CREATE TABLE calendar_link',
    'CREATE TABLE account_link',
    'CREATE TABLE schema_migration',
  ]) {
    assert.ok(up.includes(table), `누락: ${table}`);
  }
  assert.ok(up.includes('CREATE VIRTUAL TABLE schedule_fts USING fts5'));
  assert.ok(up.includes('CREATE TRIGGER schedule_ai'));
  assert.ok(up.includes('CREATE TRIGGER schedule_ad'));
  assert.ok(up.includes('CREATE TRIGGER schedule_au'));
  // 시드(database.md §7)
  assert.ok(up.includes("INSERT INTO category") && up.includes("'기타'"));
  assert.ok(up.includes("'theme.mode'"));
  assert.ok(up.includes("'notif.showTitle'"));
  // 인덱스
  assert.ok(up.includes('idx_reminder_trigger_state'));
});

test('F-06/v1.9: 002_seed_default_categories — 공부/취미/업무 idempotent DML 시딩(database.md §14.3)', () => {
  assert.equal(MIGRATIONS[1].version, 2);
  assert.equal(MIGRATIONS[1].name, '002_seed_default_categories');
  const up = MIGRATIONS[1].up;
  for (const name of ['공부', '취미', '업무']) {
    assert.ok(up.includes(`'${name}'`), `누락: ${name}`);
    // 대소문자·앞뒤공백 무시 중복 방지(E-06-8)
    assert.ok(up.includes(`lower(trim(name)) = lower('${name}')`), `NOT EXISTS 조건 누락: ${name}`);
  }
  // 팔레트 앞 3색 고정(§5.1 CATEGORY_COLOR_PALETTE[0..2])
  assert.ok(up.includes('#00897B'));
  assert.ok(up.includes('#00ACC1'));
  assert.ok(up.includes('#039BE5'));
  // is_system=0 (D-27(a) — 보호 대상 아님) — `NULL, 0, <sort_order>,` 위치의 0 이 is_system 컬럼.
  assert.ok(up.includes('NULL, 0, 101,'), '공부 IS_SYSTEM 컬럼이 0 이어야 한다');
  assert.ok(up.includes('NULL, 0, 102,'), '취미 IS_SYSTEM 컬럼이 0 이어야 한다');
  assert.ok(up.includes('NULL, 0, 103,'), '업무 IS_SYSTEM 컬럼이 0 이어야 한다');
});

test('F-24/v1.9: 003_recurrence_reminder_offsets — schedule 테이블에 컬럼 추가(database.md §14.1)', () => {
  assert.equal(MIGRATIONS[2].version, 3);
  assert.equal(MIGRATIONS[2].name, '003_recurrence_reminder_offsets');
  const up = MIGRATIONS[2].up;
  assert.ok(up.includes('ALTER TABLE schedule ADD COLUMN recurrence_reminder_offsets'));
});

/** exec 호출을 SQL 문장 단위로 기록하는 가짜 DB (op-sqlite 어댑터의 exec 분할 규칙을 근사). */
class RecordingMigrationDb implements MigrationDb {
  userVersion = 0;
  statements: string[] = [];
  async getUserVersion() {
    return this.userVersion;
  }
  async setUserVersion(v: number) {
    this.userVersion = v;
  }
  async exec(sql: string) {
    for (const stmt of sql.split(';').map((s) => s.trim()).filter((s) => s && !s.startsWith('--'))) {
      this.statements.push(stmt);
    }
  }
  async transaction<T>(work: () => Promise<T>): Promise<T> {
    const v = this.userVersion;
    const s = [...this.statements];
    try {
      return await work();
    } catch (e) {
      this.userVersion = v;
      this.statements = s;
      throw e;
    }
  }
}

test('V-20 / AC-24: runMigrations(MIGRATIONS) 가 user_version 을 3 으로 올리고 멱등 재실행된다', async () => {
  const db = new RecordingMigrationDb();
  const first = await runMigrations(db, [...MIGRATIONS]);
  assert.deepEqual(first.applied, [1, 2, 3]);
  assert.equal(db.userVersion, 3);
  assert.equal(first.failedAt, undefined);
  assert.ok(db.statements.some((s) => s.startsWith('CREATE TABLE schedule')));
  assert.ok(db.statements.some((s) => s.includes('ALTER TABLE schedule ADD COLUMN recurrence_reminder_offsets')));

  const second = await runMigrations(db, [...MIGRATIONS]);
  assert.deepEqual(second.applied, []);
  assert.equal(second.fromVersion, 3);
});

test('F-06/v1.9: 기존 사용자(버전 1)가 재실행하면 002/003 만 적용된다', async () => {
  const db = new RecordingMigrationDb();
  db.userVersion = 1; // 신규 설치자가 아니라 이미 001 만 적용된 기존 사용자를 가정
  const result = await runMigrations(db, [...MIGRATIONS]);
  assert.deepEqual(result.applied, [2, 3]);
  assert.equal(db.userVersion, 3);
});
