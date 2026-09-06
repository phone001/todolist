/**
 * 딥링크 URL 파서 + 알림 payload 파서 (순수 함수, 플랫폼 비의존).
 * 설계 근거: document/architect/logic.md v1.1 §16.2, §16.7, 13.3 (Injection/Tampering 방어).
 *
 * 규칙:
 *  - 스킴 화이트리스트: `todaywhat://` 만 허용.
 *  - 경로 `todaywhat://schedule/:id` → ScheduleDetail. `:id` 는 양의 정수만.
 *  - 알림 payload 의 data 는 `{ scheduleId }` 정수만 신뢰. 그 외는 무시.
 *  - 파서는 네비게이션 대상만 계산한다. 실제 존재 검증(findById 재조회)은 호출부(RootNavigator)가 수행한다.
 */
import type { NavigationTarget } from './routes.ts';

export const APP_URL_SCHEME = 'todaywhat';

/** react-navigation `linking.prefixes` 에 넣을 값. */
export const LINKING_PREFIXES = [`${APP_URL_SCHEME}://`];

/** 양의 32bit 정수인지 확인 (rowid 범위 방어). */
function parsePositiveInt(raw: string): number | null {
  if (!/^\d{1,15}$/.test(raw)) return null;
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0 || n > Number.MAX_SAFE_INTEGER) return null;
  return n;
}

/**
 * 딥링크 URL → 네비게이션 대상.
 * 허용: `todaywhat://schedule/<정수>`  (쿼리스트링·fragment 는 무시)
 * 그 외(타 스킴, 잘못된 경로, 비정수 id)는 null → 호출부는 대시보드로 보낸다.
 */
export function parseDeepLink(url: string | null | undefined): NavigationTarget | null {
  if (!url || typeof url !== 'string') return null;

  const schemeMatch = /^([a-zA-Z][a-zA-Z0-9+.-]*):\/\//.exec(url);
  if (!schemeMatch || schemeMatch[1].toLowerCase() !== APP_URL_SCHEME) return null;

  const afterScheme = url.slice(schemeMatch[0].length);
  const path = afterScheme.split(/[?#]/, 1)[0].replace(/^\/+/, '').replace(/\/+$/, '');
  const segments = path.split('/').filter((s) => s.length > 0);

  if (segments.length === 2 && segments[0] === 'schedule') {
    const scheduleId = parsePositiveInt(decodeURIComponent(segments[1]));
    if (scheduleId !== null) {
      return { stack: 'ScheduleDetail', params: { scheduleId } };
    }
  }
  return null;
}

/**
 * 알림 payload 의 data → scheduleId.
 * NotificationRequest.data 는 설계상 `{ scheduleId: number }` 뿐이다(gateways.ts).
 * 문자열 정수도 허용하되(직렬화 왕복 대비) 정수 변환 실패/음수/객체 오염은 null.
 */
export function parseNotificationPayload(data: unknown): number | null {
  if (data === null || typeof data !== 'object') return null;
  const raw = (data as Record<string, unknown>).scheduleId;
  if (typeof raw === 'number') {
    return Number.isInteger(raw) && raw > 0 ? raw : null;
  }
  if (typeof raw === 'string') {
    return parsePositiveInt(raw);
  }
  return null;
}

/** 알림 payload → 네비게이션 대상 (없으면 null). */
export function notificationTarget(data: unknown): NavigationTarget | null {
  const scheduleId = parseNotificationPayload(data);
  return scheduleId === null ? null : { stack: 'ScheduleDetail', params: { scheduleId } };
}
