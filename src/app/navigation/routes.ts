/**
 * 네비게이션 라우트 이름과 파라미터 타입 (순수 데이터, 플랫폼 비의존).
 * 설계 근거: document/architect/logic.md v1.12 §16.2 / §16.3.8. React Navigation 6.x.
 *
 * 이 파일은 react-navigation 을 import 하지 않는다 — 라우트 계약만 정의하고,
 * RootNavigator.tsx(네이티브 바인딩)가 이 타입으로 스택/탭을 구성한다.
 *
 * v1.12: 세 번째 탭이 "검색"(`SearchTab`) → "통계"(`StatisticsTab`, F-23)로 교체되고,
 * 전역 검색(F-11)은 Bottom Tab 에서 Native Stack 화면(`Search`)으로 이전한다(D-20(a), P-54).
 */

export const TAB_ROUTES = {
  Dashboard: 'DashboardTab',
  Calendar: 'CalendarTab',
  Statistics: 'StatisticsTab',
  Settings: 'SettingsTab',
} as const;

export const STACK_ROUTES = {
  Tabs: 'Tabs',
  ScheduleDetail: 'ScheduleDetail',
  ScheduleEditor: 'ScheduleEditor',
  Search: 'Search',
  CategoryManager: 'CategoryManager',
  Permissions: 'Permissions',
} as const;

export type TabRouteName = (typeof TAB_ROUTES)[keyof typeof TAB_ROUTES];
export type StackRouteName = (typeof STACK_ROUTES)[keyof typeof STACK_ROUTES];

/** 스택 라우트별 파라미터. scheduleId 는 항상 정수. */
export interface RootStackParamList {
  Tabs: undefined;
  ScheduleDetail: { scheduleId: number };
  /**
   * scheduleId 없으면 신규 작성.
   * presetDate: 대시보드 기준 날짜(F-20)가 오늘이 아닐 때 FAB/빈 상태 버튼으로 진입 시 전달되는
   * 로컬 자정 epoch ms. 신규 모드 기본 시작 일시 = presetDate + 9h (OI-19, logic §16.3.7).
   */
  ScheduleEditor: { scheduleId?: number; presetDate?: number };
  /**
   * 전역 검색(F-11). v1.12: 세 번째 탭 교체로 검색 전용 탭이 사라지고 Stack 화면으로 이전.
   * 진입점은 캘린더 화면 헤더의 검색 아이콘(D-20(a)). `initialQuery` 는 선택.
   */
  Search: { initialQuery?: string } | undefined;
  CategoryManager: undefined;
  Permissions: { from?: 'onboarding' | 'settings' } | undefined;
}

export interface TabParamList {
  DashboardTab: undefined;
  CalendarTab: undefined;
  StatisticsTab: undefined;
  SettingsTab: undefined;
}

/** 딥링크/알림 탭이 도달할 수 있는 대상. linking.ts 가 이 형태로 해석 결과를 돌려준다. */
export type NavigationTarget =
  | { stack: 'ScheduleDetail'; params: { scheduleId: number } }
  | { stack: 'Tabs'; params?: undefined };
