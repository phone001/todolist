/**
 * 통계 화면(F-23) 순수 집계 로직 — 상단 카드 총/완료 count, 하단 유형별 월별 그래프.
 * 대응: nfr.md v1.10 §9 V-46(상단 카드 집계·연도 비연동) / V-47(월 버킷·tz/DST/연 경계) /
 *       V-48(유형 계열·삭제 유형→"기타"·rename ID 유지) / V-49(빈 상태 분기·읽기 전용·비영속),
 *       logic.md v1.12 §7.2 / §16.3.8, plan v1.7 §5.16 P-54~P-58.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { localWallToEpoch } from '../../src/core/domain/time.ts';
import {
  aggregateTotals,
  aggregateYear,
  currentYear,
  hasMeaningfulCategories,
  monthBoundaries,
  monthIndexOf,
  STATISTICS_PAGE_SIZE,
  statisticsEmptyState,
  yearRangeEpochs,
  type StatCategory,
  type StatRow,
} from '../../src/app/screens/statisticsViewModel.ts';

const TZS = ['UTC', 'Asia/Seoul', 'America/New_York', 'Australia/Sydney'];

// ── 설계 상수 ──────────────────────────────────────────────────────────────

test('§7.2.1: STATISTICS_PAGE_SIZE = 200', () => {
  assert.equal(STATISTICS_PAGE_SIZE, 200);
});

// ── currentYear (P-17 / §7.2.3) ────────────────────────────────────────────

test('V-46: currentYear — 단말 로컬 시간대 기준 연도(자정 경계 tz 민감)', () => {
  const ts = Date.UTC(2025, 11, 31, 20, 0, 0); // UTC 로는 2025년, KST(+9)로는 2026-01-01
  assert.equal(currentYear(ts, 'UTC'), 2025);
  assert.equal(currentYear(ts, 'Asia/Seoul'), 2026);
});

// ── yearRangeEpochs / monthBoundaries (D-23(a) / P-56) ─────────────────────

test('V-47: yearRangeEpochs — [1월1일 00:00, 다음해 1월1일 00:00) 로컬 경계', () => {
  for (const tz of TZS) {
    const { startTs, endTs } = yearRangeEpochs(2026, tz);
    assert.equal(startTs, localWallToEpoch(2026, 1, 1, 0, 0, tz), tz);
    assert.equal(endTs, localWallToEpoch(2027, 1, 1, 0, 0, tz), tz);
    assert.ok(endTs > startTs, tz);
  }
});

test('V-47: monthBoundaries — 길이 13, 단조 증가, 양끝이 yearRangeEpochs 와 일치', () => {
  for (const tz of TZS) {
    const b = monthBoundaries(2026, tz);
    assert.equal(b.length, 13, tz);
    for (let i = 1; i < b.length; i += 1) assert.ok(b[i] > b[i - 1], `${tz} @ ${i}`);
    const { startTs, endTs } = yearRangeEpochs(2026, tz);
    assert.equal(b[0], startTs, tz);
    assert.equal(b[12], endTs, tz);
    // 월 간격은 28~31일(±DST 1h)
    for (let i = 1; i < 13; i += 1) {
      const days = (b[i] - b[i - 1]) / 86_400_000;
      assert.ok(days >= 27.9 && days <= 31.1, `${tz} month ${i} = ${days}d`);
    }
  }
});

// ── monthIndexOf (P-56 — start_at 기준, 범위 밖 -1) ─────────────────────────

test('V-47: monthIndexOf — 각 월 시작일/말일이 그 달로 버킷팅(tz·DST 포함)', () => {
  for (const tz of TZS) {
    const b = monthBoundaries(2026, tz);
    for (let m = 1; m <= 12; m += 1) {
      assert.equal(monthIndexOf(localWallToEpoch(2026, m, 1, 0, 0, tz), b), m, `${tz} ${m}/1`);
      assert.equal(monthIndexOf(localWallToEpoch(2026, m, 15, 12, 0, tz), b), m, `${tz} ${m}/15`);
      assert.equal(monthIndexOf(localWallToEpoch(2026, m, 28, 23, 30, tz), b), m, `${tz} ${m}/28`);
    }
  }
});

test('V-47: monthIndexOf — DST 전환 월(미국 3월/11월)도 정확', () => {
  const tz = 'America/New_York';
  const b = monthBoundaries(2026, tz);
  // DST 시작: 2026-03-08 02:00 → 03:00
  assert.equal(monthIndexOf(localWallToEpoch(2026, 3, 8, 12, 0, tz), b), 3);
  assert.equal(monthIndexOf(localWallToEpoch(2026, 3, 31, 23, 0, tz), b), 3);
  assert.equal(monthIndexOf(localWallToEpoch(2026, 4, 1, 0, 0, tz), b), 4);
  // DST 종료: 2026-11-01 02:00 → 01:00
  assert.equal(monthIndexOf(localWallToEpoch(2026, 11, 1, 0, 30, tz), b), 11);
  assert.equal(monthIndexOf(localWallToEpoch(2026, 11, 30, 23, 0, tz), b), 11);
});

test('V-47: monthIndexOf — 선택 연도 범위 밖(전년 12월 / 익년 1월)은 -1', () => {
  for (const tz of TZS) {
    const b = monthBoundaries(2026, tz);
    assert.equal(monthIndexOf(localWallToEpoch(2025, 12, 31, 23, 0, tz), b), -1, tz);
    assert.equal(monthIndexOf(localWallToEpoch(2027, 1, 1, 0, 0, tz), b), -1, tz); // 익년 1/1 00:00 = 상한(exclusive)
    assert.equal(monthIndexOf(b[12], b), -1, tz);
  }
});

test('V-47: monthIndexOf — 경계값이 없는 배열은 -1', () => {
  assert.equal(monthIndexOf(0, []), -1);
  assert.equal(monthIndexOf(0, [1, 2, 3]), -1);
});

// ── aggregateTotals (D-21(a) / P-55) ──────────────────────────────────────

const R = (startAt: number, isDone: boolean, categoryId: number): StatRow => ({
  startAt,
  isDone,
  categoryId,
});

test('V-46: aggregateTotals — 전건 수 / 완료(isDone) 건수', () => {
  const rows = [R(1, true, 2), R(2, false, 2), R(3, true, 3), R(4, false, 1)];
  assert.deepEqual(aggregateTotals(rows), { total: 4, done: 2 });
  assert.deepEqual(aggregateTotals([]), { total: 0, done: 0 });
});

test('V-46: aggregateTotals — 완료율은 산출하지 않는다(카드 2장만, OI-22)', () => {
  const result = aggregateTotals([R(1, true, 1)]);
  assert.deepEqual(Object.keys(result).sort(), ['done', 'total']);
});

// ── aggregateYear (D-23(a) / P-56 / P-57 / E-23-5) ────────────────────────

const CATS: StatCategory[] = [
  { id: 1, name: '기타', color: '#8E8E93', isSystem: true },
  { id: 2, name: '업무', color: '#FF3B30', isSystem: false },
  { id: 3, name: '취미', color: '#34C759', isSystem: false },
];

function marchJulyRows(tz: string): StatRow[] {
  return [
    R(localWallToEpoch(2026, 3, 2, 9, 0, tz), false, 2),
    R(localWallToEpoch(2026, 3, 20, 18, 0, tz), true, 2),
    R(localWallToEpoch(2026, 3, 10, 12, 0, tz), true, 3),
    R(localWallToEpoch(2026, 7, 5, 8, 0, tz), false, 2),
    R(localWallToEpoch(2025, 12, 30, 8, 0, tz), false, 2), // 선택 연도 밖 → 제외
  ];
}

test('V-47/V-48: aggregateYear — 월·유형 버킷, 완료 여부 무관 전건, 범위 밖 제외', () => {
  const tz = 'Asia/Seoul';
  const agg = aggregateYear(marchJulyRows(tz), CATS, monthBoundaries(2026, tz));
  assert.equal(agg.months.length, 12);
  assert.deepEqual(agg.months[2].byCategory, { 2: 2, 3: 1 }); // 3월 (index 2)
  assert.equal(agg.months[2].total, 3);
  assert.deepEqual(agg.months[6].byCategory, { 2: 1 }); // 7월
  assert.equal(agg.months[6].total, 1);
  assert.equal(agg.months[0].total, 0);
  assert.equal(agg.maxBucketTotal, 3);
  assert.equal(agg.placedRowCount, 4); // 2025-12 행은 제외
  assert.deepEqual(agg.seriesCategoryIds, [2, 3]); // categories 순서, 등장한 것만(id 1 미등장)
});

test('V-48: aggregateYear — 계열 키는 categoryId, 유형 이름변경(rename)에도 불변(ID 참조 유지, R-23-4)', () => {
  const tz = 'UTC';
  const b = monthBoundaries(2026, tz);
  const rows = marchJulyRows(tz);
  const before = aggregateYear(rows, CATS, b);
  const renamed: StatCategory[] = CATS.map((c) => (c.id === 2 ? { ...c, name: '회사' } : c));
  const after = aggregateYear(rows, renamed, b);
  assert.deepEqual(after.seriesCategoryIds, before.seriesCategoryIds);
  assert.deepEqual(after.months[2].byCategory, before.months[2].byCategory);
});

test('V-48: aggregateYear — 삭제된 유형(목록에 없는 categoryId)은 시스템 기본("기타")으로 합산(E-23-5 / P-57)', () => {
  const tz = 'UTC';
  const b = monthBoundaries(2026, tz);
  const rows = [
    R(localWallToEpoch(2026, 5, 1, 9, 0, tz), false, 99), // 99 = 이미 삭제된 유형
    R(localWallToEpoch(2026, 5, 2, 9, 0, tz), true, 99),
    R(localWallToEpoch(2026, 5, 3, 9, 0, tz), false, 2),
  ];
  const agg = aggregateYear(rows, CATS, b);
  assert.deepEqual(agg.months[4].byCategory, { 1: 2, 2: 1 }); // 99 → 1(기타)
  assert.deepEqual(agg.seriesCategoryIds, [1, 2]);
  // 삭제된 유형 id(99)는 계열로 복원되지 않는다
  assert.ok(!agg.seriesCategoryIds.includes(99));
});

test('V-48: aggregateYear — 시스템 기본 유형이 없으면 미상 categoryId 는 그대로 뒤에 덧붙는다(방어)', () => {
  const tz = 'UTC';
  const b = monthBoundaries(2026, tz);
  const noSystem: StatCategory[] = [{ id: 2, name: '업무', color: '#FF3B30', isSystem: false }];
  const rows = [
    R(localWallToEpoch(2026, 6, 1, 9, 0, tz), false, 2),
    R(localWallToEpoch(2026, 6, 2, 9, 0, tz), false, 7),
  ];
  const agg = aggregateYear(rows, noSystem, b);
  assert.deepEqual(agg.months[5].byCategory, { 2: 1, 7: 1 });
  assert.deepEqual(agg.seriesCategoryIds, [2, 7]);
});

test('V-47: aggregateYear — 빈 입력이면 12버킷 0, maxBucketTotal 0, placedRowCount 0', () => {
  const agg = aggregateYear([], CATS, monthBoundaries(2026, 'UTC'));
  assert.equal(agg.months.length, 12);
  assert.equal(agg.months.reduce((s, m) => s + m.total, 0), 0);
  assert.equal(agg.maxBucketTotal, 0);
  assert.equal(agg.placedRowCount, 0);
  assert.deepEqual(agg.seriesCategoryIds, []);
});

// ── hasMeaningfulCategories / statisticsEmptyState (E-23-1 ~ E-23-4) ──────

test('V-49: hasMeaningfulCategories — 기본 유형("기타") 외 사용자 유형 존재 여부', () => {
  assert.equal(hasMeaningfulCategories(CATS), true);
  assert.equal(hasMeaningfulCategories([{ id: 1, name: '기타', color: '#8E8E93', isSystem: true }]), false);
  assert.equal(hasMeaningfulCategories([]), false);
});

test('V-49: statisticsEmptyState — 우선순위: load-error > no-data > no-categories > no-year-data > ok', () => {
  assert.equal(statisticsEmptyState(0, true, 0, true), 'load-error'); // 에러가 최우선
  assert.equal(statisticsEmptyState(10, true, 5, true), 'load-error');
  assert.equal(statisticsEmptyState(0, true, 0, false), 'no-data'); // E-23-1
  assert.equal(statisticsEmptyState(0, false, 0, false), 'no-data'); // 전건 0 이 no-categories 보다 우선
  assert.equal(statisticsEmptyState(5, false, 3, false), 'no-categories'); // E-23-2
  assert.equal(statisticsEmptyState(5, true, 0, false), 'no-year-data'); // E-23-3 (카드 수치는 화면이 유지)
  assert.equal(statisticsEmptyState(5, true, 3, false), 'ok');
});
