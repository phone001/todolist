/**
 * 앱 루트 — 부트스트랩 시퀀스 실행 후 네비게이터 또는 안전 모드 렌더.
 * 설계 근거: document/architect/logic.md v1.1 §16.4, overview.md v1.1 "앱 라이프사이클 → 부트스트랩".
 * 부트스트랩 대기 표시: 브랜드 로딩 인디케이터(fullscreen) — F-17, logic §16.9.8 #1 (네이티브 스플래시 종료 후,
 *   스플래시 미연장). 하드 실패는 SafeModeScreen 경로 유지 → onRetry 미지정.
 * 워치 동기화 배선(F-19, logic §17.2 / overview v1.9): 렌더 후 `watchSync.activate()` (게이트 활성 +
 *   완료 토글 수신 콜백 등록은 서비스 내부에서 수행) → 초기 스냅샷 1회 push. 이후 `dashboard` 스토어
 *   무효화(= 폰 데이터 변경) 시점과 `AppState 'active'` 전이 시 500ms 디바운스로 `pushSnapshot()`.
 *   미지원 플랫폼(Android)에서는 서비스/어댑터가 조용히 no-op.
 * 반복 회차 실체화 배선(F-24, logic §18.3 / nfr §17.1·§17.3): `RecurrenceScheduler.sync()`는
 *   `ReminderScheduler.sync()`와 동일 지점(콜드 스타트 / `AppState 'active'` / 생성 직후 / 부팅 완료)에
 *   병행 호출한다. 콜드 스타트는 `composeNative.native.ts`의 `createPostRenderSteps().syncReminders`
 *   내부에서, 생성 직후는 `ScheduleService.create()` 내부에서 이미 호출한다 — 아래 `AppState 'active'`
 *   핸들러에서만 이 파일이 배선을 담당한다(RECUR-01 수정).
 * 콜드 스타트 초기렌더 경합 해소(RECUR-01 후속): 부트스트랩 `useEffect`는 `setResult(r)`로 화면을 먼저
 *   마운트한 뒤 `runPostRender`(reminderScheduler.sync + recurrenceScheduler.sync 포함)를 비동기로
 *   기다리므로, 그 사이 실체화된 "오늘" 회차를 최초 마운트된 화면이 놓칠 수 있다. `runPostRender` 완료
 *   직후 `list`/`dashboard` 스토어를 무효화해 이미 마운트된 화면이 이를 감지하고 재조회하도록 신호를
 *   보낸다(포커스 유지 중인 화면의 실시간 감지는 각 화면의 라이브 구독이 담당 — 예: DashboardScreen).
 * 환경 제약: react / react-native / 네이티브 어댑터 의존 → 파이프라인 미실행(정적 리뷰).
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { bootstrap, runPostRender, type BootstrapResult } from './src/app/bootstrap/bootstrapSequence.ts';
import {
  createBootstrapSteps,
  createPostRenderSteps,
  type NativeConfig,
} from './src/app/bootstrap/composeNative.native.ts';
import { ServicesProvider } from './src/app/bootstrap/AppContext.tsx';
import { RootNavigator } from './src/app/navigation/RootNavigator.tsx';
import { SafeModeScreen } from './src/app/screens/SafeModeScreen.tsx';
import { BrandLoadingIndicator } from './src/app/components/BrandLoadingIndicator.tsx';
import { useShellStore } from './src/app/state/stores.native.ts';
import type { CoreServices } from './src/core/app.ts';
import appConfig from './app.json';

// 운영값(issuer/clientId/redirectUrl)은 빌드 환경에서 주입한다. 아래는 자리표시자.
const NATIVE_CONFIG: NativeConfig = {
  dbName: 'todaywhat.db',
  // D-03(DB 암호화 기본 활성) 미결정 + 현재 op-sqlite Pod 이 vanilla SQLite(SQLCipher 미컴파일)라
  // encryptionKey 는 무시된다. 실제 암호화는 D-03 확정 시 (1) package.json "op-sqlite": {"sqlcipher": true}
  // + pod 재설치, (2) CSPRNG 소스 확보 후 활성화한다. 그 전까지는 false(미암호화 상태를 정직하게 반영).
  encryptDb: false,
  auth: {
    issuer: process.env.OAUTH_ISSUER ?? 'https://idp.example.com',
    clientId: process.env.OAUTH_CLIENT_ID ?? 'todaywhat-app',
    redirectUrl: `${String(appConfig.name).toLowerCase()}://oauthredirect`,
    scopes: ['openid', 'profile'],
  },
  calendarIds: [],
  minLogLevel: __DEV__ ? 'debug' : 'warn',
};

/** 폰 데이터 변경 후 워치 스냅샷 push 디바운스(ms) — logic §17.2. */
const WATCH_PUSH_DEBOUNCE_MS = 500;

