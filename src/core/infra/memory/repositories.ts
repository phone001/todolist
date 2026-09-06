/**
 * 인메모리 저장소 포트 구현. 모든 변경은 원소 교체(immutable)로 수행한다.
 * 설계 근거: document/architect/logic.md 0.1, database.md 3~4, domain/search.ts.
 */
import { AppError, ErrorCodes } from '../../domain/errors.ts';
import { ftsLikeMatch } from '../../domain/search.ts';
import { PRIORITY_RANK } from '../../domain/types.ts';
import type {
  AccountLink,
  CalendarLink,
  Category,
  Page,
  Reminder,
  Schedule,
  ScheduleFilter,
  ScheduleSort,
} from '../../domain/types.ts';
import type { ReminderDraft } from '../../domain/reminders.ts';
import type {
  AccountRepository,
  CalendarLinkRepository,
  CategoryRepository,
  NewCalendarLink,
  NewCategory,
  NewSchedule,
  ReminderRepository,
  ScheduleRepository,
  SettingRepository,
} from '../../ports/repositories.ts';
import type { InMemoryDb } from './store.ts';

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

function matchesFilter(schedule: Schedule, filter?: ScheduleFilter): boolean {
  if (!filter) return true;
  if (filter.categoryId !== undefined && schedule.categoryId !== filter.categoryId) return false;
  if (filter.priority !== undefined && schedule.priority !== filter.priority) return false;
  if (filter.isDone !== undefined && schedule.isDone !== filter.isDone) return false;
  if (filter.fromTs !== undefined && (schedule.endAt ?? schedule.startAt) < filter.fromTs) return false;
  if (filter.toTs !== undefined && schedule.startAt >= filter.toTs) return false;
  return true;
}

function compareBySort(a: Schedule, b: Schedule, sort: ScheduleSort): number {
  if (sort === 'priority') {
    const rank = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
    if (rank !== 0) return rank;
  }
  if (a.startAt !== b.startAt) return a.startAt - b.startAt;
  return a.id - b.id;
}

interface CursorPayload {
  startAt: number;
  priority: string;
  id: number;
}

function encodeCursor(schedule: Schedule): string {
  const payload: CursorPayload = {
    startAt: schedule.startAt,
    priority: schedule.priority,
    id: schedule.id,
  };
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64');
}

function decodeCursor(cursor: string): CursorPayload | null {
  try {
    return JSON.parse(Buffer.from(cursor, 'base64').toString('utf8')) as CursorPayload;
  } catch {
    return null;
  }
}

export class InMemoryScheduleRepository implements ScheduleRepository {
  private readonly db: InMemoryDb;

  constructor(db: InMemoryDb) {
    this.db = db;
  }

  async insert(data: NewSchedule): Promise<Schedule> {
    this.db.seq.schedule += 1;
    const schedule: Schedule = { ...data, id: this.db.seq.schedule };
    this.db.schedules = [...this.db.schedules, schedule];
    return clone(schedule);
  }

  async update(
    id: number,
    patch: Partial<NewSchedule>,
    expectedUpdatedAt?: number,
  ): Promise<Schedule> {
    const index = this.db.schedules.findIndex((s) => s.id === id);
    if (index === -1) {
      throw new AppError(ErrorCodes.NOT_FOUND_SCHEDULE, '일정을 찾을 수 없습니다.');
    }
    const current = this.db.schedules[index];
    if (expectedUpdatedAt !== undefined && current.updatedAt !== expectedUpdatedAt) {
      throw new AppError(ErrorCodes.STORAGE_STALE_WRITE, '다른 곳에서 먼저 수정되었습니다.');
    }
    const next: Schedule = {
      ...current,
      ...patch,
      id,
      updatedAt: patch.updatedAt ?? current.updatedAt,
    };
    const copy = [...this.db.schedules];
    copy[index] = next;
    this.db.schedules = copy;
    return clone(next);
  }

  async softDelete(id: number, at: number): Promise<void> {
    await this.update(id, { deletedAt: at, updatedAt: at });
  }

  async restore(id: number): Promise<Schedule> {
    return this.update(id, { deletedAt: null });
  }

  async findById(id: number): Promise<Schedule | null> {
    const found = this.db.schedules.find((s) => s.id === id);
    return found ? clone(found) : null;
  }

