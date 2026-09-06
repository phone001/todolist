/**
 * 도메인 엔티티 및 값 타입.
 * 설계 근거: document/architect/database.md 3장, document/architect/logic.md.
 * 시각은 모두 epoch milliseconds(UTC) 정수. 표시 변환은 UI 계층 책임(P-16).
 */

export type Priority = 'HIGH' | 'NORMAL' | 'LOW';

/** 우선순위 정렬 가중치 (AC-12: HIGH > NORMAL > LOW). */
export const PRIORITY_RANK: Record<Priority, number> = {
  HIGH: 0,
  NORMAL: 1,
  LOW: 2,
};

export type RecurrenceRule = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';

export type ScheduleSource = 'LOCAL' | 'CALENDAR';

export type ReminderKind = 'PRE' | 'START';

export type ReminderState =
  | 'PENDING'
  | 'SCHEDULED'
  | 'FIRED'
  | 'SKIPPED'
  | 'CANCELLED';

export type AccountState = 'NONE' | 'LINKED' | 'EXPIRED';

export type ThemeMode = 'light' | 'dark' | 'system';

export interface Recurrence {
  rule: RecurrenceRule;
  /** 종료일 (endAt 과 count 는 동시 지정 불가). */
  endAt?: number | null;
  /** 반복 횟수 (> 0). */
  count?: number | null;
}

export interface Category {
  id: number;
  name: string;
  color: string;
  icon: string | null;
  isSystem: boolean;
  sortOrder: number;
  createdAt: number;
  updatedAt: number;
}

export interface Schedule {
  id: number;
  title: string;
  memo: string | null;
  categoryId: number;
  priority: Priority;
  startAt: number;
  endAt: number | null;
  timeZone: string;
  isAllDay: boolean;
  isDone: boolean;
  doneAt: number | null;
  recurrenceRule: RecurrenceRule | null;
  recurrenceEndAt: number | null;
  recurrenceCount: number | null;
  recurrenceParentId: number | null;
  source: ScheduleSource;
  notifyAtStart: boolean;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
}

export interface Reminder {
  id: number;
  scheduleId: number;
  offsetMinutes: number;
  kind: ReminderKind;
  triggerAt: number;
  osRequestId: string | null;
  state: ReminderState;
  lastSyncedAt: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface AccountLink {
  provider: string | null;
  subject: string | null;
  displayName: string | null;
  linkedAt: number | null;
  tokenRef: string | null;
  state: AccountState;
}

export interface CalendarLink {
  id: number;
  scheduleId: number;
  externalCalendarId: string;
  externalEventId: string;
  externalUpdatedAt: number | null;
  syncState: 'LINKED' | 'EXTERNAL_DELETED' | 'CONFLICT';
  lastSyncedAt: number;
}

/** 일정 조회/검색 필터 (logic.md 5, 8). */
export interface ScheduleFilter {
  categoryId?: number;
  priority?: Priority;
  isDone?: boolean;
  fromTs?: number;
  toTs?: number;
}

export type ScheduleSort = 'startAt' | 'priority';

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}
