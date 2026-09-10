/**
 * 통계 화면(F-23) 순수 집계 로직 — 상단 카드(전체 기간 총/완료) + 하단 유형별 월별 그래프.
 * 설계 근거: document/architect/logic.md v1.13 §7.2 / §16.3.8, plan v1.7 §5.16 P-54~P-58,
 *            nfr.md v1.11 §16.
 *
 * 플랫폼 비의존(react / react-native 미import) — StatisticsScreen 이 이 모듈의 순수 함수를
 * 조합해 화면 상태를 구성한다. 무인자 `new Date()` / `Date.now()` 를 쓰지 않으며,
 * 로컬 월 경계 산술은 코어 `time.ts` 의 기존 공개 순수 함수(`localWallToEpoch`)에 위임한다
 * (`dashboardViewModel.ts` 와 동일 규약, logic §16.11 T-04). 코어에 함수를 추가하지 않는다.
 *
 * v1.13 델타(막대→선): 집계 계약(export 시그니처·`YearAggregate` 반환 형태)은 전면 불변.
 * 선 그래프 y축 스케일용 `seriesPointMax` 만 기존 export 를 건드리지 않는 신규 순수 헬퍼로 추가한다.
 */
import { localWallToEpoch } from '../../core/domain/time.ts';

/**
 * 상단 카드/하단 그래프 조회 시 `ScheduleService.findInRange` cursor 루프의 페이지 크기(설계 상수).
 * `CALENDAR_MONTH_PAGE_SIZE` 와 동급. cursor = keyset `(start_at, id)` — `IDX_SCHEDULE_START` 지원.
 */
export const STATISTICS_PAGE_SIZE = 200;

/** 빈 상태 문구 (E-23-1 ~ E-23-4). 스크린리더 낭독용으로 서로 구분한다(nfr §16.3). */
export const STATISTICS_NO_DATA_TEXT = '표시할 데이터가 없습니다';
export const STATISTICS_NO_CATEGORIES_TEXT = '분류할 유형이 없습니다';
export const STATISTICS_NO_YEAR_DATA_TEXT = '해당 연도에 일정이 없습니다';
export const STATISTICS_LOAD_ERROR_TEXT = '통계를 불러오지 못했어요';

/** 집계 입력 행의 최소 형태(Schedule 의 부분집합). 뷰모델은 행의 **현재** `categoryId` 만 본다(P-57). */
export interface StatRow {
  startAt: number;
  isDone: boolean;
  categoryId: number;
}

/** 유형(계열) 메타의 최소 형태(Category 의 부분집합). */
export interface StatCategory {
  id: number;
  name: string;
  color: string;
  isSystem: boolean;
}

/**
 * 단말 로컬 시간대 기준 "올해"(P-17). 그래프 연도 선택의 기본값.
 * 포맷 전용 `new Date(ts)` 는 logic §16.11 에서 허용. 무인자 `new Date()` / `Date.now()` 미사용.
 */
export function currentYear(nowTs: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
  }).formatToParts(new Date(nowTs));
  const y = parts.find((p) => p.type === 'year')?.value ?? '';
  return Number(y);
}

/** 선택 연도의 로컬 [시작, 끝) epoch — `findInRange(startTs, endTs, …)` 범위 인자(D-23(a), P-56). */
export function yearRangeEpochs(
  year: number,
  timeZone: string,
): { startTs: number; endTs: number } {
  return {
    startTs: localWallToEpoch(year, 1, 1, 0, 0, timeZone),
    endTs: localWallToEpoch(year + 1, 1, 1, 0, 0, timeZone),
  };
}

/**
 * 13개 로컬 월 경계 epoch(P-56).
 * `[0]` = 1월 1일 00:00 … `[11]` = 12월 1일 00:00, `[12]` = 다음 해 1월 1일 00:00.
 * `localWallToEpoch` 가 DST 보정을 포함한다.
 */
export function monthBoundaries(year: number, timeZone: string): number[] {
  const out: number[] = [];
  for (let m = 1; m <= 12; m += 1) out.push(localWallToEpoch(year, m, 1, 0, 0, timeZone));
  out.push(localWallToEpoch(year + 1, 1, 1, 0, 0, timeZone));
  return out;
}

/**
 * `startAt` 이 속한 월(1..12). `boundaries` 는 `monthBoundaries()` 결과(길이 13).
 * `boundaries[m-1] <= startAt < boundaries[m]` 인 `m`. 연 범위 밖(예: `findInRange` 의 overlap
 * 반환분 중 `startAt < yearStart`)이면 -1 → 그래프에서 제외한다(월 버킷 기준 = `start_at`, P-56).
 */
export function monthIndexOf(startAt: number, boundaries: number[]): number {
  if (boundaries.length < 13) return -1;
  if (startAt < boundaries[0] || startAt >= boundaries[12]) return -1;
  for (let m = 1; m <= 12; m += 1) {
    if (startAt >= boundaries[m - 1] && startAt < boundaries[m]) return m;
  }
  return -1;
}

export interface StatTotals {
  total: number;
  done: number;
}

/**
 * 상단 카드 집계(D-21(a), P-55). 입력 = `findInRange(0, MAX_SAFE_INTEGER)` cursor 루프로
 * 수집한 전건(soft-deleted 는 `findInRange` 계약이 이미 제외 — 삭제분 미포함).
 * "총 할 일 건수" = 전건 수, "완료된 건수" = `isDone` 인 행 수(완료 상태 = P-04).
 * **하단 그래프 연도 선택과 비연동** — 연도를 바꿔도 이 값은 재계산하지 않는다.
 */
