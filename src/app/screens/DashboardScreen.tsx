/**
 * 오늘 — 금일 일정 리스트 + 상단 개수 요약(전체·완료) (F-10, AC-04/15/16).
 * 각 항목: 체크박스 + 제목. 왼쪽 스와이프 → 수정 / 삭제 (SwipeableRow).
 * 헤더 우측「+」→ ScheduleEditor 신규 작성 진입 (F-01, logic §16.2).
 * 빈 상태「일정 추가」→ 동일 진입 (AC-15, E-10-1).
 * 최초 집계 로딩 중에는 브랜드 로딩 인디케이터(인라인) 노출 (F-17, logic §16.9.8 #2).
 * 바인딩: ScheduleService.findInRange / toggleDone / softDelete → list·dashboard·search 무효화.
 * 환경 제약: react / react-native 의존 → 파이프라인 미실행(정적 리뷰).
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  AppState,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useServices } from '../bootstrap/AppContext.tsx';
import { useShellStore } from '../state/stores.native.ts';
import { STACK_ROUTES, type RootStackParamList } from '../navigation/routes.ts';
import type { Schedule } from '../../core/domain/types.ts';
import { SwipeableRow } from './SwipeableRow.tsx';
import { BrandLoadingIndicator } from '../components/BrandLoadingIndicator.tsx';

type DashboardNavProp = NativeStackNavigationProp<RootStackParamList>;

/** 기기 로컬 기준 오늘 [자정, 다음날 자정) epoch ms. */
function todayRange(): { start: number; end: number } {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const start = d.getTime();
  return { start, end: start + 86_400_000 };
}

