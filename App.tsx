/**
 * 앱 루트 — 부트스트랩 시퀀스 실행 후 네비게이터 또는 안전 모드 렌더.
 * 설계 근거: document/architect/logic.md v1.1 §16.4, overview.md v1.1 "앱 라이프사이클 → 부트스트랩".
 * 부트스트랩 대기 표시: 브랜드 로딩 인디케이터(fullscreen) — F-17, logic §16.9.8 #1 (네이티브 스플래시 종료 후,
 *   스플래시 미연장). 하드 실패는 SafeModeScreen 경로 유지 → onRetry 미지정.
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

export default function App() {
  const [result, setResult] = useState<BootstrapResult | null>(null);
  const lastSyncRef = useRef<number | null>(null);
  const steps = useMemo(() => createBootstrapSteps(NATIVE_CONFIG), []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const r = await bootstrap(steps);
      if (cancelled) return;
      setResult(r);
      if (r.ok) {
        await runPostRender(r.services, createPostRenderSteps());
        lastSyncRef.current = Date.now();
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
      const now = Date.now();
      if (lastSyncRef.current !== null && now - lastSyncRef.current < 30_000) return;
      lastSyncRef.current = now;
      void result.services.scheduler.sync();
    });
    return () => sub.remove();
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
