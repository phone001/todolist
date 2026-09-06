/**
 * @notifee/react-native 기반 NotificationGateway 어댑터 (네이티브 바인딩).
 * 설계 근거: document/architect/logic.md 6, v1.1 §16.5, nfr §1.1 (TimestampTrigger, 정확 알람).
 * 환경 제약: notifee 의존 → 파이프라인 미실행(정적 리뷰). 온디바이스 검증.
 */
import notifee, {
  AndroidImportance,
  TimestampTrigger,
  TriggerType,
  AuthorizationStatus,
} from '@notifee/react-native';
import type { NotificationGateway, NotificationRequest, PermissionStatus } from '../../../core/ports/gateways.ts';
import { normalizePermission } from '../errors.ts';

const CHANNEL_ID = 'schedule-reminders';

export class NotifeeNotificationGateway implements NotificationGateway {
  private permission: PermissionStatus = 'undetermined';
  private channelReady = false;

  private async ensureChannel(): Promise<void> {
    if (this.channelReady) return;
    await notifee.createChannel({
      id: CHANNEL_ID,
      name: '일정 알림',
      importance: AndroidImportance.HIGH,
    });
    this.channelReady = true;
  }

  async requestPermission(): Promise<PermissionStatus> {
    const settings = await notifee.requestPermission();
    this.permission =
      settings.authorizationStatus === AuthorizationStatus.AUTHORIZED ||
      settings.authorizationStatus === AuthorizationStatus.PROVISIONAL
        ? 'granted'
        : settings.authorizationStatus === AuthorizationStatus.DENIED
          ? 'denied'
          : 'undetermined';
    return this.permission;
  }

  getPermission(): PermissionStatus {
    return this.permission;
  }

  async schedule(request: NotificationRequest): Promise<string> {
    await this.ensureChannel();
    const trigger: TimestampTrigger = {
      type: TriggerType.TIMESTAMP,
      timestamp: request.at,
      alarmManager: { allowWhileIdle: true }, // Android 정확 알람(권한 시)
    };
    await notifee.createTriggerNotification(
      {
        id: request.id, // 결정적 ID → 재예약 멱등(logic 6)
        title: request.title,
        body: request.body,
        data: { scheduleId: String(request.data.scheduleId) }, // payload 는 정수 ID 만(13.3)
        android: { channelId: CHANNEL_ID, pressAction: { id: 'default' } },
        ios: { sound: 'default' },
      },
      trigger,
    );
    return request.id;
  }

  async cancel(osRequestId: string): Promise<void> {
    await notifee.cancelTriggerNotification(osRequestId);
  }

  async cancelAll(): Promise<void> {
    await notifee.cancelTriggerNotifications();
  }
}

export { normalizePermission };
