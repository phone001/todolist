import { startOfLocalDay } from '../../core/domain/time.ts';
import { TAB_ROUTES, type SavedScheduleResult } from './routes.ts';

type NavigationState = { index?: number; routes: readonly { name: string; state?: NavigationState }[] };

/** Existing list tab below the editor/detail/search stack; direct entry defaults to Dashboard. */
export function savedScheduleDestination(state: NavigationState): 'DashboardTab' | 'CalendarTab' {
  const tabs = state.routes.find((route) => route.name === 'Tabs')?.state;
  return tabs?.routes[tabs.index ?? 0]?.name === TAB_ROUTES.Calendar
    ? TAB_ROUTES.Calendar : TAB_ROUTES.Dashboard;
}

export function parseSavedSchedule(value: unknown): SavedScheduleResult | null {
  if (typeof value !== 'object' || value === null) return null;
  const result = value as SavedScheduleResult;
  return Number.isSafeInteger(result.scheduleId) && result.scheduleId > 0 &&
    Number.isSafeInteger(result.startAt) && Number.isFinite(new Date(result.startAt).getTime()) &&
    typeof result.done === 'boolean' ? result : null;
}

export function savedDashboardView(result: SavedScheduleResult, timeZone: string) {
  return {
    referenceDate: startOfLocalDay(result.startAt, timeZone),
    inlineQuery: '', debouncedQuery: '', searchExpanded: false,
  };
}

export function savedCalendarView(result: SavedScheduleResult) {
  const date = new Date(result.startAt);
  const y = date.getFullYear(), m = date.getMonth(), d = date.getDate();
  return { view: { y, m }, selKey: y * 10000 + (m + 1) * 100 + d, selLabel: { m: m + 1, d } };
}
