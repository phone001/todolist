/** F-28: 필드 오류를 표시할 기본/상세 영역과 전역 안내로 분류한다. */
const basicFields = new Set(['title', 'startAt']);
const detailFields = new Set([
  'endAt', 'memo', 'priority', 'categoryId', 'notifyAtStart', 'reminderOffsets', 'recurrence',
]);

export function resolveEditorErrors(errors: ReadonlyArray<{ field?: string; message: string }>) {
  const fieldErrors: Record<string, string> = {};
  let globalError: string | null = null;
  let expandDetails = false;
  let expandRecurrence = false;
  for (const error of errors) {
    if (error.field && (basicFields.has(error.field) || detailFields.has(error.field))) {
      fieldErrors[error.field] = error.message;
      if (detailFields.has(error.field)) expandDetails = true;
      if (error.field === 'recurrence') expandRecurrence = true;
    } else if (globalError === null) {
      globalError = error.message;
    }
  }
  return { fieldErrors, globalError, expandDetails, expandRecurrence };
}
