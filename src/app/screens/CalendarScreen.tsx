/**
 * 캘린더 — 금일 기준 월 달력. 연/월 이동 및 피커로 연도·월 검색 (F-02/05, AC-11/12).
 * 날짜 탭 → 그 날짜 일정 목록을 아래에 표시. 항목: 체크박스 + 제목(탭 → 상세).
 * 헤더 우측「+」→ ScheduleEditor 신규 작성 진입 (F-01, logic §16.2).
 * 월/기간 전환 로딩 중에는 브랜드 로딩 인디케이터(인라인) 를 그리드 영역에 오버레이 (F-17, logic §16.9.8 #3).
 *   월 헤더·이동 컨트롤·피커는 계속 조작 가능(오버레이 pointerEvents='none').
 * 바인딩: ScheduleService.findInRange / toggleDone → list·dashboard 무효화.
 * 환경 제약: react / react-native 의존 → 파이프라인 미실행(정적 리뷰).
 */
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useServices } from '../bootstrap/AppContext.tsx';
import { useShellStore } from '../state/stores.native.ts';
import { STACK_ROUTES, type RootStackParamList } from '../navigation/routes.ts';
import type { Schedule } from '../../core/domain/types.ts';
import { BrandLoadingIndicator } from '../components/BrandLoadingIndicator.tsx';

type CalendarNavProp = NativeStackNavigationProp<RootStackParamList>;

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

/** 로컬 (연,월0-11,일) → 일 단위 비교 키. */
function dayKey(y: number, m: number, d: number): number {
  return y * 10000 + m * 100 + d;
}
function dayKeyOfTs(ts: number): number {
  const d = new Date(ts);
  return dayKey(d.getFullYear(), d.getMonth(), d.getDate());
}

