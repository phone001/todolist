/**
 * 외부 시스템 게이트웨이 포트 (OS 알림 / OS 캘린더 / OAuth / 보안 저장소 / 로그).
 * 설계 근거: document/architect/logic.md 0.1, 9 (API 설계), 13 (보안 설계).
 */

export type PermissionStatus = 'granted' | 'denied' | 'undetermined';

export interface NotificationRequest {
  /** 결정적 ID (예: `rem-<reminderId>`). 재예약 시 멱등성 보장. */
  id: string;
  /** 발송 예정 시각 (epoch ms). */
  at: number;
  title: string;
  body: string;
  /** payload 는 정수 ID 만. 수신 시 저장소 재조회로 검증(13.3). */
  data: { scheduleId: number };
}

export interface NotificationGateway {
  requestPermission(): Promise<PermissionStatus>;
  getPermission(): PermissionStatus;
  /** OS 알림 예약. OS 예약 식별자를 반환. */
  schedule(request: NotificationRequest): Promise<string>;
  cancel(osRequestId: string): Promise<void>;
  cancelAll(): Promise<void>;
}

export interface ExternalCalendar {
  id: string;
  title: string;
  allowsModifications: boolean;
}

export interface ExternalEvent {
  calendarId: string;
  eventId: string;
  title: string;
  notes: string | null;
  startAt: number;
  endAt: number | null;
  updatedAt: number | null;
}

export interface CalendarGateway {
  requestPermission(): Promise<PermissionStatus>;
  getPermission(): PermissionStatus;
  listCalendars(): Promise<ExternalCalendar[]>;
  fetchEvents(fromTs: number, toTs: number, calendarIds: string[]): Promise<ExternalEvent[]>;
  createEvent(calendarId: string, event: Omit<ExternalEvent, 'calendarId' | 'eventId'>): Promise<string>;
  updateEvent(calendarId: string, eventId: string, patch: Partial<ExternalEvent>): Promise<void>;
  deleteEvent(calendarId: string, eventId: string): Promise<void>;
}

/** OAuth 2.0 + PKCE 결과 토큰 셋. 값은 절대 DB 에 저장하지 않는다(13.4). */
export interface TokenSet {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: number;
  provider?: string;
  subject?: string;
  displayName?: string;
}

export interface AuthGateway {
  authorize(): Promise<TokenSet>;
  refresh(refreshToken: string): Promise<TokenSet>;
  revoke(token: string): Promise<void>;
}

/** OS 보안 저장소(Keychain/Keystore) 포트. 토큰/DB 키 전용. */
export interface TokenStore {
  save(ref: string, tokens: TokenSet): Promise<void>;
  load(ref: string): Promise<TokenSet | null>;
  clear(ref: string): Promise<void>;
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/** 구조적 로거. 구현체는 민감정보 마스킹 책임을 진다(nfr.md 5.1). */
export interface Logger {
  log(level: LogLevel, event: string, fields?: Record<string, unknown>): void;
  metric(name: string, value?: number): void;
}
