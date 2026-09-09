/**
 * 네비게이션 라우트 이름과 파라미터 타입 (순수 데이터, 플랫폼 비의존).
 * 설계 근거: document/architect/logic.md v1.1 §16.2. React Navigation 6.x.
 *
 * 이 파일은 react-navigation 을 import 하지 않는다 — 라우트 계약만 정의하고,
 * RootNavigator.tsx(네이티브 바인딩)가 이 타입으로 스택/탭을 구성한다.
 */

export const TAB_ROUTES = {
  Dashboard: 'DashboardTab',
  Calendar: 'CalendarTab',
  Search: 'SearchTab',
  Settings: 'SettingsTab',
} as const;

export const STACK_ROUTES = {
  Tabs: 'Tabs',
  ScheduleDetail: 'ScheduleDetail',
  ScheduleEditor: 'ScheduleEditor',
  CategoryManager: 'CategoryManager',
  Permissions: 'Permissions',
} as const;

export type TabRouteName = (typeof TAB_ROUTES)[keyof typeof TAB_ROUTES];
export type StackRouteName = (typeof STACK_ROUTES)[keyof typeof STACK_ROUTES];

/** 스택 라우트별 파라미터. scheduleId 는 항상 정수. */
export interface RootStackParamList {
  Tabs: undefined;
  ScheduleDetail: { scheduleId: number };
  /** scheduleId 없으면 신규 작성. */
  ScheduleEditor: { scheduleId?: number };
  CategoryManager: undefined;
  Permissions: { from?: 'onboarding' | 'settings' } | undefined;
}

export interface TabParamList {
  DashboardTab: undefined;
  CalendarTab: undefined;
  SearchTab: { initialQuery?: string } | undefined;
  SettingsTab: undefined;
}

/** 딥링크/알림 탭이 도달할 수 있는 대상. linking.ts 가 이 형태로 해석 결과를 돌려준다. */
export type NavigationTarget =
  | { stack: 'ScheduleDetail'; params: { scheduleId: number } }
  | { stack: 'Tabs'; params?: undefined };
