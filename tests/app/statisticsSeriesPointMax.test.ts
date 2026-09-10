/**
 * 통계 화면(F-23) 선(line) 그래프 y축 스케일 파생값 `seriesPointMax` 순수 함수 단위 테스트.
 * 대응: nfr.md v1.11 §16.6 — "막대→선 교체 시 Developer 가 y축 스케일 파생값을 신규 순수 헬퍼로
 *       뽑으면 그 헬퍼 단위 테스트만 추가(기존 export 불변)", logic.md v1.13 §16.3.8.
 *
 * `aggregateTotals` / `aggregateYear` / `monthBoundaries` … 기존 export 와 `YearAggregate` 반환 형태는
 * 무변경이므로 `tests/app/statisticsViewModel.test.ts` 는 손대지 않는다(이 파일은 신규 헬퍼 전용).
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { localWallToEpoch } from '../../src/core/domain/time.ts';
import {
  aggregateYear,
  monthBoundaries,
  seriesPointMax,
  type StatCategory,
  type StatRow,
  type YearAggregate,
} from '../../src/app/screens/statisticsViewModel.ts';

const R = (startAt: number, isDone: boolean, categoryId: number): StatRow => ({
  startAt,
  isDone,
  categoryId,
});

const CATS: StatCategory[] = [
  { id: 1, name: '기타', color: '#8E8E93', isSystem: true },
  { id: 2, name: '업무', color: '#FF3B30', isSystem: false },
  { id: 3, name: '취미', color: '#34C759', isSystem: false },
];

test('seriesPointMax — 빈 집계는 0 (화면이 Math.max(1, …) 로 하한 처리)', () => {
  const agg = aggregateYear([], CATS, monthBoundaries(2026, 'UTC'));
  assert.equal(seriesPointMax(agg), 0);
});

test('seriesPointMax — 한 (월,유형) 셀의 최대 건수 (스택 합 maxBucketTotal 아님)', () => {
  const tz = 'UTC';
  const b = monthBoundaries(2026, tz);
  // 3월: 업무 3건 + 취미 2건 → 월 total 5, 셀 최대 3
  // 7월: 업무 4건 단독 → 월 total 4, 셀 최대 4
  const rows: StatRow[] = [
    R(localWallToEpoch(2026, 3, 2, 9, 0, tz), false, 2),
    R(localWallToEpoch(2026, 3, 3, 9, 0, tz), false, 2),
    R(localWallToEpoch(2026, 3, 4, 9, 0, tz), true, 2),
    R(localWallToEpoch(2026, 3, 5, 9, 0, tz), false, 3),
    R(localWallToEpoch(2026, 3, 6, 9, 0, tz), true, 3),
    R(localWallToEpoch(2026, 7, 1, 9, 0, tz), false, 2),
    R(localWallToEpoch(2026, 7, 2, 9, 0, tz), false, 2),
    R(localWallToEpoch(2026, 7, 3, 9, 0, tz), true, 2),
    R(localWallToEpoch(2026, 7, 4, 9, 0, tz), false, 2),
  ];
  const agg = aggregateYear(rows, CATS, b);
  assert.equal(agg.maxBucketTotal, 5); // 3월 스택 합
  assert.equal(seriesPointMax(agg), 4); // 7월 업무 셀
});

test('seriesPointMax — 단일 계열 단일 월도 정확', () => {
  const tz = 'UTC';
  const b = monthBoundaries(2026, tz);
  const rows: StatRow[] = [
    R(localWallToEpoch(2026, 5, 1, 9, 0, tz), false, 2),
    R(localWallToEpoch(2026, 5, 2, 9, 0, tz), false, 2),
  ];
  const agg = aggregateYear(rows, CATS, b);
  assert.equal(seriesPointMax(agg), 2);
});

test('seriesPointMax — 삭제 유형(미상 categoryId)이 "기타"로 합산된 셀도 포함', () => {
  const tz = 'UTC';
  const b = monthBoundaries(2026, tz);
  const rows: StatRow[] = [
    R(localWallToEpoch(2026, 8, 1, 9, 0, tz), false, 99),
    R(localWallToEpoch(2026, 8, 2, 9, 0, tz), false, 99),
    R(localWallToEpoch(2026, 8, 3, 9, 0, tz), true, 99),
    R(localWallToEpoch(2026, 8, 4, 9, 0, tz), false, 2),
  ];
  const agg = aggregateYear(rows, CATS, b);
  // 99 → 1(기타) 로 접혀 8월 "기타" 셀 = 3
  assert.equal(seriesPointMax(agg), 3);
});

test('seriesPointMax — 순수: 동일 입력 반복 호출 시 결과·입력 불변', () => {
  const tz = 'UTC';
  const b = monthBoundaries(2026, tz);
  const rows: StatRow[] = [
    R(localWallToEpoch(2026, 2, 1, 9, 0, tz), false, 2),
    R(localWallToEpoch(2026, 2, 2, 9, 0, tz), false, 3),
    R(localWallToEpoch(2026, 2, 3, 9, 0, tz), false, 3),
  ];
  const agg: YearAggregate = aggregateYear(rows, CATS, b);
  const snapshot = JSON.stringify(agg);
  assert.equal(seriesPointMax(agg), 2);
  assert.equal(seriesPointMax(agg), 2);
  assert.equal(JSON.stringify(agg), snapshot); // 입력 비파괴
});