export function aggregateTotals(rows: readonly StatRow[]): StatTotals {
  let done = 0;
  for (const r of rows) if (r.isDone) done += 1;
  return { total: rows.length, done };
}

export interface MonthBucket {
  /** 1..12 */
  month: number;
  /** categoryId → 그 달에 시작일이 속하며 그 유형을 참조하는 행 수(완료 여부 무관). */
  byCategory: Record<number, number>;
  /** 그 달의 전체 건수(= byCategory 합). */
  total: number;
}

export interface YearAggregate {
  /** 길이 12, month 1..12 순. */
  months: MonthBucket[];
  /** 그 연도에 1건 이상 등장한 유형 id — `categories` 순서. 미상 id 는 뒤에 덧붙인다. */
  seriesCategoryIds: number[];
  /** 월 total 의 최댓값(그래프 막대 높이 비율 분모). 데이터 없으면 0. */
  maxBucketTotal: number;
  /** 월 버킷에 실제 배정된 행 수(연 범위 밖 제외). 0 이면 E-23-3(no-year-data). */
  placedRowCount: number;
}

/**
 * 하단 그래프 집계(D-23(a), P-56 / P-57 / E-23-5).
 * - 계열 키 = 행의 **현재** `categoryId`. 라벨·색은 화면이 `categories` 에서 조회한다(rename → 새 이름, R-23-4).
 * - 삭제된 유형에 속했던 행은 F-06 E-06-2 로 이미 기본 유형("기타", `isSystem`)으로 재지정되어 있어
 *   자동으로 "기타" 계열에 합산된다. 방어적으로, `categories` 에 없는 `categoryId` 는 기본 유형으로 접는다.
 * - 각 (월, 유형) 버킷 값 = 완료 여부와 무관하게 전건(완료분 별도 계열은 범위 밖, OI-23).
 */
export function aggregateYear(
  rows: readonly StatRow[],
  categories: readonly StatCategory[],
  boundaries: number[],
): YearAggregate {
  const knownIds = new Set(categories.map((c) => c.id));
  const fallback = categories.find((c) => c.isSystem);
  const fallbackId = fallback ? fallback.id : undefined;

  const months: MonthBucket[] = [];
  for (let m = 1; m <= 12; m += 1) months.push({ month: m, byCategory: {}, total: 0 });

  const appearing = new Set<number>();
  let placedRowCount = 0;

  for (const r of rows) {
    const mi = monthIndexOf(r.startAt, boundaries);
    if (mi < 1 || mi > 12) continue;
    let cid = r.categoryId;
    if (!knownIds.has(cid) && fallbackId !== undefined) cid = fallbackId;
    const bucket = months[mi - 1];
    bucket.byCategory[cid] = (bucket.byCategory[cid] ?? 0) + 1;
    bucket.total += 1;
    appearing.add(cid);
    placedRowCount += 1;
  }

  let maxBucketTotal = 0;
  for (const b of months) if (b.total > maxBucketTotal) maxBucketTotal = b.total;

  const seriesCategoryIds: number[] = [];
  for (const c of categories) if (appearing.has(c.id)) seriesCategoryIds.push(c.id);
  for (const id of appearing) if (!knownIds.has(id)) seriesCategoryIds.push(id);

  return { months, seriesCategoryIds, maxBucketTotal, placedRowCount };
}

/**
 * 선(line) 그래프 y축 스케일 분모(logic.md v1.13 §16.3.8).
 * = 한 (월, 유형) 셀의 최대 건수 = `max over m in 1..12, cid in seriesCategoryIds of (months[m-1].byCategory[cid] ?? 0)`.
 * 선 그래프는 계열(유형)별 건수를 개별 선으로 그리므로 스택 합(`maxBucketTotal`)이 아닌 이 값을 분모로 써야
 * 세로 공간을 활용한다. `YearAggregate` 로부터 **순수 파생**하며 뷰모델 반환 형태(`YearAggregate`)에 필드를
 * 추가하지 않는다(v1.13 델타 방침). 데이터가 없으면 0 — 화면이 `Math.max(1, …)` 로 하한 처리한다.
 */
export function seriesPointMax(agg: YearAggregate): number {
  let max = 0;
  for (const bucket of agg.months) {
    for (const cid of agg.seriesCategoryIds) {
      const v = bucket.byCategory[cid] ?? 0;
      if (v > max) max = v;
    }
  }
  return max;
}

/**
 * E-23-2: 기본 유형("기타", `isSystem`) 외에 분류할 사용자 정의 유형이 하나라도 있는가.
 * false 면 그래프 영역에 "분류할 유형이 없습니다" 를 표시한다(문구 구분은 화면).
 */
export function hasMeaningfulCategories(categories: readonly StatCategory[]): boolean {
  return categories.some((c) => !c.isSystem);
}

export type StatisticsEmptyState =
  | 'load-error'
  | 'no-data'
  | 'no-categories'
  | 'no-year-data'
  | 'ok';

/**
 * 빈 상태 / 예외 분기(logic §16.3.8 표, E-23-1 ~ E-23-4).
 * 우선순위: 로드 실패 → 전건 0 → 분류 유형 없음 → 선택 연도 0건 → 정상.
 * `'no-year-data'` 일 때도 상단 카드 수치는 유지된다(전체 기간 누적 — D-21(a) / E-23-3).
 */
export function statisticsEmptyState(
  allRowsLen: number,
  categoriesMeaningful: boolean,
  yearRowsLen: number,
  loadError: boolean,
): StatisticsEmptyState {
  if (loadError) return 'load-error';
  if (allRowsLen === 0) return 'no-data';
  if (!categoriesMeaningful) return 'no-categories';
  if (yearRowsLen === 0) return 'no-year-data';
  return 'ok';
}
