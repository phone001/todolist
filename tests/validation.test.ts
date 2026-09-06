import test from 'node:test';
import assert from 'node:assert/strict';
import {
  collectScheduleInputErrors,
  assertValidScheduleInput,
  MAX_REMINDER_OFFSETS,
} from '../src/core/domain/validation.ts';
import { ValidationError } from '../src/core/domain/errors.ts';

const base = { title: '회의', startAt: Date.UTC(2026, 8, 4, 10, 0, 0) };

test('V-4: 유효 입력은 오류가 없다', () => {
  assert.equal(collectScheduleInputErrors(base).length, 0);
});

test('AC-02: 제목이 비면 VALIDATION_TITLE_REQUIRED (field=title)', () => {
  const errs = collectScheduleInputErrors({ ...base, title: '   ' });
  assert.equal(errs.length, 1);
  assert.equal(errs[0].code, 'VALIDATION_TITLE_REQUIRED');
  assert.equal(errs[0].field, 'title');
});

test('AC-02: startAt 누락 시 VALIDATION_START_REQUIRED', () => {
  const errs = collectScheduleInputErrors({ title: '회의' });
  assert.ok(errs.some((e) => e.code === 'VALIDATION_START_REQUIRED'));
});

test('AC-03: 종료 < 시작이면 VALIDATION_END_BEFORE_START', () => {
  const errs = collectScheduleInputErrors({ ...base, endAt: base.startAt - 1 });
  assert.ok(errs.some((e) => e.code === 'VALIDATION_END_BEFORE_START'));
});

test('종료 == 시작은 허용', () => {
  const errs = collectScheduleInputErrors({ ...base, endAt: base.startAt });
  assert.equal(errs.length, 0);
});

test('제목 200자 초과는 VALIDATION_TITLE_TOO_LONG', () => {
  const errs = collectScheduleInputErrors({ ...base, title: 'x'.repeat(201) });
  assert.ok(errs.some((e) => e.code === 'VALIDATION_TITLE_TOO_LONG'));
});

test('P-10: 사전 알림 오프셋이 6개(중복 제외)면 VALIDATION_REMINDER_LIMIT', () => {
  const errs = collectScheduleInputErrors({ ...base, reminderOffsets: [1, 2, 3, 4, 5, 6] });
  assert.ok(errs.some((e) => e.code === 'VALIDATION_REMINDER_LIMIT'));
  assert.equal(MAX_REMINDER_OFFSETS, 5);
});

test('중복 오프셋은 개수 계산에서 제거된다', () => {
  const errs = collectScheduleInputErrors({ ...base, reminderOffsets: [5, 5, 5, 5, 5, 5, 10] });
  assert.equal(errs.length, 0);
});

test('음수 오프셋은 VALIDATION_REMINDER_OFFSET_INVALID', () => {
  const errs = collectScheduleInputErrors({ ...base, reminderOffsets: [-1] });
  assert.ok(errs.some((e) => e.code === 'VALIDATION_REMINDER_OFFSET_INVALID'));
});

test('D-05: 반복 종료일과 횟수 동시 지정은 VALIDATION_RECURRENCE_CONFLICT', () => {
  const errs = collectScheduleInputErrors({
    ...base,
    recurrence: { rule: 'WEEKLY', endAt: base.startAt + 1_000_000, count: 5 },
  });
  assert.ok(errs.some((e) => e.code === 'VALIDATION_RECURRENCE_CONFLICT'));
});

test('잘못된 반복 규칙은 VALIDATION_RECURRENCE_RULE_INVALID', () => {
  const errs = collectScheduleInputErrors({ ...base, recurrence: { rule: 'HOURLY' } });
  assert.ok(errs.some((e) => e.code === 'VALIDATION_RECURRENCE_RULE_INVALID'));
});

test('assertValidScheduleInput 은 ValidationError 를 던지고 errors 목록을 담는다', () => {
  assert.throws(
    () => assertValidScheduleInput({ title: '', startAt: undefined }),
    (err: unknown) => {
      assert.ok(err instanceof ValidationError);
      assert.ok((err as ValidationError).errors.length >= 2);
      return true;
    },
  );
});
