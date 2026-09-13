/**
 * 반복 일정(F-24) 회차 실체화(materialization). `ReminderScheduler`(§6)와 동형 패턴.
 * 설계 근거: document/architect/logic.md §18.1~§18.3. AC-82, E-24-3.
 *
 * 반복 규칙을 가진 마스터 행(recurrenceRule NOT NULL, recurrenceParentId NULL)을 순회해,
 * `expandOccurrences`(순수 함수, recurrence.ts) 로 [now, now+horizon) 구간의 발생 시각을 전개하고
 * 아직 실체화되지 않은 시작 시각에 대해서만 회차 행(정식 SCHEDULE 행)을 생성한다.
 * 회차별 알림은 `ReminderScheduler.sync(occurrenceId)` 로 독립 예약한다(P-03 재사용).
 */
import { expandOccurrences } from '../domain/recurrence.ts';
import { buildReminderDrafts } from '../domain/reminders.ts';
import type { Clock } from '../domain/clock.ts';
import type { Schedule } from '../domain/types.ts';
import type { ReminderRepository, ScheduleRepository, UnitOfWork } from '../ports/repositories.ts';
import type { Logger } from '../ports/gateways.ts';
import type { ReminderScheduler } from './reminderScheduler.ts';

export interface RecurrenceSyncResult {
  created: number;
}

export interface RecurrenceSchedulerDeps {
  clock: Clock;
  uow: UnitOfWork;
  schedules: ScheduleRepository;
  reminders: ReminderRepository;
  reminderScheduler: ReminderScheduler;
  logger: Logger;
  /** 회차를 실제로 실체화할 미래 구간(일). 기본 60([제안], nfr.md §1.2 — ReminderScheduler horizon 과 동일 정책). */
  horizonDays?: number;
}

/** master.recurrenceReminderOffsets(JSON 배열 문자열) 파싱. 실패 시 빈 배열(방어 — 회차 생성 자체는 막지 않음). */
function safeParseOffsets(raw: string | null): number[] {
  if (raw === null) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is number => Number.isInteger(x) && x >= 0);
  } catch {
    return [];
  }
}

export class RecurrenceScheduler {
  private readonly d: RecurrenceSchedulerDeps;
  private readonly horizonMs: number;
  /** 재진입 방지: 진행 중이면 다음 실행을 큐잉(ReminderScheduler.sync 와 동일 패턴). */
  private lock: Promise<unknown> = Promise.resolve();

  constructor(deps: RecurrenceSchedulerDeps) {
    this.d = deps;
    this.horizonMs = (deps.horizonDays ?? 60) * 86_400_000;
  }

  /** masterId 미지정 시 전체 반복 마스터를 재조정. 직렬화되어 실행된다. */
  sync(masterId?: number): Promise<RecurrenceSyncResult> {
    const run = this.lock.then(() => this.syncOnce(masterId));
    this.lock = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  private async syncOnce(masterId?: number): Promise<RecurrenceSyncResult> {
    const masters = masterId === undefined ? await this.d.schedules.findRecurringMasters() : await this.loadMaster(masterId);

    let createdTotal = 0;
    for (const master of masters) {
      try {
        createdTotal += await this.syncMaster(master);
      } catch (err) {
        // 한 시리즈의 실패가 다른 시리즈의 실체화를 막지 않는다(§18.3 실패 격리).
        this.d.logger.log('warn', 'recurrence.sync.failed', { masterId: master.id, error: String(err) });
      }
    }
    return { created: createdTotal };
  }

  private async loadMaster(masterId: number): Promise<Schedule[]> {
    const master = await this.d.schedules.findById(masterId);
    if (!master || master.deletedAt !== null || master.recurrenceRule === null || master.recurrenceParentId !== null) {
      return [];
    }
    return [master];
  }

  private async syncMaster(master: Schedule): Promise<number> {
    const now = this.d.clock.now();
    // 상한 366([제안], recurrence.ts MAX_EXPANSION)이 horizon 과 무관하게 항상 걸린다(E-24-3, 무한 증식 방지).
    const expected = expandOccurrences(master, now, now + this.horizonMs);
    const already = new Set(await this.d.schedules.listOccurrenceStartTimes(master.id));
    const missing = expected.filter((startAt) => !already.has(startAt));
    const offsets = safeParseOffsets(master.recurrenceReminderOffsets);

    let created = 0;
    for (const startAt of missing) {
      try {
        const occurrence = await this.createOccurrence(master, startAt, offsets, now);
        await this.d.reminderScheduler.sync(occurrence.id);
        created += 1;
      } catch (err) {
        this.d.logger.log('warn', 'recurrence.occurrence.failed', {
          masterId: master.id,
          startAt,
          error: String(err),
        });
      }
    }
    return created;
  }

  private async createOccurrence(
    master: Schedule,
    startAt: number,
    offsets: number[],
    now: number,
  ): Promise<Schedule> {
    return this.d.uow.transaction(async () => {
      const occurrence = await this.d.schedules.insert({
        title: master.title,
        memo: master.memo,
        categoryId: master.categoryId,
        priority: master.priority,
        startAt,
        endAt: master.endAt !== null ? startAt + (master.endAt - master.startAt) : null,
        timeZone: master.timeZone,
        isAllDay: master.isAllDay,
        isDone: false,
        doneAt: null,
        recurrenceRule: null,
        recurrenceEndAt: null,
        recurrenceCount: null,
        recurrenceParentId: master.id,
        recurrenceReminderOffsets: null,
        source: master.source,
        notifyAtStart: master.notifyAtStart,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      });
      const drafts = buildReminderDrafts(occurrence.startAt, offsets, master.notifyAtStart);
      await this.d.reminders.replaceForSchedule(occurrence.id, drafts, now);
      return occurrence;
    });
  }
}
