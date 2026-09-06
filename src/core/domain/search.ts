/**
 * 검색어 정규화 및 주입 방어 유틸 (순수 함수).
 * 설계 근거: document/architect/logic.md 8 (SearchService), 13.3 (Injection 방어), 정책 P-11/P-12.
 * V-9, V-11.
 *
 * 이 프로젝트는 현재 SQLite 어댑터를 네이티브 환경에서만 실행하지만,
 * FTS5 / LIKE 질의를 만드는 규칙 자체는 여기에서 정의·검증하여 어댑터가 그대로 사용한다.
 */

/** FTS 를 사용할 최소 글자 수. 미만이면 LIKE 폴백(P-11). */
export const FTS_MIN_CHARS = 2;
/** LIKE 폴백 결과 상한(P-11). */
export const LIKE_FALLBACK_LIMIT = 50;

export type SearchMode = 'empty' | 'fts' | 'like';

export function resolveSearchMode(rawQuery: string): SearchMode {
  const q = rawQuery.trim();
  if (q.length === 0) return 'empty';
  return q.length >= FTS_MIN_CHARS ? 'fts' : 'like';
}

/**
 * LIKE 패턴에 쓰일 사용자 입력 이스케이프.
 * 백슬래시, `%`, `_` 를 이스케이프한다. 어댑터는 반드시 `ESCAPE '\'` 를 붙여야 한다.
 */
export function escapeLike(input: string): string {
  return input.replace(/[\\%_]/g, (ch) => '\\' + ch);
}

const CONTROL_CHARS = new RegExp('[\\u0000-\\u001F\\u007F]', 'g');

/** 제어문자 제거 + 공백 정규화 + 길이 상한. 외부/사용자 텍스트 저장 전 정제(13.3). */
export function sanitizeText(input: string, maxLen: number): string {
  const noControl = input.replace(CONTROL_CHARS, ' ');
  const collapsed = noControl.replace(/\s+/g, ' ').trim();
  return collapsed.length > maxLen ? collapsed.slice(0, maxLen) : collapsed;
}

/**
 * 사용자 검색어를 FTS5 MATCH 식으로 변환한다.
 * - 각 토큰을 큰따옴표 phrase 로 감싸고 내부 큰따옴표는 두 개로 이스케이프한다.
 * - `NEAR`, `*`, `:`, `^`, `AND/OR/NOT` 등 FTS 연산자는 phrase 안에서 리터럴로 처리된다.
 * - 토큰이 없으면 매치되지 않는 식(빈 문자열)을 돌려준다.
 */
export function toFtsMatchExpression(rawQuery: string): string {
  const tokens = rawQuery
    .trim()
    .split(/\s+/)
    .filter((t) => t.length > 0);
  if (tokens.length === 0) return '';
  return tokens.map((t) => '"' + t.replace(/"/g, '""') + '"').join(' ');
}

/**
 * 인메모리/폴백용 토큰 매칭. 어댑터가 없는 환경에서 SearchService 를 검증하기 위한 참조 구현.
 * FTS 의 "모든 토큰이 어떤 단어의 접두사로 존재" 규칙을 근사한다.
 */
export function ftsLikeMatch(haystack: string, rawQuery: string): boolean {
  const words = haystack
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
  const tokens = rawQuery.toLowerCase().trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return false;
  return tokens.every((tok) => words.some((w) => w === tok || w.startsWith(tok)));
}
