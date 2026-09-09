/**
 * WATCH-08 / WATCH-09 / WATCH-10 회귀:
 * 워치 → 폰 WCSession 인바운드 메시지 파싱/분류(`src/app/adapters/watch/watchMessage.ts`, 순수).
 * `emitIncoming` 우회가 아니라 **실제 파싱 경로**를 검증한다.
 *
 * 대응: document/architect/logic.md §17.2, §17.4 step 1, §13.9 (정수 계약), AC-23/AC-48/AC-50.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyInboundMessage,
  parseToggleOp,
} from '../../src/app/adapters/watch/watchMessage.ts';
import { buildApp } from '../../src/core/app.ts';
import { FixedClock } from '../../src/core/domain/clock.ts';
import { ArrayLogger, FakeWatchSyncGateway } from '../../src/core/infra/fakes/fakes.ts';

const UUID = 'cb56fa1f-e5e6-4796-9bea-b8891e09788b';
const NOON = Date.UTC(2026, 8, 4, 12, 0, 0);

/** 워치가 sendMessage / transferUserInfo 로 보내는 실제 형태(중첩 payload). */
function watchToggleMessage(over: Record<string, unknown> = {}) {
  return {
    type: 'toggle',
    payload: {
      opId: UUID,
      scheduleId: 2,
      done: true,
      watchChangedAt: 1_788_850_190_717,
      baseUpdatedAt: 1_788_849_935_093,
      ...over,
    },
  };
}

// ── WATCH-08 / WATCH-09: 정수 계약 ──────────────────────────────────────────

test('WATCH-09: 정수 watchChangedAt/baseUpdatedAt 를 가진 op 은 파싱된다', () => {
  const op = parseToggleOp(watchToggleMessage());
  assert.ok(op);
  assert.equal(op?.opId, UUID);
  assert.equal(op?.scheduleId, 2);
  assert.equal(op?.done, true);
  assert.equal(op?.watchChangedAt, 1_788_850_190_717);
  assert.equal(op?.baseUpdatedAt, 1_788_849_935_093);
});

test('WATCH-08: 비정수 watchChangedAt(Swift timeIntervalSince1970*1000) → 파싱 거부(null)', () => {
  // 수정 전 스캐폴드가 emit 하던 값 형태: 소수부가 있는 Double.
  assert.equal(parseToggleOp(watchToggleMessage({ watchChangedAt: 1_788_850_190_717.4 })), null);
});

test('WATCH-08: 비정수 baseUpdatedAt → 파싱 거부(null)', () => {
  assert.equal(parseToggleOp(watchToggleMessage({ baseUpdatedAt: 1_788_849_935_093.9 })), null);
});

test('WATCH-09: NaN/Infinity 시각 → 파싱 거부(null)', () => {
  assert.equal(parseToggleOp(watchToggleMessage({ watchChangedAt: Number.NaN })), null);
  assert.equal(parseToggleOp(watchToggleMessage({ baseUpdatedAt: Number.POSITIVE_INFINITY })), null);
});

test('파싱: 비-UUID opId / 비정수·비양수 scheduleId / 비-boolean done → null', () => {
  assert.equal(parseToggleOp(watchToggleMessage({ opId: 'not-a-uuid' })), null);
  assert.equal(parseToggleOp(watchToggleMessage({ scheduleId: 2.5 })), null);
  assert.equal(parseToggleOp(watchToggleMessage({ scheduleId: 0 })), null);
  assert.equal(parseToggleOp(watchToggleMessage({ done: 'yes' })), null);
});

test('파싱: 평탄(flat) 형태도 허용한다', () => {
  const op = parseToggleOp({
    opId: UUID,
    scheduleId: 7,
    done: false,
    watchChangedAt: 1_788_850_190_000,
    baseUpdatedAt: 1_788_850_000_000,
  });
  assert.equal(op?.scheduleId, 7);
  assert.equal(op?.done, false);
});

// ── WATCH-10: 메시지 분류 ──────────────────────────────────────────────────

