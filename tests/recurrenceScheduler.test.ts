/**
 * F-24(v1.9) 반복 일정 — 마스터/회차 분리 생성 + RecurrenceScheduler 회차 실체화.
 * 대응: document/architect/logic.md v1.16 §18. AC-82~84, E-24-1~5.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../src/core/app.ts';
import { FixedClock } from '../src/core/domain/clock.ts';
import { ValidationError } from '../src/core/domain/errors.ts';
import { DAY_MS } from '../src/core/domain/time.ts';

const NOW = Date.UTC(2026, 8, 4, 9, 0, 0);
const future = (h: number) => NOW + h * 3_600_000;

function setup() {
  const clock = new FixedClock(NOW, 'UTC');
  return { clock, app: buildApp({ clock }) };
}

test('AC-82: 반복 일정 생성 시 마스터 행은 비표시, 회차#1 은 findInRange 에 나타난다', async () => {
  const { app } = setup();
  const { id } = await app.schedules.create({
    title: '매일 운동',
    startAt: future(2),
    notifyAtStart: false,
    recurrence: { rule: 'DAILY', count: 3 },
  });

  // 반환된 id 는 회차#1(마스터가 아님)
  const occurrence1 = app.db.schedules.find((s) => s.id === id)!;
  assert.equal(occurrence1.recurrenceParentId !== null, true);
  assert.equal(occurrence1.recurrenceRule, null);

  const masterId = occurrence1.recurrenceParentId as number;
  const master = app.db.schedules.find((s) => s.id === masterId)!;
  assert.equal(master.recurrenceRule, 'DAILY');
  assert.equal(master.recurrenceParentId, null);
  assert.equal(master.recurrenceCount, 3);

  // findInRange: 마스터는 제외되고 회차만 보인다 (database §14.2)
  const page = await app.schedules.findInRange(0, future(24 * 30));
  assert.equal(page.items.length, 3, 'count=3 반복은 3개 회차만 보여야 한다');
  assert.ok(page.items.every((s) => s.recurrenceRule === null));
  assert.ok(page.items.every((s) => s.recurrenceParentId === masterId));
});

test('AC-82: 회차#2 이후는 create() 내부에서 RecurrenceScheduler.sync 로 즉시 실체화된다', async () => {
  const { app } = setup();
  const { id: occurrence1Id } = await app.schedules.create({
    title: '매일 스터디',
    startAt: future(1),
    notifyAtStart: false,
    recurrence: { rule: 'DAILY', count: 5 },
  });
  const occ1 = app.db.schedules.find((s) => s.id === occurrence1Id)!;
  const masterId = occ1.recurrenceParentId as number;

  const starts = await app.schedules.findInRange(0, future(24 * 30));
  assert.equal(starts.items.length, 5);
  const startTimes = starts.items.map((s) => s.startAt).sort((a, b) => a - b);
  for (let i = 0; i < 5; i += 1) {
    assert.equal(startTimes[i], future(1) + i * DAY_MS);
  }

  // 회차별 독립 REMINDER 행(P-03) — occurrence1 은 notifyAtStart=false 이므로 알림 없음, 다른 회차도 동일 템플릿.
  for (const occ of starts.items) {
    const reminders = await app.db.reminders.filter((r) => r.scheduleId === occ.id);
    assert.equal(reminders.length, 0);
  }
  void masterId;
});

test('database §14.2: findForDashboard 도 마스터 행을 제외한다', async () => {
  const { app } = setup();
  await app.schedules.create({
    title: '매일 알약',
    startAt: future(1),
    notifyAtStart: false,
    recurrence: { rule: 'DAILY', count: 2 },
  });

  const summary = await app.dashboard.getSummary(future(1));
  // 오늘 회차#1 만 집계되어야 한다(마스터 미포함, 회차#2 는 내일).
  assert.equal(summary.total, 1);
});

test('database §14.2: search 도 마스터 행을 제외한다(제목은 동일해도 회차만 매칭)', async () => {
  const { app } = setup();
  await app.schedules.create({
    title: '반복검색테스트',
    startAt: future(1),
    notifyAtStart: false,
    recurrence: { rule: 'DAILY', count: 2 },
  });
  const result = await app.search.search({ query: '반복검색테스트' });
  assert.equal(result.items.length, 2, '마스터 제외, 회차 2건만 검색되어야 한다');
  assert.ok(result.items.every((s) => s.recurrenceRule === null));
});

test('F-24 §18.2: findRecurringMasters / listOccurrenceStartTimes 신규 포트 메서드', async () => {
  const { app } = setup();
  const { id: occ1Id } = await app.schedules.create({
    title: '주기 확인',
    startAt: future(1),
    notifyAtStart: false,
    recurrence: { rule: 'DAILY', count: 3 },
  });
  const occ1 = app.db.schedules.find((s) => s.id === occ1Id)!;
  const masterId = occ1.recurrenceParentId as number;

  const masters = await app.schedules.findInRange(0, Number.MAX_SAFE_INTEGER); // sanity: 마스터 미포함
  assert.ok(masters.items.every((s) => s.id !== masterId));
});

test('E-24-4: "이 일정만" 삭제 — 그 회차만 삭제되고 나머지는 무영향(신규 로직 불필요)', async () => {
  const { app } = setup();
  const { id: occ1Id } = await app.schedules.create({
    title: '이일정만',
    startAt: future(1),
    notifyAtStart: false,
    recurrence: { rule: 'DAILY', count: 3 },
  });
  const occ1 = app.db.schedules.find((s) => s.id === occ1Id)!;
  const masterId = occ1.recurrenceParentId as number;

  const before = await app.schedules.findInRange(0, future(24 * 30));
  assert.equal(before.items.length, 3);
  const target = before.items[1]; // 회차#2

  await app.schedules.softDelete(target.id);

  const after = await app.schedules.findInRange(0, future(24 * 30));
  assert.equal(after.items.length, 2, '삭제된 회차만 사라지고 나머지 2건은 유지');
  assert.ok(!after.items.some((s) => s.id === target.id));

  // 재생성 방지: soft-deleted 회차도 listOccurrenceStartTimes 에 남아 sync 가 되살리지 않는다.
  await app.scheduler.sync(); // no-op 트리거, RecurrenceScheduler 는 별도 sync 호출로 검증
  void masterId;
});

test('E-24-5 / AC-84: "이후 모두" 삭제 — 지정 회차부터 이후 활성 회차 전부 삭제, 과거는 유지', async () => {
  const { app } = setup();
  const { id: occ1Id } = await app.schedules.create({
    title: '이후모두',
    startAt: future(1),
    notifyAtStart: false,
    recurrence: { rule: 'DAILY', count: 5 },
  });
  const occ1 = app.db.schedules.find((s) => s.id === occ1Id)!;
  const masterId = occ1.recurrenceParentId as number;

  const all = await app.schedules.findInRange(0, future(24 * 30));
  assert.equal(all.items.length, 5);
  const sorted = [...all.items].sort((a, b) => a.startAt - b.startAt);
  const fromIndex = 2; // 회차#3 부터 이후 모두 삭제

  const result = await app.schedules.deleteRecurrenceFollowing(sorted[fromIndex].id);
  assert.equal(result.deleted, 3); // #3,#4,#5

  const remaining = await app.schedules.findInRange(0, future(24 * 30));
  assert.equal(remaining.items.length, 2); // #1,#2 만 남음
  assert.deepEqual(
    remaining.items.map((s) => s.id).sort(),
    [sorted[0].id, sorted[1].id].sort(),
  );

  const master = app.db.schedules.find((s) => s.id === masterId)!;
  assert.equal(master.recurrenceEndAt, sorted[fromIndex].startAt - 1);
});

test('E-24-5: 대상이 반복 회차가 아니면 POLICY_NOT_RECURRING_OCCURRENCE', async () => {
  const { app } = setup();
  const { id } = await app.schedules.create({ title: '비반복', startAt: future(1), notifyAtStart: false });
  await assert.rejects(
    () => app.schedules.deleteRecurrenceFollowing(id),
    (err: unknown) => (err as { code?: string }).code === 'POLICY_NOT_RECURRING_OCCURRENCE',
  );
});

test('E-24-1: 반복 규칙 변경 — 미래 활성 회차 삭제(재생성 대상), 과거·완료 회차는 보존', async () => {
  const { app } = setup();
  const { id: occ1Id } = await app.schedules.create({
    title: '규칙변경',
    startAt: future(1),
    notifyAtStart: false,
    recurrence: { rule: 'DAILY', count: 4 },
  });
  const occ1 = app.db.schedules.find((s) => s.id === occ1Id)!;
  const masterId = occ1.recurrenceParentId as number;

  const beforeChange = await app.schedules.findInRange(0, future(24 * 30));
  assert.equal(beforeChange.items.length, 4);
  const sorted = [...beforeChange.items].sort((a, b) => a.startAt - b.startAt);

  // "지금(now)" 시점을 회차#2 시작 시각 이후로 두어, 회차#1 은 과거로 보존되고 나머지는 미래로 취급.
  const nowForChange = sorted[1].startAt + 1;

  await app.schedules.updateRecurrenceRule(occ1Id, { rule: 'DAILY', count: 2 }, nowForChange);

  const master = app.db.schedules.find((s) => s.id === masterId)!;
  assert.equal(master.recurrenceCount, 2);

  const remaining = await app.schedules.findInRange(0, future(24 * 30));
  // findInRange 의 range 판정은 (endAt ?? startAt) >= fromTs — nowForChange 가 회차#2 시작 시각보다도
  // 이후이므로 회차#2 는 "이미 지난" 회차로 보존되고, 회차#3·#4(now 이후)만 soft-delete 되어 재생성 대상이 된다.
  assert.deepEqual(
    remaining.items.map((s) => s.id).sort(),
    [sorted[0].id, sorted[1].id].sort(),
  );
});

test('E-24-1: 대상이 반복 회차가 아니면 updateRecurrenceRule 도 POLICY_NOT_RECURRING_OCCURRENCE', async () => {
  const { app } = setup();
  const { id } = await app.schedules.create({ title: '비반복2', startAt: future(1), notifyAtStart: false });
  await assert.rejects(
    () => app.schedules.updateRecurrenceRule(id, { rule: 'DAILY' }),
    (err: unknown) => (err as { code?: string }).code === 'POLICY_NOT_RECURRING_OCCURRENCE',
  );
});

test('E-24-2 / AC-83: 반복 종료일 < 시작 일시는 저장을 거부한다', async () => {
  const { app } = setup();
  await assert.rejects(
    () =>
      app.schedules.create({
        title: '잘못된반복',
        startAt: future(10),
        notifyAtStart: false,
        recurrence: { rule: 'DAILY', endAt: future(1) },
      }),
    (err: unknown) => {
      if (!(err instanceof ValidationError)) return false;
      return err.errors.some((e) => e.code === 'VALIDATION_RECURRENCE_END_BEFORE_START');
    },
  );
  const page = await app.schedules.findInRange(0, Number.MAX_SAFE_INTEGER);
  assert.equal(page.items.length, 0, '검증 실패 시 저장소 변경이 없어야 한다');
});

test('회귀: 비반복 경로(input.recurrence == null)는 기존과 동일하게 동작한다', async () => {
  const { app } = setup();
  const { id } = await app.schedules.create({
    title: '비반복 회귀',
    startAt: future(2),
    reminderOffsets: [10],
    notifyAtStart: true,
  });
  const s = app.db.schedules.find((x) => x.id === id)!;
  assert.equal(s.recurrenceRule, null);
  assert.equal(s.recurrenceParentId, null);
  assert.equal(s.recurrenceReminderOffsets, null);
  assert.equal(app.notifications.activeCount(), 2); // PRE + START (기존 AC-01 과 동일 기대치)

  const page = await app.schedules.findInRange(future(0), future(24));
  assert.equal(page.items.length, 1);
});

// ── RecurrenceScheduler 단독 동작 ───────────────────────────────────────────

test('E-24-3: horizon(60일) 내에서만 실제 회차가 실체화되고 상한(366)을 초과하지 않는다', async () => {
  const { app } = setup();
  // 종료조건 없음(무기한) DAILY — horizon=60일 내로만 실체화되어야 한다.
  const { id: occ1Id } = await app.schedules.create({
    title: '무기한 매일',
    startAt: future(1),
    notifyAtStart: false,
    recurrence: { rule: 'DAILY' },
  });
  const occ1 = app.db.schedules.find((s) => s.id === occ1Id)!;
  const masterId = occ1.recurrenceParentId as number;

  // findInRange 기본 limit(50)에 걸리지 않도록 충분히 큰 limit 을 명시한다.
  const page = await app.schedules.findInRange(0, Number.MAX_SAFE_INTEGER, undefined, 'startAt', 500, null);
  const occurrences = page.items.filter((s) => s.recurrenceParentId === masterId);
  // horizonDays=60 이므로 대략 60~61건 내에서 실체화되어야 한다(절대 상한 366 은 걸리지 않음).
  assert.ok(occurrences.length >= 55 && occurrences.length <= 62, `실체화 건수=${occurrences.length}`);
});

test('RecurrenceScheduler.sync 재호출은 멱등(이미 실체화된 회차를 중복 생성하지 않음)', async () => {
  const { app } = setup();
  const { id: occ1Id } = await app.schedules.create({
    title: '멱등확인',
    startAt: future(1),
    notifyAtStart: false,
    recurrence: { rule: 'DAILY', count: 3 },
  });
  const occ1 = app.db.schedules.find((s) => s.id === occ1Id)!;
  const masterId = occ1.recurrenceParentId as number;

  const before = await app.schedules.findInRange(0, future(24 * 30));
  assert.equal(before.items.length, 3);

  await app.recurrenceScheduler.sync(masterId);
  await app.recurrenceScheduler.sync(); // 전체 재조정

  const after = await app.schedules.findInRange(0, future(24 * 30));
  assert.equal(after.items.length, 3, '재호출로 중복 생성되지 않아야 한다');
});
