/**
 * 오늘 — 기준 날짜(F-20) 일정 리스트 + 진행률 한 줄(F-21) + 날짜별 접이식 검색(F-22).
 * 상단: 좌/우 화살표로 ±1일 이동, 오늘이 아니면 "오늘로" 복귀 — 한 줄에 컴팩트하게 배치(F-20 v1.6).
 * 그 아래 진행률 한 줄("M / N 완료" + progress bar; 미래 날짜는 "일정 N건"만),
 * 접이식 검색(검색 아이콘 탭 → 펼침, 제목·메모 실시간 필터), 요약 상세(완료율), 기준 날짜 일정 목록.
 * 각 항목: 체크박스 + 제목. 스와이프 → 수정 / 삭제 (SwipeableRow).
 * FAB / 빈 상태「일정 추가」→ ScheduleEditor. 기준 날짜가 오늘이 아니면 presetDate 동반(OI-19).
 * 최초·날짜 이동 집계 로딩 중에는 브랜드 로딩 인디케이터(인라인) 노출 (F-17, logic §16.9.8 #2).
 *
 * 설계 근거: document/architect/logic.md v1.11 §7.1 / §16.3.3 / §16.3.7, plan v1.6 §5.15.
 * 코어 무변경: DashboardService.getSummary / ScheduleService.findInRange 를 referenceDate 인자로 재사용.
 * 상태(referenceDate / inlineQuery / searchExpanded)는 화면 로컬 — 영구 저장하지 않음(P-45 / P-50 / P-53).
 * 환경 제약: react / react-native 의존 → 파이프라인 미실행(정적 리뷰).
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  AppState,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useServices } from '../bootstrap/AppContext.tsx';
import { useShellStore } from '../state/stores.native.ts';
import { STACK_ROUTES, type RootStackParamList } from '../navigation/routes.ts';
import type { Schedule } from '../../core/domain/types.ts';
import type { DashboardSummary } from '../../core/services/dashboardService.ts';
import { DAY_MS } from '../../core/domain/time.ts';
import {
  DASHBOARD_EMPTY_TEXT,
  DASHBOARD_INLINE_SEARCH_DEBOUNCE_MS,
  DASHBOARD_SEARCH_EMPTY_TEXT,
  dashboardListEmptyState,
  filterByInlineQuery,
  isFreshLoadSequence,
  isFutureDate,
  resolveMidnightRollover,
  resolveSearchToggle,
  resolveTodayStart,
  stepReferenceDate,
} from './dashboardViewModel.ts';
import { SwipeableRow } from './SwipeableRow.tsx';
import { ProgressLine } from '../components/ProgressLine.tsx';
import { BrandLoadingIndicator } from '../components/BrandLoadingIndicator.tsx';

type DashboardNavProp = NativeStackNavigationProp<RootStackParamList>;

const DASHBOARD_LIST_LIMIT = 200;

function hhmm(ts: number): string {
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** 기준 날짜 라벨 — 로캘 포맷(NFR-09). 포맷 전용 `new Date(ts)` 는 logic §16.11 에서 허용. */
function formatDateLabel(ts: number, isToday: boolean): string {
  let body: string;
  try {
    body = new Intl.DateTimeFormat(undefined, {
      month: 'long',
      day: 'numeric',
      weekday: 'short',
    }).format(new Date(ts));
  } catch {
    const d = new Date(ts);
    body = `${d.getMonth() + 1}월 ${d.getDate()}일`;
  }
  return isToday ? `오늘 · ${body}` : body;
}

