/**
 * 앱 부트스트랩 오케스트레이터 (순수 함수, 플랫폼 비의존).
 * 설계 근거: document/architect/logic.md §12 (부트스트랩 흐름), v1.1 §16.4 (RN 라이프사이클 매핑),
 *           overview.md v1.1 "앱 라이프사이클 → 부트스트랩". NFR-06, AC-24, E-15-1, P-09.
 *
 * 이 파일은 op-sqlite / notifee / react 를 import 하지 않는다.
 * 네이티브 단계(DB open, migrate, 테마 적용, 알림 sync)를 함수로 주입받아 순서만 강제한다.
 * → node:test 로 성공/마이그레이션 실패/알림 sync 격리를 검증(V-20).
 */
import type { CorePorts, CoreServices } from '../../core/app.ts';
import type { MigrationRunResult } from '../../core/migration/runner.ts';

export type BootPhase =
  | 'db-open'
  | 'migrate'
  | 'assemble'
  | 'load-settings'
  | 'ready' // 첫 화면 렌더 가능
  | 'post-render' // sync / token refresh (렌더 이후 비동기)
  | 'safe-mode'; // 마이그레이션 실패 → 읽기 전용

export interface BootstrapSteps {
  /** SQLite 파일 open + PRAGMA(foreign_keys/WAL) (+ 선택 암호화 키). CorePorts 를 만들 준비를 한다. */
  openDatabase(): Promise<CorePorts>;
  /** PRAGMA user_version 기반 순차 마이그레이션. */
  runMigrations(ports: CorePorts): Promise<MigrationRunResult>;
  /** CorePorts → 서비스 조립 (core assembleServices 위임). */
  assemble(ports: CorePorts): CoreServices;
  /** APP_SETTING 로드 후 ThemeStore 초기화. */
  loadSettings(services: CoreServices): Promise<void>;
}

export interface PostRenderSteps {
  /** 전체 알림 재예약 (P-09, AC-08). 실패는 격리(부트스트랩 결과에 영향 없음). */
  syncReminders(services: CoreServices): Promise<void>;
  /** 연동 상태면 액세스 토큰 갱신. 실패해도 로컬 모드로 계속(E-12-2). */
  ensureFreshToken(services: CoreServices): Promise<void>;
}

export interface BootstrapSuccess {
  ok: true;
  phase: 'ready';
  services: CoreServices;
  migration: MigrationRunResult;
  /** phase 진행 로그 (테스트/관측용). */
  trace: BootPhase[];
}

export interface BootstrapSafeMode {
  ok: false;
  phase: 'safe-mode';
  /** 실패한 마이그레이션 버전 등. */
  migration: MigrationRunResult;
  errorCode: 'STORAGE_MIGRATION_FAILED';
  trace: BootPhase[];
}

export type BootstrapResult = BootstrapSuccess | BootstrapSafeMode;

/**
 * 부트스트랩 1~4단계를 순서대로 수행한다.
 * 마이그레이션이 `failedAt` 을 반환하면 서비스를 조립하지 않고 안전 모드 결과를 돌려준다(E-15-1).
 * 반환된 services 로 첫 화면을 렌더한 뒤 `runPostRender()` 를 호출한다.
 */
export async function bootstrap(steps: BootstrapSteps): Promise<BootstrapResult> {
  const trace: BootPhase[] = [];

  const safeMode = (migration: MigrationRunResult): BootstrapSafeMode => {
    trace.push('safe-mode');
    return { ok: false, phase: 'safe-mode', migration, errorCode: 'STORAGE_MIGRATION_FAILED', trace };
  };

  try {
    trace.push('db-open');
    const ports = await steps.openDatabase();

    trace.push('migrate');
    const migration = await steps.runMigrations(ports);
    if (migration.failedAt !== undefined) {
      return safeMode(migration);
    }

    trace.push('assemble');
    const services = steps.assemble(ports);

    trace.push('load-settings');
    await steps.loadSettings(services);

    trace.push('ready');
    return { ok: true, phase: 'ready', services, migration, trace };
  } catch (err) {
    // db-open / user_version 조회 / assemble / load-settings 단계의 예외를 안전 모드로 수렴한다
    // (E-15-1: 미처리 거부로 첫 화면이 멈추지 않도록). 실패 지점은 trace 마지막 항목으로 관측한다.
    const lastPhase = trace[trace.length - 1] ?? 'db-open';
    return safeMode({
      fromVersion: 0,
      toVersion: 0,
      applied: [],
      failedAt: -1,
      error: `bootstrap ${lastPhase}: ${err instanceof Error ? err.message : String(err)}`,
    });
  }
}

/**
 * 첫 화면 렌더 이후 실행. 각 단계는 독립적으로 격리되어 하나가 실패해도 나머지는 진행한다.
 * 반환값은 관측용 요약이며 UI 흐름을 막지 않는다.
 */
export async function runPostRender(
  services: CoreServices,
  steps: PostRenderSteps,
): Promise<{ reminderSync: 'ok' | 'failed'; tokenRefresh: 'ok' | 'failed' | 'skipped' }> {
  let reminderSync: 'ok' | 'failed' = 'ok';
  try {
    await steps.syncReminders(services);
  } catch {
    reminderSync = 'failed';
  }

  let tokenRefresh: 'ok' | 'failed' | 'skipped' = 'ok';
  try {
    await steps.ensureFreshToken(services);
  } catch {
    tokenRefresh = 'failed';
  }

  return { reminderSync, tokenRefresh };
}

/** AppState 'active' 복귀 시 최소 간격(ms). 이보다 잦은 재-sync 는 건너뛴다(logic §16.4). */
export const RESUME_SYNC_THROTTLE_MS = 30_000;

/** 마지막 sync 시각과 현재 시각으로 재-sync 여부 결정 (순수). */
export function shouldResumeSync(lastSyncAt: number | null, now: number): boolean {
  if (lastSyncAt === null) return true;
  return now - lastSyncAt >= RESUME_SYNC_THROTTLE_MS;
}
