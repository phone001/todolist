import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CATEGORY_COLOR_FALLBACK,
  CATEGORY_COLOR_PALETTE,
  assignCategoryColor,
} from '../src/core/domain/categoryColor.ts';

test('F-06/P-59: 기존 색상이 없으면 팔레트 1번째 색을 배정한다', () => {
  assert.equal(assignCategoryColor([]), CATEGORY_COLOR_PALETTE[0]);
});

test('F-06/P-59: 앞쪽 색이 이미 사용 중이면 최초-미사용 색을 배정한다', () => {
  const used = [CATEGORY_COLOR_PALETTE[0], CATEGORY_COLOR_PALETTE[1]];
  assert.equal(assignCategoryColor(used), CATEGORY_COLOR_PALETTE[2]);
});

test('F-06/P-59: 대소문자가 달라도 동일 색으로 인식한다(사용 중 판정)', () => {
  const used = [CATEGORY_COLOR_PALETTE[0].toLowerCase()];
  assert.equal(assignCategoryColor(used), CATEGORY_COLOR_PALETTE[1]);
});

test('F-06/P-59: 중간에 빈 슬롯(삭제로 생긴)을 최우선으로 재사용한다', () => {
  // 팔레트 순서상 0,1 은 사용 중이지만 2 는 비어있는 상황(삭제 등으로 인한 빈 슬롯)
  const used = [CATEGORY_COLOR_PALETTE[0], CATEGORY_COLOR_PALETTE[3]];
  assert.equal(assignCategoryColor(used), CATEGORY_COLOR_PALETTE[1]);
});

test('F-06/P-59: 팔레트 12색이 모두 사용 중이면 existingColors.length % 12 로 순환한다', () => {
  const all = [...CATEGORY_COLOR_PALETTE];
  assert.equal(assignCategoryColor(all), CATEGORY_COLOR_PALETTE[all.length % CATEGORY_COLOR_PALETTE.length]);

  const thirteen = [...CATEGORY_COLOR_PALETTE, CATEGORY_COLOR_PALETTE[0]];
  assert.equal(assignCategoryColor(thirteen), CATEGORY_COLOR_PALETTE[13 % CATEGORY_COLOR_PALETTE.length]);
});

test('E-06-7: 내부 오류가 나도 예외를 던지지 않고 폴백 회색을 반환한다', () => {
  // existingColors 원소가 문자열이 아닌 방어적 상황을 시뮬레이션(타입 단언으로 우회)
  const malformed = [null] as unknown as string[];
  assert.equal(assignCategoryColor(malformed), CATEGORY_COLOR_FALLBACK);
});

test('팔레트는 12색이며 F-07 우선순위 색과 겹치지 않는다', () => {
  assert.equal(CATEGORY_COLOR_PALETTE.length, 12);
  const priorityColors = new Set(['#D32F2F', '#E65100', '#689F38']);
  for (const c of CATEGORY_COLOR_PALETTE) {
    assert.equal(priorityColors.has(c), false);
  }
});
