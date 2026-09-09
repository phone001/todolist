/**
 * react-native-watch-connectivity 기반 `WatchSyncGateway` 어댑터 (iOS 네이티브 바인딩). F-19.
 * 설계 근거: document/architect/logic.md 0.1, 17.1, 17.2, 13.9, overview v1.9 "워치 타깃".
 *
 * 온디바이스 검증(N-11): watchOS 26.2 시뮬레이터에서 폰↔워치 왕복 검증 완료. 파싱/분류 로직은
 * `./watchMessage.ts`(순수)로 분리해 `node:test` 로 회귀 커버(WATCH-08/09/10). RN 셸의 `.native.ts`
 * 파일은 core tsconfig(tsconfig.json)에서 제외된다.
 *
 * 전송 메커니즘(17.2):
 *  - 폰 -> 워치 스냅샷: updateApplicationContext(최신 1건 유지) + 도달 시 sendMessage 병행.
 *  - 워치 -> 폰 완료 토글: message / user-info 이벤트로 수신 -> 콜백 위임.
 *  - 워치 -> 폰 "스냅샷 주세요"(requestSnapshot, 수동 새로고침 §17.1(d)): 마지막 스냅샷으로 즉시 reply
 *    + 폰측 pushSnapshot() 재호출로 최신 스냅샷을 다시 전송(WATCH-10).
 *  - ack: sendMessage replyHandler 가 없는 경로를 위해 다음 applicationContext 에 ackedOpIds 를 실어 전달.
 *  - 전송/활성화 실패는 폰 흐름을 저해하지 않는다(격리, NFR-12) -- throw 하지 않고 로깅만.
 *  - 미지원 플랫폼(Android 등)에서는 모든 메서드가 조용히 no-op 이다(17.2 — `GATEWAY_WATCH_UNAVAILABLE`
 *    없이 skip). `WatchSyncService` 도 `isSupported()` 로 먼저 걸러내므로 이중 방어.
 *
 * 직렬화(17.2 "직렬화 후 updateApplicationContext"): `WCSession` payload 는 property-list 타입만
 * 허용한다(NSNull 불가). `WatchSnapshot` 의 `nextUpcoming`·`doneAt` 은 null 가능(§17.3)이므로 전송
 * 직전에 null/undefined 키를 재귀적으로 제거한다. 워치(Swift) Optional 필드는 키 부재 시 nil 로
 * 디코드되므로 스키마는 그대로 유지된다(계약 무변경).
 */
import { Platform } from 'react-native';
import {
  getReachability,
  sendMessage,
  transferUserInfo,
  updateApplicationContext,
  watchEvents,
} from 'react-native-watch-connectivity';
import type { Logger, WatchSyncGateway } from '../../../core/ports/gateways.ts';
import type {
  WatchSnapshot,
  WatchToggleAck,
  WatchToggleOp,
} from '../../../core/watchSync/types.ts';
import { classifyInboundMessage } from './watchMessage.ts';

type Unsubscribe = () => void;

/**
 * WCSession payload 로 넘길 수 있도록 null/undefined 를 재귀적으로 제거한다.
 * `updateApplicationContext`/`sendMessage` 는 plist 타입만 허용 → NSNull 이 있으면
 * `WCErrorCodePayloadUnsupportedTypes` 로 전체 전송이 실패한다.
 */
function toPlistSafe<T>(value: T): T {
  if (Array.isArray(value)) {
    return value
      .filter((v) => v !== null && v !== undefined)
      .map((v) => toPlistSafe(v)) as unknown as T;
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v === null || v === undefined) continue;
      out[k] = toPlistSafe(v);
    }
    return out as T;
  }
  return value;
}

export class WatchConnectivityGateway implements WatchSyncGateway {
  private readonly logger: Logger;
  private toggleCb: ((op: WatchToggleOp) => void) | null = null;
  /** 워치의 "스냅샷 주세요" 요청 시 호출(§17.2). 조립 지점에서 `pushSnapshot` 에 배선. */
  private snapshotRequestCb: (() => void) | null = null;
  private subscriptions: Unsubscribe[] = [];
  /** transferUserInfo 경로 ack -- 다음 스냅샷 applicationContext 에 실어 전달. */
  private pendingAckedOpIds: string[] = [];
  /** 마지막으로 전송한 스냅샷 -- requestSnapshot reply 에 즉시 사용(§17.2 "reply 로 최신 스냅샷"). */
  private lastSnapshot: WatchSnapshot | null = null;
  private activated = false;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  /** iOS 에서만 지원. Android 는 false -> WatchSyncService 가 모든 경로를 no-op 처리. */
  isSupported(): boolean {
    return Platform.OS === 'ios';
  }

