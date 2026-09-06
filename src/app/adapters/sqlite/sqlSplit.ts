/**
 * 다중 문장 SQL 스플리터 (순수 함수).
 * 설계 근거: SHELL-001 수정 — op-sqlite `execute()` 는 단일 문장만 실행하므로 마이그레이션 DDL 을
 *           문장 단위로 나눠야 한다. 단순 ';' 분할은 `CREATE TRIGGER ... BEGIN ... END;` 의
 *           내부 ';' 에서 트리거 본문을 파손한다(database.md §6).
 *
 * 규칙:
 *  - 문자열 리터럴('...') 안의 ';' / '--' 는 구분자로 보지 않는다.
 *  - `--` 부터 줄 끝까지는 주석(제거).
 *  - `BEGIN` ~ 대응 `END` 사이(트리거 본문)의 ';' 는 문장 경계가 아니다.
 *  - 최상위 ';' 에서만 분할한다. 빈 문장은 버린다.
 */

export function splitSqlStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = '';
  let inString = false;
  let beginDepth = 0;
  let i = 0;

  const isWordBoundary = (ch: string | undefined): boolean =>
    ch === undefined || !/[A-Za-z0-9_]/.test(ch);

  while (i < sql.length) {
    const ch = sql[i];
    const next = sql[i + 1];

    if (inString) {
      current += ch;
      if (ch === "'") {
        if (next === "'") {
          current += next; // 이스케이프된 따옴표
          i += 2;
          continue;
        }
        inString = false;
      }
      i += 1;
      continue;
    }

    // 줄 주석
    if (ch === '-' && next === '-') {
      while (i < sql.length && sql[i] !== '\n') i += 1;
      continue;
    }

    if (ch === "'") {
      inString = true;
      current += ch;
      i += 1;
      continue;
    }

    // BEGIN / END 키워드 추적 (대소문자 무시, 단어 경계 확인)
    const upcoming = sql.slice(i, i + 5).toUpperCase();
    if (upcoming === 'BEGIN' && isWordBoundary(sql[i - 1]) && isWordBoundary(sql[i + 5])) {
      beginDepth += 1;
      current += sql.slice(i, i + 5);
      i += 5;
      continue;
    }
    if (sql.slice(i, i + 3).toUpperCase() === 'END' && isWordBoundary(sql[i - 1]) && isWordBoundary(sql[i + 3])) {
      if (beginDepth > 0) beginDepth -= 1;
      current += sql.slice(i, i + 3);
      i += 3;
      continue;
    }

    if (ch === ';' && beginDepth === 0) {
      const trimmed = current.trim();
      if (trimmed.length > 0) statements.push(trimmed);
      current = '';
      i += 1;
      continue;
    }

    current += ch;
    i += 1;
  }

  const tail = current.trim();
  if (tail.length > 0) statements.push(tail);
  return statements;
}
