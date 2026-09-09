/**
 * 폰 측 워치 동기화 조정자 (F-19).
 * 설계 근거: document/architect/logic.md §17.2 ~ §17.6, §13.9, AC-23/AC-48.
 *
 * - `pushSnapshot()` — 데이터 fetch(= DashboardService.getSummary 와 동일 소스) → `buildWatchSnapshot`
 *   → `WatchSyncGateway.sendSnapshot`. 실패는 로깅 후 격리(NFR-12).
 * - `applyIncomingToggle(op)` — 입력 검증 → opId 중복 제거 원장 → `resolveToggleLWW`
 *   → 이기면 `ScheduleService.toggleDone` **만** 호출 → 원장 기록 → ack → `pushSnapshot`.
 *
 * 쓰기는 `ScheduleService.toggleDone` 외에 없다(P-43, §13.9 Broken Access Control 표면 제거).
 */
import { startOfLocalDay, DAY_MS } from '../domain/time.ts';
import { buildWatchSnapshot } from '../watchSync/snapshot.ts';
import { resolveToggleLWW } from '../watchSync/reconcile.ts';
import {
  WATCH_APPLIED_OPS_KEY,
  WATCH_APPLIED_OPS_MAX,
  type WatchAppliedOp,
  type WatchToggleOp,
} from '../watchSync/types.ts';
import type { Clock } from '../domain/clock.ts';
import type { CategoryRepository, ScheduleRepository, SettingRepository } from '../ports/repositories.ts';
import type { Logger, WatchSyncGateway } from '../ports/gateways.ts';
import type { ScheduleService } from './scheduleService.ts';

export interface WatchSyncServiceDeps {
  clock: Clock;
  schedules: ScheduleRepository;
  categories: CategoryRepository;
  settings: SettingRepository;
  /** 쓰기 전용 접점 — `toggleDone` 만 사용(P-43). */
  scheduleService: ScheduleService;
  gateway: WatchSyncGateway;
  logger: Logger;
}

const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

function isValidToggleOp(op: unknown): op is WatchToggleOp {
  if (!op || typeof op !== 'object') return false;
  const o = op as Record<string, unknown>;
  return (
    typeof o.opId === 'string' &&
    UUID_RE.test(o.opId) &&
    typeof o.scheduleId === 'number' &&
    Number.isInteger(o.scheduleId) &&
    o.scheduleId > 0 &&
    typeof o.done === 'boolean' &&
    typeof o.watchChangedAt === 'number' &&
    Number.isInteger(o.watchChangedAt) &&
    Number.isFinite(o.watchChangedAt) &&
    typeof o.baseUpdatedAt === 'number' &&
    Number.isInteger(o.baseUpdatedAt) &&
    Number.isFinite(o.baseUpdatedAt)
  );
}

export class WatchSyncService {
  private readonly d: WatchSyncServiceDeps;

  constructor(deps: WatchSyncServiceDeps) {
    this.d = deps;
  }

  /**
   * 부트스트랩 배선(§17.2): 워치 게이트 활성화 + 완료 토글 수신 콜백 등록.
   * Android(미지원) 는 조용히 no-op. 활성화 실패는 로깅 후 격리한다.
   */
  async activate(): Promise<void> {
    if (!this.d.gateway.isSupported()) return;
    try {
      await this.d.gateway.activate();
      this.d.gateway.onIncomingToggle((op) =>
        this.applyIncomingToggle(op).catch((err) => {
          this.d.logger.log('warn', 'watch.toggle.handler.failed', { error: String(err) });
        }),
      );
    } catch (err) {
      this.d.logger.log('warn', 'watch.activate.failed', { error: String(err) });
    }
  }

