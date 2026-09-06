/**
 * react-native-calendar-events 기반 CalendarGateway 어댑터 (네이티브 바인딩).
 * 설계 근거: document/architect/logic.md 11, 13.3, v1.1 §16.5.
 * 환경 제약: 라이브러리 의존 → 파이프라인 미실행(정적 리뷰). 온디바이스 검증.
 * 외부 이벤트는 sanitizeExternalEvents 로 정제 후 코어에 전달한다.
 */
import RNCalendarEvents from 'react-native-calendar-events';
import type {
  CalendarGateway,
  ExternalCalendar,
  ExternalEvent,
  PermissionStatus,
} from '../../../core/ports/gateways.ts';
import { sanitizeExternalEvents } from './sanitize.ts';
import { mapCalendarError } from '../errors.ts';

export class RNCalendarEventsGateway implements CalendarGateway {
  private permission: PermissionStatus = 'undetermined';

  async requestPermission(): Promise<PermissionStatus> {
    const status = await RNCalendarEvents.requestPermissions();
    this.permission = status === 'authorized' ? 'granted' : status === 'denied' ? 'denied' : 'undetermined';
    return this.permission;
  }

  getPermission(): PermissionStatus {
    return this.permission;
  }

  async listCalendars(): Promise<ExternalCalendar[]> {
    try {
      const cals = await RNCalendarEvents.findCalendars();
      return cals.map((c) => ({
        id: String(c.id),
        title: String(c.title ?? ''),
        allowsModifications: Boolean(c.allowsModifications),
      }));
    } catch (err) {
      throw mapCalendarError(err, this.permission);
    }
  }

  async fetchEvents(fromTs: number, toTs: number, calendarIds: string[]): Promise<ExternalEvent[]> {
    try {
      const raw = await RNCalendarEvents.fetchAllEvents(
        new Date(fromTs).toISOString(),
        new Date(toTs).toISOString(),
        calendarIds,
      );
      return sanitizeExternalEvents(raw as never[]);
    } catch (err) {
      throw mapCalendarError(err, this.permission);
    }
  }

  async createEvent(calendarId: string, event: Omit<ExternalEvent, 'calendarId' | 'eventId'>): Promise<string> {
    try {
      const id = await RNCalendarEvents.saveEvent(event.title, {
        calendarId,
        startDate: new Date(event.startAt).toISOString(),
        endDate: new Date(event.endAt ?? event.startAt).toISOString(),
        notes: event.notes ?? undefined,
      });
      return String(id);
    } catch (err) {
      throw mapCalendarError(err, this.permission);
    }
  }

  async updateEvent(calendarId: string, eventId: string, patch: Partial<ExternalEvent>): Promise<void> {
    try {
      await RNCalendarEvents.saveEvent(patch.title ?? '', {
        id: eventId,
        calendarId,
        ...(patch.startAt ? { startDate: new Date(patch.startAt).toISOString() } : {}),
        ...(patch.endAt ? { endDate: new Date(patch.endAt).toISOString() } : {}),
        ...(patch.notes !== undefined ? { notes: patch.notes ?? undefined } : {}),
      });
    } catch (err) {
      throw mapCalendarError(err, this.permission);
    }
  }

  async deleteEvent(_calendarId: string, eventId: string): Promise<void> {
    try {
      await RNCalendarEvents.removeEvent(eventId);
    } catch (err) {
      throw mapCalendarError(err, this.permission);
    }
  }
}
