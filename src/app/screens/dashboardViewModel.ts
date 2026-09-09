/**
 * 대시보드("오늘" 탭) 날짜 네비게이션 · 진행률 한 줄 · 접이식 검색 순수 로직 (F-20 / F-21 / F-22).
 * 설계 근거: document/architect/logic.md v1.11 §7.1 / §16.3.7, plan v1.6 §5.15 P-45~P-53.
 * v1.11 재확정 방향: 개수 카드 2장 → 진행률 한 줄(`progressFillRatio`), 상시 입력창 → 접이식 검색
 * (`resolveSearchToggle`), 미래 날짜 분기(`isFutureDate`). 델타는 UI 계층 한정 — 코어·서비스·포트 무변경.
 *
 * 플랫폼 비의존(react / react-native 미import) — DashboardScreen 이 이 모듈의 순수 함수를
 * 조합해 화면 상태를 구성한다. 무인자 `new Date()` / `Date.now()` 를 쓰지 않으며,
 * 로컬-일 산술은 코어 `time.ts` 의 순수 유틸(`startOfLocalDay`)에 위임한다(logic §16.11 T-04).
 */
import { DAY_MS, startOfLocalDay } from '../../core/domain/time.ts';

/** 인라인 검색 디바운스(ms). 인메모리 필터라 DB 왕복형 SearchScreen(250ms)보다 짧게 둔다 (logic §16.3.7). */
export const DASHBOARD_INLINE_SEARCH_DEBOUNCE_MS = 200;

/** 기준 날짜에 일정이 아예 없을 때(E-10-1 / AC-61). */
export const DASHBOARD_EMPTY_TEXT = '오늘 일정이 없습니다';

/** 기준 날짜에 일정은 있으나 검색어와 일치가 없을 때(E-22-1 / AC-63) — 위 문구와 반드시 구분. */
export const DASHBOARD_SEARCH_EMPTY_TEXT = '검색어에 해당하는 오늘 일정이 없습니다';

/** OI-19: 과거/미래 기준일에서 새 일정 추가 시 기본 시작 일시 = 해당 날짜 09:00 로컬. */
const EDITOR_PRESET_START_OFFSET_MS = 9 * 3_600_000;

/** timeZone 기준 nowTs 가 속한 로컬 날짜의 자정(epoch ms). 기준 날짜 기본값·"오늘로" 대상. */
export function resolveTodayStart(nowTs: number, timeZone: string): number {
  return startOfLocalDay(nowTs, timeZone);
}

/**
 * 기준 날짜(로컬 자정 epoch ms)를 하루 앞뒤로 이동한다(F-20, logic §16.3.7).
 * `refTs + dir*DAY_MS` 로 목표일 자정 근처(±DST 편차 최대 1h)에 도달한 뒤, 12h 쿠션을
 * 더해 목표일 정오 부근으로 스냅 → `startOfLocalDay` 로 목표일 자정을 얻는다. 12h ≫ 1h 이므로
 * DST 로 하루가 23h/25h 여도 항상 인접 달력일로만 이동한다(E-20-4).
 *
 * 주: 쿠션은 방향과 무관하게 `+HALF_DAY` 다(뒤로 이동 시에도 목표일 "정오"로 들어가야 하므로).
 * logic §16.3.7(v1.11 DASH-01 정정)이 방향 무관 `+ HALF_DAY` 로 확정 — 이 구현과 일치.
 */
export function stepReferenceDate(refTs: number, dir: -1 | 1, timeZone: string): number {
  const halfDay = DAY_MS / 2;
  return startOfLocalDay(refTs + dir * DAY_MS + halfDay, timeZone);
}

/**
 * 미래 기준 날짜 판정(F-21 / P-52 / D-19(a), logic §7.1.2 / §16.3.7).
 * `refTs`·`todayStartTs` 는 둘 다 로컬 자정 epoch ms(P-17). 순수 표시 조건이며
 * `getSummary` 호출·인자·결과에는 영향을 주지 않는다.
 */
export function isFutureDate(refTs: number, todayStartTs: number): boolean {
  return refTs > todayStartTs;
}

/**
 * 진행률 한 줄 progress bar 채움 비율 (F-21, P-07 = 완료율 정의).
 * `total <= 0` 이면 0(빈(0%) bar). 범위를 [0, 1] 로 클램프한다.
 */
export function progressFillRatio(total: number, done: number): number {
  if (total <= 0) return 0;
  const r = done / total;
  if (r < 0) return 0;
  if (r > 1) return 1;
  return r;
}

export interface SearchToggleResult {
  /** 토글 후 펼침 상태. */
  searchExpanded: boolean;
  /** 접힘으로 전환되어 `inlineQuery` 를 `''` 로 초기화해야 하는가(D-18(a) / E-22-6). */
  clearQuery: boolean;
}

