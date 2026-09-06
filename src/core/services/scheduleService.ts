/**
 * 일정 CRUD / 완료 토글 / 기간 조회.
 * 설계 근거: document/architect/logic.md 1~5. AC-01~05, AC-11, AC-12, AC-20, AC-22.
 */
import { AppError, ErrorCodes } from '../domain/errors.ts';
import { buildReminderDrafts } from '../domain/reminders.ts';
import { assertValidScheduleInput } from '../domain/validation.ts';
import type { Clock } from '../domain/clock.ts';
import type {
  Page,
  Priority,
  Recurrence,
  Schedule,
  ScheduleFilter,
  ScheduleSort,
} from '../domain/types.ts';
import type {
  CategoryRepository,
  NewSchedule,
  ReminderRepository,
  ScheduleRepository,
  UnitOfWork,
} from '../ports/repositories.ts';
import type { Logger, NotificationGateway } from '../ports/gateways.ts';
import type { ReminderScheduler } from './reminderScheduler.ts';

export interface CreateScheduleInput {
  title: string;
  memo?: string | null;
  categoryId?: number;
  priority?: Priority;
  startAt: number;
  endAt?: number | null;
  isAllDay?: boolean;
  notifyAtStart?: boolean;
  reminderOffsets?: number[];
  recurrence?: Recurrence | null;
}

export type UpdateScheduleInput = Partial<CreateScheduleInput> & { expectedUpdatedAt?: number };

export interface ScheduleServiceDeps {
  clock: Clock;
  uow: UnitOfWork;
  schedules: ScheduleRepository;
  reminders: ReminderRepository;
  categories: CategoryRepository;
  notifications: NotificationGateway;
  scheduler: ReminderScheduler;
  logger: Logger;
}

export class ScheduleService {
  private readonly d: ScheduleServiceDeps;

  constructor(deps: ScheduleServiceDeps) {
    this.d = deps;
  }

  /** F-01. 검증 → 기본값 → TX(일정+알림) → 알림 동기화(격리) → { id }. */
  async create(input: CreateScheduleInput): Promise<{ id: number }> {
    assertValidScheduleInput(input);

    const now = this.d.clock.now();
    const timeZone = this.d.clock.timeZone();
    const categoryId = await this.resolveCategoryId(input.categoryId);
    const priority: Priority = input.priority ?? 'NORMAL';
    const notifyAtStart = input.notifyAtStart ?? true;
    const title = input.title.trim();

    const created = await this.d.uow.transaction(async () => {
      const record: NewSchedule = {
        title,
        memo: input.memo ?? null,
        categoryId,
        priority,
        startAt: input.startAt,
        endAt: input.endAt ?? null,
        timeZone,
        isAllDay: input.isAllDay ?? false,
        isDone: false,
        doneAt: null,
        recurrenceRule: input.recurrence?.rule ?? null,
        recurrenceEndAt: input.recurrence?.endAt ?? null,
        recurrenceCount: input.recurrence?.count ?? null,
        recurrenceParentId: null,
        source: 'LOCAL',
        notifyAtStart,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      };
      const schedule = await this.d.schedules.insert(record);
      const drafts = buildReminderDrafts(schedule.startAt, input.reminderOffsets ?? [], notifyAtStart);
      await this.d.reminders.replaceForSchedule(schedule.id, drafts, now);
      return schedule;
    });

    await this.syncRemindersSafely(created.id);
    return { id: created.id };
  }

  /** F-03. 필드 변경 + (시간/알림 변경 시) 알림 재생성 및 OS 재예약(AC-09). */
  async update(id: number, input: UpdateScheduleInput): Promise<Schedule> {
    const existing = await this.d.schedules.findById(id);
    if (!existing || existing.deletedAt !== null) {
      throw new AppError(ErrorCodes.NOT_FOUND_SCHEDULE, '일정을 찾을 수 없습니다.');
    }

    const merged = {
      title: input.title ?? existing.title,
      memo: input.memo === undefined ? existing.memo : input.memo,
      startAt: input.startAt ?? existing.startAt,
      endAt: input.endAt === undefined ? existing.endAt : input.endAt,
      reminderOffsets: input.reminderOffsets,
      recurrence:
        input.recurrence === undefined
          ? undefined
          : input.recurrence,
    };
    assertValidScheduleInput(merged);

    const now = this.d.clock.now();
    const timeZone = existing.timeZone;
    const categoryId =
      input.categoryId !== undefined ? await this.resolveCategoryId(input.categoryId) : existing.categoryId;
    const notifyAtStart = input.notifyAtStart ?? existing.notifyAtStart;

    const remindersChanged =
      input.startAt !== undefined ||
      input.notifyAtStart !== undefined ||
      input.reminderOffsets !== undefined;

    const result = await this.d.uow.transaction(async () => {
      const patch: Partial<NewSchedule> = {
        title: merged.title.trim(),
        memo: merged.memo,
        categoryId,
        priority: input.priority ?? existing.priority,
        startAt: merged.startAt,
        endAt: merged.endAt,
        timeZone,
        isAllDay: input.isAllDay ?? existing.isAllDay,
        notifyAtStart,
        recurrenceRule:
          input.recurrence === undefined ? existing.recurrenceRule : input.recurrence?.rule ?? null,
        recurrenceEndAt:
          input.recurrence === undefined ? existing.recurrenceEndAt : input.recurrence?.endAt ?? null,
        recurrenceCount:
          input.recurrence === undefined ? existing.recurrenceCount : input.recurrence?.count ?? null,
        updatedAt: now,
      };
      const updated = await this.d.schedules.update(id, patch, input.expectedUpdatedAt);

      let toCancel: string[] = [];
      if (remindersChanged) {
        const currentOffsets =
          input.reminderOffsets ??
          (await this.d.reminders.findBySchedule(id))
            .filter((r) => r.kind === 'PRE')
            .map((r) => r.offsetMinutes);
        const drafts = buildReminderDrafts(updated.startAt, currentOffsets, notifyAtStart);
        const { removed } = await this.d.reminders.replaceForSchedule(id, drafts, now);
        toCancel = removed.map((r) => r.osRequestId).filter((x): x is string => x !== null);
      }
      return { updated, toCancel };
    });

    if (remindersChanged) {
      for (const osId of result.toCancel) {
        await this.safe(() => this.d.notifications.cancel(osId));
      }
      await this.syncRemindersSafely(id);
    }
    return result.updated;
  }

