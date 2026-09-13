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

/**
 * 우선순위 색상 매핑(F-07, P-60, AC-78). WCAG 1.4.11 비-텍스트 대비(>=3:1) 충족(logic.md 5.2).
 * 대시보드 리스트(§7.3)의 우선순위 점(dot) 등에서 사용.
 */
export const PRIORITY_COLORS: Record<Priority, string> = {
  HIGH: '#D32F2F',
  NORMAL: '#E65100',
  LOW: '#689F38',
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
  /**
   * F-24(v1.8 신규, `database.md` §14.1). 반복 **마스터 행**(`recurrenceRule` NOT NULL,
   * `recurrenceParentId` NULL)에만 채워지는 사전 알림 오프셋 템플릿(JSON 배열 문자열, 예: `'[10,60]'`).
   * 회차 행·비반복 일정은 항상 null — 회차 실체화(`RecurrenceScheduler`) 시 이 값을 파싱해
   * 각 회차의 `REMINDER` 행을 재구성한다(logic.md §18.2/§18.3).
   */
  recurrenceReminderOffsets: string | null;
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
  /**
   * F-24(v1.8 신규, logic.md §18.2). 지정 시 이 마스터 id 의 활성 회차만 조회한다
   * ("이후 모두" 삭제·반복 규칙 변경 시 사용, `ScheduleService.deleteRecurrenceFollowing`/`updateRecurrenceRule`).
   */
  recurrenceParentId?: number;
}

export type ScheduleSort = 'startAt' | 'priority';

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}
