/**
 * 일정 CRUD / 완료 토글 / 기간 조회.
 * 설계 근거: document/architect/logic.md 1~5. AC-01~05, AC-11, AC-12, AC-20, AC-22.
 * F-24(v1.9): 반복 마스터/회차 분리 생성(§18.4), "이후 모두" 삭제·반복 규칙 변경(§18.5).
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
import type { RecurrenceScheduler } from './recurrenceScheduler.ts';

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

/**
 * F-24(v1.9, §18.5). `updateRecurrenceRule` 입력 — 마스터 규칙 갱신 시 사전 알림 오프셋 템플릿도
 * 함께 갱신할 수 있다(생략 시 빈 배열로 리셋 — 마스터는 이 값 외에 별도 상태를 갖지 않음).
 */
export type UpdateRecurrenceRuleInput = Recurrence & { reminderOffsets?: number[] };

export interface ScheduleServiceDeps {
  clock: Clock;
  uow: UnitOfWork;
  schedules: ScheduleRepository;
  reminders: ReminderRepository;
  categories: CategoryRepository;
  notifications: NotificationGateway;
  scheduler: ReminderScheduler;
  /** F-24(v1.9 신규). 반복 회차 실체화(§18.3~§18.4) — 비반복 경로는 이 의존성을 사용하지 않는다. */
  recurrenceScheduler: RecurrenceScheduler;
  logger: Logger;
}

export class ScheduleService {
  private readonly d: ScheduleServiceDeps;

  constructor(deps: ScheduleServiceDeps) {
    this.d = deps;
  }

