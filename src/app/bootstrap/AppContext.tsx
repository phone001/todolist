/**
 * 조립된 CoreServices 를 React 트리에 제공한다. (네이티브 바인딩 — react 의존)
 * 설계 근거: document/architect/overview.md v1.1 "클라이언트 셸 아키텍처".
 */
import React, { createContext, useContext } from 'react';
import type { CoreServices } from '../../core/app.ts';

const ServicesContext = createContext<CoreServices | null>(null);

export function ServicesProvider(props: { services: CoreServices; children: React.ReactNode }) {
  return <ServicesContext.Provider value={props.services}>{props.children}</ServicesContext.Provider>;
}

export function useServices(): CoreServices {
  const ctx = useContext(ServicesContext);
  if (!ctx) throw new Error('useServices must be used within ServicesProvider');
  return ctx;
}