export function CalendarScreen() {
  const { schedules } = useServices();
  const invalidate = useShellStore((s) => s.invalidate);
  const clearStale = useShellStore((s) => s.clearStale);
  const navigation = useNavigation<CalendarNavProp>();

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return { y: d.getFullYear(), m: d.getMonth(), d: d.getDate() };
  }, []);
  const todayKey = dayKey(today.y, today.m, today.d);

  const [view, setView] = useState(() => ({ y: today.y, m: today.m }));
  const [selKey, setSelKey] = useState(todayKey);
  const [selLabel, setSelLabel] = useState({ m: today.m + 1, d: today.d });
  const [monthItems, setMonthItems] = useState<Schedule[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  // F-17: 월/기간 전환 로딩 상태(인라인 인디케이터 소스).
  const [loadingMonth, setLoadingMonth] = useState(true);
  const [monthError, setMonthError] = useState(false);

  // 헤더 우측「+」— ScheduleEditor 신규 작성 진입 (F-01, logic §16.2, §16.3)
  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable
          onPress={() => navigation.navigate(STACK_ROUTES.ScheduleEditor, {})}
          accessibilityLabel="일정 추가"
          style={{ paddingHorizontal: 12 }}
        >
          <Text style={{ fontSize: 24 }}>+</Text>
        </Pressable>
      ),
    });
  }, [navigation]);

  const load = useCallback(async () => {
    setLoadingMonth(true);
    setMonthError(false);
    try {
      const start = new Date(view.y, view.m, 1).getTime();
      const end = new Date(view.y, view.m + 1, 1).getTime();
      const page = await schedules.findInRange(start, end, undefined, 'startAt', 500, null);
      setMonthItems(page.items);
    } catch {
      // 로드 실패 → 마지막 캐시 유지 + 에러/재시도 (E-02-2, E-17-7)
      setMonthError(true);
    } finally {
      setLoadingMonth(false);
    }
  }, [schedules, view.y, view.m]);

  useEffect(() => {
    void load();
  }, [load]);

  // 다른 화면(일정 추가/수정·삭제)이 list 를 무효화하면 포커스 복귀 시 재조회 (logic §16.3).
  useFocusEffect(
    useCallback(() => {
      if (useShellStore.getState().stale.list) {
        clearStale('list');
        void load();
      }
    }, [load, clearStale]),
  );

  const daysWithItems = useMemo(() => {
    const set = new Set<number>();
    for (const s of monthItems) set.add(dayKeyOfTs(s.startAt));
    return set;
  }, [monthItems]);

  const selectedItems = useMemo(
    () =>
      monthItems
        .filter((s) => dayKeyOfTs(s.startAt) === selKey)
        .sort((a, b) => a.startAt - b.startAt),
    [monthItems, selKey],
  );

  const weeks = useMemo(() => {
    const firstWeekday = new Date(view.y, view.m, 1).getDay();
    const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
    const cells: Array<number | null> = [];
    for (let i = 0; i < firstWeekday; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);
    const rows: Array<Array<number | null>> = [];
    for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
    return rows;
  }, [view.y, view.m]);

  const shiftMonth = (delta: number) => {
    setView((v) => {
      const n = v.m + delta;
      return { y: v.y + Math.floor(n / 12), m: ((n % 12) + 12) % 12 };
    });
  };

  const pickDay = (d: number) => {
    setSelKey(dayKey(view.y, view.m, d));
    setSelLabel({ m: view.m + 1, d });
  };

  const goToday = () => {
    setView({ y: today.y, m: today.m });
    setSelKey(todayKey);
    setSelLabel({ m: today.m + 1, d: today.d });
    setPickerOpen(false);
  };

  const toggle = async (s: Schedule) => {
    try {
      await schedules.toggleDone(s.id, !s.isDone);
      setMonthItems((prev) => prev.map((x) => (x.id === s.id ? { ...x, isDone: !x.isDone } : x)));
      invalidate('list', 'dashboard');
    } catch {
      // 저장 실패 → 상태 유지 (E-05-2)
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1 }}>
        {/* 월 헤더 */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 16,
            paddingVertical: 12,
          }}
        >
          <Pressable onPress={() => shiftMonth(-1)} hitSlop={10} style={{ padding: 6 }}>
            <Text style={{ fontSize: 20 }}>◀</Text>
          </Pressable>
          <Pressable onPress={() => setPickerOpen(true)} accessibilityLabel="연도·월 선택">
            <Text style={{ fontSize: 18, fontWeight: '700' }}>
              {view.y}년 {view.m + 1}월
            </Text>
          </Pressable>
          <Pressable onPress={() => shiftMonth(1)} hitSlop={10} style={{ padding: 6 }}>
            <Text style={{ fontSize: 20 }}>▶</Text>
          </Pressable>
        </View>

        {/* 요일 */}
        <View style={{ flexDirection: 'row', paddingHorizontal: 8 }}>
          {WEEKDAYS.map((w, i) => (
            <Text
              key={w}
              style={{
                flex: 1,
                textAlign: 'center',
                paddingVertical: 6,
                fontSize: 12,
                color: i === 0 ? '#e00' : i === 6 ? '#06c' : '#666',
              }}
            >
              {w}
            </Text>
          ))}
        </View>

        {/* 그리드 */}
        <View style={{ paddingHorizontal: 8 }}>
          {weeks.map((row, ri) => (
            <View key={ri} style={{ flexDirection: 'row' }}>
              {row.map((d, ci) => {
                if (d === null) return <View key={ci} style={{ flex: 1, height: 48 }} />;
                const k = dayKey(view.y, view.m, d);
                const isToday = k === todayKey;
                const isSel = k === selKey;
                return (
                  <Pressable
                    key={ci}
                    onPress={() => pickDay(d)}
                    style={{ flex: 1, height: 48, alignItems: 'center', justifyContent: 'center' }}
                  >
                    <View
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 16,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: isSel ? '#007AFF' : isToday ? '#e6f0ff' : 'transparent',
                      }}
                    >
                      <Text style={{ fontSize: 14, color: isSel ? '#fff' : '#111' }}>{d}</Text>
                    </View>
                    <View
                      style={{
                        width: 5,
                        height: 5,
                        borderRadius: 3,
                        marginTop: 2,
                        backgroundColor: daysWithItems.has(k)
                          ? isSel
                            ? '#fff'
                            : '#007AFF'
                          : 'transparent',
                      }}
                    />
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>

        {/* 선택일 일정 목록 */}
        <View style={{ marginTop: 12, borderTopWidth: 1, borderTopColor: '#eee' }}>
          <Text style={{ paddingHorizontal: 16, paddingVertical: 10, fontWeight: '700' }}>
            {selLabel.m}월 {selLabel.d}일 일정
          </Text>
          {selectedItems.length === 0 ? (
            <Text style={{ paddingHorizontal: 16, paddingVertical: 12, color: '#888' }}>
              일정이 없습니다
            </Text>
          ) : (
            selectedItems.map((s) => (
              <Pressable
                key={s.id}
                onPress={() =>
                  navigation.navigate(STACK_ROUTES.ScheduleDetail, { scheduleId: s.id })
                }
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  paddingHorizontal: 16,
                  paddingVertical: 14,
                  borderBottomWidth: 1,
                  borderBottomColor: '#f0f0f0',
                }}
              >
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: s.isDone }}
                  hitSlop={8}
                  onPress={() => void toggle(s)}
                >
                  <Text style={{ fontSize: 20 }}>{s.isDone ? '☑' : '☐'}</Text>
                </Pressable>
                <Text
                  numberOfLines={1}
                  style={{
                    flex: 1,
                    fontSize: 15,
                    textDecorationLine: s.isDone ? 'line-through' : 'none',
                    color: s.isDone ? '#999' : '#111',
                  }}
                >
                  {s.title}
                </Text>
              </Pressable>
            ))
          )}
        </View>

        {/* 연도·월 피커 */}
        <Modal
          visible={pickerOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setPickerOpen(false)}
        >
          <Pressable
            style={{
              flex: 1,
              backgroundColor: 'rgba(0,0,0,0.3)',
              justifyContent: 'center',
              padding: 32,
            }}
            onPress={() => setPickerOpen(false)}
          >
            <Pressable style={{ backgroundColor: '#fff', borderRadius: 12, padding: 16 }} onPress={() => {}}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 12,
                }}
              >
                <Pressable
                  onPress={() => setView((v) => ({ ...v, y: v.y - 1 }))}
                  hitSlop={10}
                  style={{ padding: 8 }}
                >
                  <Text style={{ fontSize: 18 }}>◀</Text>
                </Pressable>
                <Text style={{ fontSize: 18, fontWeight: '700' }}>{view.y}년</Text>
                <Pressable
                  onPress={() => setView((v) => ({ ...v, y: v.y + 1 }))}
                  hitSlop={10}
                  style={{ padding: 8 }}
                >
                  <Text style={{ fontSize: 18 }}>▶</Text>
                </Pressable>
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                {Array.from({ length: 12 }, (_, i) => i).map((mi) => {
                  const active = mi === view.m;
                  return (
                    <Pressable
                      key={mi}
                      onPress={() => {
                        setView((v) => ({ ...v, m: mi }));
                        setPickerOpen(false);
                      }}
                      style={{ width: '25%', paddingVertical: 10, alignItems: 'center' }}
                    >
                      <View
                        style={{
                          paddingVertical: 6,
                          paddingHorizontal: 12,
                          borderRadius: 8,
                          backgroundColor: active ? '#007AFF' : '#f0f0f0',
                        }}
                      >
                        <Text style={{ color: active ? '#fff' : '#333' }}>{mi + 1}월</Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
              <Pressable onPress={goToday} style={{ marginTop: 8, paddingVertical: 10, alignItems: 'center' }}>
                <Text style={{ color: '#007AFF', fontWeight: '600' }}>오늘로 이동</Text>
              </Pressable>
            </Pressable>
          </Pressable>
        </Modal>
      </ScrollView>

      {/* F-17 인라인 인디케이터 — 그리드 영역 오버레이. 헤더 아래에 배치, 컨트롤 조작 방해 안 함(pointerEvents). 화면당 1개(E-17-8). */}
      {loadingMonth || monthError ? (
        <View style={styles.overlay} pointerEvents={monthError ? 'box-none' : 'none'}>
          <BrandLoadingIndicator
            variant="inline"
            loading={loadingMonth}
            endReason={monthError ? 'error' : 'success'}
            onRetry={() => void load()}
            testID="calendar-loading"
          />
          {monthError ? (
            <Pressable onPress={() => void load()} accessibilityRole="button" style={{ marginTop: 4 }}>
              <Text style={{ color: '#007AFF', fontWeight: '600' }}>불러오지 못했어요 · 다시 시도</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 56,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 24,
  },
});