export function DashboardScreen() {
  const { schedules, dashboard, clock } = useServices();
  const setDashboard = useShellStore((s) => s.setDashboard);
  const invalidate = useShellStore((s) => s.invalidate);
  const clearStale = useShellStore((s) => s.clearStale);
  const navigation = useNavigation<DashboardNavProp>();

  const tz = clock.timeZone();

  const [items, setItems] = useState<Schedule[]>([]);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  // F-17: 최초/날짜 이동 집계 로딩 상태(인라인 인디케이터 소스). 새로고침(RefreshControl)에는 사용하지 않는다.
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  // F-20: 기준 날짜(로컬 자정 epoch ms). 기본값 = 오늘. 영구 저장하지 않는다(P-45).
  const [referenceDate, setReferenceDate] = useState<number>(() =>
    resolveTodayStart(clock.now(), tz),
  );
  // F-22: 접이식 검색 상태(화면 로컬, 영구 저장 없음 P-50/P-53). 기본 접힘.
  const [searchExpanded, setSearchExpanded] = useState(false);
  const [inlineQuery, setInlineQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  const prevTodayStartRef = useRef<number>(referenceDate); // 자정 롤오버 판별용(P-46)
  const loadSeqRef = useRef(0); // 연속 탭 stale 응답 폐기용(E-20-4)

  const todayStartValue = resolveTodayStart(clock.now(), tz);
  const isToday = referenceDate === todayStartValue;
  // F-21: 미래 날짜면 진행률 한 줄이 progress bar·완료 수를 숨긴다(P-52 / D-19(a) / AC-68). 순수 표시 조건.
  const isFuture = isFutureDate(referenceDate, todayStartValue);

  // F-22: 인라인 검색 디바운스(§16.3.7, DASHBOARD_INLINE_SEARCH_DEBOUNCE_MS).
  useEffect(() => {
    const id = setTimeout(
      () => setDebouncedQuery(inlineQuery),
      DASHBOARD_INLINE_SEARCH_DEBOUNCE_MS,
    );
    return () => clearTimeout(id);
  }, [inlineQuery]);

  const load = useCallback(async () => {
    const seq = ++loadSeqRef.current;
    const dayStart = referenceDate;
    const dayEnd = referenceDate + DAY_MS;
    try {
      const [summaryResult, page] = await Promise.all([
        // 요약 상세 + 진행률 한 줄(F-21) — 동일 호출 1건 공유, 별도 집계 없음(P-47).
        dashboard.getSummary(referenceDate),
        schedules.findInRange(dayStart, dayEnd, undefined, 'startAt', DASHBOARD_LIST_LIMIT, null),
      ]);
      if (!isFreshLoadSequence(seq, loadSeqRef.current)) return; // E-20-4: stale 폐기
      setItems(page.items);
      setSummary(summaryResult);
      setLoaded(true);
      setLoadError(false);
      setDashboard({
        total: summaryResult.total,
        done: summaryResult.done,
        notDone: summaryResult.notDone,
        completionRate: summaryResult.completionRate,
        nextScheduleId: summaryResult.nextScheduleId,
        empty: summaryResult.empty,
      });
    } catch {
      // 로드 실패 → 마지막 캐시 유지 + 재시도 UI (E-02-2, E-20-2, E-21-2, E-10-6, E-17-7)
      if (!isFreshLoadSequence(seq, loadSeqRef.current)) return;
      setLoadError(true);
    } finally {
      if (isFreshLoadSequence(seq, loadSeqRef.current)) setInitialLoading(false);
    }
  }, [dashboard, schedules, referenceDate, setDashboard]);

  const retry = useCallback(() => {
    setInitialLoading(true);
    setLoadError(false);
    void load();
  }, [load]);

  /** 자정 롤오버 재평가(P-46). 기준 날짜가 이동하면 true(→ load 는 useEffect 가 처리). */
  const runRollover = useCallback((): boolean => {
    const r = resolveMidnightRollover({
      referenceDate,
      prevTodayStart: prevTodayStartRef.current,
      newTodayStart: resolveTodayStart(clock.now(), tz),
    });
    prevTodayStartRef.current = r.nextPrevTodayStart;
    if (r.changed) setReferenceDate(r.nextReferenceDate);
    return r.changed;
  }, [referenceDate, clock, tz]);

  /** "오늘로" 복귀 / 탭 이탈 리셋(D-12, P-50, P-53, AC-58). 검색창 접힘 + 검색어도 초기화한다. */
  const resetDashboardView = useCallback(() => {
    const t = resolveTodayStart(clock.now(), tz);
    setReferenceDate(t);
    setSearchExpanded(false); // P-53 — 검색창 접힘 (E-22-7)
    setInlineQuery('');
    setDebouncedQuery('');
    prevTodayStartRef.current = t;
  }, [clock, tz]);

  /** F-22: 검색 아이콘 토글(D-18(a)). 접힘으로 전환 시 검색어를 비워 필터를 해제한다(E-22-6). */
  const toggleSearch = useCallback(() => {
    setSearchExpanded((exp) => {
      const r = resolveSearchToggle(exp);
      if (r.clearQuery) setInlineQuery('');
      return r.searchExpanded;
    });
  }, []);

  // 최초 + referenceDate 변경 시 재조회. AppState 'active' 에서 자정 롤오버 재평가(AC-16/AC-59).
  useEffect(() => {
    setInitialLoading(true);
    void load();
    const sub = AppState.addEventListener('change', (st) => {
      if (st !== 'active') return;
      if (!runRollover()) void load(); // 날짜 이동이면 이 effect 재실행이 재조회를 담당
    });
    return () => sub.remove();
  }, [load, runRollover]);

  // 다른 화면(추가/수정·완료 토글·삭제)이 무효화하면 포커스 복귀 시 재조회 (logic §16.3).
  useFocusEffect(
    useCallback(() => {
      if (runRollover()) return; // 자정 경과로 오늘이 이동 → load 는 useEffect 가 처리
      const st = useShellStore.getState().stale;
      if (st.list || st.dashboard) {
        clearStale('list');
        clearStale('dashboard');
        void load();
      }
    }, [load, clearStale, runRollover]),
  );

  // D-12: 형제 탭으로 전환(대시보드 탭 blur) 시 기준 날짜·검색 상태를 리셋한다.
  // ScheduleDetail / ScheduleEditor 로의 Stack push 는 부모 스택의 포커스 라우트로 구분해 제외한다(logic §16.3.7).
  useEffect(() => {
    const unsub = navigation.addListener('blur', () => {
      const parentState = navigation.getParent()?.getState();
      const focusedStackRoute =
        parentState && typeof parentState.index === 'number'
          ? parentState.routes[parentState.index]?.name
          : undefined;
      if (
        focusedStackRoute === STACK_ROUTES.ScheduleDetail ||
        focusedStackRoute === STACK_ROUTES.ScheduleEditor
      ) {
        return;
      }
      resetDashboardView();
    });
    return unsub;
  }, [navigation, resetDashboardView]);

  const goPrevDay = useCallback(() => {
    // 검색어·펼침 상태는 유지한다(P-50 / D-17 / AC-65).
    setReferenceDate((d) => stepReferenceDate(d, -1, tz));
  }, [tz]);

  const goNextDay = useCallback(() => {
    setReferenceDate((d) => stepReferenceDate(d, 1, tz));
  }, [tz]);

  const goAddSchedule = useCallback(() => {
    navigation.navigate(
      STACK_ROUTES.ScheduleEditor,
      referenceDate === todayStartValue ? {} : { presetDate: referenceDate },
    );
  }, [navigation, referenceDate, todayStartValue]);

  // F-22: 목록 표시 계층 순수 필터(§7.1.3). 진행률 한 줄·요약에는 적용하지 않는다(P-49 / D-16).
  // searchExpanded === false 면 inlineQuery 가 항상 '' 이라 여기서 no-op 이 된다.
  const visible = useMemo(
    () => filterByInlineQuery(items, debouncedQuery),
    [items, debouncedQuery],
  );
  const emptyState = dashboardListEmptyState(items.length, visible.length, debouncedQuery);

  const toggle = async (s: Schedule) => {
    try {
      await schedules.toggleDone(s.id, !s.isDone);
      setItems((prev) => prev.map((x) => (x.id === s.id ? { ...x, isDone: !x.isDone } : x)));
      invalidate('list', 'dashboard');
      void load(); // 진행률 한 줄·완료율 즉시 갱신 (AC-44 / AC-60). visible 은 파생이라 검색어 자동 재적용(E-22-3)
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
      {/* 2. 날짜 네비게이션(컴팩트, F-20 v1.6) — 화살표·라벨·"오늘로"를 한 줄에 작게. 로딩 중에도 조작 가능(E-20-4) */}
      <View style={styles.dateNav}>
        <Pressable onPress={goPrevDay} accessibilityLabel="전날" hitSlop={8} style={styles.arrow}>
          <Text style={styles.arrowText}>‹</Text>
        </Pressable>
        <Pressable
          onPress={isToday ? undefined : resetDashboardView}
          accessibilityRole={isToday ? 'text' : 'button'}
          style={styles.dateLabelWrap}
        >
          <Text style={styles.dateLabel} numberOfLines={1}>
            {formatDateLabel(referenceDate, isToday)}
          </Text>
        </Pressable>
        <Pressable onPress={goNextDay} accessibilityLabel="다음날" hitSlop={8} style={styles.arrow}>
          <Text style={styles.arrowText}>›</Text>
        </Pressable>
        {!isToday ? (
          <Pressable onPress={resetDashboardView} accessibilityRole="button" style={styles.todayBtn}>
            <Text style={styles.todayBtnText}>오늘로</Text>
          </Pressable>
        ) : null}
      </View>

      {/* 3. 진행률 한 줄 (F-21) — getSummary 의 total/done (P-47), 검색과 무관(P-49). 미래 날짜면 "일정 N건"만 */}
      <ProgressLine
        total={summary?.total ?? 0}
        done={summary?.done ?? 0}
        isFuture={isFuture}
        testID="dashboard-progress-line"
      />

      {/* 4. 접이식 검색 (F-22) — 검색 아이콘 상시 렌더, 펼침 시에만 TextInput. 목록만 필터 */}
      <View style={styles.searchRow}>
        <Pressable
          onPress={toggleSearch}
          accessibilityRole="button"
          accessibilityState={{ expanded: searchExpanded }}
          accessibilityLabel={searchExpanded ? '일정 검색 닫기' : '일정 검색 열기'}
          hitSlop={8}
          style={styles.searchToggle}
        >
          <Text style={styles.searchToggleText}>{searchExpanded ? '검색 닫기' : '검색'}</Text>
        </Pressable>
        {searchExpanded ? (
          <>
            <TextInput
              value={inlineQuery}
              onChangeText={setInlineQuery}
              autoFocus
              placeholder="이 날짜의 일정 검색 (제목·메모)"
              placeholderTextColor="#999"
              accessibilityLabel="이 날짜의 일정 검색"
              style={styles.searchInput}
            />
            {inlineQuery.length > 0 ? (
              <Pressable
                onPress={() => setInlineQuery('')}
                accessibilityLabel="검색어 지우기"
                hitSlop={8}
                style={styles.searchClear}
              >
                <Text style={styles.searchClearText}>✕</Text>
              </Pressable>
            ) : null}
          </>
        ) : null}
      </View>

      {/* 5. 요약 상세 — 완료율(%) 존치(AC-46 회귀 방지, P-07). 미래 날짜여도 기존대로 산출 */}
      <View style={styles.summaryDetail}>
        <Text style={styles.summaryDetailText}>완료율 {summary?.completionRate ?? 0}%</Text>
      </View>

      {/* 6. 기준 날짜 일정 목록 */}
      <View style={{ flex: 1 }}>
        <FlatList
          style={{ flex: 1 }}
          contentContainerStyle={{ flexGrow: 1, paddingBottom: 96 }}
          data={visible}
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
            initialLoading || loadError || !loaded ? null : emptyState === 'no-schedules' ? (
              <View style={styles.centerBox}>
                <Text style={styles.emptyText}>{DASHBOARD_EMPTY_TEXT}</Text>
                <Pressable
                  onPress={goAddSchedule}
                  accessibilityRole="button"
                  style={styles.emptyAction}
                >
                  <Text style={styles.emptyActionText}>일정 추가</Text>
                </Pressable>
              </View>
            ) : emptyState === 'no-search-results' ? (
              <View style={styles.centerBox}>
                <Text style={styles.emptyText}>{DASHBOARD_SEARCH_EMPTY_TEXT}</Text>
                <Pressable
                  onPress={() => setInlineQuery('')}
                  accessibilityRole="button"
                  style={styles.emptyAction}
                >
                  <Text style={styles.emptyActionText}>검색어 지우기</Text>
                </Pressable>
              </View>
            ) : null
          }
        />

        {/* F-17 인라인 인디케이터 — 콘텐츠(리스트) 영역만 대체. 날짜 네비게이션·FAB 는 유지 (§16.9.8 #2). 화면당 1개(E-17-8). */}
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

      {/* 7. 일정 추가 FAB — 원형, 우측 하단. 기준 날짜가 오늘이 아니면 presetDate 동반(OI-19, AC-15, E-10-1) */}
      <Pressable
        onPress={goAddSchedule}
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
  // 날짜 네비게이션은 시각적으로 작게(F-20 v1.6, OI-15) — v1.10 대비 높이·타이포·아이콘 축소.
  dateNav: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  arrow: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowText: {
    fontSize: 20,
    color: '#007AFF',
    lineHeight: 22,
  },
  dateLabelWrap: {
    flex: 1,
    alignItems: 'center',
  },
  dateLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111',
  },
  todayBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#eef4ff',
  },
  todayBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#007AFF',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  searchToggle: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    backgroundColor: '#fff',
  },
  searchToggleText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#555',
  },
  searchInput: {
    flex: 1,
    height: 38,
    marginLeft: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 14,
    color: '#111',
    backgroundColor: '#fff',
  },
  searchClear: {
    marginLeft: 8,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchClearText: {
    fontSize: 15,
    color: '#888',
  },
  summaryDetail: {
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  summaryDetailText: {
    fontSize: 13,
    color: '#666',
  },
  centerBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  emptyText: {
    fontSize: 15,
    color: '#888',
    textAlign: 'center',
  },
  emptyAction: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#007AFF',
  },
  emptyActionText: {
    color: '#fff',
    fontWeight: '600',
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
