/**
 * 카테고리(유형) 색상 자동 배정 (순수 함수).
 * 설계 근거: document/architect/logic.md 5.1 "색상 자동 배정" (F-06, P-59, E-06-7, AC-77).
 */

/**
 * 유형 자동 배정 고정 팔레트(12색). 색상환 156°~345° 구간(청록→시안→파랑→인디고→보라→자홍)
 * + 저채도 중성색(갈색·청회색 2종)으로 구성 — F-07 우선순위 색(§5.2)과 최소 60° 이상 이격.
 */
export const CATEGORY_COLOR_PALETTE: readonly string[] = [
  '#00897B', // 청록
  '#00ACC1', // 시안
  '#039BE5', // 밝은 파랑
  '#1E88E5', // 파랑
  '#3949AB', // 남색(인디고)
  '#5E35B1', // 남보라
  '#8E24AA', // 보라
  '#D81B60', // 자홍
  '#6D4C41', // 갈색
  '#546E7A', // 청회색
  '#455A64', // 진청회색
  '#4527A0', // 진남보라
];

/** 색상 배정 실패(E-06-7) 시 폴백. 시스템 기본 유형("기타")의 고정 회색과 동일. */
export const CATEGORY_COLOR_FALLBACK = '#8E8E93';

/**
 * 기존에 사용 중인 색상 배열을 받아 팔레트에서 "최초-미사용" 색을 배정한다.
 * 12색이 모두 사용 중이면 `existingColors.length % 12` 로 순환(P-59).
 * 내부에서 예외가 발생해도 던지지 않고 `CATEGORY_COLOR_FALLBACK` 을 반환한다(E-06-7 — 호출부 폴백 보장용 방어).
 */
export function assignCategoryColor(existingColors: string[]): string {
  try {
    const used = new Set(existingColors.map((c) => c.toUpperCase()));
    for (const color of CATEGORY_COLOR_PALETTE) {
      if (!used.has(color.toUpperCase())) return color;
    }
    return CATEGORY_COLOR_PALETTE[existingColors.length % CATEGORY_COLOR_PALETTE.length];
  } catch {
    return CATEGORY_COLOR_FALLBACK;
  }
}
