/**
 * 화면 ↔ 서비스 바인딩 맵 (선언적 데이터).
 * 설계 근거: document/architect/logic.md v1.1 §16.3, overview.md v1.1 "화면 ↔ 서비스 바인딩".
 *
 * 화면 컴포넌트(.tsx)는 이 맵이 가리키는 서비스 메서드만 호출한다.
 * 서비스 계층은 상태를 보유하지 않으므로 스토어에는 결과 스냅샷만 둔다.
 * 이 파일은 react 를 import 하지 않는다 — 바인딩 계약을 테스트로 고정하기 위함.
 */

export type StoreSlice = 'dashboard' | 'list' | 'search' | 'categories' | 'settings' | 'account';

/** CoreServices 의 키. */
export type ServiceKey =
  | 'dashboard'
  | 'schedules'
  | 'search'
  | 'categories'
  | 'settings'
  | 'auth'
  | 'calendarSync'
  | 'scheduler';

export interface ScreenBinding {
  screen: string;
  reads: Array<{ service: ServiceKey; method: string }>;
  writes: Array<{ service: ServiceKey; method: string }>;
  /** 쓰기 성공 후 무효화할 스토어 슬라이스. */
  invalidates: StoreSlice[];
}

export const SCREEN_BINDINGS: readonly ScreenBinding[] = [
  {
    screen: 'DashboardScreen',
    reads: [
      // 요약 상세 + 개수 카드(F-21) 소스. 기준 날짜(F-20)를 인자로 전달 — 시그니처 무변경 (logic §7.1).
      { service: 'dashboard', method: 'getSummary' },
      // 기준 날짜 일정 목록 소스. 인라인 검색(F-22)은 이 결과 배열의 표시 계층 순수 필터 — 서비스 미호출.
      { service: 'schedules', method: 'findInRange' },
    ],
    writes: [
      { service: 'schedules', method: 'toggleDone' },
      { service: 'schedules', method: 'softDelete' },
    ],
    invalidates: ['list', 'dashboard', 'search'],
  },
  {
    screen: 'CalendarScreen',
    reads: [{ service: 'schedules', method: 'findInRange' }],
    writes: [{ service: 'schedules', method: 'toggleDone' }],
    invalidates: ['list', 'dashboard'],
  },
  {
    screen: 'ScheduleListScreen',
    reads: [{ service: 'schedules', method: 'findInRange' }],
    writes: [{ service: 'schedules', method: 'toggleDone' }],
    invalidates: ['list', 'dashboard'],
  },
  {
    screen: 'ScheduleEditorScreen',
    reads: [
      { service: 'categories', method: 'list' },
      { service: 'settings', method: 'get' },
    ],
    writes: [
      { service: 'schedules', method: 'create' },
      { service: 'schedules', method: 'update' },
      { service: 'categories', method: 'create' },
      { service: 'categories', method: 'rename' },
      { service: 'categories', method: 'remove' },
    ],
    invalidates: ['list', 'dashboard', 'search', 'categories'],
  },
  {
    screen: 'ScheduleDetailScreen',
    reads: [
      { service: 'schedules', method: 'getById' },
      { service: 'categories', method: 'list' },
    ],
    writes: [
      { service: 'schedules', method: 'toggleDone' },
      { service: 'schedules', method: 'softDelete' },
      { service: 'schedules', method: 'restore' },
    ],
    invalidates: ['list', 'dashboard', 'search'],
  },
  {
    screen: 'SearchScreen',
    reads: [{ service: 'search', method: 'search' }],
    writes: [],
    invalidates: [],
  },
  {
    screen: 'SettingsScreen',
    reads: [
      { service: 'settings', method: 'get' },
      { service: 'settings', method: 'getAll' },
      { service: 'categories', method: 'list' },
    ],
    writes: [
      { service: 'settings', method: 'set' },
      { service: 'auth', method: 'link' },
      { service: 'auth', method: 'unlink' },
      { service: 'calendarSync', method: 'pull' },
    ],
    invalidates: ['settings', 'account'],
  },
  {
    screen: 'CategoryManagerScreen',
    reads: [{ service: 'categories', method: 'list' }],
    writes: [
      { service: 'categories', method: 'create' },
      { service: 'categories', method: 'remove' },
    ],
    invalidates: ['categories', 'list', 'dashboard'],
  },
  {
    screen: 'PermissionsScreen',
    reads: [],
    writes: [{ service: 'settings', method: 'set' }],
    invalidates: ['settings'],
  },
] as const;

/** APP_SETTING 키(logic §10, §16.3). SettingsScreen 이 읽고 쓰는 값. */
export const SETTING_KEYS = {
  themeMode: 'theme.mode',
  themeAccent: 'theme.accent',
  themeFontScale: 'theme.fontScale',
  notifEnabled: 'notif.enabled',
  notifShowTitle: 'notif.showTitle',
  scheduleDefaultPriority: 'schedule.defaultPriority',
  scheduleDefaultCategoryId: 'schedule.defaultCategoryId',
  calendarPushEnabled: 'calendar.pushEnabled',
  calendarConflictPolicy: 'calendar.conflictPolicy',
} as const;