  async findInRange(
    fromTs: number,
    toTs: number,
    filter?: ScheduleFilter,
    sort: ScheduleSort = 'startAt',
    limit = 50,
    cursor: string | null = null,
  ): Promise<Page<Schedule>> {
    const overlapping = this.db.schedules
      .filter((s) => s.deletedAt === null)
      .filter((s) => s.startAt < toTs && (s.endAt ?? s.startAt) >= fromTs)
      .filter((s) => matchesFilter(s, filter))
      .sort((a, b) => compareBySort(a, b, sort));

    let startIndex = 0;
    if (cursor) {
      const decoded = decodeCursor(cursor);
      if (decoded) {
        const pos = overlapping.findIndex((s) => s.id === decoded.id);
        startIndex = pos === -1 ? 0 : pos + 1;
      }
    }

    const slice = overlapping.slice(startIndex, startIndex + limit);
    const hasMore = startIndex + limit < overlapping.length;
    return {
      items: slice.map(clone),
      nextCursor: hasMore && slice.length > 0 ? encodeCursor(slice[slice.length - 1]) : null,
    };
  }

  async findForDashboard(dayStart: number, dayEnd: number): Promise<Schedule[]> {
    return this.db.schedules
      .filter((s) => s.deletedAt === null && s.startAt >= dayStart && s.startAt < dayEnd)
      .map(clone);
  }

  async search(params: {
    query: string;
    mode: 'fts' | 'like';
    filter?: ScheduleFilter;
    limit: number;
  }): Promise<{ items: Schedule[]; limited: boolean }> {
    const categoryNameById = new Map(this.db.categories.map((c) => [c.id, c.name]));
    const needle = params.query.toLowerCase();

    const matches = this.db.schedules
      .filter((s) => s.deletedAt === null)
      .filter((s) => matchesFilter(s, params.filter))
      .filter((s) => {
        const haystack = `${s.title} ${s.memo ?? ''} ${categoryNameById.get(s.categoryId) ?? ''}`;
        return params.mode === 'fts'
          ? ftsLikeMatch(haystack, params.query)
          : haystack.toLowerCase().includes(needle);
      })
      .sort((a, b) => b.startAt - a.startAt || a.id - b.id);

    return {
      items: matches.slice(0, params.limit).map(clone),
      limited: matches.length > params.limit,
    };
  }

  async reassignCategory(fromCategoryId: number, toCategoryId: number): Promise<number> {
    let count = 0;
    this.db.schedules = this.db.schedules.map((s) => {
      if (s.categoryId === fromCategoryId && s.deletedAt === null) {
        count += 1;
        return { ...s, categoryId: toCategoryId };
      }
      return s;
    });
    return count;
  }
}

export class InMemoryReminderRepository implements ReminderRepository {
  private readonly db: InMemoryDb;

  constructor(db: InMemoryDb) {
    this.db = db;
  }

  async replaceForSchedule(
    scheduleId: number,
    drafts: ReminderDraft[],
    now: number,
  ): Promise<{ created: Reminder[]; removed: Reminder[] }> {
    const removed = this.db.reminders.filter((r) => r.scheduleId === scheduleId);
    const kept = this.db.reminders.filter((r) => r.scheduleId !== scheduleId);
    const created: Reminder[] = drafts.map((draft) => {
      this.db.seq.reminder += 1;
      return {
        id: this.db.seq.reminder,
        scheduleId,
        offsetMinutes: draft.offsetMinutes,
        kind: draft.kind,
        triggerAt: draft.triggerAt,
        osRequestId: null,
        state: 'PENDING',
        lastSyncedAt: null,
        createdAt: now,
        updatedAt: now,
      };
    });
    this.db.reminders = [...kept, ...created];
    return { created: created.map(clone), removed: removed.map(clone) };
  }

  async findBySchedule(scheduleId: number): Promise<Reminder[]> {
    return this.db.reminders.filter((r) => r.scheduleId === scheduleId).map(clone);
  }

  async findDue(now: number, horizonMs: number, scheduleId?: number): Promise<Reminder[]> {
    const limit = now + horizonMs;
    return this.db.reminders
      .filter((r) => r.state === 'PENDING' || r.state === 'SCHEDULED')
      .filter((r) => r.triggerAt <= limit)
      .filter((r) => (scheduleId === undefined ? true : r.scheduleId === scheduleId))
      .sort((a, b) => a.triggerAt - b.triggerAt || a.id - b.id)
      .map(clone);
  }

  async markState(
    id: number,
    state: Reminder['state'],
    osRequestId?: string | null,
    lastSyncedAt?: number | null,
  ): Promise<void> {
    const index = this.db.reminders.findIndex((r) => r.id === id);
    if (index === -1) return;
    const current = this.db.reminders[index];
    const next: Reminder = {
      ...current,
      state,
      osRequestId: osRequestId === undefined ? current.osRequestId : osRequestId,
      lastSyncedAt: lastSyncedAt === undefined ? current.lastSyncedAt : lastSyncedAt,
    };
    const copy = [...this.db.reminders];
    copy[index] = next;
    this.db.reminders = copy;
  }

