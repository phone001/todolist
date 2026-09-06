/**
 * 공통 오류 코드 및 오류 타입.
 * 설계 근거: document/architect/logic.md 0.2 "공통 오류 코드 체계".
 */

export const ErrorCodes = {
  VALIDATION_TITLE_REQUIRED: 'VALIDATION_TITLE_REQUIRED',
  VALIDATION_TITLE_TOO_LONG: 'VALIDATION_TITLE_TOO_LONG',
  VALIDATION_START_REQUIRED: 'VALIDATION_START_REQUIRED',
  VALIDATION_END_BEFORE_START: 'VALIDATION_END_BEFORE_START',
  VALIDATION_END_INVALID: 'VALIDATION_END_INVALID',
  VALIDATION_MEMO_TOO_LONG: 'VALIDATION_MEMO_TOO_LONG',
  VALIDATION_REMINDER_OFFSET_INVALID: 'VALIDATION_REMINDER_OFFSET_INVALID',
  VALIDATION_REMINDER_LIMIT: 'VALIDATION_REMINDER_LIMIT',
  VALIDATION_RECURRENCE_RULE_INVALID: 'VALIDATION_RECURRENCE_RULE_INVALID',
  VALIDATION_RECURRENCE_CONFLICT: 'VALIDATION_RECURRENCE_CONFLICT',
  VALIDATION_RECURRENCE_COUNT_INVALID: 'VALIDATION_RECURRENCE_COUNT_INVALID',

  POLICY_SYSTEM_CATEGORY_DELETE: 'POLICY_SYSTEM_CATEGORY_DELETE',

  NOT_FOUND_SCHEDULE: 'NOT_FOUND_SCHEDULE',
  NOT_FOUND_CATEGORY: 'NOT_FOUND_CATEGORY',

  PERMISSION_NOTIFICATION_DENIED: 'PERMISSION_NOTIFICATION_DENIED',
  PERMISSION_CALENDAR_DENIED: 'PERMISSION_CALENDAR_DENIED',

  GATEWAY_AUTH_FAILED: 'GATEWAY_AUTH_FAILED',
  GATEWAY_AUTH_CANCELLED: 'GATEWAY_AUTH_CANCELLED',
  GATEWAY_CALENDAR_UNAVAILABLE: 'GATEWAY_CALENDAR_UNAVAILABLE',

  STORAGE_TX_FAILED: 'STORAGE_TX_FAILED',
  STORAGE_STALE_WRITE: 'STORAGE_STALE_WRITE',
  STORAGE_READ_FAILED: 'STORAGE_READ_FAILED',
  STORAGE_MIGRATION_FAILED: 'STORAGE_MIGRATION_FAILED',
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

/** 도메인/애플리케이션 계층 공통 오류. UI는 `field`로 인라인 표시. */
export class AppError extends Error {
  readonly code: ErrorCode;
  readonly field?: string;

  constructor(code: ErrorCode, message: string, field?: string) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.field = field;
  }
}

/** 입력 검증 실패(여러 건). 이 오류가 던져지면 저장소 변경은 발생하지 않는다. */
export class ValidationError extends AppError {
  readonly errors: AppError[];

  constructor(errors: AppError[]) {
    const first = errors[0];
    super(
      first ? first.code : ErrorCodes.VALIDATION_TITLE_REQUIRED,
      first ? first.message : '입력값이 올바르지 않습니다.',
      first ? first.field : undefined,
    );
    this.name = 'ValidationError';
    this.errors = errors;
  }
}
