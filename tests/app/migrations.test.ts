/**
 * 마이그레이션 정의 검증.
 * 대응: nfr.md v1.1 §9 V-20, database.md §6~7, AC-24. (runner 자체는 tests/migrationRunner.test.ts)
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { runMigrations, type MigrationDb } from '../../src/core/migration/runner.ts';
import { MIGRATIONS, TARGET_SCHEMA_VERSION } from '../../src/app/adapters/sqlite/migrations.ts';

test('MIGRATIONS: 001_init 이 database.md 의 모든 테이블/트리거/FTS 를 포함한다', () => {
  assert.equal(MIGRATIONS.length, 1);
  assert.equal(MIGRATIONS[0].version, 1);
  assert.equal(TARGET_SCHEMA_VERSION, 1);
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

test('V-20 / AC-24: runMigrations(MIGRATIONS) 가 user_version 을 1 로 올리고 멱등 재실행된다', async () => {
  const db = new RecordingMigrationDb();
  const first = await runMigrations(db, [...MIGRATIONS]);
  assert.deepEqual(first.applied, [1]);
  assert.equal(db.userVersion, 1);
  assert.equal(first.failedAt, undefined);
  assert.ok(db.statements.some((s) => s.startsWith('CREATE TABLE schedule')));

  const second = await runMigrations(db, [...MIGRATIONS]);
  assert.deepEqual(second.applied, []);
  assert.equal(second.fromVersion, 1);
});
