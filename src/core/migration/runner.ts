/**
 * 스키마 마이그레이션 러너 (PRAGMA user_version 기반).
 * 설계 근거: document/architect/database.md 5, document/architect/logic.md 12. NFR-06, AC-24, E-15-1, V-12.
 *
 * DB 엔진에 비의존적으로 정의한다. 운영은 op-sqlite 어댑터가 MigrationDb 를 구현하고,
 * 테스트는 FakeMigrationDb 로 순차 적용/실패 롤백을 검증한다.
 */

export interface MigrationDb {
  getUserVersion(): Promise<number>;
  setUserVersion(version: number): Promise<void>;
  exec(sql: string): Promise<void>;
  /** work 가 throw 하면 이 트랜잭션에서 이뤄진 exec/setUserVersion 을 롤백한다. */
  transaction<T>(work: () => Promise<T>): Promise<T>;
}

export interface Migration {
  version: number;
  name: string;
  up: string;
}

export interface MigrationRunResult {
  fromVersion: number;
  toVersion: number;
  applied: number[];
  failedAt?: number;
  error?: string;
}

/**
 * migrations 를 version 오름차순으로 정렬해 현재 user_version 초과분만 적용한다.
 * 각 마이그레이션은 독립 트랜잭션(exec + setUserVersion). 실패 시 그 마이그레이션을 롤백하고 중단한다.
 * 다운그레이드(현재 버전 > 최대 마이그레이션 버전)는 수행하지 않는다.
 */
export async function runMigrations(
  db: MigrationDb,
  migrations: Migration[],
): Promise<MigrationRunResult> {
  const sorted = [...migrations].sort((a, b) => a.version - b.version);
  const fromVersion = await db.getUserVersion();
  const applied: number[] = [];

  for (const migration of sorted) {
    if (migration.version <= fromVersion) continue;

    try {
      await db.transaction(async () => {
        await db.exec(migration.up);
        await db.setUserVersion(migration.version);
      });
      applied.push(migration.version);
    } catch (err) {
      return {
        fromVersion,
        toVersion: await db.getUserVersion(),
        applied,
        failedAt: migration.version,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  return { fromVersion, toVersion: await db.getUserVersion(), applied };
}
