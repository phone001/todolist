/**
 * RN용 Composition Root (네이티브 바인딩).
 * 설계 근거: document/architect/overview.md v1.1 "조립 지점 리팩터", logic.md v1.1 §16.1/§16.4,
 *           v1.9 워치 배선 (overview §"전체 구조", logic §17.2).
 * 환경 제약: 네이티브 어댑터 import → 파이프라인 미실행(정적 리뷰). 온디바이스 검증.
 *
 * bootstrapSequence 의 BootstrapSteps 구현을 제공한다.
 */
import { runMigrations } from '../../core/migration/runner.ts';
import { assembleServices, type CorePorts, type CoreServices } from '../../core/app.ts';
import { SystemClock } from '../../core/domain/clock.ts';
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

export interface NativeConfig {
  dbName?: string;
  /** true 면 SQLCipher 로 암호화 DB 를 연다(D-03). */
  encryptDb?: boolean;
  auth: AppAuthGatewayConfig;
  calendarIds?: string[];
  logSink?: (r: LogRecord) => void;
  minLogLevel?: 'debug' | 'info' | 'warn' | 'error';
}

export function createBootstrapSteps(cfg: NativeConfig): BootstrapSteps {
  let db: OpSqliteDb | null = null;

  return {
    async openDatabase(): Promise<CorePorts> {
      const encryptionKey = cfg.encryptDb ? await loadOrCreateDbKey() : null;
      db = await OpSqliteDb.openDatabase({ name: cfg.dbName ?? 'todaywhat.db', encryptionKey });
      const repositories = createSqliteRepositories(db.db);
      const logger = new MaskingLogger(cfg.logSink ?? (() => {}), { minLevel: cfg.minLogLevel ?? 'warn' });
      return {
        clock: new SystemClock(),
        logger,
        uow: db,
        repositories,
        notifications: new NotifeeNotificationGateway(),
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
    },
    async ensureFreshToken(services) {
      const account = await services.auth.getStatus();
      if (account.state !== 'NONE') {
        await services.auth.ensureFreshToken();
      }
    },
  };
}
