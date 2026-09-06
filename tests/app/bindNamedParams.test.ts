/**
 * RENDER-003 회귀: op-sqlite `execute` 는 위치 기반 배열만 받는다.
 * 어댑터 shim `bindNamedParams` 가 리포지토리의 named 파라미터 객체를
 * `(?N, values[])` 로 변환하는지 검증한다.
 * 대응: src/app/adapters/sqlite/bindNamedParams.ts, OpSqliteDb.native.ts(withNamedParamBinding).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { bindNamedParams } from '../../src/app/adapters/sqlite/bindNamedParams.ts';

test('배열 파라미터는 이미 positional 이므로 그대로 통과한다', () => {
  const out = bindNamedParams('SELECT * FROM t WHERE a = ? AND b = ?', [1, 'x']);
  assert.deepEqual(out, { sql: 'SELECT * FROM t WHERE a = ? AND b = ?', values: [1, 'x'] });
});

test('undefined / null 파라미터는 빈 배열로 통과한다 (마이그레이션 DDL 경로)', () => {
  assert.deepEqual(bindNamedParams('PRAGMA user_version', undefined), {
    sql: 'PRAGMA user_version',
    values: [],
  });
  assert.deepEqual(bindNamedParams('CREATE TABLE a (id INTEGER)', null), {
    sql: 'CREATE TABLE a (id INTEGER)',
    values: [],
  });
});

test('단순 named 파라미터를 등장 순서대로 ?N 과 값 배열로 바꾼다', () => {
  const out = bindNamedParams('SELECT value FROM app_setting WHERE key = :key', { key: 'theme' });
  assert.deepEqual(out, { sql: 'SELECT value FROM app_setting WHERE key = ?1', values: ['theme'] });
});

test('빈 객체라도 플레이스홀더가 없으면 그대로 통과한다', () => {
  const out = bindNamedParams('SELECT * FROM category ORDER BY sort_order, id', {});
  assert.deepEqual(out, {
    sql: 'SELECT * FROM category ORDER BY sort_order, id',
    values: [],
  });
});

test('동일 이름은 슬롯 1개로 dedup 하고 값은 최초 등장 순서로 정렬한다', () => {
  const sql = 'WHERE (:x IS NULL OR a = :x) AND b < :now AND c > :now';
  const out = bindNamedParams(sql, { now: 200, x: 5, unused: 1 });
  assert.equal(out.sql, 'WHERE (?1 IS NULL OR a = ?1) AND b < ?2 AND c > ?2');
  assert.deepEqual(out.values, [5, 200]); // 최초 등장 순서: x, now
});

test('실제 keyset 페이지네이션 SQL: 중복 이름이 한 슬롯으로 접힌다', () => {
  const sql =
    'SELECT * FROM schedule WHERE deleted_at IS NULL ' +
    'AND start_at < :toTs AND coalesce(end_at, start_at) >= :fromTs ' +
    'AND (:fCategoryId IS NULL OR category_id = :fCategoryId) ' +
    'AND (:cursorStartAt IS NULL OR start_at > :cursorStartAt OR (start_at = :cursorStartAt AND id > :cursorId)) ' +
    'ORDER BY start_at, id LIMIT :limit';
  const params = {
    toTs: 10,
    fromTs: 1,
    fCategoryId: null,
    cursorStartAt: 7,
    cursorId: 42,
    limit: 51,
  };
  const out = bindNamedParams(sql, params);
  // 유니크 슬롯 6개(toTs, fromTs, fCategoryId, cursorStartAt, cursorId, limit)
  const uniqueSlots = new Set(out.sql.match(/\?\d+/g));
  assert.deepEqual([...uniqueSlots].sort(), ['?1', '?2', '?3', '?4', '?5', '?6']);
  assert.ok(!out.sql.includes(':'));
  // fCategoryId 는 ?3 로 2번, cursorStartAt 은 ?4 로 3번 등장
  assert.equal((out.sql.match(/\?3\b/g) ?? []).length, 2);
  assert.equal((out.sql.match(/\?4\b/g) ?? []).length, 3);
  assert.deepEqual(out.values, [10, 1, null, 7, 42, 51]);
});

test('세 가지 접두어(:name / $name / @name)를 모두 인식한다', () => {
  const out = bindNamedParams('SELECT :a, $b, @c', { a: 1, b: 2, c: 3 });
  assert.equal(out.sql, 'SELECT ?1, ?2, ?3');
  assert.deepEqual(out.values, [1, 2, 3]);
});

test('문자열 리터럴 안의 : $ @ 는 플레이스홀더가 아니다', () => {
  const sql = "SELECT * FROM s WHERE note = 'a:b $c @d' AND s.title LIKE :like ESCAPE '\\'";
  const out = bindNamedParams(sql, { like: '%foo%' });
  assert.equal(out.sql, "SELECT * FROM s WHERE note = 'a:b $c @d' AND s.title LIKE ?1 ESCAPE '\\'");
  assert.deepEqual(out.values, ['%foo%']);
});

test("이스케이프된 따옴표('')가 있는 리터럴 안의 : 도 건너뛴다", () => {
  const sql = "INSERT INTO t VALUES ('it''s 3:30', :v)";
  const out = bindNamedParams(sql, { v: 9 });
  assert.equal(out.sql, "INSERT INTO t VALUES ('it''s 3:30', ?1)");
  assert.deepEqual(out.values, [9]);
});

test('-- 줄 주석 안의 :name 은 플레이스홀더가 아니다', () => {
  const sql = 'SELECT 1 -- filter by :key here\nWHERE k = :key';
  const out = bindNamedParams(sql, { key: 'x' });
  assert.equal(out.sql, 'SELECT 1 -- filter by :key here\nWHERE k = ?1');
  assert.deepEqual(out.values, ['x']);
});

test(':: 캐스트는 플레이스홀더로 오인하지 않는다', () => {
  const out = bindNamedParams('SELECT a::text, :id', { id: 7 });
  assert.equal(out.sql, 'SELECT a::text, ?1');
  assert.deepEqual(out.values, [7]);
});

test('SQL 에 등장한 이름이 값 객체에 없으면 명시적 에러를 던진다', () => {
  assert.throws(
    () => bindNamedParams('SELECT * FROM t WHERE id = :id AND k = :key', { id: 1 }),
    /missing parameter ":key"/,
  );
});

test('값이 명시적으로 null 이면(키 존재) 통과시킨다', () => {
  const out = bindNamedParams('SELECT (:a IS NULL OR x = :a)', { a: null });
  assert.deepEqual(out.values, [null]);
});

test('reminderMarkState 형태의 CASE/중복 파라미터 SQL', () => {
  const sql =
    'UPDATE reminder SET state = :state, updated_at = :updatedAt, ' +
    'os_request_id = CASE WHEN :setOs = 1 THEN :osRequestId ELSE os_request_id END, ' +
    'last_synced_at = CASE WHEN :setSync = 1 THEN :lastSyncedAt ELSE last_synced_at END ' +
    'WHERE id = :id';
  const out = bindNamedParams(sql, {
    state: 'SCHEDULED',
    updatedAt: 111,
    setOs: 1,
    osRequestId: 'req-1',
    setSync: 0,
    lastSyncedAt: null,
    id: 9,
  });
  assert.ok(!out.sql.includes(':'));
  assert.deepEqual(out.values, ['SCHEDULED', 111, 1, 'req-1', 0, null, 9]);
});