function hhmm(ts: number): string {
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function DashboardScreen() {
  const { schedules } = useServices();
  const setDashboard = useShellStore((s) => s.setDashboard);
  const invalidate = useShellStore((s) => s.invalidate);
  const clearStale = useShellStore((s) => s.clearStale);
  const navigation = useNavigation<DashboardNavProp>();

  const [items, setItems] = useState<Schedule[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  // F-17: 최초 집계 로딩 상태(인라인 인디케이터 소스). 새로고침(RefreshControl)에는 사용하지 않는다.
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const load = useCallback(async () => {
    try {
      const { start, end } = todayRange();
      const page = await schedules.findInRange(start, end, undefined, 'startAt', 200, null);
      setItems(page.items);
      setLoaded(true);
      setLoadError(false);
      const total = page.items.length;
      const done = page.items.filter((s) => s.isDone).length;
      const now = Date.now();
      setDashboard({
        total,
        done,
        notDone: total - done,
        completionRate: total === 0 ? 0 : Math.round((done / total) * 100),
        nextScheduleId: page.items.find((s) => !s.isDone && s.startAt >= now)?.id ?? null,
        empty: total === 0,
      });
    } catch {
      // 로드 실패 → 마지막 캐시 유지 + 에러/재시도 UI (E-02-2, E-17-7)
      setLoadError(true);
    } finally {
      setInitialLoading(false);
    }
  }, [schedules, setDashboard]);

  const retry = useCallback(() => {
    setInitialLoading(true);
    setLoadError(false);
    void load();
  }, [load]);

  useEffect(() => {
    void load();
    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'active') void load(); // 자정 경과 반영(AC-16)
    });
    return () => sub.remove();
  }, [load]);

  // 다른 화면(추가/수정·완료 토글·삭제)이 무효화하면 포커스 복귀 시 재조회 (logic §16.3:506).
  useFocusEffect(
    useCallback(() => {
      const st = useShellStore.getState().stale;
      if (st.list || st.dashboard) {
        clearStale('list');
        clearStale('dashboard');
        void load();
      }
    }, [load, clearStale]),
  );

  const total = items.length;
  const done = items.filter((s) => s.isDone).length;

  const toggle = async (s: Schedule) => {
    try {
      await schedules.toggleDone(s.id, !s.isDone);
      setItems((prev) => prev.map((x) => (x.id === s.id ? { ...x, isDone: !x.isDone } : x)));
      invalidate('list', 'dashboard');
    } catch {
      // 실패 시 상태 유지, 사용자에게 토스트 (E-05-2)
    }
  };

  const confirmDelete = (s: Schedule) => {
    Alert.alert('일정 삭제', `"${s.title}" 을(를) 삭제할까요?`, [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: async () => {
          try {
            await schedules.softDelete(s.id);
            setItems((prev) => prev.filter((x) => x.id !== s.id));
            invalidate('list', 'dashboard', 'search');
            void load();
          } catch {
            Alert.alert('삭제 실패', '잠시 후 다시 시도해 주세요.');
          }
        },
      },
    ]);
  };

  return (
    <View style={{ flex: 1 }}>
      <View
        style={{
          paddingHorizontal: 16,
          paddingVertical: 12,
          borderBottomWidth: 1,
          borderBottomColor: '#eee',
        }}
      >
        <Text style={{ fontSize: 15, fontWeight: '600' }}>
          오늘 일정 {total}개 · 완료 {done}개
        </Text>
      </View>

      <View style={{ flex: 1 }}>
        <FlatList
          style={{ flex: 1 }}
          contentContainerStyle={{ flexGrow: 1, paddingBottom: 96 }}
          data={items}
          keyExtractor={(s) => String(s.id)}
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
          renderItem={({ item }) => (
            <SwipeableRow
              onEdit={() =>
                navigation.navigate(STACK_ROUTES.ScheduleEditor, { scheduleId: item.id })
              }
              onDelete={() => confirmDelete(item)}
            >
              <Pressable
                onPress={() =>
                  navigation.navigate(STACK_ROUTES.ScheduleDetail, { scheduleId: item.id })
                }
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  paddingHorizontal: 16,
                  paddingVertical: 14,
                  borderBottomWidth: 1,
                  borderBottomColor: '#f0f0f0',
                  backgroundColor: '#fff',
                }}
              >
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: item.isDone }}
                  hitSlop={8}
                  onPress={() => void toggle(item)}
                >
                  <Text style={{ fontSize: 20 }}>{item.isDone ? '☑' : '☐'}</Text>
                </Pressable>
                <Text style={{ width: 44, fontSize: 12, color: '#888' }}>{hhmm(item.startAt)}</Text>
                <Text
                  numberOfLines={1}
                  style={{
                    flex: 1,
                    fontSize: 15,
                    textDecorationLine: item.isDone ? 'line-through' : 'none',
                    color: item.isDone ? '#999' : '#111',
                  }}
                >
                  {item.title}
                </Text>
              </Pressable>
            </SwipeableRow>
          )}
          ListEmptyComponent={
            initialLoading || loadError ? null : loaded ? (
              <View style={styles.centerBox}>
                <Text style={{ fontSize: 15, color: '#888', textAlign: 'center' }}>
                  오늘 일정이 없습니다
                </Text>
              </View>
            ) : null
          }
        />

        {/* F-17 인라인 인디케이터 — 콘텐츠(리스트) 영역만 대체. 헤더·FAB 는 유지 (§16.9.8 #2). 화면당 1개(E-17-8). */}
        {initialLoading || loadError ? (
          <View style={styles.overlay} pointerEvents={loadError ? 'auto' : 'none'}>
            <BrandLoadingIndicator
              variant="inline"
              loading={initialLoading}
              endReason={loadError ? 'error' : 'success'}
              onRetry={retry}
              testID="dashboard-loading"
            />
            {loadError ? (
              <Pressable onPress={retry} accessibilityRole="button" style={{ marginTop: 4 }}>
                <Text style={{ color: '#007AFF', fontWeight: '600' }}>
                  일정을 불러오지 못했어요 · 다시 시도
                </Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </View>

      {/* 일정 추가 FAB — 원형, 우측 하단 (AC-15, E-10-1) */}
      <Pressable
        onPress={() => navigation.navigate(STACK_ROUTES.ScheduleEditor, {})}
        accessibilityLabel="일정 추가"
        style={{
          position: 'absolute',
          right: 20,
          bottom: 24,
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: '#007AFF',
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: '#000',
          shadowOpacity: 0.25,
          shadowRadius: 4,
          shadowOffset: { width: 0, height: 2 },
          elevation: 4,
        }}
      >
        <Text style={{ color: '#fff', fontSize: 30, lineHeight: 32, marginTop: -2 }}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  centerBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  overlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