  /** F-04. soft delete + 알림 전부 취소(AC-10). */
  async softDelete(id: number): Promise<void> {
    const existing = await this.d.schedules.findById(id);
    if (!existing || existing.deletedAt !== null) {
      throw new AppError(ErrorCodes.NOT_FOUND_SCHEDULE, '일정을 찾을 수 없습니다.');
    }
    const now = this.d.clock.now();
    const removed = await this.d.uow.transaction(async () => {
      const gone = await this.d.reminders.deleteForSchedule(id);
      await this.d.schedules.softDelete(id, now);
      return gone;
    });
    for (const r of removed) {
      if (r.osRequestId) await this.safe(() => this.d.notifications.cancel(r.osRequestId as string));
    }
  }

  /** E-04-2. Undo 복원 + 알림 재생성. */
  async restore(id: number): Promise<Schedule> {
    const now = this.d.clock.now();
    const schedule = await this.d.uow.transaction(async () => {
      const s = await this.d.schedules.restore(id);
      const offsets = (await this.d.reminders.findBySchedule(id))
        .filter((r) => r.kind === 'PRE')
        .map((r) => r.offsetMinutes);
      const drafts = buildReminderDrafts(s.startAt, offsets, s.notifyAtStart);
      await this.d.reminders.replaceForSchedule(id, drafts, now);
      return s;
    });
    await this.syncRemindersSafely(id);
    return schedule;
  }

  /** F-05. 완료 토글 (P-04~06). 저장 실패 시 이전 값 반환(호출자 롤백용). */
  async toggleDone(id: number, done: boolean): Promise<Schedule> {
    const existing = await this.d.schedules.findById(id);
    if (!existing || existing.deletedAt !== null) {
      throw new AppError(ErrorCodes.NOT_FOUND_SCHEDULE, '일정을 찾을 수 없습니다.');
    }
    const now = this.d.clock.now();
    return this.d.schedules.update(id, {
      isDone: done,
      doneAt: done ? now : null,
      updatedAt: now,
    });
  }

  /** F-02. 단건 조회 (상세 화면용, logic §16.3). soft-deleted 는 null. */
  async getById(id: number): Promise<Schedule | null> {
    const found = await this.d.schedules.findById(id);
    return found && found.deletedAt === null ? found : null;
  }

  /** F-02. 기간 조회 + 필터 + 정렬 + keyset 페이지네이션. */
  findInRange(
    fromTs: number,
    toTs: number,
    filter?: ScheduleFilter,
    sort: ScheduleSort = 'startAt',
    limit = 50,
    cursor: string | null = null,
  ): Promise<Page<Schedule>> {
    return this.d.schedules.findInRange(fromTs, toTs, filter, sort, limit, cursor);
  }

  private async resolveCategoryId(candidate?: number): Promise<number> {
    if (candidate !== undefined) {
      const found = await this.d.categories.findById(candidate);
      if (found) return found.id;
    }
    return this.d.categories.systemDefaultId();
  }

  private async syncRemindersSafely(scheduleId: number): Promise<void> {
    try {
      const res = await this.d.scheduler.sync(scheduleId);
      if (res.warning) {
        this.d.logger.log('warn', 'reminder.sync.warning', { scheduleId, warning: res.warning });
      }
    } catch (err) {
      // 알림 예약 실패는 일정 저장 결과에 영향을 주지 않는다(부분 실패 격리).
      this.d.logger.log('warn', 'reminder.sync.failed', { scheduleId, error: String(err) });
    }
  }

  private async safe(fn: () => Promise<unknown>): Promise<void> {
    try {
      await fn();
    } catch (err) {
      this.d.logger.log('warn', 'notification.cancel.failed', { error: String(err) });
    }
  }
}
