/**
 * 단순 반복(D-05)의 발생 시각 전개 (순수 함수).
 * 설계 근거: document/architect/logic.md 5 (RecurrenceExpander), nfr.md 1.2 (확장 상한).
 */
import { advanceByRule } from './time.ts';
import type { Schedule } from './types.ts';

export const MAX_EXPANSION = 366; // nfr.md [제안] 상한

/**
 * [rangeFrom, rangeTo) 구간과 겹치는 이 일정의 시작 시각 목록.
 * - 비반복 일정: 구간과 겹치면 [startAt], 아니면 [].
 * - 반복 일정: rule 에 따라 전개, recurrenceEndAt / recurrenceCount / MAX_EXPANSION 로 상한.
 */
export function expandOccurrences(
  schedule: Pick<
    Schedule,
    'startAt' | 'endAt' | 'timeZone' | 'recurrenceRule' | 'recurrenceEndAt' | 'recurrenceCount'
  >,
  rangeFrom: number,
  rangeTo: number,
  cap: number = MAX_EXPANSION,
): number[] {
  const durationMs = schedule.endAt !== null ? schedule.endAt - schedule.startAt : 0;

  if (schedule.recurrenceRule === null) {
    const occEnd = schedule.startAt + durationMs;
    return schedule.startAt < rangeTo && occEnd >= rangeFrom ? [schedule.startAt] : [];
  }

  const out: number[] = [];
  let cursor = schedule.startAt;
  let iterations = 0;

  while (iterations < cap) {
    if (schedule.recurrenceEndAt !== null && cursor > schedule.recurrenceEndAt) break;
    if (schedule.recurrenceCount !== null && iterations >= schedule.recurrenceCount) break;
    if (cursor >= rangeTo) break;

    const occEnd = cursor + durationMs;
    if (occEnd >= rangeFrom) out.push(cursor);

    cursor = advanceByRule(cursor, schedule.recurrenceRule, schedule.timeZone);
    iterations += 1;
  }
  return out;
}
