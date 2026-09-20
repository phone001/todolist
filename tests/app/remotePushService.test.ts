/**
 * V-61/V-62: 원격 푸시 등록·토픽 구독/해지·전역 토글 연동 `RemotePushService` (F-27, v1.23 신규).
 * 대응: document/architect/nfr.md §9 V-61/V-62, logic §19.3~§19.5, §6 "전역 알림 토글과 원격 푸시 연동",
 *       AC-97/AC-98/AC-99.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { InMemoryDb } from '../../src/core/infra/memory/store.ts';
import { InMemorySettingRepository } from '../../src/core/infra/memory/repositories.ts';
import { ArrayLogger, FakeNotificationGateway, FakeRemotePushGateway } from '../../src/core/infra/fakes/fakes.ts';
import { FixedClock } from '../../src/core/domain/clock.ts';
import {
  PUSH_TOPIC_ANNOUNCEMENTS,
  PushSettingKeys,
  RemotePushService,
} from '../../src/app/services/remotePushService.ts';
import { NoopRemotePushGateway } from '../../src/app/adapters/push/NoopRemotePushGateway.ts';

const NOW = Date.UTC(2026, 8, 20, 9, 0, 0);

function setup(opts: { permission?: 'granted' | 'denied' | 'undetermined'; supported?: boolean } = {}) {
  const clock = new FixedClock(NOW, 'UTC');
  const logger = new ArrayLogger();
  const db = new InMemoryDb();
  const settings = new InMemorySettingRepository(db);
  const notifications = new FakeNotificationGateway(opts.permission ?? 'granted');
  const gateway = new FakeRemotePushGateway(opts.supported ?? true);
  const service = new RemotePushService({ clock, settings, notifications, gateway, logger });
  return { clock, logger, settings, notifications, gateway, service };
}

test('AC-97: 권한 허용 시 등록 → 토큰/등록시각 저장 + 토픽 구독', async () => {
  const { settings, gateway, logger } = setup();
  const service = new RemotePushService({
    clock: new FixedClock(NOW, 'UTC'),
    settings,
    notifications: new FakeNotificationGateway('granted'),
    gateway,
    logger,
  });

  await service.registerRemotePush();

  assert.equal(gateway.registerCalls, 1);
  assert.deepEqual(gateway.subscribedTopics, [PUSH_TOPIC_ANNOUNCEMENTS]);
  assert.equal(JSON.parse((await settings.get(PushSettingKeys.fcmToken)) ?? 'null'), 'fcm-token-1');
  assert.equal(JSON.parse((await settings.get(PushSettingKeys.registeredAt)) ?? 'null'), NOW);
  assert.equal(JSON.parse((await settings.get(PushSettingKeys.topicSubscribed)) ?? 'null'), true);
  assert.ok(logger.metrics.some((m) => m.name === 'push.token.registered'));
  assert.ok(logger.metrics.some((m) => m.name === 'push.topic.subscribed'));
});

test('AC-98/E-27-1: 권한 거부 시 등록을 시도하지 않는다', async () => {
  const { service, gateway, settings } = setup({ permission: 'denied' });

  await service.registerRemotePush();

  assert.equal(gateway.registerCalls, 0);
  assert.equal(await settings.get(PushSettingKeys.fcmToken), null);
});

test('P-74: Android(미지원) 는 등록을 시도하지 않는다', async () => {
  const { service, gateway } = setup({ supported: false });
  await service.registerRemotePush();
  assert.equal(gateway.registerCalls, 0);
});

test('E-27-2/AC-99: 토큰 발급 실패(null) 시 예외 없이 경고 메트릭만 남는다', async () => {
  const { service, gateway, logger, settings } = setup();
  gateway.registerResult = null;

  await assert.doesNotReject(() => service.registerRemotePush());

  assert.ok(logger.metrics.some((m) => m.name === 'push.token.register.fail'));
  assert.equal(await settings.get(PushSettingKeys.fcmToken), null);
});

test('nfr §18.2: registerRemotePushIfNeeded 는 토큰이 이미 있으면 재시도하지 않는다', async () => {
  const { service, gateway } = setup();
  await service.registerRemotePush();
  assert.equal(gateway.registerCalls, 1);

  await service.registerRemotePushIfNeeded();
  assert.equal(gateway.registerCalls, 1, '토큰이 이미 있으면 스킵');
});

test('§19.3 onTokenRefresh: 새 토큰 저장 + 재구독', async () => {
  const { service, settings, gateway } = setup();
  await service.handleTokenRefresh('fcm-token-2');

  assert.equal(JSON.parse((await settings.get(PushSettingKeys.fcmToken)) ?? 'null'), 'fcm-token-2');
  assert.ok(gateway.subscribedTopics.includes(PUSH_TOPIC_ANNOUNCEMENTS));
});

test('§6/E-27-6: 전역 알림 토글 off → 토픽 해지 + topicSubscribed=false', async () => {
  const { service, settings, gateway, logger } = setup();
  await service.registerRemotePush();

  await service.applyGlobalNotificationsToggle(false);

  assert.deepEqual(gateway.unsubscribedTopics, [PUSH_TOPIC_ANNOUNCEMENTS]);
  assert.equal(JSON.parse((await settings.get(PushSettingKeys.topicSubscribed)) ?? 'null'), false);
  assert.ok(logger.metrics.some((m) => m.name === 'push.topic.unsubscribed'));
});

test('§6: 전역 알림 토글 on 복귀 → 토큰이 있으면 재구독', async () => {
  const { service, settings, gateway } = setup();
  await service.registerRemotePush();
  await service.applyGlobalNotificationsToggle(false);
  gateway.subscribedTopics.length = 0;

  await service.applyGlobalNotificationsToggle(true);

  assert.deepEqual(gateway.subscribedTopics, [PUSH_TOPIC_ANNOUNCEMENTS]);
  assert.equal(JSON.parse((await settings.get(PushSettingKeys.topicSubscribed)) ?? 'null'), true);
});

test('§19.5: applyGlobalNotificationsToggle 실패는 예외를 던지지 않는다(격리)', async () => {
  const { service, gateway } = setup();
  gateway.unsubscribeFromTopic = () => {
    throw new Error('boom');
  };
  await assert.doesNotReject(() => service.applyGlobalNotificationsToggle(false));
});

test('§19.4/E-27-6: 포그라운드 수신 — 전역 알림 on 이면 표시 내용을 반환한다', async () => {
  const { service, settings } = setup();
  await settings.set('notif.enabled', JSON.stringify(true), NOW);

  const decision = await service.handleForegroundMessage({ title: '공지', body: '내용' });
  assert.deepEqual(decision, { title: '공지', body: '내용' });
});

test('§19.4/E-27-6: 포그라운드 수신 — 전역 알림 off 면 표시하지 않는다', async () => {
  const { service, settings } = setup();
  await settings.set('notif.enabled', JSON.stringify(false), NOW);

  const decision = await service.handleForegroundMessage({ title: '공지', body: '내용' });
  assert.equal(decision, null);
});

test('§19.4: 제목/본문 미지정 시 기본값으로 대체한다', async () => {
  const { service } = setup();
  const decision = await service.handleForegroundMessage({});
  assert.deepEqual(decision, { title: '오늘뭐해', body: '' });
});

test('P-74: NoopRemotePushGateway(Android) 는 모든 메서드가 no-op 이며 throw 하지 않는다', async () => {
  const gateway = new NoopRemotePushGateway();
  assert.equal(gateway.isSupported(), false);
  assert.equal(await gateway.register(), null);
  assert.equal(await gateway.subscribeToTopic('t'), false);
  assert.equal(await gateway.unsubscribeFromTopic('t'), false);
  assert.doesNotThrow(() => gateway.onTokenRefresh(() => {}));
  assert.doesNotThrow(() => gateway.onMessage(() => {}));
});