test('WATCH-10: {type:"requestSnapshot"} → kind=requestSnapshot', () => {
  assert.deepEqual(classifyInboundMessage({ type: 'requestSnapshot' }), { kind: 'requestSnapshot' });
});

test('WATCH-10: 유효 토글 → kind=toggle (op 포함)', () => {
  const c = classifyInboundMessage(watchToggleMessage());
  assert.equal(c.kind, 'toggle');
  assert.equal(c.kind === 'toggle' && c.op.opId, UUID);
});

test('WATCH-10: type:"toggle" 인데 스키마/정수 위반 → kind=malformedToggle (metric 대상)', () => {
  assert.deepEqual(
    classifyInboundMessage(watchToggleMessage({ watchChangedAt: 1_788_850_190_717.4 })),
    { kind: 'malformedToggle' },
  );
});

test('WATCH-10: 알 수 없는/비토글 타입 → kind=ignore (malformed 로 계측하지 않음)', () => {
  assert.deepEqual(classifyInboundMessage({ type: 'snapshot' }), { kind: 'ignore' });
  assert.deepEqual(classifyInboundMessage({ type: 'ack', opId: UUID }), { kind: 'ignore' });
  assert.deepEqual(classifyInboundMessage({ foo: 1 }), { kind: 'ignore' });
  assert.deepEqual(classifyInboundMessage(null), { kind: 'ignore' });
  assert.deepEqual(classifyInboundMessage('x'), { kind: 'ignore' });
});

// ── 실제 경로 통합: parseToggleOp → WatchSyncService.applyIncomingToggle ────

test('실경로: parseToggleOp 출력은 WatchSyncService 검증을 통과해 APPLY 된다 (emitIncoming 우회 아님)', async () => {
  const clock = new FixedClock(NOON, 'UTC');
  const logger = new ArrayLogger();
  const gateway = new FakeWatchSyncGateway(true);
  const app = buildApp({ clock, logger, watchSync: gateway });
  const { id } = await app.schedules.create({ title: '점심 약속', startAt: NOON + 3_600_000, notifyAtStart: false });
  const base = (await app.schedules.getById(id))?.updatedAt ?? 0;

  // 워치가 보낸 "그대로"의 메시지를 어댑터와 동일하게 parse 한 뒤 서비스에 전달.
  const raw = { type: 'toggle', payload: { opId: UUID, scheduleId: id, done: true, watchChangedAt: NOON + 1_000, baseUpdatedAt: base } };
  const op = parseToggleOp(raw);
  assert.ok(op, 'parse 성공(정수 계약 충족)');
  await app.watchSync.applyIncomingToggle(op!);

  const after = await app.schedules.getById(id);
  assert.equal(after?.isDone, true, 'APPLY 됨 (REJECTED 아님)');
  assert.equal(after?.doneAt, NOON);
  assert.equal(gateway.acks[gateway.acks.length - 1]?.result, 'APPLIED');
  assert.ok(logger.metrics.some((m) => m.name === 'watch.toggle.applied'));
  assert.ok(!logger.metrics.some((m) => m.name === 'watch.toggle.malformed'), 'malformed 계측 없음');
});

test('실경로(음성): 비정수 watchChangedAt 메시지는 parse 단계에서 걸러져 서비스에 도달하지 않는다', async () => {
  const clock = new FixedClock(NOON, 'UTC');
  const app = buildApp({ clock, watchSync: new FakeWatchSyncGateway(true) });
  const { id } = await app.schedules.create({ title: 't', startAt: NOON + 3_600_000, notifyAtStart: false });

  const raw = { type: 'toggle', payload: { opId: UUID, scheduleId: id, done: true, watchChangedAt: (NOON + 1_000) + 0.4, baseUpdatedAt: NOON } };
  const op = parseToggleOp(raw);
  assert.equal(op, null);
  assert.deepEqual(classifyInboundMessage(raw), { kind: 'malformedToggle' });
  // 서비스는 호출되지 않으므로 상태 불변.
  assert.equal((await app.schedules.getById(id))?.isDone, false);
});