  /** 조립 지점(composeNative)에서 `() => watchSyncService.pushSnapshot()` 로 배선(WATCH-10). */
  setSnapshotRequestHandler(cb: () => void): void {
    this.snapshotRequestCb = cb;
  }

  async activate(): Promise<void> {
    // 미지원 플랫폼은 조용히 no-op (17.2 — `GATEWAY_WATCH_UNAVAILABLE` 던지지 않음).
    if (!this.isSupported()) return;
    if (this.activated) return;
    this.activated = true;

    // WCSession 은 네이티브 모듈이 자동 활성화한다. 수신 이벤트만 구독한다.
    const onMessage = watchEvents.on('message', (message: unknown, reply?: (resp: unknown) => void) => {
      const inbound = classifyInboundMessage(message);
      switch (inbound.kind) {
        case 'requestSnapshot': {
          // §17.2 sendMessage 경로 (1): 마지막 스냅샷으로 즉시 응답(워치 ingestContext 가 바로 반영).
          if (this.lastSnapshot) {
            reply?.({ type: 'snapshot', payload: toPlistSafe(this.lastSnapshot) });
          } else {
            reply?.({ ok: true });
          }
          // 최신 스냅샷을 다시 빌드/전송하도록 폰측에 요청(WATCH-10).
          this.snapshotRequestCb?.();
          return;
        }
        case 'toggle': {
          // 즉시 경로 수신 확인만. 최종 결과 ack 는 WatchSyncService -> this.ack().
          reply?.({ ok: true });
          this.toggleCb?.(inbound.op);
          return;
        }
        case 'malformedToggle': {
          this.logger.metric('watch.toggle.malformed');
          reply?.({ ok: false });
          return;
        }
        default: {
          // 알 수 없는 타입 -- malformed 로 계측하지 않는다(WATCH-10).
          reply?.({ ok: false });
        }
      }
    });

    const onUserInfo = watchEvents.on('user-info', (userInfo: unknown) => {
      const inbound = classifyInboundMessage(userInfo);
      if (inbound.kind === 'toggle') {
        this.toggleCb?.(inbound.op);
      } else if (inbound.kind === 'malformedToggle') {
        this.logger.metric('watch.toggle.malformed');
      }
      // requestSnapshot / ignore: user-info 경로에서는 무시(응답 채널 없음).
    });

    this.subscriptions.push(onMessage, onUserInfo);
  }

  async sendSnapshot(snapshot: WatchSnapshot): Promise<void> {
    if (!this.isSupported()) return;

    // transferUserInfo 경로로 처리한 op 의 ack 를 스냅샷에 합류시켜 워치 보류 큐를 정리한다.
    const acked = this.pendingAckedOpIds;
    this.pendingAckedOpIds = [];
    const payload = toPlistSafe<WatchSnapshot>({
      ...snapshot,
      ackedOpIds: [...snapshot.ackedOpIds, ...acked],
    });
    this.lastSnapshot = payload;

    try {
      updateApplicationContext({ type: 'snapshot', payload });
    } catch (err) {
      this.logger.log('warn', 'watch.snapshot.sent.fail', { error: String(err) });
    }

    try {
      const reachable = await getReachability();
      if (reachable) {
        sendMessage(
          { type: 'snapshot', payload },
          () => undefined,
          (err: unknown) => this.logger.log('warn', 'watch.snapshot.message.fail', { error: String(err) }),
        );
      }
    } catch (err) {
      this.logger.log('warn', 'watch.snapshot.reachability.fail', { error: String(err) });
    }
  }

  onIncomingToggle(cb: (op: WatchToggleOp) => void): void {
    this.toggleCb = cb;
  }

  async ack(opId: string, result: WatchToggleAck): Promise<void> {
    if (!this.isSupported() || !opId) return;
    // 재연결/재시작에도 워치가 보류 큐에서 op 을 제거하도록 다음 스냅샷 컨텍스트에 실어 보낸다.
    if (!this.pendingAckedOpIds.includes(opId)) this.pendingAckedOpIds.push(opId);
    try {
      // 보장 전달 경로(FIFO)로도 ack 를 한 번 더 보낸다 -- 스냅샷이 당장 안 나갈 수 있으므로.
      transferUserInfo({ type: 'ack', opId, result });
    } catch (err) {
      this.logger.log('warn', 'watch.ack.fail', { opId, result, error: String(err) });
    }
  }

  /** 셸 정리 시 호출(선택). */
  dispose(): void {
    for (const off of this.subscriptions) {
      try {
        off();
      } catch {
        // ignore
      }
    }
    this.subscriptions = [];
    this.toggleCb = null;
    this.snapshotRequestCb = null;
    this.activated = false;
  }
}
