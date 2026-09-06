/**
 * 외부 캘린더 이벤트 정제 (순수 함수).
 * 설계 근거: document/architect/logic.md 13.3 ("외부 캘린더 데이터: title ≤ 200, notes ≤ 5000
 *           트렁케이트, 제어문자 제거 후 저장"), 11 (CalendarSyncService), v1.1 §16.5.
 *
 * RNCalendarEventsGateway 가 fetchEvents 결과를 코어에 넘기기 전에 통과시킨다.
 * 외부 데이터는 신뢰 경계 밖 입력으로 취급한다.
 */
import { sanitizeText } from '../../../core/domain/search.ts';
import type { ExternalEvent } from '../../../core/ports/gateways.ts';

export const EXTERNAL_TITLE_MAX = 200;
export const EXTERNAL_NOTES_MAX = 5000;

/** react-native-calendar-events 의 원시 이벤트(느슨한 타입). */
export interface RawCalendarEvent {
  id?: unknown;
  calendarId?: unknown;
  title?: unknown;
  notes?: unknown;
  description?: unknown;
  startDate?: unknown;
  endDate?: unknown;
  lastModifiedDate?: unknown;
}

function toEpochMs(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.trunc(value);
  if (typeof value === 'string') {
    const t = Date.parse(value);
    return Number.isNaN(t) ? null : t;
  }
  return null;
}

function toStr(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

/**
 * 원시 이벤트 → 코어 `ExternalEvent`. 필수 필드(calendarId/eventId/startAt)가 없으면 null.
 * title/notes 는 제어문자 제거 + 길이 상한. 시각은 epoch ms 정수.
 */
export function sanitizeExternalEvent(raw: RawCalendarEvent): ExternalEvent | null {
  const calendarId = toStr(raw.calendarId);
  const eventId = toStr(raw.id);
  const startAt = toEpochMs(raw.startDate);
  if (!calendarId || !eventId || startAt === null) return null;

  const notesSource = toStr(raw.notes) || toStr(raw.description);

  return {
    calendarId,
    eventId,
    title: sanitizeText(toStr(raw.title), EXTERNAL_TITLE_MAX),
    notes: notesSource ? sanitizeText(notesSource, EXTERNAL_NOTES_MAX) : null,
    startAt,
    endAt: toEpochMs(raw.endDate),
    updatedAt: toEpochMs(raw.lastModifiedDate),
  };
}

export function sanitizeExternalEvents(rawList: RawCalendarEvent[]): ExternalEvent[] {
  const out: ExternalEvent[] = [];
  for (const raw of rawList) {
    const clean = sanitizeExternalEvent(raw);
    if (clean !== null) out.push(clean);
  }
  return out;
}
