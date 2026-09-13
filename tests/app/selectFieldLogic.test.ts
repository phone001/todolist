/**
 * SelectField / MultiSelectField 순수 라벨·토글 계산 로직.
 * 대응: document/architect/logic.md v1.17 §16.3.1 "선택형 필드 셀렉트박스화", P-70, D-31(a).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveSelectedLabel,
  formatMultiSelectTriggerLabel,
  toggleMultiSelectValue,
} from '../../src/app/components/selectFieldLogic.ts';

test('resolveSelectedLabel: 값과 일치하는 옵션의 라벨을 반환한다', () => {
  const options = [
    { value: 'LOW', label: '낮음' },
    { value: 'NORMAL', label: '보통' },
    { value: 'HIGH', label: '높음' },
  ];
  assert.equal(resolveSelectedLabel('NORMAL', options), '보통');
  assert.equal(resolveSelectedLabel('HIGH', options), '높음');
});

test('resolveSelectedLabel: 일치하는 옵션이 없으면 빈 문자열(미선택 표시)', () => {
  const options = [{ value: 1, label: '업무' }];
  assert.equal(resolveSelectedLabel(undefined, options), '');
  assert.equal(resolveSelectedLabel(999, options), '');
});

test('resolveSelectedLabel: null 값 옵션(반복 "없음") 매칭', () => {
  const options: Array<{ value: string | null; label: string }> = [
    { value: null, label: '없음' },
    { value: 'DAILY', label: '매일' },
  ];
  assert.equal(resolveSelectedLabel(null, options), '없음');
  assert.equal(resolveSelectedLabel('DAILY', options), '매일');
});

test('formatMultiSelectTriggerLabel: 0개 선택 → "없음"', () => {
  const options = [{ value: 5, label: '5분 전' }];
  assert.equal(formatMultiSelectTriggerLabel([], options), '없음');
});

test('formatMultiSelectTriggerLabel: N개 선택 → "{n}개 선택 (라벨들)"', () => {
  const options = [
    { value: 5, label: '5분 전' },
    { value: 10, label: '10분 전' },
    { value: 30, label: '30분 전' },
    { value: 60, label: '1시간 전' },
    { value: 1440, label: '하루 전' },
  ];
  assert.equal(formatMultiSelectTriggerLabel([10], options), '1개 선택 (10분 전)');
  assert.equal(formatMultiSelectTriggerLabel([10, 60], options), '2개 선택 (10분 전, 1시간 전)');
  assert.equal(
    formatMultiSelectTriggerLabel([5, 10, 30, 60, 1440], options),
    '5개 선택 (5분 전, 10분 전, 30분 전, 1시간 전, 하루 전)',
  );
});

test('formatMultiSelectTriggerLabel: 옵션에 없는 값은 라벨 목록에서 제외(방어적)', () => {
  const options = [{ value: 10, label: '10분 전' }];
  assert.equal(formatMultiSelectTriggerLabel([10, 999], options), '2개 선택 (10분 전)');
});

test('toggleMultiSelectValue: 없는 값 → 추가', () => {
  assert.deepEqual(toggleMultiSelectValue([10], 60), [10, 60]);
  assert.deepEqual(toggleMultiSelectValue([], 5), [5]);
});

test('toggleMultiSelectValue: 있는 값 → 제거', () => {
  assert.deepEqual(toggleMultiSelectValue([10, 60], 10), [60]);
  assert.deepEqual(toggleMultiSelectValue([10], 10), []);
});