  /**
   * 최신 "오늘 스냅샷"을 워치로 전송한다. 폰 데이터 변경 후 디바운스로 호출(§17.2).
   * fetch 규칙은 `DashboardService.getSummary` 와 동일 소스(§17.3).
   */
  async pushSnapshot(): Promise<void> {
    if (!this.d.gateway.isSupported()) return;

    let snapshot;
    try {
      const now = this.d.clock.now();
      const dayStart = startOfLocalDay(now, this.d.clock.timeZone());
      const dayEnd = dayStart + DAY_MS;

      const [today, nextPage, categories] = await Promise.all([
        this.d.schedules.findForDashboard(dayStart, dayEnd),
        this.d.schedules.findInRange(now, Number.MAX_SAFE_INTEGER, { isDone: false }, 'startAt', 1, null),
        this.d.categories.list(),
      ]);
      const nextUpcoming = nextPage.items[0] ?? null;
      snapshot = buildWatchSnapshot(today, nextUpcoming, categories, this.d.clock);
    } catch (err) {
      // 읽기 실패도 폰 흐름을 저해하지 않는다.
      this.d.logger.log('warn', 'watch.snapshot.build.fail', { error: String(err) });
      return;
    }

    if (snapshot.truncated) this.d.logger.metric('watch.snapshot.truncated');

    try {
      await this.d.gateway.sendSnapshot(snapshot);
      this.d.logger.metric('watch.snapshot.sent');
    } catch (err) {
      this.d.logger.log('warn', 'watch.snapshot.sent.fail', { error: String(err) });
    }
  }

  /**
   * 워치 → 폰 완료 토글 op 를 처리한다(§17.4).
   * 어떤 경로에서도 throw 하지 않는다(베스트-에포트, NFR-12).
   */
  async applyIncomingToggle(op: WatchToggleOp): Promise<void> {
    // 1. 입력 검증
    if (!isValidToggleOp(op)) {
      this.d.logger.metric('watch.toggle.malformed');
      const raw = op as { opId?: unknown } | null | undefined;
      const opId = raw && typeof raw.opId === 'string' ? raw.opId : '';
      await this.ack(opId, 'REJECTED');
      return;
    }

    this.d.logger.metric('watch.toggle.received');

    // 2. dedup — 재생/재전송/재시작 흡수
    const ledger = await this.readLedger();
    if (ledger.some((e) => e.opId === op.opId)) {
      await this.ack(op.opId, 'DUPLICATE');
      return;
    }

    // 3. scheduleId 재조회(위조 방지, §13.9)
    const schedule = await this.d.schedules.findById(op.scheduleId);
    if (!schedule || schedule.deletedAt !== null) {
      this.d.logger.metric('watch.toggle.rejected');
      await this.ack(op.opId, 'NOT_FOUND');
      return;
    }

    // 4. LWW
    const decision = resolveToggleLWW(op, schedule);
    if (decision === 'APPLY') {
      // F-05 규칙: done_at 기록·즉시 저장·집계 반영·updatedAt 갱신. 다른 메서드 호출 없음(P-43).
      await this.d.scheduleService.toggleDone(op.scheduleId, op.done);
      this.d.logger.metric('watch.toggle.applied');
    } else if (decision === 'SKIP_PHONE_WINS') {
      this.d.logger.metric('watch.toggle.lww.phoneWins');
    } else {
      // REJECT_NOT_FOUND — 3단계에서 대부분 걸러지나 방어적으로 처리.
      this.d.logger.metric('watch.toggle.rejected');
      await this.ack(op.opId, 'NOT_FOUND');
      return;
    }

    // 5. 원장 기록(링버퍼 50)
    ledger.push({ opId: op.opId, ts: this.d.clock.now() });
    await this.writeLedger(ledger.slice(-WATCH_APPLIED_OPS_MAX));

    // 6. ack
    await this.ack(op.opId, decision === 'APPLY' ? 'APPLIED' : 'RESOLVED');

    // 7. 워치가 최종 상태로 수렴하도록 스냅샷 재전송(R-19-2/R-19-3)
    await this.pushSnapshot();
  }

  private async readLedger(): Promise<WatchAppliedOp[]> {
    const raw = await this.d.settings.get(WATCH_APPLIED_OPS_KEY);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(
        (e): e is WatchAppliedOp => !!e && typeof (e as WatchAppliedOp).opId === 'string',
      );
    } catch {
      return [];
    }
  }

  private async writeLedger(ring: WatchAppliedOp[]): Promise<void> {
    await this.d.settings.set(WATCH_APPLIED_OPS_KEY, JSON.stringify(ring), this.d.clock.now());
  }

  /** ack 전송 격리 — `GATEWAY_WATCH_UNAVAILABLE` 등 채널 실패를 삼킨다(NFR-12). */
  private async ack(opId: string, result: Parameters<WatchSyncGateway['ack']>[1]): Promise<void> {
    try {
      await this.d.gateway.ack(opId, result);
    } catch (err) {
      this.d.logger.log('warn', 'watch.ack.fail', { opId, result, error: String(err) });
    }
  }
}
