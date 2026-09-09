/**
 * V-37 / V-39: 폰 측 워치 동기화 조정자 `WatchSyncService`.
 * 대응: document/architect/nfr.md §9 V-37/V-39, logic §17.4, §13.9, AC-23/AC-48, P-43, NFR-12.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../../src/core/app.ts';
import { FixedClock } from '../../src/core/domain/clock.ts';
import { ArrayLogger, FakeWatchSyncGateway } from '../../src/core/infra/fakes/fakes.ts';
import type { WatchToggleOp } from '../../src/core/watchSync/types.ts';

const NOON = Date.UTC(2026, 8, 4, 12, 0, 0);
const UUID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

function setup(now = NOON) {
  const clock = new FixedClock(now, 'UTC');
  const logger = new ArrayLogger();
  const gateway = new FakeWatchSyncGateway(true);
  const app = buildApp({ clock, logger, watchSync: gateway });
  return { clock, logger, gateway, app };
}

function lastAck(g: FakeWatchSyncGateway) {
  return g.acks[g.acks.length - 1];
}

test('V-37: 정상 op → toggleDone 반영 + ack APPLIED + pushSnapshot', async () => {
  const { logger, gateway, app } = setup();
  const { id } = await app.schedules.create({ title: '헬스', startAt: NOON + 3_600_000, notifyAtStart: false });
  const base = (await app.schedules.getById(id))?.updatedAt ?? 0;

  const op: WatchToggleOp = { opId: UUID, scheduleId: id, done: true, watchChangedAt: NOON + 1_000, baseUpdatedAt: base };
  await app.watchSync.applyIncomingToggle(op);

  const after = await app.schedules.getById(id);
  assert.equal(after?.isDone, true);
  assert.equal(after?.doneAt, NOON);
  assert.deepEqual(lastAck(gateway), { opId: UUID, result: 'APPLIED' });
  assert.ok(gateway.sentSnapshots.length >= 1, 'toggle 후 스냅샷 재전송');
  assert.ok(gateway.lastSnapshot()?.today.some((i) => i.id === id && i.isDone));
  assert.ok(logger.metrics.some((m) => m.name === 'watch.toggle.applied'));
});

test('V-37: 동일 opId 재전송 → 재적용 없이 ack DUPLICATE (dedup 원장)', async () => {
  const { clock, logger, gateway, app } = setup();
  const { id } = await app.schedules.create({ title: 't', startAt: NOON + 3_600_000, notifyAtStart: false });
  const op: WatchToggleOp = { opId: UUID, scheduleId: id, done: true, watchChangedAt: NOON + 1_000, baseUpdatedAt: NOON };

  await app.watchSync.applyIncomingToggle(op);
  const afterFirst = await app.schedules.getById(id);

  clock.advance(300_000); // +5분
  await app.watchSync.applyIncomingToggle(op);
  const afterSecond = await app.schedules.getById(id);

  assert.equal(lastAck(gateway).result, 'DUPLICATE');
  assert.equal(afterSecond?.updatedAt, afterFirst?.updatedAt, '재적용 없음 — updatedAt 불변');
  assert.equal(afterSecond?.doneAt, NOON, 'doneAt 불변');
  assert.equal(logger.metrics.filter((m) => m.name === 'watch.toggle.applied').length, 1, 'toggleDone 은 1회만');
});

test('V-37: 잘못된 op(비정수 scheduleId / 비-boolean done / 비-UUID opId) → ack REJECTED, 상태 불변', async () => {
  const { logger, gateway, app } = setup();
  const { id } = await app.schedules.create({ title: 't', startAt: NOON + 3_600_000, notifyAtStart: false });

  const bad: unknown[] = [
    { opId: UUID, scheduleId: 1.5, done: true, watchChangedAt: NOON, baseUpdatedAt: NOON },
    { opId: UUID, scheduleId: id, done: 'yes', watchChangedAt: NOON, baseUpdatedAt: NOON },
    { opId: 'not-a-uuid', scheduleId: id, done: true, watchChangedAt: NOON, baseUpdatedAt: NOON },
    { opId: UUID, scheduleId: id, done: true, watchChangedAt: Number.NaN, baseUpdatedAt: NOON },
  ];
  for (const op of bad) {
    await app.watchSync.applyIncomingToggle(op as WatchToggleOp);
    assert.equal(lastAck(gateway).result, 'REJECTED');
  }
  assert.ok(logger.metrics.some((m) => m.name === 'watch.toggle.malformed'));
  assert.equal((await app.schedules.getById(id))?.isDone, false);
});

test('V-37: 없는/삭제된 일정 → ack NOT_FOUND', async () => {
  const { logger, gateway, app } = setup();
  await app.watchSync.applyIncomingToggle({
    opId: UUID,
    scheduleId: 999_999,
    done: true,
    watchChangedAt: NOON,
    baseUpdatedAt: NOON,
  });
  assert.equal(lastAck(gateway).result, 'NOT_FOUND');
  assert.ok(logger.metrics.some((m) => m.name === 'watch.toggle.rejected'));
});

test('V-38 통합: 폰이 스냅샷 이후 편집 & 워치가 더 이름 → SKIP_PHONE_WINS, ack RESOLVED, 폰 값 유지', async () => {
  const { clock, logger, gateway, app } = setup();
  const { id } = await app.schedules.create({ title: 't', startAt: NOON + 3_600_000, notifyAtStart: false });

  clock.advance(60_000);
  await app.schedules.toggleDone(id, false); // 폰측 변경 → updatedAt 상승

  const op: WatchToggleOp = { opId: UUID, scheduleId: id, done: true, watchChangedAt: NOON + 1_000, baseUpdatedAt: NOON };
  await app.watchSync.applyIncomingToggle(op);

  const after = await app.schedules.getById(id);
  assert.equal(after?.isDone, false, '폰 값 유지');
  assert.equal(lastAck(gateway).result, 'RESOLVED');
  assert.ok(logger.metrics.some((m) => m.name === 'watch.toggle.lww.phoneWins'));
  assert.ok(gateway.sentSnapshots.length >= 1, 'SKIP 이어도 스냅샷 재전송');
});

test('V-39: 워치 채널 실패(sendSnapshot/ack throw)를 주입해도 폰 흐름은 정상 완료', async () => {
  const { logger, gateway, app } = setup();
  gateway.failSend = true;
  gateway.failAck = true;
  const { id } = await app.schedules.create({ title: 't', startAt: NOON + 3_600_000, notifyAtStart: false });

  const op: WatchToggleOp = { opId: UUID, scheduleId: id, done: true, watchChangedAt: NOON + 1_000, baseUpdatedAt: NOON };
  await assert.doesNotReject(app.watchSync.applyIncomingToggle(op));

  assert.equal((await app.schedules.getById(id))?.isDone, true, '채널 실패해도 toggleDone 은 반영');
  assert.ok(logger.entries.some((e) => e.event === 'watch.ack.fail'));
  assert.ok(logger.entries.some((e) => e.event === 'watch.snapshot.sent.fail'));
});

test('V-37 / P-43: op 처리 경로는 toggleDone 외 어떤 변경도 하지 않는다', async () => {
  const { gateway, app } = setup();
  const { id } = await app.schedules.create({ title: '원제목', memo: 'm', startAt: NOON + 3_600_000, notifyAtStart: false });
  const before = await app.schedules.getById(id);

  const op: WatchToggleOp = { opId: UUID, scheduleId: id, done: true, watchChangedAt: NOON + 1_000, baseUpdatedAt: NOON };
  await app.watchSync.applyIncomingToggle(op);
  const after = await app.schedules.getById(id);

  assert.equal(app.db.schedules.length, 1, '새 일정 생성 없음');
  assert.equal(after?.title, before?.title);
  assert.equal(after?.memo, before?.memo);
  assert.equal(after?.startAt, before?.startAt);
  assert.equal(after?.categoryId, before?.categoryId);
  assert.equal(after?.deletedAt, null);
  assert.equal(after?.isDone, true, 'isDone/doneAt 외 변화 없음');
  void gateway;
});

test('V-39: 미지원 게이트(Android) → pushSnapshot 은 조용히 no-op', async () => {
  const clock = new FixedClock(NOON, 'UTC');
  const gateway = new FakeWatchSyncGateway(false);
  const app = buildApp({ clock, watchSync: gateway });
  await app.watchSync.pushSnapshot();
  assert.equal(gateway.sentSnapshots.length, 0);
});

test('§17.2 배선: activate() → gateway.activate + onIncomingToggle 등록, 수신 op 이 처리된다', async () => {
  const { gateway, app } = setup();
  await app.watchSync.activate();
  assert.equal(gateway.activated, 1);
  assert.equal(gateway.hasHandler(), true);

  const { id } = await app.schedules.create({ title: 't', startAt: NOON + 3_600_000, notifyAtStart: false });
  await gateway.emitIncoming({ opId: UUID, scheduleId: id, done: true, watchChangedAt: NOON + 1_000, baseUpdatedAt: NOON });
  assert.equal((await app.schedules.getById(id))?.isDone, true);
});

test('V-39: 미지원 게이트에서 activate() 는 no-op (핸들러 미등록)', async () => {
  const gateway = new FakeWatchSyncGateway(false);
  const app = buildApp({ watchSync: gateway });
  await app.watchSync.activate();
  assert.equal(gateway.activated, 0);
  assert.equal(gateway.hasHandler(), false);
});
