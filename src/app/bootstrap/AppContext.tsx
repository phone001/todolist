/**
 * 조립된 CoreServices 를 React 트리에 제공한다. (네이티브 바인딩 — react 의존)
 * 설계 근거: document/architect/overview.md v1.1 "클라이언트 셸 아키텍처".
 *
 * v1.23(F-27): `RemotePushService` 는 `src/core` 가 아니라 `src/app` 계층 서비스이므로(Architect
 * 설계 지시 — 기존 `CoreServices`/`CorePorts`(core/app.ts) 는 수정하지 않는다) `CoreServices` 를
 * 확장한 `AppServices` 로 함께 제공한다. 기존 화면들의 `useServices()` 구조분해는 `AppServices`가
 * `CoreServices` 의 상위집합이라 변경 없이 그대로 동작한다.
 */
import React, { createContext, useContext } from 'react';
import type { CoreServices } from '../../core/app.ts';
import type { RemotePushService } from '../services/remotePushService.ts';

export interface AppServices extends CoreServices {
  /** F-27(v1.23) — 원격 푸시 등록·토픽 구독/해지·전역 토글 연동. */
  remotePush: RemotePushService;
}

const ServicesContext = createContext<AppServices | null>(null);

export function ServicesProvider(props: { services: AppServices; children: React.ReactNode }) {
  return <ServicesContext.Provider value={props.services}>{props.children}</ServicesContext.Provider>;
}

export function useServices(): AppServices {
  const ctx = useContext(ServicesContext);
  if (!ctx) throw new Error('useServices must be used within ServicesProvider');
  return ctx;
}
