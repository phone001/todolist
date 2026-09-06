/**
 * SQLite PRAGMA 문자열 빌더 (순수 함수).
 * 설계 근거: document/architect/database.md 5 (foreign_keys/WAL/synchronous),
 *           logic.md v1.1 §16.5 (MigrationDb: PRAGMA user_version 은 바인딩 불가 → 정수 강제 후 리터럴).
 *
 * PRAGMA 는 파라미터 바인딩을 지원하지 않으므로, 정수를 리터럴로 넣기 전에 반드시 검증한다.
 */

/** 연결 직후 실행할 PRAGMA 목록. */
export function connectionPragmas(): string[] {
  return ['PRAGMA foreign_keys = ON', 'PRAGMA journal_mode = WAL', 'PRAGMA synchronous = NORMAL'];
}

/** `PRAGMA user_version = N` — N 은 0 이상 정수만 허용(주입 방어). */
export function setUserVersionPragma(version: number): string {
  if (!Number.isInteger(version) || version < 0 || version > 2_147_483_647) {
    throw new Error(`setUserVersionPragma: invalid version ${String(version)}`);
  }
  return `PRAGMA user_version = ${version}`;
}

export const GET_USER_VERSION_PRAGMA = 'PRAGMA user_version';

/** 무결성 점검(부트스트랩 안전 모드 판단, E-15-1). */
export const INTEGRITY_CHECK_PRAGMA = 'PRAGMA integrity_check';
