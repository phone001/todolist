/**
 * op-sqlite 기반 UnitOfWork + MigrationDb 어댑터 (네이티브 바인딩).
 * 설계 근거: document/architect/logic.md v1.1 §16.5, database.md §5.
 *
 * 환경 제약: 이 파일은 `@op-engineering/op-sqlite` 를 import 하므로 현재 파이프라인 환경에서는
 * 타입체크/실행하지 않는다(overview v1.1 "빌드 환경 제약", nfr §11.2). 온디바이스에서 검증한다.
 * 순수 규칙(pragma 문자열, cursor, migration 목록, named→positional shim)은 별도 `.ts` 로
 * 분리해 node:test 로 검증한다.
 */
import { open } from '@op-engineering/op-sqlite';
import type { DB } from '@op-engineering/op-sqlite';
import type { UnitOfWork } from '../../../core/ports/repositories.ts';
import type { MigrationDb } from '../../../core/migration/runner.ts';
import {
  GET_USER_VERSION_PRAGMA,
  connectionPragmas,
  setUserVersionPragma,
} from './pragma.ts';
import { splitSqlStatements } from './sqlSplit.ts';
import { bindNamedParams } from './bindNamedParams.ts';
import { mapSqliteError } from '../errors.ts';

export interface OpenOptions {
  name?: string;
  location?: string;
  /** SQLCipher 키(D-03). 지정 시 PRAGMA key 로 암호화 DB 를 연다. */
  encryptionKey?: string | null;
}

/**
 * op-sqlite `execute` 는 위치 기반 배열만 받는다(RENDER-003). 리포지토리/마이그레이션이
 * named 파라미터 객체(`{ key }` 등)를 넘겨도 동작하도록, `execute` 호출을 가로채 실행 직전에
 * `bindNamedParams` 로 `(?N, values[])` 로 변환한다. 나머지 메서드/프로퍼티는 그대로 위임한다.
 * 이 래핑된 DB 는 어댑터 내부(transaction/exec/PRAGMA)와
 * `createSqliteRepositories(db.db)` 양쪽에서 공유된다.
 * 파라미터가 없으면(마이그레이션 DDL·PRAGMA) 두 번째 인자 없이 원본 호출과 동일하게 실행한다.
 */
function withNamedParamBinding(db: DB): DB {
  const boundExecute = (sql: string, params?: unknown) => {
    const { sql: positionalSql, values } = bindNamedParams(
      sql,
      params as Record<string, unknown> | unknown[] | undefined,
    );
    const exec = db.execute as (s: string, p?: unknown) => unknown;
    return values.length > 0 ? exec(positionalSql, values) : exec(positionalSql);
  };
  return new Proxy(db, {
    get(target, prop, receiver) {
      if (prop === 'execute') return boundExecute;
      const value = Reflect.get(target, prop, receiver);
      return typeof value === 'function'
        ? (value as (...a: unknown[]) => unknown).bind(target)
        : value;
    },
  }) as DB;
}

export class OpSqliteDb implements UnitOfWork, MigrationDb {
  readonly db: DB;
  private txDepth = 0;

  private constructor(db: DB) {
    this.db = db;
  }

  static async openDatabase(opts: OpenOptions = {}): Promise<OpSqliteDb> {
    // op-sqlite 9.x 네이티브 open() 은 options 에 존재하는 키를 무조건 asString() 한다.
    // `{ location: undefined }` 처럼 값이 undefined 여도 hasProperty 가 true → "Value is undefined,
    // expected a String" 예외. 따라서 실제 문자열 값이 있을 때만 키를 포함한다.
    const openOpts: { name: string; location?: string; encryptionKey?: string } = {
      name: opts.name ?? 'todaywhat.db',
    };
    if (opts.location != null) openOpts.location = opts.location;
    if (opts.encryptionKey != null) openOpts.encryptionKey = opts.encryptionKey;
    // named→positional shim 을 씌운 DB 를 어댑터와 리포지토리가 공유한다(RENDER-003).
    const db = withNamedParamBinding(open(openOpts));
    const wrapper = new OpSqliteDb(db);
    for (const pragma of connectionPragmas()) {
      await db.execute(pragma);
    }
    return wrapper;
  }

  /** UnitOfWork: 콜백이 throw 하면 전체 롤백. 중첩은 바깥 트랜잭션에 합류(코어 InMemoryDb 와 동일 규약). */
  async transaction<T>(work: () => Promise<T>): Promise<T> {
    if (this.txDepth > 0) return work();
    this.txDepth += 1;
    await this.db.execute('BEGIN IMMEDIATE');
    try {
      const result = await work();
      await this.db.execute('COMMIT');
      this.txDepth -= 1;
      return result;
    } catch (err) {
      try {
        await this.db.execute('ROLLBACK');
      } finally {
        this.txDepth -= 1;
      }
      throw mapSqliteError(err, 'write');
    }
  }

  // --- MigrationDb ---

  async getUserVersion(): Promise<number> {
    const res = await this.db.execute(GET_USER_VERSION_PRAGMA);
    // op-sqlite 9.x: QueryResult.rows 는 평면 배열(6.x 의 rows._array 접근자 제거, overview v1.2 §매핑 각주).
    const row = (res.rows?.[0] ?? {}) as Record<string, unknown>;
    const v = row.user_version;
    return typeof v === 'number' ? v : 0;
  }

  async setUserVersion(version: number): Promise<void> {
    await this.db.execute(setUserVersionPragma(version)); // 정수 검증은 pragma.ts 가 수행
  }

  async exec(sql: string): Promise<void> {
    // op-sqlite execute() 는 단일 문장만 실행한다. 트리거 인지 스플리터로 분해한다(SHELL-001).
    // CREATE TRIGGER ... BEGIN ... END; 의 내부 ';' 는 문장 경계가 아니다.
    for (const stmt of splitSqlStatements(sql)) {
      await this.db.execute(stmt);
    }
  }

  // MigrationDb.transaction 은 UnitOfWork.transaction 과 시그니처가 같으므로 위 transaction() 이 겸한다.

  close(): void {
    this.db.close();
  }
}
