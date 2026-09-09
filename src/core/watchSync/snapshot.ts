/**
 * 워치 페이로드 빌더 — 순수 매핑 함수(저장소 미접근).
 * 설계 근거: document/architect/logic.md §17.3, 정책 P-17/P-39/P-40, 예외 E-19-4/E-19-6.
 *
 * 데이터 fetch 는 `WatchSyncService.pushSnapshot()` 가 수행한 뒤 이 함수에 넘긴다
 * (= `DashboardService.getSummary` 와 동일 소스: findForDashboard + 다음 예정 1건 + categories.list).
 */
import { startOfLocalDay, DAY_MS } from '../domain/time.ts';
import type { Clock } from '../domain/clock.ts';
import type { Category, Schedule } from '../domain/types.ts';
import type { WatchScheduleItem, WatchSnapshot } from './types.ts';
import { WATCH_SNAPSHOT_MAX_ITEMS } from './types.ts';

/** E-19-4 폴백: 시스템 기본 유형이 목록에 없을 때 사용할 라벨/색(store.ts 시드와 동일). */
const SYSTEM_FALLBACK = { name: '기타', color: '#8E8E93' } as const;

interface CategoryDisplay {
  label: string;
  color: string;
}

function resolveCategoryDisplay(
  categoryId: number,
  byId: Map<number, Category>,
  systemFallback: CategoryDisplay,
): CategoryDisplay {
  const found = byId.get(categoryId);
  if (found) return { label: found.name, color: found.color };
  // 삭제·미존재 유형 → 시스템 "기타"(E-19-4, E-06-2 준용).
  return systemFallback;
}

function toItem(schedule: Schedule, category: CategoryDisplay): WatchScheduleItem {
  return {
    id: schedule.id,
    title: schedule.title,
    startAt: schedule.startAt,
    timeZone: schedule.timeZone,
    categoryLabel: category.label,
    categoryColor: category.color,
    isHighPriority: schedule.priority === 'HIGH',
    isDone: schedule.isDone,
    doneAt: schedule.doneAt,
    updatedAt: schedule.updatedAt,
  };
}

/**
 * 오늘(로컬 자정 기준) 목록 + 다음 예정 1건을 워치 스냅샷으로 매핑한다.
 *
 * - `today`: `startAt` 오름차순, 최대 200건(초과 시 절단 + `truncated=true`).
 * - `summary`: 절단 이전의 전체 오늘 집합에서 계산 → `DashboardSummary` 와 일치.
 * - 시각: epoch ms(UTC) + IANA tz 원본(P-39). 로컬 변환은 워치 표시 계층.
 */
export function buildWatchSnapshot(
  todaySchedules: Schedule[],
  nextUpcomingSchedule: Schedule | null,
  categories: Category[],
  clock: Clock,
): WatchSnapshot {
  const now = clock.now();
  const dayStart = startOfLocalDay(now, clock.timeZone());
  const dayEnd = dayStart + DAY_MS;

  const byId = new Map<number, Category>(categories.map((c) => [c.id, c]));
  const systemCategory = categories.find((c) => c.isSystem);
  const systemFallback: CategoryDisplay = systemCategory
    ? { label: systemCategory.name, color: systemCategory.color }
    : { label: SYSTEM_FALLBACK.name, color: SYSTEM_FALLBACK.color };

  const sorted = [...todaySchedules].sort((a, b) => a.startAt - b.startAt || a.id - b.id);

  const done = sorted.filter((s) => s.isDone).length;
  const notDone = sorted.length - done;

  const truncated = sorted.length > WATCH_SNAPSHOT_MAX_ITEMS;
  const visible = truncated ? sorted.slice(0, WATCH_SNAPSHOT_MAX_ITEMS) : sorted;

  const today = visible.map((s) =>
    toItem(s, resolveCategoryDisplay(s.categoryId, byId, systemFallback)),
  );

  const nextUpcoming = nextUpcomingSchedule
    ? {
        id: nextUpcomingSchedule.id,
        title: nextUpcomingSchedule.title,
        startAt: nextUpcomingSchedule.startAt,
        timeZone: nextUpcomingSchedule.timeZone,
      }
    : null;

  return {
    builtAt: now,
    dayStart,
    dayEnd,
    today,
    truncated,
    nextUpcoming,
    summary: { done, notDone },
    ackedOpIds: [],
  };
}