export default function App() {
  const [result, setResult] = useState<BootstrapResult | null>(null);
  const lastSyncRef = useRef<number | null>(null);
  const watchPushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const steps = useMemo(() => createBootstrapSteps(NATIVE_CONFIG), []);

  /** 워치 스냅샷 push 를 디바운스로 예약한다(§17.2). Android/미지원은 서비스에서 no-op. */
  const scheduleWatchPush = (services: CoreServices): void => {
    if (watchPushTimerRef.current !== null) clearTimeout(watchPushTimerRef.current);
    watchPushTimerRef.current = setTimeout(() => {
      watchPushTimerRef.current = null;
      void services.watchSync.pushSnapshot();
    }, WATCH_PUSH_DEBOUNCE_MS);
  };

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const r = await bootstrap(steps);
      if (cancelled) return;
      setResult(r);
      if (r.ok) {
        await runPostRender(r.services, createPostRenderSteps());
        lastSyncRef.current = Date.now();
        // RECUR-01 후속: reminderScheduler.sync + recurrenceScheduler.sync(runPostRender 내부)가
        // 모두 끝난 시점에 무효화 신호를 보내 콜드 스타트 중 이미 마운트된 화면(Dashboard 등)이
        // 새로 실체화된 데이터를 놓치지 않도록 한다.
        useShellStore.getState().invalidate('list', 'dashboard');
        // F-19: 워치 게이트 활성화(수신 콜백 등록 포함) 후 최신 스냅샷 1회 전송(§17.2).
        await r.services.watchSync.activate();
        void r.services.watchSync.pushSnapshot();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [steps]);

  useEffect(() => {
    if (!result?.ok) return;
    const sub = AppState.addEventListener('change', (st) => {
      if (st !== 'active') return;
      // F-19: 포그라운드 복귀 시 워치 스냅샷 갱신(§17.2).
      scheduleWatchPush(result.services);
      const now = Date.now();
      if (lastSyncRef.current !== null && now - lastSyncRef.current < 30_000) return;
      lastSyncRef.current = now;
      void result.services.scheduler.sync();
      // F-24(RECUR-01 수정, logic §18.3 / nfr §17.1·§17.3): ReminderScheduler.sync() 와 동일 지점에서
      // RecurrenceScheduler.sync() 도 병행 호출 — 콜드 스타트/생성 직후 누락분을 보완한다.
      void result.services.recurrenceScheduler.sync();
    });
    return () => sub.remove();
  }, [result]);

  useEffect(() => {
    if (!result?.ok) return;
    // F-19: 폰 데이터 변경 → `dashboard` 스토어 무효화 지점에서 디바운스 push(§17.2).
    const unsubscribe = useShellStore.subscribe((state, prev) => {
      if (state.stale.dashboard && !prev.stale.dashboard) {
        scheduleWatchPush(result.services);
      }
    });
    return () => {
      unsubscribe();
      if (watchPushTimerRef.current !== null) {
        clearTimeout(watchPushTimerRef.current);
        watchPushTimerRef.current = null;
      }
    };
  }, [result]);

  if (!result) {
    return <BrandLoadingIndicator variant="fullscreen" loading />;
  }

  if (!result.ok) return <SafeModeScreen migration={result.migration} />;

  return (
    <ServicesProvider services={result.services}>
      <RootNavigator />
    </ServicesProvider>
  );
}
