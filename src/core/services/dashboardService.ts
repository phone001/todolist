/**
 * 금일(또는 선택 날짜) 완료/미완료 집계.
 * 설계 근거: document/architect/logic.md 7. F-10, 정책 P-07/P-17. AC-04, AC-15, AC-16.
 */
import { startOfLocalDay, DAY_MS } from '../domain/time.ts';
import type { Clock } from '../domain/clock.ts';
import type { ScheduleRepository } from '../ports/repositories.ts';

export interface DashboardSummary {
  /** 기준 로컬 날짜의 자정 (epoch ms). */
  date: number;
  total: number;
  done: number;
  notDone: number;
  /** (done / total) * 100, 정수 반올림. total=0 이면 0. */
  completionRate: number;
  empty: boolean;
  byCategory: Array<{ categoryId: number; total: number; done: number }>;
  /** 다음 예정(미완료, 현재 이후) 일정 id. 없으면 null. */
  nextScheduleId: number | null;
}

export class DashboardService {
  private readonly clock: Clock;
  private readonly schedules: ScheduleRepository;

  constructor(schedules: ScheduleRepository, clock: Clock) {
    this.schedules = schedules;
    this.clock = clock;
  }

  async getSummary(dateTs: number = this.clock.now()): Promise<DashboardSummary> {
    const timeZone = this.clock.timeZone();
    const dayStart = startOfLocalDay(dateTs, timeZone);
    const dayEnd = dayStart + DAY_MS;

    const items = await this.schedules.findForDashboard(dayStart, dayEnd);
    const total = items.length;
    const done = items.filter((s) => s.isDone).length;
    const notDone = total - done;
    const completionRate = total === 0 ? 0 : Math.round((done / total) * 100);

    const byCategoryMap = new Map<number, { categoryId: number; total: number; done: number }>();
    for (const s of items) {
      const entry = byCategoryMap.get(s.categoryId) ?? { categoryId: s.categoryId, total: 0, done: 0 };
      entry.total += 1;
      if (s.isDone) entry.done += 1;
      byCategoryMap.set(s.categoryId, entry);
    }

    const now = this.clock.now();
    const upcoming = await this.schedules.findInRange(
      now,
      Number.MAX_SAFE_INTEGER,
      { isDone: false },
      'startAt',
      1,
      null,
    );

    return {
      date: dayStart,
      total,
      done,
      notDone,
      completionRate,
      empty: total === 0,
      byCategory: Array.from(byCategoryMap.values()).sort((a, b) => a.categoryId - b.categoryId),
      nextScheduleId: upcoming.items[0]?.id ?? null,
    };
  }
}
