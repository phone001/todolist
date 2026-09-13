/**
 * SelectField / MultiSelectField 의 순수 라벨·토글 계산 로직 (F-06/F-07/F-08/F-24, P-70).
 * 설계 근거: document/architect/logic.md v1.17 §16.3.1 "선택형 필드 셀렉트박스화".
 *
 * `react`/`react-native` 를 import 하지 않는 순수 함수 — node:test 로 직접 검증한다
 * (useLoadingIndicator.native.ts / loadingIndicatorMachine.ts 와 동일한 로직/배선 분리 원칙).
 */

export interface SelectOption<T> {
  value: T;
  label: string;
}

/** 단일 선택 트리거 라벨 — 일치하는 옵션이 없으면 빈 문자열(미선택 표시). */
export function resolveSelectedLabel<T>(value: T, options: ReadonlyArray<SelectOption<T>>): string {
  return options.find((o) => o.value === value)?.label ?? '';
}

/**
 * 다중 선택 트리거 라벨.
 * `values.length===0 ? '없음' : '{n}개 선택 ({라벨1, 라벨2, ...})'` (§16.3.1 MultiSelectField 명세).
 * 옵션에 없는 값은 라벨 목록에서 제외한다(방어적).
 */
export function formatMultiSelectTriggerLabel(
  values: readonly number[],
  options: ReadonlyArray<SelectOption<number>>,
): string {
  if (values.length === 0) return '없음';
  const labels = values
    .map((v) => options.find((o) => o.value === v)?.label)
    .filter((l): l is string => typeof l === 'string');
  return `${values.length}개 선택 (${labels.join(', ')})`;
}

/** 다중 선택 옵션 행 토글 — 있으면 제거, 없으면 추가(순서 보존, 정렬 없음). */
export function toggleMultiSelectValue(values: readonly number[], value: number): number[] {
  return values.includes(value) ? values.filter((v) => v !== value) : [...values, value];
}
