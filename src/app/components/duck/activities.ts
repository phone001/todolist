/**
 * 브랜드 로딩 인디케이터 — 오리 순환 활동 목록·순서·타이밍.
 * 설계 근거: document/architect/logic.md v1.7 §16.9.4 (활동 순환, D-06(1), AC-30), plan.md v1.2 F-17 「순환 활동 목록」.
 *
 * 순수 모듈 — `react` / `react-native` / `react-native-svg` 미의존 (core tsc 빌드 포함 대상, V-28).
 */

import { ACTIVITY_CROSSFADE_MS, ACTIVITY_VISIBLE_MS } from '../loadingIndicatorMachine.ts';

export type ActivityId = 'checkList' | 'flipCalendar' | 'ringBell' | 'checkDone' | 'search';

export interface ActivityDef {
  id: ActivityId;
  /** 활동 의미 캡션(시각 텍스트). 스크린리더에서는 숨긴다 (§16.9.7, AC-37). */
  caption: string;
  /** 활동의 오리 동작 요약(개발 참고용). */
  motion: string;
}

/** 활동 정의 — 오리 도상은 duckGeometry.ts 를 공유하고, 여기서는 소품·의미만 정의한다. */
export const ACTIVITIES: Record<ActivityId, ActivityDef> = {
  checkList: { id: 'checkList', caption: '일정을 확인하고 있어요', motion: '클립보드를 들고 항목을 훑어본다' },
  flipCalendar: { id: 'flipCalendar', caption: '날짜를 정리하고 있어요', motion: '벽걸이 달력의 장을 넘긴다' },
  ringBell: { id: 'ringBell', caption: '알림을 맞추고 있어요', motion: '손종을 흔들고 음파가 퍼진다' },
  checkDone: { id: 'checkDone', caption: '마무리하고 있어요', motion: '체크박스에 체크를 그린다' },
  search: { id: 'search', caption: '검색 결과를 모으고 있어요', motion: '돋보기로 항목을 살핀다' },
};

/** 기본 순환 = 4활동 (P-23 범위 3~5 충족). 무한 loop. */
export const DEFAULT_SEQUENCE: readonly ActivityId[] = ['checkList', 'flipCalendar', 'ringBell', 'checkDone'];

/** Search 인라인 변형 = 5활동, 'search' 를 첫 활동으로 (F-17 노출 위치 #4). */
export const SEARCH_SEQUENCE: readonly ActivityId[] = ['search', 'checkList', 'flipCalendar', 'ringBell', 'checkDone'];

/** 활동 순서 길이 제한 (P-23). */
export const MIN_ACTIVITIES = 3;
export const MAX_ACTIVITIES = 5;

export { ACTIVITY_VISIBLE_MS, ACTIVITY_CROSSFADE_MS };

/** 활동 1루프 총 시간(ms). 기본 4활동 × 2500ms = 10s → 타임아웃 임계와 정합(§16.9.3). */
export function loopDurationMs(sequence: readonly ActivityId[]): number {
  return sequence.length * ACTIVITY_VISIBLE_MS;
}

function rotateToFirst(seq: readonly ActivityId[], first: ActivityId | undefined): ActivityId[] {
  if (!first) return [...seq];
  const i = seq.indexOf(first);
  if (i <= 0) return [...seq];
  return [...seq.slice(i), ...seq.slice(0, i)];
}

/**
 * 순환 활동 순서를 도출한다 (§16.9.4).
 *
 * - `override` 가 3개 이상이면 앞 5개로 clamp 후 사용, `startActivity` 가 그 안에 있으면 첫 활동으로 회전.
 * - `override` 가 3개 미만이면 무시(기본값 사용).
 * - `startActivity === 'search'` → SEARCH_SEQUENCE (5활동).
 * - `startActivity` 가 지정됐고 기본 순환에 없으면 맨 앞에 붙이고 5개로 clamp.
 * - 그 외 → DEFAULT_SEQUENCE, `startActivity` 가 있으면 첫 활동으로 회전.
 */
export function activitySequence(
  startActivity?: ActivityId,
  override?: readonly ActivityId[],
): ActivityId[] {
  if (override && override.length >= MIN_ACTIVITIES) {
    const clamped = override.slice(0, MAX_ACTIVITIES);
    return rotateToFirst(clamped, startActivity);
  }
  if (startActivity === 'search') {
    return [...SEARCH_SEQUENCE];
  }
  if (startActivity && !DEFAULT_SEQUENCE.includes(startActivity)) {
    return [startActivity, ...DEFAULT_SEQUENCE].slice(0, MAX_ACTIVITIES);
  }
  return rotateToFirst(DEFAULT_SEQUENCE, startActivity);
}

/** 정적 폴백 1컷의 대표 활동 (plan.md F-17 「정적 폴백」: 대표 활동 "일정 확인"). */
export const STATIC_FALLBACK_ACTIVITY: ActivityId = 'checkList';
