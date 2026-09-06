/**
 * 테스트/데모용 게이트웨이 구현. 운영 어댑터(Notifee, app-auth, Keychain 등)를 대체한다.
 * 설계 근거: document/architect/logic.md 0.1, 13.
 */
import type {
  AuthGateway,
  CalendarGateway,
  ExternalCalendar,
  ExternalEvent,
  Logger,
  LogLevel,
  NotificationGateway,
  NotificationRequest,
  PermissionStatus,
  TokenSet,
  TokenStore,
} from '../../ports/gateways.ts';

export interface ScheduledNotification {
  osRequestId: string;
  request: NotificationRequest;
}

/** 예약/취소를 기록하는 알림 게이트웨이. reboot() 로 OS 예약 유실을 흉내낸다. */
export class FakeNotificationGateway implements NotificationGateway {
  private permission: PermissionStatus;
  private counter = 0;
  private active = new Map<string, ScheduledNotification>();
  readonly scheduledLog: NotificationRequest[] = [];
  readonly cancelledLog: string[] = [];

  constructor(permission: PermissionStatus = 'granted') {
    this.permission = permission;
  }

  setPermission(status: PermissionStatus): void {
    this.permission = status;
  }

  async requestPermission(): Promise<PermissionStatus> {
    return this.permission;
  }

  getPermission(): PermissionStatus {
    return this.permission;
  }

  async schedule(request: NotificationRequest): Promise<string> {
    this.counter += 1;
    const osRequestId = `os-${this.counter}`;
    this.active.set(osRequestId, { osRequestId, request });
    this.scheduledLog.push(request);
    return osRequestId;
  }

  async cancel(osRequestId: string): Promise<void> {
    this.active.delete(osRequestId);
    this.cancelledLog.push(osRequestId);
  }

  async cancelAll(): Promise<void> {
    this.active.clear();
  }

  /** 현재 OS 에 실제로 걸려 있는 예약. */
  activeCount(): number {
    return this.active.size;
  }

  activeRequests(): NotificationRequest[] {
    return Array.from(this.active.values()).map((s) => s.request);
  }

  /** 기기 재부팅: OS 예약이 전부 사라진다(논리 REMINDER 행은 앱 DB 에 남아 있음). */
  reboot(): void {
    this.active.clear();
  }
}

/** 메모리 토큰 저장소. 운영에서는 Keychain/Keystore. */
export class InMemoryTokenStore implements TokenStore {
  private map = new Map<string, TokenSet>();

  async save(ref: string, tokens: TokenSet): Promise<void> {
    this.map.set(ref, { ...tokens });
  }

  async load(ref: string): Promise<TokenSet | null> {
    const found = this.map.get(ref);
    return found ? { ...found } : null;
  }

  async clear(ref: string): Promise<void> {
    this.map.delete(ref);
  }

  has(ref: string): boolean {
    return this.map.has(ref);
  }
}

export interface FakeAuthOptions {
  authorizeResult?: TokenSet | (() => Promise<TokenSet>);
  refreshResult?: TokenSet | (() => Promise<TokenSet>);
}

export class FakeAuthGateway implements AuthGateway {
  readonly revoked: string[] = [];
  private opts: FakeAuthOptions;

  constructor(opts: FakeAuthOptions = {}) {
    this.opts = opts;
  }

  async authorize(): Promise<TokenSet> {
    const r = this.opts.authorizeResult;
    if (typeof r === 'function') return r();
    return (
      r ?? {
        accessToken: 'access-1',
        refreshToken: 'refresh-1',
        accessTokenExpiresAt: 4_102_444_800_000, // 2100
        provider: 'https://idp.example.com',
        subject: 'user-123',
        displayName: '테스트 사용자',
      }
    );
  }

  async refresh(refreshToken: string): Promise<TokenSet> {
    const r = this.opts.refreshResult;
    if (typeof r === 'function') return r();
    if (r) return r;
    return {
      accessToken: `access-${refreshToken}-next`,
      refreshToken,
      accessTokenExpiresAt: 4_102_444_800_000,
    };
  }

  async revoke(token: string): Promise<void> {
    this.revoked.push(token);
  }
}

/** 메모리 로그 수집기. 민감정보 마스킹 검증(V-15)에도 사용. */
export class ArrayLogger implements Logger {
  readonly entries: Array<{ level: LogLevel; event: string; fields?: Record<string, unknown> }> = [];
  readonly metrics: Array<{ name: string; value: number }> = [];

  log(level: LogLevel, event: string, fields?: Record<string, unknown>): void {
    this.entries.push({ level, event, fields });
  }

  metric(name: string, value = 1): void {
    this.metrics.push({ name, value });
  }

  metricTotal(name: string): number {
    return this.metrics.filter((m) => m.name === name).reduce((sum, m) => sum + m.value, 0);
  }

  serialized(): string {
    return JSON.stringify(this.entries);
  }
}

/** 메모리 캘린더 게이트웨이. */
export class FakeCalendarGateway implements CalendarGateway {
  private permission: PermissionStatus;
  calendars: ExternalCalendar[] = [{ id: 'cal-1', title: '기본', allowsModifications: true }];
  events: ExternalEvent[] = [];
  private counter = 0;

  constructor(permission: PermissionStatus = 'granted') {
    this.permission = permission;
  }

  setPermission(status: PermissionStatus): void {
    this.permission = status;
  }

  async requestPermission(): Promise<PermissionStatus> {
    return this.permission;
  }

  getPermission(): PermissionStatus {
    return this.permission;
  }

  async listCalendars(): Promise<ExternalCalendar[]> {
    return [...this.calendars];
  }

  async fetchEvents(fromTs: number, toTs: number, calendarIds: string[]): Promise<ExternalEvent[]> {
    return this.events
      .filter((e) => calendarIds.includes(e.calendarId))
      .filter((e) => e.startAt < toTs && (e.endAt ?? e.startAt) >= fromTs)
      .map((e) => ({ ...e }));
  }

  async createEvent(
    calendarId: string,
    event: Omit<ExternalEvent, 'calendarId' | 'eventId'>,
  ): Promise<string> {
    this.counter += 1;
    const eventId = `evt-${this.counter}`;
    this.events.push({ ...event, calendarId, eventId });
    return eventId;
  }

  async updateEvent(
    calendarId: string,
    eventId: string,
    patch: Partial<ExternalEvent>,
  ): Promise<void> {
    this.events = this.events.map((e) =>
      e.calendarId === calendarId && e.eventId === eventId ? { ...e, ...patch } : e,
    );
  }

  async deleteEvent(calendarId: string, eventId: string): Promise<void> {
    this.events = this.events.filter((e) => !(e.calendarId === calendarId && e.eventId === eventId));
  }
}