/**
 * 접이식 검색 아이콘 토글 결정(F-22, D-18(a), logic §7.1.3 / §16.3.7).
 * 펼침→접힘 전환이면 검색어를 비워 필터를 해제한다(전체 목록 복원).
 * 접힘→펼침 전환은 검색어를 건드리지 않는다(항상 `''` 상태).
 */
export function resolveSearchToggle(expanded: boolean): SearchToggleResult {
  const next = !expanded;
  return { searchExpanded: next, clearQuery: !next };
}

/** 대소문자·앞뒤 공백 무시 정규화(P-48). 한국어는 케이스 개념이 없어 실질 트림 기준. */
export function inlineNormalize(s: string): string {
  return s.trim().toLowerCase();
}

/**
 * 인라인 검색 술어(D-15 — 제목 + 메모, 유형명 미포함).
 * `normalizedQuery` 는 `inlineNormalize` 를 이미 통과한 값. 빈 문자열이면 전부 통과.
 */
export function matchesInlineQuery(
  item: { title: string; memo: string | null },
  normalizedQuery: string,
): boolean {
  if (normalizedQuery.length === 0) return true;
  return (
    inlineNormalize(item.title).includes(normalizedQuery) ||
    inlineNormalize(item.memo ?? '').includes(normalizedQuery)
  );
}

/**
 * 이미 조회된 기준 날짜 목록에 대한 표시 계층 순수 필터(§7.1.3).
 * 검색어가 빈 문자열·공백만이면(E-22-4) 필터를 적용하지 않고 전체 목록을 돌려준다.
 * 접이식 검색이 접혀 있으면 `inlineQuery` 가 항상 `''` 이므로 여기서 no-op 이 된다.
 */
export function filterByInlineQuery<T extends { title: string; memo: string | null }>(
  items: readonly T[],
  rawQuery: string,
): T[] {
  const q = inlineNormalize(rawQuery);
  if (q.length === 0) return items.slice();
  return items.filter((x) => matchesInlineQuery(x, q));
}

export type DashboardListEmptyState = 'hidden' | 'no-schedules' | 'no-search-results';

/**
 * 목록 빈 상태 분기(E-10-1 vs E-22-1). "그 날짜에 일정 없음"이 검색 무결과보다 우선한다(E-22-5).
 * 로딩·에러 표시 여부는 화면이 별도로 판단한다.
 */
export function dashboardListEmptyState(
  itemsLength: number,
  visibleLength: number,
  rawQuery: string,
): DashboardListEmptyState {
  if (itemsLength === 0) return 'no-schedules';
  if (visibleLength === 0 && inlineNormalize(rawQuery).length > 0) return 'no-search-results';
  return 'hidden';
}

export interface MidnightRolloverInput {
  /** 현재 화면이 보고 있는 기준 날짜(로컬 자정 epoch ms). */
  referenceDate: number;
  /** 직전 판별 시점의 "오늘" 자정. */
  prevTodayStart: number;
  /** 지금 재평가한 "오늘" 자정. */
  newTodayStart: number;
}

export interface MidnightRolloverResult {
  nextReferenceDate: number;
  nextPrevTodayStart: number;
  /** 기준 날짜가 실제로 이동했는지(= 재조회 필요). */
  changed: boolean;
}

/**
 * 자정 롤오버 판별(P-46 / E-10-2 / E-20-3 / AC-59).
 * 자정 직전 "오늘"을 보고 있었으면 새 오늘로 함께 이동, 다른 날짜를 보고 있었으면 그대로 유지한다.
 */
export function resolveMidnightRollover(input: MidnightRolloverInput): MidnightRolloverResult {
  const wasViewingToday = input.referenceDate === input.prevTodayStart;
  const nextReferenceDate =
    wasViewingToday && input.referenceDate !== input.newTodayStart
      ? input.newTodayStart
      : input.referenceDate;
  return {
    nextReferenceDate,
    nextPrevTodayStart: input.newTodayStart,
    changed: nextReferenceDate !== input.referenceDate,
  };
}

/**
 * 연속 탭(E-20-4) stale 응답 판별. `load()` 시작 시 잡은 시퀀스 토큰이 아직 최신이면 반영, 아니면 폐기.
 */
export function isFreshLoadSequence(startedSeq: number, currentSeq: number): boolean {
  return startedSeq === currentSeq;
}

/** OI-19: `presetDate`(로컬 자정) → 신규 편집 화면 기본 시작 일시(해당 날짜 09:00 로컬). */
export function editorPresetStartAt(presetDate: number): number {
  return presetDate + EDITOR_PRESET_START_OFFSET_MS;
}
