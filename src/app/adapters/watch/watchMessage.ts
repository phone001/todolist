/**
 * 워치 → 폰 WCSession 인바운드 메시지 파싱/분류 (순수, 플랫폼 비의존). F-19.
 * 설계 근거: document/architect/logic.md §17.2 (전송 메커니즘), §17.4 (op 스키마 + 검증),
 *            §13.9 (신뢰 경계 밖 입력 — 정수 계약).
 *
 * `WatchConnectivityGateway`(.native)가 이 모듈만 사용하도록 분리한다:
 *  - `react-native` / `react-native-watch-connectivity` 를 import 하지 않으므로 `node:test` 로
 *    실제 파싱 경로(`emitIncoming` 우회가 아닌)를 검증할 수 있다(WATCH-08/09 회귀 커버리지).
 *  - 정수 계약: `watchChangedAt`/`baseUpdatedAt` 은 **정수** epoch ms 여야 한다. 폰
 *    `WatchSyncService.isValidToggleOp` 도 `Number.isInteger` 로 검증하므로, 어댑터 경계에서
 *    동일 기준으로 걸러 서비스가 조용히 폐기하는 상황을 없앤다(WATCH-09).
 */
import type { WatchToggleOp } from '../../../core/watchSync/types.ts';

/** RFC-4122 형식 UUID (대소문자 허용). 워치는 `UUID().uuidString.lowercased()` 로 생성. */
export const WATCH_UUID_RE =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

/**
 * 신뢰 경계 밖 입력(§13.9)을 완료 토글 op 으로 검증한다. 실패 시 null.
 * `{ type:'toggle', payload:{...} }` 중첩 형태와 평탄 형태를 모두 허용한다(§17.2 message/user-info).
 * 시각 필드는 **정수** epoch ms 만 통과시킨다(§17.4 step 1 / WATCH-09).
 */
export function parseToggleOp(raw: unknown): WatchToggleOp | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const body = (r.type === 'toggle' && r.payload && typeof r.payload === 'object'
    ? (r.payload as Record<string, unknown>)
    : r) as Record<string, unknown>;

  if (
    typeof body.opId === 'string' &&
    WATCH_UUID_RE.test(body.opId) &&
    typeof body.scheduleId === 'number' &&
    Number.isInteger(body.scheduleId) &&
    body.scheduleId > 0 &&
    typeof body.done === 'boolean' &&
    typeof body.watchChangedAt === 'number' &&
    Number.isInteger(body.watchChangedAt) &&
    typeof body.baseUpdatedAt === 'number' &&
    Number.isInteger(body.baseUpdatedAt)
  ) {
    return {
      opId: body.opId,
      scheduleId: body.scheduleId,
      done: body.done,
      watchChangedAt: body.watchChangedAt,
      baseUpdatedAt: body.baseUpdatedAt,
    };
  }
  return null;
}

/** 인바운드 메시지 분류 결과. */
export type WatchInboundMessage =
  | { kind: 'toggle'; op: WatchToggleOp }
  /** 워치가 최신 스냅샷을 요청(§17.1(d) 수동 새로고침 / §17.2 sendMessage 경로 (1)). */
  | { kind: 'requestSnapshot' }
  /** `type:'toggle'` 이었으나 스키마/정수 계약 위반 → `watch.toggle.malformed` 계측 대상. */
  | { kind: 'malformedToggle' }
  /** 그 외(알 수 없는 타입 등) → 무시. malformed 로 계측하지 않는다(WATCH-10). */
  | { kind: 'ignore' };

/**
 * WCSession 인바운드 메시지(`message` / `user-info`)를 분류한다.
 * "parseToggleOp 이 null" 이라고 무조건 malformed 로 보지 않는다 — `type` 이 `'toggle'` 일 때만
 * malformed 로 계측하고, 그 외 타입은 조용히 무시한다(WATCH-10).
 */
export function classifyInboundMessage(raw: unknown): WatchInboundMessage {
  const type =
    raw && typeof raw === 'object'
      ? (raw as Record<string, unknown>).type
      : undefined;

  if (type === 'requestSnapshot') return { kind: 'requestSnapshot' };

  const op = parseToggleOp(raw);
  if (op) return { kind: 'toggle', op };

  if (type === 'toggle') return { kind: 'malformedToggle' };
  return { kind: 'ignore' };
}
