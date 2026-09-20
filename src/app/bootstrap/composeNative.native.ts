/**
 * RN용 Composition Root (네이티브 바인딩).
 * 설계 근거: document/architect/overview.md v1.1 "조립 지점 리팩터", logic.md v1.1 §16.1/§16.4,
 *           v1.9 워치 배선 (overview §"전체 구조", logic §17.2), v1.9 F-24 반복 회차 실체화(logic §18.3),
 *           v1.23 원격 푸시(F-27, logic §16.4/§16.5/§19).
 * 환경 제약: 네이티브 어댑터 import → 파이프라인 미실행(정적 리뷰). 온디바이스 검증.
 *
 * bootstrapSequence 의 BootstrapSteps 구현을 제공한다.
 */
import { Platform } from 'react-native';
import notifee, { AndroidImportance } from '@notifee/react-native';
import { runMigrations } from '../../core/migration/runner.ts';
import { assembleServices, type CorePorts, type CoreServices } from '../../core/app.ts';
import { SystemClock } from '../../core/domain/clock.ts';
import type { RemotePushGateway } from '../../core/ports/gateways.ts';
import type { BootstrapSteps, PostRenderSteps } from './bootstrapSequence.ts';
import { OpSqliteDb } from '../adapters/sqlite/OpSqliteDb.native.ts';
import { createSqliteRepositories } from '../adapters/sqlite/SqliteRepositories.native.ts';
import { MIGRATIONS } from '../adapters/sqlite/migrations.ts';
import { NotifeeNotificationGateway } from '../adapters/notifications/NotifeeNotificationGateway.native.ts';
import { RNCalendarEventsGateway } from '../adapters/calendar/RNCalendarEventsGateway.native.ts';
import { AppAuthGateway, type AppAuthGatewayConfig } from '../adapters/auth/AppAuthGateway.native.ts';
import { KeychainTokenStore, loadOrCreateDbKey } from '../adapters/secure/KeychainTokenStore.native.ts';
import { MaskingLogger, type LogRecord } from '../adapters/logging/maskingLogger.ts';
import { WatchConnectivityGateway } from '../adapters/watch/WatchConnectivityGateway.native.ts';
import { FirebaseRemotePushGateway } from '../adapters/push/FirebaseRemotePushGateway.native.ts';
import { NoopRemotePushGateway } from '../adapters/push/NoopRemotePushGateway.ts';
import { RemotePushService } from '../services/remotePushService.ts';

export interface NativeConfig {
  dbName?: string;
  /** true 면 SQLCipher 로 암호화 DB 를 연다(D-03). */
  encryptDb?: boolean;
  auth: AppAuthGatewayConfig;
  calendarIds?: string[];
  logSink?: (r: LogRecord) => void;
  minLogLevel?: 'debug' | 'info' | 'warn' | 'error';
}

/** F-27(v1.23) — 기존 `schedule-reminders`(F-08/F-09) 채널과 별개인 신규 채널 1개(§16.4/§16.5). */
export const REMOTE_PUSH_CHANNEL_ID = 'remote-push';

/**
 * 부트스트랩(`openDatabase()`)에서 만든 `RemotePushGateway`/`RemotePushService` 를 이후 단계
 * (`createPostRenderSteps()`)와 App.tsx 배선(`wireRemotePushListeners`/`getRemotePushService`)이
 * 공유하기 위한 모듈 스코프 바인딩. `RemotePushService` 는 `CoreServices` 밖(app 계층) 서비스라
 * `assemble()` 반환값에 실을 수 없어 이 방식으로 전달한다(overview v1.23 영향 범위 참고).
 */
let remotePushBinding: { gateway: RemotePushGateway; service: RemotePushService } | null = null;
let remotePushChannelReady = false;

