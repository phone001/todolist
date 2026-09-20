/**
 * Android 용 `RemotePushGateway` no-op 어댑터 (F-27, P-74).
 * 설계 근거: document/architect/logic.md §16.5, §19.1 "플랫폼 경계".
 *
 * 이번 릴리스는 Android 용 Firebase 설정(`google-services.json`)이 저장소에 없어 범위 밖이다
 * (후속 OI-36). `isSupported()` 가 항상 `false` 이므로 이 클래스의 나머지 메서드는 호출부
 * (`RemotePushService`) 관점에서 사실상 도달하지 않지만, 방어적으로도 안전한 값만 반환한다 —
 * `WatchSyncGateway` 미지원 플랫폼 처리(F-19)와 동일 원칙. react-native 의존이 없어 이 파일은
 * 코어 typecheck 파이프라인에도 포함된다(`.native.ts` 접미사 불필요).
 */
import type { RemotePushGateway, RemotePushMessage } from '../../../core/ports/gateways.ts';

export class NoopRemotePushGateway implements RemotePushGateway {
  isSupported(): boolean {
    return false;
  }

  async register(): Promise<string | null> {
    return null;
  }

  async subscribeToTopic(_topic: string): Promise<boolean> {
    return false;
  }

  async unsubscribeFromTopic(_topic: string): Promise<boolean> {
    return false;
  }

  onTokenRefresh(_cb: (token: string) => void): void {
    // no-op — Android 는 이번 릴리스 범위 밖(P-74).
  }

  onMessage(_cb: (message: RemotePushMessage) => void): void {
    // no-op — Android 는 이번 릴리스 범위 밖(P-74).
  }
}
