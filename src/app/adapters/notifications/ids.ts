/**
 * OS 알림 예약의 결정적 ID 규칙 (순수 함수).
 * 설계 근거: document/architect/logic.md 6 ("deterministicId(reminderId) 로 OS 예약 멱등"),
 *           gateways.ts NotificationRequest.id ("예: `rem-<reminderId>`"), v1.1 §16.5.
 *
 * 재부팅/재예약 시 같은 reminder 는 같은 ID 를 재사용 → 중복 알림 방지.
 */

const PREFIX = 'rem-';

export function deterministicNotificationId(reminderId: number): string {
  if (!Number.isInteger(reminderId) || reminderId <= 0) {
    throw new Error(`deterministicNotificationId: invalid reminderId ${String(reminderId)}`);
  }
  return `${PREFIX}${reminderId}`;
}

/** 알림 ID → reminderId (역변환). 형식이 아니면 null. */
export function reminderIdFromNotificationId(id: string): number | null {
  if (!id.startsWith(PREFIX)) return null;
  const n = Number(id.slice(PREFIX.length));
  return Number.isInteger(n) && n > 0 ? n : null;
}
