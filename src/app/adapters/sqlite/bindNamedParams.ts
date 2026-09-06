/**
 * named → positional 파라미터 shim (순수 함수).
 * 설계 근거: Bug RENDER-003 — op-sqlite 9.3.0 `db.execute(query, params?: any[])` 는
 *   위치 기반 배열만 받는다(내부 `params?.map(...)`). 리포지토리 SQL 은 named 바인딩
 *   (`:name` / `$name` / `@name`)을 그대로 유지하고, 어댑터가 실행 직전에 이 함수로
 *   `(sqlWithPositionalPlaceholders, valuesArray)` 로 변환한다.
 *
 * shim 계약 (Architect 확정 8개항):
 *  1. 리포지토리/마이그레이션이 `execute(sql, paramsObject)` 로 넘기기 직전에 호출된다.
 *     SQL 문자열의 `:name` 표기는 소스에 그대로 남는다.
 *  2. 플레이스홀더 형식: `:name` / `$name` / `@name`. 문자열 리터럴(`'...'`, `''` 이스케이프
 *     포함)과 `--` 줄 주석 안의 `:` `$` `@` 는 플레이스홀더로 보지 않는다. `::` 캐스트도 제외.
 *     (스킵 규칙은 `sqlSplit.ts` 의 리터럴/주석 처리와 동일하다.)
 *  3. 등장 순서로 이름을 수집하되 동일 이름은 슬롯 1개로 dedup 한다. 값 배열 순서 =
 *     최초 등장 순서 (SQLite 의 "이름당 슬롯 1개" 규칙과 일치).
 *     예: `(:x IS NULL OR a = :x) AND b < :now AND c > :now`
 *       → `(?1 IS NULL OR a = ?1) AND b < ?2 AND c > ?2`, values `[params.x, params.now]`.
 *  4. 각 `:name`(중복 포함 모든 등장)을 그 이름의 dedup 슬롯 번호 `?N` 로 치환한다.
 *     `?N` 은 SQLite 위치 파라미터로, 같은 N 은 같은 값을 참조한다 → 배열은 dedup 상태로 전달.
 *  5. SQL 에 등장한 이름이 값 객체에 없으면 명시적 에러를 throw 한다(조용한 undefined 금지).
 *  8. 순수 함수로 분리해 `node:test` 로 검증한다.
 *
 * 배열/undefined 가 들어오면 이미 positional 이므로 그대로 통과시킨다.
 */

export interface BoundQuery {
  sql: string;
  values: unknown[];
}

const NAME_HEAD = /[A-Za-z_]/;
const NAME_TAIL = /[A-Za-z0-9_]/;

function readName(sql: string, start: number): string {
  if (start >= sql.length || !NAME_HEAD.test(sql[start] as string)) return '';
  let end = start + 1;
  while (end < sql.length && NAME_TAIL.test(sql[end] as string)) end += 1;
  return sql.slice(start, end);
}

export function bindNamedParams(
  sql: string,
  params: Record<string, unknown> | unknown[] | undefined | null,
): BoundQuery {
  // 이미 positional (배열) 이거나 파라미터가 없으면 변환 없이 통과.
  if (params === undefined || params === null) return { sql, values: [] };
  if (Array.isArray(params)) return { sql, values: params };

  const slots = new Map<string, number>(); // name → 1-based 슬롯 번호
  const names: string[] = []; // 슬롯 번호 순서 = 최초 등장 순서
  let out = '';
  let inString = false;
  let i = 0;

  while (i < sql.length) {
    const ch = sql[i] as string;
    const next = sql[i + 1];

    if (inString) {
      out += ch;
      if (ch === "'") {
        if (next === "'") {
          out += next; // 이스케이프된 따옴표
          i += 2;
          continue;
        }
        inString = false;
      }
      i += 1;
      continue;
    }

    // 줄 주석: 줄 끝까지 원문 그대로 복사(플레이스홀더로 보지 않는다).
    if (ch === '-' && next === '-') {
      while (i < sql.length && sql[i] !== '\n') {
        out += sql[i];
        i += 1;
      }
      continue;
    }

    if (ch === "'") {
      inString = true;
      out += ch;
      i += 1;
      continue;
    }

    // `::` 캐스트는 플레이스홀더가 아니다.
    if (ch === ':' && next === ':') {
      out += '::';
      i += 2;
      continue;
    }

    if (ch === ':' || ch === '$' || ch === '@') {
      const name = readName(sql, i + 1);
      if (name.length > 0) {
        let slot = slots.get(name);
        if (slot === undefined) {
          names.push(name);
          slot = names.length; // 1-based
          slots.set(name, slot);
        }
        out += `?${slot}`;
        i += 1 + name.length;
        continue;
      }
    }

    out += ch;
    i += 1;
  }

  const values = names.map((name) => {
    if (!(name in (params as Record<string, unknown>))) {
      throw new Error(`bindNamedParams: missing parameter ":${name}"`);
    }
    return (params as Record<string, unknown>)[name];
  });

  return { sql: out, values };
}
