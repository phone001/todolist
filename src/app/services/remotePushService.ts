/**
 * 원격 푸시(FCM) 등록·토픽 구독/해지·전역 알림 토글 연동 오케스트레이터 (F-27, v1.23 신규).
 * 설계 근거: document/architect/logic.md §19.2~§19.5(등록·수신·실패 격리), §6 "전역 알림 토글과
 *   원격 푸시(F-27) 연동", overview.md v1.23 영향 범위("RemotePushService, 신규, src/app 계층").
 *
 * 이 파일은 `src/core/**` 가 아니라 `src/app` 계층에 둔다(Architect 설계 지시) — 기존
 * `ReminderScheduler`/`ScheduleService`/`SettingService`(core) 는 수정하지 않는다(P-75).
 * react/react-native/notifee 를 import 하지 않는 순수 TS 클래스로 두어 스파이·목 기반
 * 단위 테스트(nfr.md V-61/V-62)가 가능하다 — 실제 OS 알림 표시(notifee)는 이 서비스를
 * 호출하는 네이티브 배선(`composeNative.native.ts`)의 책임이다(SRP).
 *
 * 실패 격리 원칙(E-27-2, AC-99): 이 서비스의 공개 메서드는 어떤 경로로도 예외를 던지지 않는다.
 * `RemotePushGateway` 자체도 예외를 삼키고 `null`/`false`만 반환하는 계약이지만, 이중 격리로
 * 한 번 더 try/catch 한다(§19.5, `WatchSyncService`와 동일 패턴).
 */
import type { Clock } from '../../core/domain/clock.ts';
import type { SettingRepository } from '../../core/ports/repositories.ts';
import type { Logger, NotificationGateway, RemotePushGateway, RemotePushMessage } from '../../core/ports/gateways.ts';

/** 단일 공지 토픽(D-34 (a)). 실제 배포 시 Firebase 콘솔 설정과 반드시 일치해야 한다(logic §19.2). */
export const PUSH_TOPIC_ANNOUNCEMENTS = 'todaywhat_announcements';

/** `APP_SETTING` 신규 키 3종(P-78, database.md §15). 스키마 변경 없음 — 기존 EAV 테이블 재사용. */
export const PushSettingKeys = {
  fcmToken: 'push.fcm.token',
  topicSubscribed: 'push.fcm.topicSubscribed',
  registeredAt: 'push.fcm.registeredAt',
} as const;

/** F-18(P-32) 전역 알림 토글 키. `SettingService.notificationsEnabled()` 와 동일 키·기본값(true). */
const NOTIF_ENABLED_KEY = 'notif.enabled';

export interface RemotePushServiceDeps {
  clock: Clock;
  /** `push.fcm.*`/`notif.enabled` 키 직접 접근(§0.1 SettingRepository) — 기존 SettingService 는 미변경. */
  settings: SettingRepository;
  /** 등록 전제조건(P-77 — 로컬 알림과 동일 권한) 확인용. */
  notifications: NotificationGateway;
  gateway: RemotePushGateway;
  logger: Logger;
}

/** 포그라운드 수신 시 표시할 내용. `null` 이면 표시하지 않는다(E-27-6). */
export interface ForegroundDisplayDecision {
  title: string;
  body: string;
}

export class RemotePushService {
  private readonly d: RemotePushServiceDeps;

  constructor(deps: RemotePushServiceDeps) {
    this.d = deps;
  }

  /**
   * 등록 흐름(§19.3). 권한 허용 직후(P-77) fire-and-forget 으로 호출하는 것을 전제로 하며,
   * 항상 시도한다(이미 등록되어 있어도 재시도 — 최초 트리거 지점 전용, "이미 존재하면 스킵"은
   * `registerRemotePushIfNeeded()` 가 담당).
   */
  async registerRemotePush(): Promise<void> {
    if (!this.d.gateway.isSupported()) return; // Android, P-74 — 조용히 종료
    if (this.d.notifications.getPermission() !== 'granted') return; // E-27-1 — 등록 자체를 시도하지 않음

    try {
      const token = await this.d.gateway.register();
      if (token === null) {
        this.d.logger.metric('push.token.register.fail');
        return; // E-27-2 — 예외 아님, 다음 재시도 기회로 위임
      }
      await this.storeToken(token);
      await this.writeSetting(PushSettingKeys.registeredAt, this.d.clock.now());
      this.d.logger.metric('push.token.registered');

      const subscribed = await this.d.gateway.subscribeToTopic(PUSH_TOPIC_ANNOUNCEMENTS);
      if (subscribed) {
        await this.writeSetting(PushSettingKeys.topicSubscribed, true);
        this.d.logger.metric('push.topic.subscribed');
      }
    } catch (err) {
      // 방어적 catch — register()/subscribeToTopic() 계약상 throw 하지 않아야 하지만 이중 격리(§19.3).
      this.d.logger.log('warn', 'push.register.unexpected', { error: String(err) });
    }
  }

