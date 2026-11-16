import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveEditorErrors } from '../../src/app/screens/scheduleEditorViewModel.ts';

test('F-28: 기본 오류만 있으면 상세를 강제로 펼치지 않는다', () => {
  const result = resolveEditorErrors([{ field: 'title', message: '제목을 입력하세요.' }]);
  assert.equal(result.expandDetails, false);
  assert.equal(result.expandRecurrence, false);
  assert.equal(result.fieldErrors.title, '제목을 입력하세요.');
});

test('F-28: 첫 오류가 기본 항목이어도 이후 상세 오류를 노출한다', () => {
  for (const field of ['endAt', 'memo', 'priority', 'categoryId', 'notifyAtStart', 'reminderOffsets']) {
    const result = resolveEditorErrors([
      { field: 'title', message: '제목 오류' },
      { field, message: '상세 오류' },
    ]);
    assert.equal(result.expandDetails, true, field);
    assert.equal(result.expandRecurrence, false, field);
    assert.equal(result.fieldErrors[field], '상세 오류');
  }
});

test('F-28: 반복 오류는 상세와 하위 반복 편집을 모두 노출한다', () => {
  const result = resolveEditorErrors([{ field: 'recurrence', message: '반복 종료일 오류' }]);
  assert.equal(result.expandDetails, true);
  assert.equal(result.expandRecurrence, true);
  assert.equal(result.fieldErrors.recurrence, '반복 종료일 오류');
});

test('F-28: 미지 필드와 필드 없는 오류는 전역 안내로 노출한다', () => {
  for (const field of [undefined, 'unknownField']) {
    const result = resolveEditorErrors([{ field, message: '저장할 수 없습니다.' }]);
    assert.equal(result.globalError, '저장할 수 없습니다.');
    assert.deepEqual(result.fieldErrors, {});
    assert.equal(result.expandDetails, false);
  }
});
