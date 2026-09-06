/**
 * SHELL-001 회귀: 다중 문장 SQL 스플리터가 트리거 본문을 파손하지 않는다.
 * 대응: OpSqliteDb.native.ts exec(), database.md §6 (CREATE TRIGGER ... BEGIN ... END;).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { splitSqlStatements } from '../../src/app/adapters/sqlite/sqlSplit.ts';
import { MIGRATIONS } from '../../src/app/adapters/sqlite/migrations.ts';

test('splitSqlStatements: 최상위 세미콜론에서만 분할하고 줄 주석을 제거한다', () => {
  const out = splitSqlStatements(`
    -- 주석
    PRAGMA foreign_keys = ON;
    CREATE TABLE a (id INTEGER);
    INSERT INTO a VALUES (1);
  `);
  assert.deepEqual(out, [
    'PRAGMA foreign_keys = ON',
    'CREATE TABLE a (id INTEGER)',
    'INSERT INTO a VALUES (1)',
  ]);
});

test('splitSqlStatements: CREATE TRIGGER ... BEGIN ... END; 를 한 문장으로 유지한다 (SHELL-001)', () => {
  const sql = `
CREATE TRIGGER schedule_ai AFTER INSERT ON schedule BEGIN
  INSERT INTO schedule_fts(rowid, title) VALUES (new.id, new.title);
END;
CREATE INDEX idx_x ON schedule(start_at);
`;
  const out = splitSqlStatements(sql);
  assert.equal(out.length, 2);
  assert.ok(out[0].startsWith('CREATE TRIGGER schedule_ai'));
  assert.ok(out[0].includes('INSERT INTO schedule_fts'));
  assert.ok(out[0].trimEnd().endsWith('END'));
  assert.equal(out[1], 'CREATE INDEX idx_x ON schedule(start_at)');
});

test('splitSqlStatements: 문자열 리터럴 안의 세미콜론/이스케이프 따옴표는 경계가 아니다', () => {
  const out = splitSqlStatements(`INSERT INTO t VALUES ('a;b', 'it''s ok'); SELECT 1;`);
  assert.deepEqual(out, [`INSERT INTO t VALUES ('a;b', 'it''s ok')`, 'SELECT 1']);
});

test('SHELL-001: 실제 001_init DDL 이 트리거를 온전히 포함한 문장들로 분해된다', () => {
  const stmts = splitSqlStatements(MIGRATIONS[0].up);
  const triggers = stmts.filter((s) => s.toUpperCase().startsWith('CREATE TRIGGER'));
  assert.equal(triggers.length, 3, '트리거 3개(ai/ad/au)가 각각 1문장');
  for (const t of triggers) {
    assert.ok(t.trimEnd().toUpperCase().endsWith('END'), `트리거가 END 로 끝나야 함: ${t.slice(0, 40)}`);
    // 트리거 본문의 내부 세미콜론이 잘려나가지 않았는지 (INSERT 문 포함 확인)
    assert.ok(t.includes('schedule_fts'), '트리거 본문 유지');
  }
  // "END" 만 단독으로 남은 깨진 문장이 없어야 한다.
  assert.ok(!stmts.some((s) => s.trim().toUpperCase() === 'END'));
  // 테이블/인덱스/가상테이블/시드도 개별 문장으로 존재
  assert.ok(stmts.some((s) => s.startsWith('CREATE TABLE schedule ')));
  assert.ok(stmts.some((s) => s.startsWith('CREATE VIRTUAL TABLE schedule_fts')));
  assert.ok(stmts.some((s) => s.startsWith('INSERT INTO category')));
});
