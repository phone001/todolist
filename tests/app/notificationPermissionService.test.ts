import test from 'node:test';
import assert from 'node:assert/strict';
import type { PermissionStatus } from '../../src/core/ports/gateways.ts';
import { NotificationPermissionService } from '../../src/app/services/notificationPermissionService.ts';

function setup(osStatus: PermissionStatus = 'undetermined') {
  const state = { osStatus, cached: 'undetermined' as PermissionStatus, requests: 0, local: 0, remote: 0 };
  const service = new NotificationPermissionService({
    getPermission: () => state.cached,
    refreshPermission: async () => { state.cached = state.osStatus; return state.cached; },
    requestPermission: async () => { state.requests++; state.osStatus = state.cached = 'granted'; return state.cached; },
  }, async () => { state.local++; }, async () => { state.remote++; });
  return { service, state };
}

test('미결정 사용자 요청은 공유 캐시 갱신 후 로컬 예약과 원격 등록을 재시도한다', async () => {
  const { service, state } = setup();
  assert.equal(await service.request(), 'granted');
  assert.equal(service.getPermission(), 'granted');
  assert.deepEqual([state.requests, state.local, state.remote], [1, 1, 1]);
});

test('이미 거부한 사용자에게 OS 팝업을 반복 요청하지 않는다', async () => {
  const { service, state } = setup('denied');
  assert.equal(await service.request(), 'denied');
  assert.deepEqual([state.requests, state.local, state.remote], [0, 0, 0]);
});

test('기존 허용 및 기기 설정에서 허용한 상태를 조회하면 캐시와 등록을 복구한다', async () => {
  const { service, state } = setup('denied');
  await service.refresh();
  state.osStatus = 'granted';
  assert.equal(await service.refresh(), 'granted');
  await service.refresh();
  assert.deepEqual([state.requests, state.local, state.remote], [0, 1, 1]);
});

test('로컬 예약이 동기적으로 실패해도 권한 허용과 원격 등록은 유지한다', async () => {
  let cached: PermissionStatus = 'undetermined';
  let registered = false;
  const service = new NotificationPermissionService({
    getPermission: () => cached,
    refreshPermission: async () => cached,
    requestPermission: async () => { cached = 'granted'; return cached; },
  }, () => { throw new Error('scheduler failed'); }, async () => { registered = true; });
  assert.equal(await service.request(), 'granted');
  assert.equal(registered, true);
});

test('FCM 등록이 끝나지 않아도 권한 요청과 설정 복귀 조회는 즉시 완료된다', async () => {
  let cached: PermissionStatus = 'undetermined';
  const service = new NotificationPermissionService({
    getPermission: () => cached,
    refreshPermission: async () => cached,
    requestPermission: async () => { cached = 'granted'; return cached; },
  }, async () => {}, () => new Promise(() => {}));
  const withoutWaitingForRemote = async (operation: Promise<PermissionStatus>) => {
    const result = await Promise.race([
      operation,
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('권한 결과가 FCM 등록을 기다림')), 100)),
    ]);
    assert.equal(result, 'granted');
  };
  await withoutWaitingForRemote(service.request());
  cached = 'undetermined';
  const alreadyGranted = new NotificationPermissionService({
    getPermission: () => cached,
    refreshPermission: async () => { cached = 'granted'; return cached; },
    requestPermission: async () => { throw new Error('재요청 불필요'); },
  }, async () => {}, () => new Promise(() => {}));
  await withoutWaitingForRemote(alreadyGranted.refresh());
});
