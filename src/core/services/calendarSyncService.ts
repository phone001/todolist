/**
 * 기본 캘린더(OS) ↔ 앱 일정 동기화 (읽기 중심, 쓰기는 옵션).
 * 설계 근거: document/architect/logic.md 11. F-14, 정책 P-08/P-08-1/P-08-2. AC-18, AC-19, E-14-1.
 */
import { AppError, ErrorCodes } from '../domain/errors.ts';
import { sanitizeText } from '../domain/search.ts';
import { MEMO_MAX, TITLE_MAX } from '../domain/validation.ts';
import type { Clock } from '../domain/clock.ts';
import type {
  CalendarLinkRepository,
  CategoryRepository,
  NewSchedule,
  ScheduleRepository,
  UnitOfWork,
} from '../ports/repositories.ts';
import type { CalendarGateway, Logger } from '../ports/gateways.ts';

/** 동일성 판정: 제목 동일 + 시작 시각 ±60초 (정책 P-08 휴리스틱). */
const MATCH_START_TOLERANCE_MS = 60_000;

export interface CalendarPullResult {
  created: number;
  merged: number;
  updatedExisting: number;
  externalDeleted: number;
}

export interface CalendarSyncServiceDeps {
  clock: Clock;
  uow: UnitOfWork;
  schedules: ScheduleRepository;
  links: CalendarLinkRepository;
  categories: CategoryRepository;
  calendar: CalendarGateway;
  logger: Logger;
  calendarIds: string[];
}

export class CalendarSyncService {
  private readonly d: CalendarSyncServiceDeps;

  constructor(deps: CalendarSyncServiceDeps) {
    this.d = deps;
  }

  /** 외부 캘린더 → 앱 단방향 반영. 로컬 사용자가 편집한 필드(memo/category/priority)는 보존한다(P-08). */
  async pull(fromTs: number, toTs: number): Promise<CalendarPullResult> {
    if (this.d.calendar.getPermission() !== 'granted') {
      throw new AppError(ErrorCodes.PERMISSION_CALENDAR_DENIED, '캘린더 접근 권한이 없습니다.');
    }

    const now = this.d.clock.now();
    const externalEvents = await this.d.calendar.fetchEvents(fromTs, toTs, this.d.calendarIds);
    const seenExternalKeys = new Set<string>();
    const result: CalendarPullResult = {
      created: 0,
      merged: 0,
      updatedExisting: 0,
      externalDeleted: 0,
    };

    for (const event of externalEvents) {
      seenExternalKeys.add(`${event.calendarId}:${event.eventId}`);
      const title = sanitizeText(event.title, TITLE_MAX);
      const notes = event.notes === null ? null : sanitizeText(event.notes, MEMO_MAX);

      const existingLink = await this.d.links.findByExternal(event.calendarId, event.eventId);
      if (existingLink) {
        await this.d.schedules.update(existingLink.scheduleId, {
          title,
          startAt: event.startAt,
          endAt: event.endAt,
          updatedAt: now,
        });
        await this.d.links.update(existingLink.id, {
          externalUpdatedAt: event.updatedAt,
          syncState: 'LINKED',
          lastSyncedAt: now,
        });
        result.updatedExisting += 1;
        continue;
      }

      const candidate = await this.findLocalMatch(title, event.startAt);
      if (candidate) {
        // 병합: 로컬 편집 필드(memo/category/priority)는 그대로 두고 링크만 만든다.
        await this.d.links.insert({
          scheduleId: candidate,
          externalCalendarId: event.calendarId,
          externalEventId: event.eventId,
          externalUpdatedAt: event.updatedAt,
          syncState: 'LINKED',
          lastSyncedAt: now,
        });
        result.merged += 1;
        continue;
      }

      const record: NewSchedule = {
        title,
        memo: notes,
        categoryId: await this.systemCategoryId(),
        priority: 'NORMAL',
        startAt: event.startAt,
        endAt: event.endAt,
        timeZone: this.d.clock.timeZone(),
        isAllDay: false,
        isDone: false,
        doneAt: null,
        recurrenceRule: null,
        recurrenceEndAt: null,
        recurrenceCount: null,
        recurrenceParentId: null,
        source: 'CALENDAR',
        notifyAtStart: false,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      };
      const created = await this.d.uow.transaction(async () => {
        const schedule = await this.d.schedules.insert(record);
        await this.d.links.insert({
          scheduleId: schedule.id,
          externalCalendarId: event.calendarId,
          externalEventId: event.eventId,
          externalUpdatedAt: event.updatedAt,
          syncState: 'LINKED',
          lastSyncedAt: now,
        });
        return schedule;
      });
      void created;
      result.created += 1;
    }

    // 외부에서 사라진 링크는 EXTERNAL_DELETED 로 표시(P-08-1).
    for (const link of await this.d.links.list()) {
      const key = `${link.externalCalendarId}:${link.externalEventId}`;
      if (!seenExternalKeys.has(key) && link.syncState === 'LINKED') {
        await this.d.links.update(link.id, { syncState: 'EXTERNAL_DELETED', lastSyncedAt: now });
        result.externalDeleted += 1;
      }
    }

    this.d.logger.metric('calendar.sync.merged', result.merged);
    return result;
  }

  private async findLocalMatch(title: string, startAt: number): Promise<number | null> {
    const from = startAt - MATCH_START_TOLERANCE_MS;
    const to = startAt + MATCH_START_TOLERANCE_MS + 1;
    const page = await this.d.schedules.findInRange(from, to, undefined, 'startAt', 100, null);
    const match = page.items.find(
      (s) =>
        s.source === 'LOCAL' &&
        s.title === title &&
        Math.abs(s.startAt - startAt) <= MATCH_START_TOLERANCE_MS,
    );
    return match ? match.id : null;
  }

  private systemCategoryId(): Promise<number> {
    return this.d.categories.systemDefaultId();
  }
}
