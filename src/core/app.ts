/**
 * 조립 지점 (Composition Root). 포트에 구체 어댑터를 주입한다.
 *
 * - `assembleServices(ports)` — 포트 구현을 받아 8개 서비스를 조립하는 재사용 seam.
 *   RN 앱 셸은 SQLite/Notifee/AppAuth/Keychain 어댑터를 이 함수에 주입한다(overview v1.1 §"조립 지점 리팩터", logic §16.1).
 * - `buildApp(options)` — 인메모리/Fake 어댑터로 조립하는 기존 진입점. 후방 호환 유지.
 *
 * 설계 근거: document/architect/overview.md v1.1 "전체 구조"·"클라이언트 셸 아키텍처", logic.md 0.1, §16.1.
 */
import { SystemClock } from './domain/clock.ts';
import type { Clock } from './domain/clock.ts';
import { InMemoryDb, seedDefaults } from './infra/memory/store.ts';
import {
  InMemoryAccountRepository,
  InMemoryCalendarLinkRepository,
  InMemoryCategoryRepository,
  InMemoryReminderRepository,
  InMemoryScheduleRepository,
  InMemorySettingRepository,
} from './infra/memory/repositories.ts';
import {
  ArrayLogger,
  FakeAuthGateway,
  FakeCalendarGateway,
  FakeNotificationGateway,
  InMemoryTokenStore,
} from './infra/fakes/fakes.ts';
import { AuthService } from './services/authService.ts';
import { CalendarSyncService } from './services/calendarSyncService.ts';
import { CategoryService } from './services/categoryService.ts';
import { DashboardService } from './services/dashboardService.ts';
import { ReminderScheduler } from './services/reminderScheduler.ts';
import { ScheduleService } from './services/scheduleService.ts';
import { SearchService } from './services/searchService.ts';
import { SettingService } from './services/settingService.ts';
import type {
  AccountRepository,
  CalendarLinkRepository,
  CategoryRepository,
  ReminderRepository,
  ScheduleRepository,
  SettingRepository,
  UnitOfWork,
} from './ports/repositories.ts';
import type {
  AuthGateway,
  CalendarGateway,
  Logger,
  NotificationGateway,
  TokenStore,
} from './ports/gateways.ts';

/** 6개 저장소 포트 묶음. 어댑터 계층(인메모리 / SQLite)이 이 형태로 제공한다. */
export interface CoreRepositories {
  schedules: ScheduleRepository;
  reminders: ReminderRepository;
  categories: CategoryRepository;
  settings: SettingRepository;
  account: AccountRepository;
  calendarLinks: CalendarLinkRepository;
}

/** `assembleServices` 입력: 모든 외부 의존성을 포트 인터페이스로만 받는다(DIP). */
export interface CorePorts {
  clock: Clock;
  logger: Logger;
  uow: UnitOfWork;
  repositories: CoreRepositories;
  notifications: NotificationGateway;
  calendar: CalendarGateway;
  auth: AuthGateway;
  tokenStore: TokenStore;
  /** CalendarSyncService 가 조회할 외부 캘린더 ID 목록. 미지정 시 빈 목록. */
  calendarIds?: string[];
}

/** 조립된 애플리케이션 서비스 묶음. UI/셸은 이 인터페이스에만 의존한다. */
export interface CoreServices {
  clock: Clock;
  logger: Logger;
  schedules: ScheduleService;
  scheduler: ReminderScheduler;
  dashboard: DashboardService;
  search: SearchService;
  categories: CategoryService;
  settings: SettingService;
  auth: AuthService;
  calendarSync: CalendarSyncService;
}

/**
 * 포트 구현을 받아 8개 서비스를 조립한다. 저장소 종류(인메모리/SQLite)에 무관하다.
 * 서비스 간 결선은 여기 한 곳에서만 이뤄진다(SRP).
 */
export function assembleServices(ports: CorePorts): CoreServices {
  const { clock, logger, uow, repositories: repo } = ports;

  const settings = new SettingService(repo.settings, clock);

  const scheduler = new ReminderScheduler({
    clock,
    reminders: repo.reminders,
    schedules: repo.schedules,
    notifications: ports.notifications,
    settings,
    logger,
  });

  const schedules = new ScheduleService({
    clock,
    uow,
    schedules: repo.schedules,
    reminders: repo.reminders,
    categories: repo.categories,
    notifications: ports.notifications,
    scheduler,
    logger,
  });

  const dashboard = new DashboardService(repo.schedules, clock);
  const search = new SearchService(repo.schedules);
  const categories = new CategoryService({ clock, uow, categories: repo.categories, schedules: repo.schedules });
  const auth = new AuthService({ clock, auth: ports.auth, tokenStore: ports.tokenStore, account: repo.account, logger });
  const calendarSync = new CalendarSyncService({
    clock,
    uow,
    schedules: repo.schedules,
    links: repo.calendarLinks,
    categories: repo.categories,
    calendar: ports.calendar,
    logger,
    calendarIds: ports.calendarIds ?? [],
  });

  return { clock, logger, schedules, scheduler, dashboard, search, categories, settings, auth, calendarSync };
}

export interface AppOptions {
  clock?: Clock;
  logger?: Logger;
  notifications?: FakeNotificationGateway;
}

export interface App extends CoreServices {
  db: InMemoryDb;
  notifications: FakeNotificationGateway;
  calendarGateway: FakeCalendarGateway;
  tokenStore: InMemoryTokenStore;
  authGateway: FakeAuthGateway;
}

/**
 * 인메모리/Fake 어댑터로 조립한다 — 테스트·`npm run demo` 진입점.
 * RN 앱은 `assembleServices` 에 네이티브 어댑터를 주입한다(logic §16.1).
 */
export function buildApp(options: AppOptions = {}): App {
  const clock = options.clock ?? new SystemClock();
  const logger = options.logger ?? new ArrayLogger();
  const notifications: FakeNotificationGateway =
    options.notifications ?? new FakeNotificationGateway('granted');
  const calendarGateway = new FakeCalendarGateway('granted');
  const tokenStore = new InMemoryTokenStore();
  const authGateway = new FakeAuthGateway();

  const db = new InMemoryDb();
  seedDefaults(db, clock.now());

  const repositories: CoreRepositories = {
    schedules: new InMemoryScheduleRepository(db),
    reminders: new InMemoryReminderRepository(db),
    categories: new InMemoryCategoryRepository(db),
    settings: new InMemorySettingRepository(db),
    account: new InMemoryAccountRepository(db),
    calendarLinks: new InMemoryCalendarLinkRepository(db),
  };

  const services = assembleServices({
    clock,
    logger,
    uow: db,
    repositories,
    notifications: notifications as NotificationGateway,
    calendar: calendarGateway,
    auth: authGateway,
    tokenStore,
    calendarIds: ['cal-1'],
  });

  return {
    ...services,
    db,
    notifications,
    calendarGateway,
    tokenStore,
    authGateway,
  };
}