  async deleteForSchedule(scheduleId: number): Promise<Reminder[]> {
    const removed = this.db.reminders.filter((r) => r.scheduleId === scheduleId);
    this.db.reminders = this.db.reminders.filter((r) => r.scheduleId !== scheduleId);
    return removed.map(clone);
  }

  async resetScheduledToPending(now: number): Promise<number> {
    let count = 0;
    this.db.reminders = this.db.reminders.map((r) => {
      if (r.state === 'SCHEDULED' && r.triggerAt > now) {
        count += 1;
        return { ...r, state: 'PENDING', osRequestId: null, updatedAt: now };
      }
      return r;
    });
    return count;
  }
}

export class InMemoryCategoryRepository implements CategoryRepository {
  private readonly db: InMemoryDb;

  constructor(db: InMemoryDb) {
    this.db = db;
  }

  async list(): Promise<Category[]> {
    return [...this.db.categories].sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id).map(clone);
  }

  async findById(id: number): Promise<Category | null> {
    const found = this.db.categories.find((c) => c.id === id);
    return found ? clone(found) : null;
  }

  async findByName(name: string): Promise<Category | null> {
    const found = this.db.categories.find((c) => c.name === name);
    return found ? clone(found) : null;
  }

  async insert(data: NewCategory): Promise<Category> {
    this.db.seq.category += 1;
    const category: Category = { ...data, id: this.db.seq.category };
    this.db.categories = [...this.db.categories, category];
    return clone(category);
  }

  async rename(id: number, name: string, now: number): Promise<Category> {
    const index = this.db.categories.findIndex((c) => c.id === id);
    if (index === -1) {
      throw new AppError(ErrorCodes.NOT_FOUND_CATEGORY, '유형을 찾을 수 없습니다.');
    }
    const next: Category = { ...this.db.categories[index], name, updatedAt: now };
    const copy = [...this.db.categories];
    copy[index] = next;
    this.db.categories = copy;
    return clone(next);
  }

  async remove(id: number): Promise<void> {
    this.db.categories = this.db.categories.filter((c) => c.id !== id);
  }

  async systemDefaultId(): Promise<number> {
    const existing = this.db.categories.find((c) => c.isSystem);
    if (existing) return existing.id;
    const created = await this.insert({
      name: '기타',
      color: '#8E8E93',
      icon: 'dots',
      isSystem: true,
      sortOrder: 100,
      createdAt: 0,
      updatedAt: 0,
    });
    return created.id;
  }
}

export class InMemorySettingRepository implements SettingRepository {
  private readonly db: InMemoryDb;

  constructor(db: InMemoryDb) {
    this.db = db;
  }

  async get(key: string): Promise<string | null> {
    return this.db.settings.get(key)?.value ?? null;
  }

  async set(key: string, jsonValue: string, now: number): Promise<void> {
    const copy = new Map(this.db.settings);
    copy.set(key, { value: jsonValue, updatedAt: now });
    this.db.settings = copy;
  }

  async getAll(): Promise<Record<string, string>> {
    const out: Record<string, string> = {};
    for (const [key, entry] of this.db.settings) out[key] = entry.value;
    return out;
  }
}

export class InMemoryAccountRepository implements AccountRepository {
  private readonly db: InMemoryDb;

  constructor(db: InMemoryDb) {
    this.db = db;
  }

  async get(): Promise<AccountLink> {
    return { ...this.db.account };
  }

  async set(value: AccountLink): Promise<void> {
    this.db.account = { ...value };
  }
}

export class InMemoryCalendarLinkRepository implements CalendarLinkRepository {
  private readonly db: InMemoryDb;

  constructor(db: InMemoryDb) {
    this.db = db;
  }

  async findByExternal(
    externalCalendarId: string,
    externalEventId: string,
  ): Promise<CalendarLink | null> {
    const found = this.db.calendarLinks.find(
      (l) => l.externalCalendarId === externalCalendarId && l.externalEventId === externalEventId,
    );
    return found ? clone(found) : null;
  }

  async findByScheduleId(scheduleId: number): Promise<CalendarLink | null> {
    const found = this.db.calendarLinks.find((l) => l.scheduleId === scheduleId);
    return found ? clone(found) : null;
  }

  async list(): Promise<CalendarLink[]> {
    return this.db.calendarLinks.map(clone);
  }

  async insert(data: NewCalendarLink): Promise<CalendarLink> {
    this.db.seq.calendarLink += 1;
    const link: CalendarLink = { ...data, id: this.db.seq.calendarLink };
    this.db.calendarLinks = [...this.db.calendarLinks, link];
    return clone(link);
  }

  async update(id: number, patch: Partial<NewCalendarLink>): Promise<void> {
    this.db.calendarLinks = this.db.calendarLinks.map((l) => (l.id === id ? { ...l, ...patch } : l));
  }
}
