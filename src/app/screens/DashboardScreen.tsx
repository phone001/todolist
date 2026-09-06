/**
 * 대시보드 — 금일 완료/미완료 요약 (F-10, AC-04/15/16).
 * 바인딩: DashboardService.getSummary (state/bindings.ts).
 * 환경 제약: react / react-native 의존 → 파이프라인 미실행(정적 리뷰).
 */
import React, { useCallback, useEffect, useState } from 'react';
import { AppState, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useServices } from '../bootstrap/AppContext.tsx';
import { useShellStore } from '../state/stores.native.ts';

export function DashboardScreen() {
  const { dashboard } = useServices();
  const setDashboard = useShellStore((s) => s.setDashboard);
  const snap = useShellStore((s) => s.dashboard);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const s = await dashboard.getSummary();
    setDashboard({
      total: s.total,
      done: s.done,
      notDone: s.notDone,
      completionRate: s.completionRate,
      nextScheduleId: s.nextScheduleId ?? null,
      empty: s.total === 0,
    });
  }, [dashboard, setDashboard]);

  useEffect(() => {
    void load();
    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'active') void load(); // 자정 경과 반영(AC-16)
    });
    return () => sub.remove();
  }, [load]);

  return (
    <ScrollView
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true);
            await load();
            setRefreshing(false);
          }}
        />
      }
    >
      {!snap || snap.empty ? (
        <View style={{ padding: 24 }}>
          <Text>오늘 일정이 없습니다</Text>
        </View>
      ) : (
        <View style={{ padding: 24, gap: 8 }}>
          <Text>완료 {snap.done} / 전체 {snap.total}</Text>
          <Text>완료율 {snap.completionRate}%</Text>
          <Text>미완료 {snap.notDone}건</Text>
        </View>
      )}
    </ScrollView>
  );
}
