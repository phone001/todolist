/**
 * 앱 설정(APP_SETTING) 접근. 값은 JSON 직렬화하여 저장.
 * 설계 근거: document/architect/logic.md 10. F-13, 정책 P-10-1/P-08-2, D-02. AC-17.
 */
import type { Clock } from '../domain/clock.ts';
import type { ThemeMode } from '../domain/types.ts';
import type { SettingRepository } from '../ports/repositories.ts';

export const SettingKeys = {
  THEME_MODE: 'theme.mode',
  THEME_ACCENT: 'theme.accent',
  THEME_FONT_SCALE: 'theme.fontScale',
  NOTIF_SHOW_TITLE: 'notif.showTitle',
  CALENDAR_PUSH_ENABLED: 'calendar.pushEnabled',
  CALENDAR_CONFLICT_POLICY: 'calendar.conflictPolicy',
} as const;

export interface ThemeSettings {
  mode: ThemeMode;
  accent: string;
  fontScale: number;
}

const DEFAULT_THEME: ThemeSettings = { mode: 'system', accent: '#0A84FF', fontScale: 1 };

export class SettingService {
  private readonly settings: SettingRepository;
  private readonly clock: Clock;

  constructor(settings: SettingRepository, clock: Clock) {
    this.settings = settings;
    this.clock = clock;
  }

  private async readJson<T>(key: string, fallback: T): Promise<T> {
    const raw = await this.settings.get(key);
    if (raw === null) return fallback;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  }

  private write(key: string, value: unknown): Promise<void> {
    return this.settings.set(key, JSON.stringify(value), this.clock.now());
  }

  async getTheme(): Promise<ThemeSettings> {
    return {
      mode: await this.readJson<ThemeMode>(SettingKeys.THEME_MODE, DEFAULT_THEME.mode),
      accent: await this.readJson<string>(SettingKeys.THEME_ACCENT, DEFAULT_THEME.accent),
      fontScale: await this.readJson<number>(SettingKeys.THEME_FONT_SCALE, DEFAULT_THEME.fontScale),
    };
  }

  async setTheme(patch: Partial<ThemeSettings>): Promise<void> {
    if (patch.mode !== undefined) await this.write(SettingKeys.THEME_MODE, patch.mode);
    if (patch.accent !== undefined) await this.write(SettingKeys.THEME_ACCENT, patch.accent);
    if (patch.fontScale !== undefined) await this.write(SettingKeys.THEME_FONT_SCALE, patch.fontScale);
  }

  /** 정책 P-10-1. 기본값 true(제목 노출). false 면 알림 본문에서 제목을 가린다. */
  showNotificationTitle(): Promise<boolean> {
    return this.readJson<boolean>(SettingKeys.NOTIF_SHOW_TITLE, true);
  }

  setShowNotificationTitle(show: boolean): Promise<void> {
    return this.write(SettingKeys.NOTIF_SHOW_TITLE, show);
  }

  /** D-02. 앱 → 기본 캘린더 쓰기(양방향) 옵션. 기본 false(읽기 전용). */
  calendarPushEnabled(): Promise<boolean> {
    return this.readJson<boolean>(SettingKeys.CALENDAR_PUSH_ENABLED, false);
  }

  setCalendarPushEnabled(enabled: boolean): Promise<void> {
    return this.write(SettingKeys.CALENDAR_PUSH_ENABLED, enabled);
  }

  /** 정책 P-08-2. 캘린더 충돌 해결 기본값 'device'(기기 캘린더 우선). */
  calendarConflictPolicy(): Promise<'device' | 'app'> {
    return this.readJson<'device' | 'app'>(SettingKeys.CALENDAR_CONFLICT_POLICY, 'device');
  }
}
