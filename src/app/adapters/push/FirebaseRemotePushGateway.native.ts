/**
 * `@react-native-firebase/messaging` 기반 `RemotePushGateway` 어댑터 (iOS 전용, F-27, v1.23 신규).
 * 설계 근거: document/architect/logic.md 0.1, §16.5, §19.2, §19.6. P-74(iOS 한정)·E-27-2(실패 격리).
 * 환경 제약: react-native / @react-native-firebase 의존 → 파이프라인 미실행(정적 리뷰). 온디바이스 검증 후속.
 *
 * 전 메서드가 내부에서 예외를 포획하고 실패를 나타내는 값(`null`/`false`)만 반환한다 — 예외를
 * 절대 전파하지 않는다(E-27-2, AC-99). `WatchConnectivityGateway`(F-19)와 동일한 실패 격리 원칙.
 * `GoogleService-Info.plist` 배치·초기화(`[FIRApp configure]`)는 네이티브 프로젝트 설정 책임이며
 * 이 어댑터는 JS SDK 호출만 담당한다(§13.10).
 */
import { Platform } from 'react-native';
import messaging from '@react-native-firebase/messaging';
import type { Logger, RemotePushGateway, RemotePushMessage } from '../../../core/ports/gateways.ts';

export class FirebaseRemotePushGateway implements RemotePushGateway {
  private readonly logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  /** iOS 만 지원(P-74). Android 는 `NoopRemotePushGateway` 를 대신 주입한다(composeNative). */
  isSupported(): boolean {
    return Platform.OS === 'ios';
  }

  /** APNs 디바이스 토큰 → FCM 토큰 발급(§19.6.1). 실패해도 throw 하지 않고 `null` 반환(E-27-2). */
  async register(): Promise<string | null> {
    if (!this.isSupported()) return null;
    try {
      const app = messaging();
      // 일부 iOS 환경은 getToken() 이전에 APNs 원격 알림 등록을 명시적으로 선행해야 한다.
      if (!app.isDeviceRegisteredForRemoteMessages) {
        await app.registerDeviceForRemoteMessages();
      }
      const token = await app.getToken();
      return token && token.length > 0 ? token : null;
    } catch (err) {
      this.logger.log('warn', 'push.register.fail', { error: String(err) });
      return null; // E-27-2 — 예외를 삼키고 null 반환, 다음 재시도 기회로 위임
    }
  }

  /** 토픽 구독(§19.6). best-effort — 실패해도 throw 하지 않고 `false` 반환. */
  async subscribeToTopic(topic: string): Promise<boolean> {
    if (!this.isSupported()) return false;
    try {
      await messaging().subscribeToTopic(topic);
      return true;
    } catch (err) {
      this.logger.log('warn', 'push.topic.subscribe.fail', { error: String(err) });
      return false;
    }
  }

  /** 토픽 해지. best-effort — 실패해도 throw 하지 않고 `false` 반환. */
  async unsubscribeFromTopic(topic: string): Promise<boolean> {
    if (!this.isSupported()) return false;
    try {
      await messaging().unsubscribeFromTopic(topic);
      return true;
    } catch (err) {
      this.logger.log('warn', 'push.topic.unsubscribe.fail', { error: String(err) });
      return false;
    }
  }

  /** FCM 토큰 로테이션 이벤트(§19.6.2). 부트스트랩 1회 등록 — 앱 생명주기 동안 유지. */
  onTokenRefresh(cb: (token: string) => void): void {
    if (!this.isSupported()) return;
    try {
      messaging().onTokenRefresh((token: string) => {
        try {
          cb(token);
        } catch (err) {
          this.logger.log('warn', 'push.tokenRefresh.callback.fail', { error: String(err) });
        }
      });
    } catch (err) {
      this.logger.log('warn', 'push.tokenRefresh.register.fail', { error: String(err) });
    }
  }

  /** 포그라운드 수신(§19.6.3). 백그라운드/종료는 iOS 표준 알림에 위임 — 핸들러 미등록(E-27-3). */
  onMessage(cb: (message: RemotePushMessage) => void): void {
    if (!this.isSupported()) return;
    try {
      messaging().onMessage(async (remoteMessage) => {
        try {
          cb({
            title: remoteMessage.notification?.title ?? undefined,
            body: remoteMessage.notification?.body ?? undefined,
            data: (remoteMessage.data as Record<string, string> | undefined) ?? undefined,
          });
        } catch (err) {
          this.logger.log('warn', 'push.message.callback.fail', { error: String(err) });
        }
      });
    } catch (err) {
      this.logger.log('warn', 'push.message.register.fail', { error: String(err) });
    }
  }
}