export function createBootstrapSteps(cfg: NativeConfig): BootstrapSteps {
  let db: OpSqliteDb | null = null;

  return {
    async openDatabase(): Promise<CorePorts> {
      const encryptionKey = cfg.encryptDb ? await loadOrCreateDbKey() : null;
      db = await OpSqliteDb.openDatabase({ name: cfg.dbName ?? 'todaywhat.db', encryptionKey });
      const repositories = createSqliteRepositories(db.db);
      const clock = new SystemClock();
      const logger = new MaskingLogger(cfg.logSink ?? (() => {}), { minLevel: cfg.minLogLevel ?? 'warn' });
      const notifications = new NotifeeNotificationGateway();

      // F-27(v1.23): iOS 는 FCM 어댑터, Android 는 no-op(P-74) — WatchConnectivityGateway 와 동일 패턴.
      const remotePushGateway: RemotePushGateway =
        Platform.OS === 'ios' ? new FirebaseRemotePushGateway(logger) : new NoopRemotePushGateway();
      const remotePushService = new RemotePushService({
        clock,
        settings: repositories.settings,
        notifications,
        gateway: remotePushGateway,
        logger,
      });
      remotePushBinding = { gateway: remotePushGateway, service: remotePushService };

      return {
        clock,
        logger,
        uow: db,
        repositories,
        notifications,
        calendar: new RNCalendarEventsGateway(),
        auth: new AppAuthGateway(cfg.auth),
        tokenStore: new KeychainTokenStore(),
        calendarIds: cfg.calendarIds ?? [],
        // F-19: iOS 는 WatchConnectivity 어댑터, Android 는 isSupported()=false 로 전 경로 no-op (§17.2).
        watchSync: new WatchConnectivityGateway(logger),
      };
    },

    async runMigrations(ports: CorePorts) {
      // ports.uow 는 OpSqliteDb 이며 MigrationDb 도 구현한다.
      return runMigrations(ports.uow as unknown as Parameters<typeof runMigrations>[0], [...MIGRATIONS]);
    },

    assemble(ports: CorePorts): CoreServices {
      const services = assembleServices(ports);
      // F-19(WATCH-10): 워치의 "스냅샷 주세요"(requestSnapshot, 수동 새로고침) 수신 시 최신 스냅샷을
      // 다시 빌드·전송하도록 어댑터에 배선한다. 포트 계약 무변경 — 구체 어댑터의 배선 지점.
      if (ports.watchSync instanceof WatchConnectivityGateway) {
        ports.watchSync.setSnapshotRequestHandler(() => {
          void services.watchSync.pushSnapshot();
        });
      }
      return services;
    },

    async loadSettings(services: CoreServices): Promise<void> {
      // ThemeStore 초기화는 UI 계층(AppContext)에서 수행. 여기서는 설정 저장소 접근이
      // 정상 동작하는지 확인(마이그레이션 직후 첫 읽기). SettingService 에 getAll 은 없다.
      await services.settings.getTheme();
    },
  };
}

export function createPostRenderSteps(): PostRenderSteps {
  return {
    async syncReminders(services) {
      await services.scheduler.sync();
      // F-24(v1.9, logic §18.3): 알림 재조정 직후 반복 회차를 horizon 내로 실체화(콜드 스타트/재부팅).
      // 실패는 이 단계 자체가 이미 runPostRender 에서 격리되므로 별도 try/catch 불필요.
      await services.recurrenceScheduler.sync();
    },
    async ensureFreshToken(services) {
      const account = await services.auth.getStatus();
      if (account.state !== 'NONE') {
        await services.auth.ensureFreshToken();
      }
    },
  };
}

/**
 * F-27(v1.23) — `openDatabase()` 가 만든 `RemotePushService` 를 셸(App.tsx/화면)에 노출한다.
 * `bootstrap()` 이 성공한 뒤(= `openDatabase()` 완료 후)에만 호출한다.
 */
export function getRemotePushService(): RemotePushService {
  if (!remotePushBinding) {
    throw new Error('getRemotePushService() called before bootstrap openDatabase() completed');
  }
  return remotePushBinding.service;
}

async function ensureRemotePushChannel(): Promise<void> {
  if (remotePushChannelReady) return;
  await notifee.createChannel({ id: REMOTE_PUSH_CHANNEL_ID, name: '원격 알림', importance: AndroidImportance.HIGH });
  remotePushChannelReady = true;
}

/**
 * F-27(v1.23, §19.3/§19.4) — `onTokenRefresh`/`onMessage` 리스너를 부트스트랩 완료 후 1회 등록한다.
 * 포그라운드 수신 시 실제 OS 알림 표시(`notifee.displayNotification`)는 여기(네이티브 배선)에서
 * 수행하고, "표시해야 하는가/무엇을 표시하는가" 판단은 `RemotePushService`(순수, 테스트 가능)에 위임한다.
 * Android(미지원)는 게이트웨이 내부에서 조용히 no-op(P-74) — 아래 콜백 자체가 등록되지 않는다.
 */
export function wireRemotePushListeners(): void {
  if (!remotePushBinding) return;
  const { gateway, service } = remotePushBinding;

  gateway.onTokenRefresh((token) => {
    void service.handleTokenRefresh(token);
  });

  gateway.onMessage((message) => {
    void service.handleForegroundMessage(message).then(async (decision) => {
      if (!decision) return; // E-27-6 — 전역 알림 토글 off, 표시하지 않음
      await ensureRemotePushChannel();
      await notifee.displayNotification({
        title: decision.title,
        body: decision.body,
        android: { channelId: REMOTE_PUSH_CHANNEL_ID },
        ios: { sound: 'default' },
      });
    });
  });
}
