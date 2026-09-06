/**
 * keyset(cursor) 페이지네이션 인코딩 (순수 함수).
 * 설계 근거: document/architect/nfr.md 1.2 ("keyset cursor = (start_at, id)", OFFSET 미사용),
 *           logic.md v1.1 §16.5 (SqliteScheduleRepository).
 *
 * cursor = base64url("<startAt>:<id>"). SQLite 어댑터의 findInRange/search 가 사용한다.
 */

import { base64UrlToUtf8, utf8ToBase64Url } from '../base64.ts';

export interface Keyset {
  startAt: number;
  id: number;
}

export function encodeCursor(key: Keyset): string {
  if (!Number.isInteger(key.startAt) || !Number.isInteger(key.id)) {
    throw new Error('encodeCursor: startAt/id must be integers');
  }
  return utf8ToBase64Url(`${key.startAt}:${key.id}`);
}

/** 잘못된 커서는 null (첫 페이지로 처리). 신뢰 경계 밖 입력으로 취급. */
export function decodeCursor(cursor: string | null | undefined): Keyset | null {
  if (!cursor) return null;
  try {
    const decoded = base64UrlToUtf8(cursor);
    const m = /^(-?\d{1,16}):(\d{1,16})$/.exec(decoded);
    if (!m) return null;
    const startAt = Number(m[1]);
    const id = Number(m[2]);
    if (!Number.isInteger(startAt) || !Number.isInteger(id) || id <= 0) return null;
    return { startAt, id };
  } catch {
    return null;
  }
}

/**
 * keyset 조건 SQL 조각. 정렬이 (start_at ASC, id ASC) 일 때:
 *   WHERE (start_at > :cs OR (start_at = :cs AND id > :ci))
 * 파라미터는 바인딩으로만 전달한다(문자열 보간 금지, 13.3).
 */
export function keysetWhereClause(column = 'start_at', idColumn = 'id'): string {
  return `(${column} > :cursorStartAt OR (${column} = :cursorStartAt AND ${idColumn} > :cursorId))`;
}
