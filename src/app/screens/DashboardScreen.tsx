/**
 * 대시보드 — 금일 완료/미완료 요약 (F-10, AC-04/15/16).
 * 헤더: 앱 로고·태그라인 렌더 (F-16, AC-25, logic v1.5 §16.3.2).
 * 바인딩: DashboardService.getSummary (state/bindings.ts).
 * 환경 제약: react / react-native 의존 → 파이프라인 미실행(정적 리뷰).
 */
import React, { useCallback, useEffect, useState } from 'react';
import { AppState, Image, RefreshControl, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { useServices } from '../bootstrap/AppContext.tsx';
import { useShellStore } from '../state/stores.native.ts';

// 에셋 경로 (logic v1.5 §16.3.2, P-21: 빌드 타임 번들 포함, 런타임 경로 주입 없음)
const LOGO_SOURCE = require('../../assets/icons/logo.png') as number;
const TAGLINE_SOURCE = require('../../assets/images/tagline.png') as number;

export function DashboardScreen() {
  const { dashboard } = useServices();
  const setDashboard = useShellStore((s) => s.setDashboard);
  const snap = useShellStore((s) => s.dashboard);
  const [refreshing, setRefreshing] = useState(false);

  // 에셋 로드 실패 상태 (E-16-1, AC-28: 폴백 텍스트 렌더)
  const [logoError, setLogoError] = useState(false);
  const [taglineError, setTaglineError] = useState(false);

  // 화면 폭 60% 이하 제한 (P-20, logic v1.5 §16.3.2)
  const { width: screenWidth } = useWindowDimensions();
  const imageWidth = screenWidth * 0.6;

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
      {/* 앱 아이덴티티 헤더: 로고 → 태그라인 (F-16, AC-25, logic v1.5 §16.3.2) */}
      <View style={{ alignItems: 'center', paddingTop: 16 }}>
        {logoError ? (
          <Text style={{ fontSize: 20, fontWeight: 'bold' }}>오늘뭐해</Text>
        ) : (
          <Image
            source={LOGO_SOURCE}
            style={{ width: imageWidth, resizeMode: 'contain' }}
            onError={() => setLogoError(true)}
          />
        )}
        {taglineError ? (
          <Text style={{ fontSize: 14, marginTop: 8 }}>하루를 계획하세요</Text>
        ) : (
          <Image
            source={TAGLINE_SOURCE}
            style={{ width: imageWidth, resizeMode: 'contain', marginTop: 8 }}
            onError={() => setTaglineError(true)}
          />
        )}
      </View>

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
