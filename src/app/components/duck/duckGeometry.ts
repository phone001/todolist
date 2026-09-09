/**
 * 로고 오리 캐릭터 — SVG 도형의 단일 출처 (형태·색).
 * 설계 근거: document/architect/logic.md v1.7 §16.9.4 ("모든 활동의 오리 도상은 duckGeometry.ts 단일 출처를 공유").
 *
 * 순수 상수 모듈 — `react` / `react-native` / `react-native-svg` 미의존 (core tsc 빌드 포함 대상, V-28 보조).
 * 여기 정의된 path 는 앱이 코드로 작성한 정적 도형이다. 외부·동적 SVG 문자열을 렌더하지 않는다
 * (logic §16.7 "브랜드 로딩 인디케이터 SVG" 보안 노트).
 *
 * 좌표계: 120x120 viewBox, 원점 좌상단. 오리는 대략 (18..104, 30..96) 영역을 차지한다.
 */

export const DUCK_VIEWBOX = '0 0 120 120';
export const DUCK_VIEWBOX_SIZE = 120;

/** 로고 오리 팔레트 (기존 아이덴티티 유지 — 새 캐릭터 생성 금지, F-17 비범위). */
export const DUCK_COLORS = {
  /** 몸통·머리 본체 */
  body: '#F7C948',
  /** 몸통 그림자/날개 */
  wing: '#E8B22E',
  /** 부리·발 */
  bill: '#F5843C',
  /** 윤곽선 */
  outline: '#C6881B',
  /** 눈 */
  eye: '#2A2A2A',
  /** 볼 홍조 */
  cheek: '#F29AA0',
  /** 활동 소품 기본색(파랑 계열) */
  prop: '#4A90D9',
  /** 활동 소품 강조색(빨강 계열 — 종/체크) */
  propAccent: '#E2483D',
  /** 활동 소품 보조 면색 */
  propFill: '#FFFFFF',
} as const;

export type DuckColorKey = keyof typeof DUCK_COLORS;

/**
 * 오리 본체 path 조각. 장면(활동)이 바뀌어도 공유한다.
 * 노드 수 예산: 장면당 SVG 노드 < 30 (nfr §13.1) — 본체는 6 path + 1 circle.
 */
export const DUCK_PATHS = {
  /** 몸통(타원형 볼륨) */
  body: 'M60 96c-21 0-38-13-38-31 0-15 12-27 30-30 6-1 9-4 12-9 4-7 12-11 20-9 9 2 15 10 15 19 0 4 2 7 5 10 6 6 9 13 9 20 0 18-17 30-38 30-4 0-11 0-16 0z',
  /** 머리 */
  head: 'M70 30c11 0 20 9 20 20 0 11-9 20-20 20s-20-9-20-20c0-11 9-20 20-20z',
  /** 날개(접힌) */
  wing: 'M52 60c10-3 22-2 31 5 4 3 3 10-2 12-9 4-20 3-28-3-5-4-4-12-1-14z',
  /** 부리 */
  bill: 'M90 46c8-2 17 0 21 5 2 2 1 6-2 7-6 2-14 1-19-3-3-2-3-7 0-9z',
  /** 앞발 */
  footFront: 'M50 94c-2 5-1 9 2 11 3 1 7 0 8-3l1-8z',
  /** 뒷발 */
  footBack: 'M70 95c-1 5 1 9 4 10 3 1 6-1 6-4l-1-7z',
} as const;

export type DuckPathKey = keyof typeof DUCK_PATHS;

/** 눈(원). cx/cy/r. */
export const DUCK_EYE = { cx: 74, cy: 46, r: 3.4 } as const;
/** 볼 홍조(원). */
export const DUCK_CHEEK = { cx: 64, cy: 54, r: 4.2 } as const;

/** 표준 렌더 크기(dp) — 인라인 72dp, 풀스크린 160dp (overview "D-06 설계 확정값"). */
export const DUCK_SIZE_INLINE = 72;
export const DUCK_SIZE_FULLSCREEN = 160;

/** 화면 폭 대비 상한 비율 — 인라인 40%, 풀스크린 60% (P-27). */
export const DUCK_MAX_WIDTH_RATIO_INLINE = 0.4;
export const DUCK_MAX_WIDTH_RATIO_FULLSCREEN = 0.6;
