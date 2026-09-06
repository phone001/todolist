/**
 * 일정 입력 검증 (순수 함수). 저장소 접근 없음 — 저장 이전에 호출된다.
 * 설계 근거: document/architect/logic.md 1 (ScheduleService.create), 정책 P-10/D-05.
 * AC-02, AC-03, V-4.
 */
import { AppError, ErrorCodes, ValidationError } from './errors.ts';
import type { RecurrenceRule } from './types.ts';

export const TITLE_MAX = 200;
export const MEMO_MAX = 5000;
export const MAX_REMINDER_OFFSETS = 5; // 정책 P-10

const VALID_RULES: readonly RecurrenceRule[] = ['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'];

export interface ScheduleInput {
  title?: string;
  memo?: string | null;
  startAt?: number;
  endAt?: number | null;
  reminderOffsets?: number[];
  recurrence?: {
    rule?: string;
    endAt?: number | null;
    count?: number | null;
  } | null;
}

/** 검증 오류 목록을 수집한다. 비어 있으면 유효. */
export function collectScheduleInputErrors(input: ScheduleInput): AppError[] {
  const errors: AppError[] = [];

  const title = (input.title ?? '').trim();
  if (title.length === 0) {
    errors.push(new AppError(ErrorCodes.VALIDATION_TITLE_REQUIRED, '제목을 입력하세요.', 'title'));
  } else if (title.length > TITLE_MAX) {
    errors.push(
      new AppError(ErrorCodes.VALIDATION_TITLE_TOO_LONG, `제목은 ${TITLE_MAX}자 이하여야 합니다.`, 'title'),
    );
  }

  const startValid = Number.isInteger(input.startAt);
  if (!startValid) {
    errors.push(new AppError(ErrorCodes.VALIDATION_START_REQUIRED, '시작 일시를 선택하세요.', 'startAt'));
  }

  if (input.endAt !== undefined && input.endAt !== null) {
    if (!Number.isInteger(input.endAt)) {
      errors.push(new AppError(ErrorCodes.VALIDATION_END_INVALID, '종료 일시가 올바르지 않습니다.', 'endAt'));
    } else if (startValid && (input.endAt as number) < (input.startAt as number)) {
      errors.push(
        new AppError(
          ErrorCodes.VALIDATION_END_BEFORE_START,
          '종료 일시는 시작 일시보다 빠를 수 없습니다.',
          'endAt',
        ),
      );
    }
  }

  if (input.memo !== undefined && input.memo !== null && String(input.memo).length > MEMO_MAX) {
    errors.push(
      new AppError(ErrorCodes.VALIDATION_MEMO_TOO_LONG, `메모는 ${MEMO_MAX}자 이하여야 합니다.`, 'memo'),
    );
  }

  if (input.reminderOffsets !== undefined) {
    const arr = input.reminderOffsets;
    if (!Array.isArray(arr)) {
      errors.push(
        new AppError(
          ErrorCodes.VALIDATION_REMINDER_OFFSET_INVALID,
          '알림 오프셋 형식이 올바르지 않습니다.',
          'reminderOffsets',
        ),
      );
    } else {
      const bad = arr.some((o) => !Number.isInteger(o) || o < 0);
      if (bad) {
        errors.push(
          new AppError(
            ErrorCodes.VALIDATION_REMINDER_OFFSET_INVALID,
            '알림 오프셋은 0 이상의 정수여야 합니다.',
            'reminderOffsets',
          ),
        );
      }
      if (new Set(arr).size > MAX_REMINDER_OFFSETS) {
        errors.push(
          new AppError(
            ErrorCodes.VALIDATION_REMINDER_LIMIT,
            `사전 알림은 최대 ${MAX_REMINDER_OFFSETS}개까지 설정할 수 있습니다.`,
            'reminderOffsets',
          ),
        );
      }
    }
  }

  if (input.recurrence !== undefined && input.recurrence !== null) {
    const r = input.recurrence;
    if (!VALID_RULES.includes(r.rule as RecurrenceRule)) {
      errors.push(
        new AppError(
          ErrorCodes.VALIDATION_RECURRENCE_RULE_INVALID,
          '반복 규칙이 올바르지 않습니다.',
          'recurrence',
        ),
      );
    }
    if (r.endAt !== undefined && r.endAt !== null && r.count !== undefined && r.count !== null) {
      errors.push(
        new AppError(
          ErrorCodes.VALIDATION_RECURRENCE_CONFLICT,
          '반복 종료일과 반복 횟수는 함께 설정할 수 없습니다.',
          'recurrence',
        ),
      );
    }
    if (r.count !== undefined && r.count !== null && (!Number.isInteger(r.count) || r.count <= 0)) {
      errors.push(
        new AppError(
          ErrorCodes.VALIDATION_RECURRENCE_COUNT_INVALID,
          '반복 횟수는 1 이상의 정수여야 합니다.',
          'recurrence',
        ),
      );
    }
  }

  return errors;
}

/** 유효하지 않으면 ValidationError 를 던진다(저장소 변경 전). */
export function assertValidScheduleInput(input: ScheduleInput): void {
  const errors = collectScheduleInputErrors(input);
  if (errors.length > 0) throw new ValidationError(errors);
}
