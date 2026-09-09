/**
 * 활동 1컷 = 로고 오리(공유 geometry) + 활동 소품 SVG.
 * 설계 근거: document/architect/logic.md v1.7 §16.9.4 / §16.9.2 (duck/DuckScene.tsx),
 *           nfr.md v1.5 §13.1 (장면당 SVG 노드 < 30, 동시 마운트 장면 ≤ 2).
 * 환경 제약: react / react-native-svg 의존 → 파이프라인 미실행(정적 리뷰).
 *
 * `activity` prop 만 받는 순수 시각 컴포넌트. 접근성은 상위 컨테이너가 단일 라벨로 담당하고,
 * 이 서브트리는 스크린리더에서 숨긴다(§16.9.7). React.memo 로 활동 전환이 부모 리렌더를 유발하지 않는다.
 */
import React from 'react';
import Svg, { Circle, G, Line, Path, Rect } from 'react-native-svg';
import {
  DUCK_CHEEK,
  DUCK_COLORS,
  DUCK_EYE,
  DUCK_PATHS,
  DUCK_VIEWBOX,
} from './duckGeometry.ts';
import type { ActivityId } from './activities.ts';

interface DuckSceneProps {
  activity: ActivityId;
  /** 정사각 렌더 크기(dp). */
  size: number;
}

function DuckBody() {
  return (
    <G>
      <Path d={DUCK_PATHS.body} fill={DUCK_COLORS.body} stroke={DUCK_COLORS.outline} strokeWidth={2} />
      <Path d={DUCK_PATHS.footFront} fill={DUCK_COLORS.bill} />
      <Path d={DUCK_PATHS.footBack} fill={DUCK_COLORS.bill} />
      <Path d={DUCK_PATHS.wing} fill={DUCK_COLORS.wing} stroke={DUCK_COLORS.outline} strokeWidth={1.5} />
      <Path d={DUCK_PATHS.head} fill={DUCK_COLORS.body} stroke={DUCK_COLORS.outline} strokeWidth={2} />
      <Path d={DUCK_PATHS.bill} fill={DUCK_COLORS.bill} stroke={DUCK_COLORS.outline} strokeWidth={1.5} />
      <Circle cx={DUCK_CHEEK.cx} cy={DUCK_CHEEK.cy} r={DUCK_CHEEK.r} fill={DUCK_COLORS.cheek} opacity={0.7} />
      <Circle cx={DUCK_EYE.cx} cy={DUCK_EYE.cy} r={DUCK_EYE.r} fill={DUCK_COLORS.eye} />
    </G>
  );
}

/** 활동 소품 — 오리 앞쪽에 배치. 노드 수 최소화(장면 전체 < 30). */
function ActivityProp({ activity }: { activity: ActivityId }) {
  const { prop, propAccent, propFill, outline } = DUCK_COLORS;
  switch (activity) {
    case 'checkList':
      return (
        <G>
          <Rect x={24} y={58} width={26} height={32} rx={3} fill={propFill} stroke={outline} strokeWidth={2} />
          <Rect x={31} y={54} width={12} height={7} rx={2} fill={prop} />
          <Line x1={29} y1={68} x2={45} y2={68} stroke={prop} strokeWidth={2.5} />
          <Line x1={29} y1={76} x2={45} y2={76} stroke={prop} strokeWidth={2.5} />
          <Line x1={29} y1={84} x2={40} y2={84} stroke={prop} strokeWidth={2.5} />
        </G>
      );
    case 'flipCalendar':
      return (
        <G>
          <Rect x={22} y={52} width={34} height={30} rx={3} fill={propFill} stroke={outline} strokeWidth={2} />
          <Rect x={22} y={52} width={34} height={9} rx={3} fill={propAccent} />
          <Line x1={30} y1={49} x2={30} y2={56} stroke={outline} strokeWidth={2.5} />
          <Line x1={48} y1={49} x2={48} y2={56} stroke={outline} strokeWidth={2.5} />
          <Path d="M56 61c8-4 14-3 18 2-6 5-13 6-18 3z" fill={prop} opacity={0.85} />
        </G>
      );
    case 'ringBell':
      return (
        <G>
          <Path d="M34 78c0-12 6-20 12-20s12 8 12 20z" fill={propAccent} stroke={outline} strokeWidth={2} />
          <Rect x={38} y={78} width={16} height={4} rx={2} fill={outline} />
          <Circle cx={46} cy={56} r={3} fill={outline} />
          <Path d="M62 60c4 3 4 11 0 14" stroke={prop} strokeWidth={2.5} fill="none" />
          <Path d="M67 55c7 6 7 22 0 28" stroke={prop} strokeWidth={2.5} fill="none" />
        </G>
      );
    case 'checkDone':
      return (
        <G>
          <Rect x={26} y={60} width={28} height={28} rx={5} fill={propFill} stroke={outline} strokeWidth={2} />
          <Path d="M32 74l7 8 14-16" stroke={propAccent} strokeWidth={4} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </G>
      );
    case 'search':
      return (
        <G>
          <Circle cx={40} cy={66} r={13} fill="none" stroke={prop} strokeWidth={4} />
          <Line x1={50} y1={76} x2={62} y2={88} stroke={prop} strokeWidth={5} strokeLinecap="round" />
        </G>
      );
    default:
      return null;
  }
}

function DuckSceneImpl({ activity, size }: DuckSceneProps) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox={DUCK_VIEWBOX}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <ActivityProp activity={activity} />
      <DuckBody />
    </Svg>
  );
}

export const DuckScene = React.memo(DuckSceneImpl);