  /**
   * F-01. 검증 → 기본값 → TX(일정+알림) → 알림 동기화(격리) → { id }.
   * F-24(v1.9, logic §18.4): `input.recurrence` 가 있으면 마스터 행 + 회차#1 을 함께 생성하고
   * horizon 내 후속 회차를 즉시 실체화한다. **비반복 경로(`input.recurrence == null`)는 원문 그대로**
   * — 분기만 나뉘고 동작은 바뀌지 않는다(회귀 방지).
   */
  async create(input: CreateScheduleInput): Promise<{ id: number }> {
    assertValidScheduleInput(input);

    const now = this.d.clock.now();
    const timeZone = this.d.clock.timeZone();
    const categoryId = await this.resolveCategoryId(input.categoryId);
    const priority: Priority = input.priority ?? 'NORMAL';
    const notifyAtStart = input.notifyAtStart ?? true;
    const title = input.title.trim();

    if (input.recurrence == null) {
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
          recurrenceRule: null,
          recurrenceEndAt: null,
          recurrenceCount: null,
          recurrenceParentId: null,
          recurrenceReminderOffsets: null,
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

    // F-24 §18.4: 반복 분기 — 마스터 행(비표시) + 회차#1(표시·알림 대상)을 한 TX 에서 생성.
    const recurrence = input.recurrence;
    const { master, occurrence1 } = await this.d.uow.transaction(async () => {
      const master = await this.d.schedules.insert({
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
        recurrenceRule: recurrence.rule,
        recurrenceEndAt: recurrence.endAt ?? null,
        recurrenceCount: recurrence.count ?? null,
        recurrenceParentId: null,
        recurrenceReminderOffsets: JSON.stringify(input.reminderOffsets ?? []),
        source: 'LOCAL',
        notifyAtStart,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      });
      const occurrence1 = await this.d.schedules.insert({
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
        recurrenceRule: null,
        recurrenceEndAt: null,
        recurrenceCount: null,
        recurrenceParentId: master.id,
        recurrenceReminderOffsets: null,
        source: 'LOCAL',
        notifyAtStart,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      });
      const drafts = buildReminderDrafts(occurrence1.startAt, input.reminderOffsets ?? [], notifyAtStart);
      await this.d.reminders.replaceForSchedule(occurrence1.id, drafts, now);
      return { master, occurrence1 };
    });

    await this.syncRemindersSafely(occurrence1.id); // 회차#1 알림(P-03)
    await this.syncRecurrenceSafely(master.id); // 회차#2 이후를 horizon 내 즉시 실체화(부분 실패는 격리)
    return { id: occurrence1.id }; // 반환 id = 실제 표시되는 회차#1(마스터 id 아님)
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

  /**
   * F-08 §6.1: 이 일정에 현재 구성된 사전 알림(PRE) 오프셋 목록(읽기 전용).
   * 수정 화면이 체크박스를 정확한 현재 상태로 프리필하기 위한 조회 전용 헬퍼.
   * `CANCELLED` 는 전역 알림 off 로 일괄 취소된 상태라 제외.
   * 조회 실패 시 빈 배열로 저하(화면은 전부 미체크로 표시).
   */
  async getReminderOffsets(scheduleId: number): Promise<number[]> {
    try {
      const rows = await this.d.reminders.findBySchedule(scheduleId);
      const offsets = rows
        .filter((r) => r.kind === 'PRE' && r.state !== 'CANCELLED')
        .map((r) => r.offsetMinutes);
      return Array.from(new Set(offsets)).sort((a, b) => a - b);
    } catch (err) {
      this.d.logger.log('warn', 'reminder.offsets.read.failed', { scheduleId, error: String(err) });
      return [];
    }
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

  /**
   * F-24(v1.9, §18.5, E-24-5, AC-84). "이후 모두" 삭제 — 지정 회차부터 이후의 모든 활성(미삭제) 회차를
   * soft-delete 하고, 마스터의 `recurrenceEndAt` 을 그 회차 시작 시각 직전으로 고정해 재생성을 막는다.
   * 과거·완료된 회차는 손대지 않는다.
   */
  async deleteRecurrenceFollowing(occurrenceId: number): Promise<{ deleted: number }> {
    const occ = await this.d.schedules.findById(occurrenceId);
    if (!occ || occ.recurrenceParentId === null) {
      throw new AppError(
        ErrorCodes.POLICY_NOT_RECURRING_OCCURRENCE,
        '반복 회차가 아닌 일정입니다.',
      );
    }
    const masterId = occ.recurrenceParentId;
    const targets = await this.d.schedules.findInRange(occ.startAt, Number.MAX_SAFE_INTEGER, {
      recurrenceParentId: masterId,
    });
    for (const t of targets.items) {
      await this.softDelete(t.id);
    }
    await this.d.schedules.update(masterId, { recurrenceEndAt: occ.startAt - 1 });
    return { deleted: targets.items.length };
  }

  /**
   * F-24(v1.9, §18.5, E-24-1). 반복 규칙 자체의 사후 변경 — 마스터 규칙을 갱신하고,
   * 아직 지나지 않은(now 이후) 활성 회차를 삭제해 새 규칙으로 재생성될 수 있게 한다.
   * 과거·완료된 회차는 range 밖이라 보존된다(E-24-1).
   */
  async updateRecurrenceRule(
    occurrenceId: number,
    recurrence: UpdateRecurrenceRuleInput,
    now?: number,
  ): Promise<void> {
    const occ = await this.d.schedules.findById(occurrenceId);
    if (!occ || occ.recurrenceParentId === null) {
      throw new AppError(
        ErrorCodes.POLICY_NOT_RECURRING_OCCURRENCE,
        '반복 회차가 아닌 일정입니다.',
      );
    }
    const masterId = occ.recurrenceParentId;
    const effectiveNow = now ?? this.d.clock.now();

    await this.d.schedules.update(masterId, {
      recurrenceRule: recurrence.rule,
      recurrenceEndAt: recurrence.endAt ?? null,
      recurrenceCount: recurrence.count ?? null,
      recurrenceReminderOffsets: JSON.stringify(recurrence.reminderOffsets ?? []),
    });

    const future = await this.d.schedules.findInRange(effectiveNow, Number.MAX_SAFE_INTEGER, {
      recurrenceParentId: masterId,
    });
    for (const f of future.items) {
      await this.softDelete(f.id);
    }
    // 새 규칙으로의 재생성은 다음 RecurrenceScheduler.sync() 사이클에 위임한다(§18.5 설계 그대로 — 즉시 트리거 없음).
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

  /** F-24 §18.3~§18.4: 회차 실체화 실패는 일정 생성/규칙 변경 결과에 영향을 주지 않는다(부분 실패 격리). */
  private async syncRecurrenceSafely(masterId: number): Promise<void> {
    try {
      await this.d.recurrenceScheduler.sync(masterId);
    } catch (err) {
      this.d.logger.log('warn', 'recurrence.sync.failed', { masterId, error: String(err) });
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
