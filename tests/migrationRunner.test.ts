import test from 'node:test';
import assert from 'node:assert/strict';
import { runMigrations } from '../src/core/migration/runner.ts';
import type { Migration, MigrationDb } from '../src/core/migration/runner.ts';

/** exec 로그를 기록하고, 특정 토큰이 든 SQL 에서 throw 하는 가짜 DB. 트랜잭션 롤백 지원. */
class FakeMigrationDb implements MigrationDb {
  userVersion = 0;
  execLog: string[] = [];
  failToken: string | null = null;

  async getUserVersion(): Promise<number> {
    return this.userVersion;
  }

  async setUserVersion(version: number): Promise<void> {
    this.userVersion = version;
  }

  async exec(sql: string): Promise<void> {
    if (this.failToken && sql.includes(this.failToken)) {
      throw new Error(`exec failed: ${this.failToken}`);
    }
    this.execLog.push(sql);
  }

  async transaction<T>(work: () => Promise<T>): Promise<T> {
    const snapshotVersion = this.userVersion;
    const snapshotLog = [...this.execLog];
    try {
      return await work();
    } catch (err) {
      this.userVersion = snapshotVersion;
      this.execLog = snapshotLog;
      throw err;
    }
  }
}

const migrations: Migration[] = [
  { version: 1, name: 'init', up: 'CREATE TABLE schedule (...)' },
  { version: 2, name: 'add_index', up: 'CREATE INDEX idx_schedule_start (...)' },
  { version: 3, name: 'add_fts', up: 'CREATE VIRTUAL TABLE schedule_fts (...)' },
];

test('V-12 / AC-24: 마이그레이션을 순서대로 모두 적용하고 user_version 을 올린다', async () => {
  const db = new FakeMigrationDb();
  const result = await runMigrations(db, migrations);
  assert.deepEqual(result.applied, [1, 2, 3]);
  assert.equal(db.userVersion, 3);
  assert.equal(db.execLog.length, 3);
  assert.equal(result.failedAt, undefined);
});

test('V-12: 재실행은 멱등 (이미 최신이면 아무것도 적용하지 않음)', async () => {
  const db = new FakeMigrationDb();
  await runMigrations(db, migrations);
  const second = await runMigrations(db, migrations);
  assert.deepEqual(second.applied, []);
  assert.equal(second.fromVersion, 3);
  assert.equal(db.execLog.length, 3);
});

test('E-15-1: 중간 마이그레이션 실패 시 해당 스텝 롤백 + 중단', async () => {
  const db = new FakeMigrationDb();
  db.failToken = 'idx_schedule_start'; // 버전 2 에서 실패
  const result = await runMigrations(db, migrations);

  assert.deepEqual(result.applied, [1]);
  assert.equal(result.failedAt, 2);
  assert.equal(db.userVersion, 1, 'user_version 은 1 로 롤백/유지되어야 한다');
  assert.equal(db.execLog.length, 1, '버전 3 SQL 은 실행되지 않아야 한다');
  assert.match(result.error ?? '', /idx_schedule_start/);
});

test('부분 적용 상태에서 재시도하면 실패 지점부터 이어서 적용', async () => {
  const db = new FakeMigrationDb();
  db.failToken = 'schedule_fts';
  const first = await runMigrations(db, migrations);
  assert.deepEqual(first.applied, [1, 2]);
  assert.equal(db.userVersion, 2);

  db.failToken = null; // 환경 복구
  const retry = await runMigrations(db, migrations);
  assert.deepEqual(retry.applied, [3]);
  assert.equal(db.userVersion, 3);
});
