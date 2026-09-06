/**
 * 타임존 인지 날짜 경계 계산.
 * 설계 근거: document/architect/logic.md 7 (DashboardService), 정책 P-16/P-17.
 * 저장은 epoch ms(UTC), 날짜 경계는 사용자 로컬 자정 기준.
 */

export const DAY_MS = 86_400_000;

interface WallParts {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
  second: number;
}

function wallParts(ts: number, timeZone: string): WallParts {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const out: Record<string, number> = {};
  for (const p of dtf.formatToParts(new Date(ts))) {
    if (p.type !== 'literal') out[p.type] = Number(p.value);
  }
  return {
    year: out.year,
    month: out.month,
    day: out.day,
    hour: out.hour,
    minute: out.minute,
    second: out.second,
  };
}

/** 주어진 시각에서 해당 타임존의 UTC 오프셋(ms). local = utc + offset. */
export function timeZoneOffsetMs(ts: number, timeZone: string): number {
  const w = wallParts(ts, timeZone);
  const asIfUtc = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second);
  return asIfUtc - Math.floor(ts / 1000) * 1000;
}

/** timeZone 기준 ts 가 속한 로컬 날짜의 자정(00:00:00.000) 의 epoch ms. */
export function startOfLocalDay(ts: number, timeZone: string): number {
  const w = wallParts(ts, timeZone);
  const midnightAsIfUtc = Date.UTC(w.year, w.month - 1, w.day, 0, 0, 0);
  let candidate = midnightAsIfUtc - timeZoneOffsetMs(ts, timeZone);
  // DST 경계 보정: 자정 시점의 오프셋으로 한 번 더 계산.
  const off2 = timeZoneOffsetMs(candidate, timeZone);
  const recomputed = midnightAsIfUtc - off2;
  if (recomputed !== candidate) candidate = recomputed;
  return candidate;
}

/** 다음 로컬 날짜 경계 (start + 24h). 설계상 고정 24h(logic.md 7). */
export function endOfLocalDayExclusive(ts: number, timeZone: string): number {
  return startOfLocalDay(ts, timeZone) + DAY_MS;
}

/** 단순 반복(D-05)에서 다음 발생 시각. */
export function advanceByRule(
  ts: number,
  rule: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY',
  timeZone: string,
): number {
  if (rule === 'DAILY') return ts + DAY_MS;
  if (rule === 'WEEKLY') return ts + 7 * DAY_MS;

  const w = wallParts(ts, timeZone);
  let year = w.year;
  let month = w.month; // 1-12
  if (rule === 'MONTHLY') {
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  } else {
    year += 1;
  }
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const day = Math.min(w.day, daysInMonth);
  const asIfUtc = Date.UTC(year, month - 1, day, w.hour, w.minute, w.second);
  return asIfUtc - timeZoneOffsetMs(asIfUtc, timeZone);
}
