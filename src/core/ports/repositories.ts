/**
 * 저장소 포트 (Interface First / DIP).
 * 설계 근거: document/architect/logic.md 0.1 포트 목록, database.md 3장.
 * 구현체(어댑터)는 이 계약을 따른다: SqliteXxxRepository(운영) / InMemoryXxxRepository(테스트).
 */
import type {
  Category,
  Page,
  Reminder,
  Schedule,
  ScheduleFilter,
  ScheduleSort,
} from '../domain/types.ts';
import type { ReminderDraft } from '../domain/reminders.ts';
import type { SearchMode } from '../domain/search.ts';

/** 트랜잭션 경계. 콜백이 throw 하면 전체 롤백된다. */
export interface UnitOfWork {
  transaction<T>(work: () => Promise<T>): Promise<T>;
}

export type NewSchedule = Omit<Schedule, 'id'>;

export interface ScheduleRepository {
  insert(data: NewSchedule): Promise<Schedule>;
  /** expectedUpdatedAt 지정 시 불일치하면 STORAGE_STALE_WRITE. */
  update(id: number, patch: Partial<NewSchedule>, expectedUpdatedAt?: number): Promise<Schedule>;
  softDelete(id: number, at: number): Promise<void>;
  restore(id: number): Promise<Schedule>;
  findById(id: number): Promise<Schedule | null>;
  /** deleted 제외, [fromTs, toTs) 와 겹치는 일정. 필터/정렬/keyset 페이지네이션. */
  findInRange(
    fromTs: number,
    toTs: number,
    filter?: ScheduleFilter,
    sort?: ScheduleSort,
    limit?: number,
    cursor?: string | null,
  ): Promise<Page<Schedule>>;
  /** 대시보드용: deleted 제외, startAt 이 [dayStart, dayEnd) 인 일정. */
  findForDashboard(dayStart: number, dayEnd: number): Promise<Schedule[]>;
  /** 제목/메모/유형명 검색. mode 에 따라 어댑터가 FTS 또는 LIKE 를 사용. */
  search(params: {
    query: string;
    mode: Exclude<SearchMode, 'empty'>;
    filter?: ScheduleFilter;
    limit: number;
  }): Promise<{ items: Schedule[]; limited: boolean }>;
  /** 카테고리 삭제 시 소속 일정을 fallback 카테고리로 재지정(E-06-2). 재지정 건수 반환. */
  reassignCategory(fromCategoryId: number, toCategoryId: number): Promise<number>;
}

export interface ReminderRepository {
  /** 해당 일정의 기존 알림을 모두 지우고 새 초안으로 대체. 삭제된 행(취소 대상)을 반환. */
  replaceForSchedule(
    scheduleId: number,
    drafts: ReminderDraft[],
    now: number,
  ): Promise<{ created: Reminder[]; removed: Reminder[] }>;
  findBySchedule(scheduleId: number): Promise<Reminder[]>;
  /** state ∈ {PENDING, SCHEDULED} 이고 triggerAt <= now + horizonMs 인 알림. scheduleId 로 한정 가능. */
  findDue(now: number, horizonMs: number, scheduleId?: number): Promise<Reminder[]>;
  markState(
    id: number,
    state: Reminder['state'],
    osRequestId?: string | null,
    lastSyncedAt?: number | null,
  ): Promise<void>;
  /** 일정의 모든 알림 삭제. 삭제된 행(취소 대상)을 반환(AC-10). */
  deleteForSchedule(scheduleId: number): Promise<Reminder[]>;
  /** 미래 SCHEDULED 알림을 PENDING 으로 되돌리고 osRequestId 를 비운다(재부팅 복원, P-09). */
  resetScheduledToPending(now: number): Promise<number>;
}

export type NewCategory = Omit<Category, 'id'>;

export interface CategoryRepository {
  list(): Promise<Category[]>;
  findById(id: number): Promise<Category | null>;
  findByName(name: string): Promise<Category | null>;
  insert(data: NewCategory): Promise<Category>;
  rename(id: number, name: string, now: number): Promise<Category>;
  remove(id: number): Promise<void>;
  /** 시스템 기본 카테고리("기타") id (E-06-1). 없으면 생성. */
  systemDefaultId(): Promise<number>;
}

export interface SettingRepository {
  get(key: string): Promise<string | null>;
  set(key: string, jsonValue: string, now: number): Promise<void>;
  getAll(): Promise<Record<string, string>>;
}

export interface AccountRepository {
  get(): Promise<import('../domain/types.ts').AccountLink>;
  set(value: import('../domain/types.ts').AccountLink): Promise<void>;
}

export type NewCalendarLink = Omit<import('../domain/types.ts').CalendarLink, 'id'>;

export interface CalendarLinkRepository {
  findByExternal(
    externalCalendarId: string,
    externalEventId: string,
  ): Promise<import('../domain/types.ts').CalendarLink | null>;
  findByScheduleId(scheduleId: number): Promise<import('../domain/types.ts').CalendarLink | null>;
  list(): Promise<import('../domain/types.ts').CalendarLink[]>;
  insert(data: NewCalendarLink): Promise<import('../domain/types.ts').CalendarLink>;
  update(id: number, patch: Partial<NewCalendarLink>): Promise<void>;
}
