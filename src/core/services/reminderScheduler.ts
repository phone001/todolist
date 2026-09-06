/**
 * 논리 예약(REMINDER 행) 과 OS 예약을 일치시킨다.
 * 설계 근거: document/architect/logic.md 6. F-08, F-09, P-03, P-09. AC-05, AC-06, AC-08, AC-09.
 */
import { ErrorCodes } from '../domain/errors.ts';
import { formatReminderText } from '../domain/reminders.ts';
import type { Clock } from '../domain/clock.ts';
import type { ReminderRepository, ScheduleRepository } from '../ports/repositories.ts';
import type { Logger, NotificationGateway } from '../ports/gateways.ts';
import type { SettingService } from './settingService.ts';

export interface SyncResult {
  scheduled: number;
  skipped: number;
  deferred?: boolean;
  warning?: string;
}

export interface ReminderSchedulerDeps {
  clock: Clock;
  reminders: ReminderRepository;
  schedules: ScheduleRepository;
  notifications: NotificationGateway;
  settings: SettingService;
  logger: Logger;
  /** 실제 OS 예약을 수행할 미래 구간(일). 기본 60(nfr.md 1.2). */
  horizonDays?: number;
}

export class ReminderScheduler {
  private readonly d: ReminderSchedulerDeps;
  private readonly horizonMs: number;
  /** 재진입 방지: 진행 중이면 다음 실행을 큐잉(logic.md 6 동시성). */
  private lock: Promise<unknown> = Promise.resolve();

  constructor(deps: ReminderSchedulerDeps) {
    this.d = deps;
    this.horizonMs = (deps.horizonDays ?? 60) * 86_400_000;
  }

  /** scheduleId 미지정 시 전체 재조정(콜드 스타트). 직렬화되어 실행된다. */
  sync(scheduleId?: number): Promise<SyncResult> {
    const run = this.lock.then(() => this.syncOnce(scheduleId));
    // lock 은 실패해도 다음 호출을 막지 않도록 swallow 한 체인으로 유지.
    this.lock = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  /** 재부팅 완료 처리(P-09, AC-08): 미래 SCHEDULED 를 PENDING 으로 되돌리고 전체 재예약. */
  async handleBootCompleted(): Promise<SyncResult> {
    const now = this.d.clock.now();
    const reset = await this.d.reminders.resetScheduledToPending(now);
    this.d.logger.metric('reminder.restore.count', reset);
    return this.sync();
  }

  private async syncOnce(scheduleId?: number): Promise<SyncResult> {
    const now = this.d.clock.now();
    const due = await this.d.reminders.findDue(now, this.horizonMs, scheduleId);
    const permission = this.d.notifications.getPermission();
    const showTitle = await this.d.settings.showNotificationTitle();

    let scheduled = 0;
    let skipped = 0;
    let warning: string | undefined;

    for (const reminder of due) {
      if (reminder.triggerAt <= now) {
        if (reminder.state !== 'FIRED') {
          await this.d.reminders.markState(reminder.id, 'SKIPPED');
          skipped += 1;
          this.d.logger.metric('reminder.skipped');
        }
        continue;
      }

      if (permission !== 'granted') {
        warning = ErrorCodes.PERMISSION_NOTIFICATION_DENIED;
        continue;
      }

      if (reminder.state === 'SCHEDULED' && reminder.osRequestId) {
        continue; // 이미 예약됨 (멱등)
      }

      const schedule = await this.d.schedules.findById(reminder.scheduleId);
      if (!schedule || schedule.deletedAt !== null) continue;

      const text = formatReminderText(
        schedule.title,
        reminder.kind,
        reminder.offsetMinutes,
        showTitle,
      );

      try {
        const osRequestId = await this.d.notifications.schedule({
          id: `rem-${reminder.id}`,
          at: reminder.triggerAt,
          title: text.title,
          body: text.body,
          data: { scheduleId: schedule.id },
        });
        await this.d.reminders.markState(reminder.id, 'SCHEDULED', osRequestId, now);
        scheduled += 1;
        this.d.logger.metric('reminder.scheduled');
      } catch (err) {
        // 개별 예약 실패는 PENDING 유지 → 다음 sync 재시도.
        this.d.logger.metric('reminder.schedule.fail');
        this.d.logger.log('warn', 'reminder.schedule.fail', {
          reminderId: reminder.id,
          error: String(err),
        });
      }
    }

    const result: SyncResult = { scheduled, skipped };
    if (warning) result.warning = warning;
    return result;
  }

  /** 알림 수신 후 상태 반영(F-08 발송 수신 처리). */
  async markFired(reminderId: number): Promise<void> {
    await this.d.reminders.markState(reminderId, 'FIRED');
    this.d.logger.metric('reminder.fired');
  }

  /**
   * 알림 탭 시 payload 검증(13.3): 정수 scheduleId 로 저장소 재조회.
   * 존재/유효하지 않으면 null.
   */
  async resolveTappedSchedule(data: unknown): Promise<number | null> {
    if (typeof data !== 'object' || data === null) return null;
    const raw = (data as { scheduleId?: unknown }).scheduleId;
    if (!Number.isInteger(raw)) return null;
    const schedule = await this.d.schedules.findById(raw as number);
    if (!schedule || schedule.deletedAt !== null) return null;
    return schedule.id;
  }
}