  /**
   * 자연 재시도 지점(부트스트랩 렌더 후 / `AppState` `active` 복귀, §16.4/§18.2 nfr) 전용.
   * 로컬에 토큰이 이미 있으면 불필요한 SDK 호출을 피하기 위해 스킵한다(nfr §18.2).
   */
  async registerRemotePushIfNeeded(): Promise<void> {
    try {
      const existing = await this.getStoredToken();
      if (existing) return;
    } catch {
      // 읽기 실패는 등록 시도를 막지 않는다 — 아래 registerRemotePush() 가 다시 격리한다.
    }
    await this.registerRemotePush();
  }

  /** FCM 토큰 로테이션 콜백(§19.3 "onTokenRefresh 등록"). 새 토큰 저장 + 동일 토픽 재구독. */
  async handleTokenRefresh(token: string): Promise<void> {
    try {
      await this.storeToken(token);
      await this.d.gateway.subscribeToTopic(PUSH_TOPIC_ANNOUNCEMENTS);
    } catch (err) {
      this.d.logger.log('warn', 'push.tokenRefresh.fail', { error: String(err) });
    }
  }

  /**
   * 전역 알림 토글(F-18) ↔ 원격 푸시 토픽 연동(§6 "전역 알림 토글과 원격 푸시(F-27) 연동").
   * 로컬 알림 취소/유지(`ReminderScheduler.applyGlobalNotificationsToggle`, 기존/무변경)와는
   * 완전히 독립된 실패 도메인이다 — 이 메서드의 실패가 이미 완료된 로컬 토글 결과를 되돌리지 않는다.
   */
  async applyGlobalNotificationsToggle(enabled: boolean): Promise<void> {
    try {
      if (!enabled) {
        await this.d.gateway.unsubscribeFromTopic(PUSH_TOPIC_ANNOUNCEMENTS);
        await this.writeSetting(PushSettingKeys.topicSubscribed, false);
        this.d.logger.metric('push.topic.unsubscribed');
        return;
      }

      const token = await this.getStoredToken();
      if (token && this.d.notifications.getPermission() === 'granted') {
        await this.d.gateway.subscribeToTopic(PUSH_TOPIC_ANNOUNCEMENTS);
        await this.writeSetting(PushSettingKeys.topicSubscribed, true);
        this.d.logger.metric('push.topic.subscribed');
      }
      // 토큰 미발급 상태면 §19.3 등록 재시도 시점(다음 포그라운드)에서 자연히 구독됨.
    } catch (err) {
      // 예외를 삼킴 — 로컬 알림 토글은 이미 완료된 상태라 영향 없음(E-27-2 원칙 재사용).
      this.d.logger.log('warn', 'push.toggle.sync.fail', { enabled, error: String(err) });
    }
  }

  /**
   * 포그라운드 수신 처리(§19.4 `handleForegroundPush`). 실제 OS 알림 표시(notifee)는 호출부 책임 —
   * 이 메서드는 "표시해야 하는가/무엇을 표시하는가"만 결정한다(SRP, 테스트 용이성).
   * 전역 알림 토글 off 면 `null`(표시 안 함, E-27-6 — 토픽 해지의 전파 지연 구간 대비 이중 방어).
   */
  async handleForegroundMessage(message: RemotePushMessage): Promise<ForegroundDisplayDecision | null> {
    const enabled = await this.notificationsEnabled();
    if (!enabled) return null;
    return { title: message.title ?? '오늘뭐해', body: message.body ?? '' };
  }

  private async notificationsEnabled(): Promise<boolean> {
    const raw = await this.d.settings.get(NOTIF_ENABLED_KEY);
    if (raw === null) return true;
    try {
      const parsed: unknown = JSON.parse(raw);
      return typeof parsed === 'boolean' ? parsed : true;
    } catch {
      return true;
    }
  }

  private async storeToken(token: string): Promise<void> {
    await this.writeSetting(PushSettingKeys.fcmToken, token);
  }

  private async getStoredToken(): Promise<string | null> {
    const raw = await this.d.settings.get(PushSettingKeys.fcmToken);
    if (raw === null) return null;
    try {
      const parsed: unknown = JSON.parse(raw);
      return typeof parsed === 'string' && parsed.length > 0 ? parsed : null;
    } catch {
      return null;
    }
  }

  private writeSetting(key: string, value: unknown): Promise<void> {
    return this.d.settings.set(key, JSON.stringify(value), this.d.clock.now());
  }
}
