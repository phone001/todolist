/**
 * V-36: 워치 페이로드 빌더 `buildWatchSnapshot` (순수).
 * 대응: document/architect/nfr.md §9 V-36, logic §17.3, P-39/P-40, E-19-4/E-19-6, AC-47/53.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildWatchSnapshot } from '../../src/core/watchSync/snapshot.ts';
import { WATCH_SNAPSHOT_MAX_ITEMS } from '../../src/core/watchSync/types.ts';
import { FixedClock } from '../../src/core/domain/clock.ts';
import { DAY_MS, startOfLocalDay } from '../../src/core/domain/time.ts';
import type { Category, Schedule } from '../../src/core/domain/types.ts';

const NOON = Date.UTC(2026, 8, 4, 12, 0, 0);

function makeSchedule(over: Partial<Schedule> = {}): Schedule {
  return {
    id: 1,
    title: '기본 일정',
    memo: '비밀 메모',
    categoryId: 1,
    priority: 'NORMAL',
    startAt: NOON,
    endAt: null,
    timeZone: 'Asia/Seoul',
    isAllDay: false,
    isDone: false,
    doneAt: null,
    recurrenceRule: null,
    recurrenceEndAt: null,
    recurrenceCount: null,
    recurrenceParentId: null,
    source: 'LOCAL',
    notifyAtStart: true,
    createdAt: NOON,
    updatedAt: NOON,
    deletedAt: null,
    ...over,
  };
}

function makeCategory(over: Partial<Category> = {}): Category {
  return {
    id: 1,
    name: '업무',
    color: '#FF3B30',
    icon: null,
    isSystem: false,
    sortOrder: 0,
    createdAt: 0,
    updatedAt: 0,
    ...over,
  };
}

const SYSTEM_CATEGORY = makeCategory({ id: 99, name: '기타', color: '#8E8E93', isSystem: true, sortOrder: 100 });

test('V-36: today 는 startAt 오름차순, 필드는 최소화(메모·반복·source 등 미포함)', () => {
  const clock = new FixedClock(NOON, 'UTC');
  const schedules = [
    makeSchedule({ id: 2, title: 'B', startAt: NOON + 3_600_000 }),
    makeSchedule({ id: 1, title: 'A', startAt: NOON + 1_000 }),
  ];
  const snap = buildWatchSnapshot(schedules, null, [makeCategory(), SYSTEM_CATEGORY], clock);

  assert.deepEqual(snap.today.map((i) => i.id), [1, 2], 'startAt 오름차순 정렬');
  assert.deepEqual(
    Object.keys(snap.today[0]).sort(),
    [
      'categoryColor',
      'categoryLabel',
      'doneAt',
      'id',
      'isDone',
      'isHighPriority',
      'startAt',
      'timeZone',
      'title',
      'updatedAt',
    ],
    '항목 필드는 10개로 최소화 — 메모/반복/알림/유형 전체정의 미포함',
  );
});

test('V-36: 시각은 epoch ms(UTC) + IANA tz 원본을 그대로 전달(P-39)', () => {
  const clock = new FixedClock(NOON, 'UTC');
  const s = makeSchedule({ startAt: NOON + 42, timeZone: 'America/New_York' });
  const snap = buildWatchSnapshot([s], null, [makeCategory()], clock);

  assert.equal(snap.today[0].startAt, NOON + 42);
  assert.equal(snap.today[0].timeZone, 'America/New_York');
});

test('V-36: dayStart/dayEnd 는 로컬 자정 경계(P-17)', () => {
  const clock = new FixedClock(NOON, 'UTC');
  const snap = buildWatchSnapshot([], null, [], clock);
  assert.equal(snap.dayStart, startOfLocalDay(NOON, 'UTC'));
  assert.equal(snap.dayEnd, snap.dayStart + DAY_MS);
  assert.equal(snap.builtAt, NOON);
});

test('V-36: 다음 예정 1건은 id/title/startAt/timeZone 만, 없으면 null(P-40)', () => {
  const clock = new FixedClock(NOON, 'UTC');
  const next = makeSchedule({ id: 7, title: '내일 회의', startAt: NOON + DAY_MS, memo: '민감' });

  const withNext = buildWatchSnapshot([], next, [makeCategory()], clock);
  assert.deepEqual(withNext.nextUpcoming, {
    id: 7,
    title: '내일 회의',
    startAt: NOON + DAY_MS,
    timeZone: 'Asia/Seoul',
  });

  const noNext = buildWatchSnapshot([], null, [makeCategory()], clock);
  assert.equal(noNext.nextUpcoming, null);
});

test('V-36: 삭제·미존재 유형 → 시스템 "기타" 라벨/색으로 매핑(E-19-4)', () => {
  const clock = new FixedClock(NOON, 'UTC');
  const s = makeSchedule({ categoryId: 12345 }); // 목록에 없는 유형
  const snap = buildWatchSnapshot([s], null, [makeCategory(), SYSTEM_CATEGORY], clock);
  assert.equal(snap.today[0].categoryLabel, '기타');
  assert.equal(snap.today[0].categoryColor, '#8E8E93');
});

test('V-36: 시스템 유형이 목록에 없으면 기본 폴백(기타/#8E8E93)', () => {
  const clock = new FixedClock(NOON, 'UTC');
  const s = makeSchedule({ categoryId: 999 });
  const snap = buildWatchSnapshot([s], null, [], clock);
  assert.equal(snap.today[0].categoryLabel, '기타');
  assert.equal(snap.today[0].categoryColor, '#8E8E93');
});

test('V-36: 존재하는 유형은 이름/색을 그대로 사용', () => {
  const clock = new FixedClock(NOON, 'UTC');
  const s = makeSchedule({ categoryId: 3 });
  const cat = makeCategory({ id: 3, name: '개인', color: '#34C759' });
  const snap = buildWatchSnapshot([s], null, [cat], clock);
  assert.equal(snap.today[0].categoryLabel, '개인');
  assert.equal(snap.today[0].categoryColor, '#34C759');
});

test('V-36: isHighPriority 는 priority==="HIGH" 에만 true', () => {
  const clock = new FixedClock(NOON, 'UTC');
  const snap = buildWatchSnapshot(
    [
      makeSchedule({ id: 1, priority: 'HIGH', startAt: NOON + 1 }),
      makeSchedule({ id: 2, priority: 'NORMAL', startAt: NOON + 2 }),
      makeSchedule({ id: 3, priority: 'LOW', startAt: NOON + 3 }),
    ],
    null,
    [makeCategory()],
    clock,
  );
  assert.deepEqual(snap.today.map((i) => i.isHighPriority), [true, false, false]);
});

test('V-36 / E-19-6: 200건 초과 시 앞 200건 절단 + truncated=true, summary 는 전체 기준', () => {
  const clock = new FixedClock(NOON, 'UTC');
  const total = WATCH_SNAPSHOT_MAX_ITEMS + 1;
  const schedules = Array.from({ length: total }, (_, i) =>
    makeSchedule({ id: i + 1, startAt: NOON + i * 1000, isDone: i % 2 === 0 }),
  );
  const snap = buildWatchSnapshot(schedules, null, [makeCategory()], clock);

  assert.equal(snap.today.length, WATCH_SNAPSHOT_MAX_ITEMS);
  assert.equal(snap.truncated, true);
  // summary 는 절단 이전 전체(201건) 기준 — DashboardSummary 와 일치
  const doneAll = schedules.filter((s) => s.isDone).length;
  assert.equal(snap.summary.done, doneAll);
  assert.equal(snap.summary.notDone, total - doneAll);
});

test('V-36: 200건 이하면 truncated=false, ackedOpIds 는 빈 배열(전송 계층이 채움)', () => {
  const clock = new FixedClock(NOON, 'UTC');
  const snap = buildWatchSnapshot([makeSchedule()], null, [makeCategory()], clock);
  assert.equal(snap.truncated, false);
  assert.deepEqual(snap.ackedOpIds, []);
});

test('V-36: summary done/notDone 카운트', () => {
  const clock = new FixedClock(NOON, 'UTC');
  const snap = buildWatchSnapshot(
    [
      makeSchedule({ id: 1, isDone: true, startAt: NOON + 1 }),
      makeSchedule({ id: 2, isDone: false, startAt: NOON + 2 }),
      makeSchedule({ id: 3, isDone: false, startAt: NOON + 3 }),
    ],
    null,
    [makeCategory()],
    clock,
  );
  assert.deepEqual(snap.summary, { done: 1, notDone: 2 });
});
