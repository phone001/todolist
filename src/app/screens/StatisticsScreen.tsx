/**
 * 통계 (F-23) — 세 번째 탭. 상단: "총 할 일 건수" / "완료된 건수" 카드 2장(전체 기간 누적, D-21(a)).
 * 그 아래: 연도 선택(‹ 올해 ›, 비영속 화면 로컬 state). 하단: 선택 연도의 유형별 월별(1~12월) **선(line) 그래프**.
 * 그래프는 `react-native-svg`(F-17 기보유) `Polyline`(유형 계열당 1개) + 비영 데이터 포인트 `Circle` 마커 +
 * 축/베이스라인/그리드 `<Line>` — 애니메이션·인터랙션 없음(OI-23). 좌표는 `YearAggregate` 로부터 순수 파생.
 * `useFocusEffect` 로 진입·복귀마다 재조회 + pull-to-refresh(R-23-3). 로딩 중에는 F-17 인라인 인디케이터 1개.
 *
 * 설계 근거: document/architect/logic.md v1.13 §7.2 / §16.2 / §16.3.8(하단 그래프 렌더 — 선 그래프),
 *            plan v1.7 §5.16, nfr.md v1.11 §16.
 * 코어 무변경: ScheduleService.findInRange / CategoryService.list 만 재사용. 집계는 statisticsViewModel(순수).
 * 상태(selectedYear 등)는 화면 로컬 — 영구 저장하지 않음(P-45 유사, bindings.ts SETTING_KEYS 무변경).
 * v1.13 델타 = 프레젠테이션 한정: 집계·데이터 소스·빈 상태 분기·연도 컨트롤·카드·로딩 로직 전부 불변,
 * `'ok'` 분기의 하단 그래프 렌더만 `<View>` 높이 비율 막대 → SVG 선 그래프로 교체.
 * 환경 제약: react / react-native / react-native-svg 의존 → 파이프라인 미실행(정적 리뷰).
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Polyline, Text as SvgText } from 'react-native-svg';
import { useFocusEffect } from '@react-navigation/native';
import { useServices } from '../bootstrap/AppContext.tsx';
import type { Category, Schedule } from '../../core/domain/types.ts';
import { BrandLoadingIndicator } from '../components/BrandLoadingIndicator.tsx';
import { isFreshLoadSequence } from './dashboardViewModel.ts';
import {
  aggregateTotals,
  aggregateYear,
  currentYear,
  hasMeaningfulCategories,
  monthBoundaries,
  seriesPointMax,
  STATISTICS_LOAD_ERROR_TEXT,
  STATISTICS_NO_CATEGORIES_TEXT,
  STATISTICS_NO_DATA_TEXT,
  STATISTICS_NO_YEAR_DATA_TEXT,
  STATISTICS_PAGE_SIZE,
  statisticsEmptyState,
  yearRangeEpochs,
  type StatTotals,
  type YearAggregate,
} from './statisticsViewModel.ts';

const UNKNOWN_CATEGORY_COLOR = '#C7C7CC';
const UNKNOWN_CATEGORY_LABEL = '기타';
/** cursor 루프 페이지 폭주 방지 상한(§2 용량 ≤ 1만 행 / 200 = 50 페이지). */
const MAX_PAGES = 200;

// ── 선 그래프 좌표계 (logic §16.3.8, 화면 파생·순수) ────────────────────────
// `<Svg>` 는 `viewBox` 로 컨테이너 폭에 스케일된다(preserveAspectRatio 기본 = meet).
// 축 눈금/월 레이블도 SVG 내부 `<Text>` 로 두어(logic §16.3.8: "또는 `<Text>`(svg)")
// polyline 정점과 픽셀 정합이 유지되게 한다. r·strokeWidth 는 계열 수와 무관한 고정 소량.
const CHART_VB_WIDTH = 320;
const CHART_VB_HEIGHT = 190;
const CHART_HEIGHT = 190; // dp — viewBox 비율(190/320)에 근접시켜 레터박스 최소화
const CHART_PAD = { left: 26, right: 12, top: 12, bottom: 26 } as const;
const CHART_PLOT_W = CHART_VB_WIDTH - CHART_PAD.left - CHART_PAD.right;
const CHART_PLOT_H = CHART_VB_HEIGHT - CHART_PAD.top - CHART_PAD.bottom;
const CHART_MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

/** x(m) = padLeft + (m-1)/11 * plotW  (m = 1..12). */
function chartX(month: number): number {
  return CHART_PAD.left + ((month - 1) / 11) * CHART_PLOT_W;
}
/** y(v) = padTop + (1 - v/yMax) * plotH. */
function chartY(value: number, yMax: number): number {
  return CHART_PAD.top + (1 - value / yMax) * CHART_PLOT_H;
}

interface MonthlyLineChartProps {
  agg: YearAggregate;
  colorOf: (cid: number) => string;
  labelOf: (cid: number) => string;
}

/**
 * 유형별 월별 선(line) 그래프 — 순수 프레젠테이션(props 주입만, core/서비스/bindings 무의존).
 * 계열(유형) N개 → `Polyline` N개(계열당 12점). 건수 > 0 인 점만 `Circle` 마커(0 점은 마커 생략,
 * 단 선은 baseline y=0 실점으로 연결 — 결측 아님, logic §16.3.8). 애니메이션·인터랙션 없음(OI-23).
 */
function MonthlyLineChart({ agg, colorOf, labelOf }: MonthlyLineChartProps) {
  const yMax = Math.max(1, seriesPointMax(agg));
  const baselineY = chartY(0, yMax);
  const topY = chartY(yMax, yMax);
  const rightX = CHART_VB_WIDTH - CHART_PAD.right;

  return (
    <Svg
      width="100%"
      height={CHART_HEIGHT}
      viewBox={`0 0 ${CHART_VB_WIDTH} ${CHART_VB_HEIGHT}`}
    >
      {/* 축 / 그리드 (최소 구현: 0·최댓값 수평선 + y축) */}
      <Line x1={CHART_PAD.left} y1={topY} x2={rightX} y2={topY} stroke="#ECECEC" strokeWidth={1} />
      <Line x1={CHART_PAD.left} y1={baselineY} x2={rightX} y2={baselineY} stroke="#D0D0D0" strokeWidth={1} />
      <Line x1={CHART_PAD.left} y1={topY} x2={CHART_PAD.left} y2={baselineY} stroke="#ECECEC" strokeWidth={1} />

      {/* y 눈금 숫자 (0 / 최댓값) */}
      <SvgText x={CHART_PAD.left - 4} y={baselineY + 3} fontSize={9} fill="#AAAAAA" textAnchor="end">
        0
      </SvgText>
      <SvgText x={CHART_PAD.left - 4} y={topY + 3} fontSize={9} fill="#AAAAAA" textAnchor="end">
        {String(yMax)}
      </SvgText>

      {/* 계열별 선 + 비영 데이터 포인트 마커 */}
      {agg.seriesCategoryIds.map((cid) => {
        const color = colorOf(cid);
        const points = CHART_MONTHS.map(
          (m) => `${chartX(m)},${chartY(agg.months[m - 1]?.byCategory[cid] ?? 0, yMax)}`,
        ).join(' ');
        return (
          <React.Fragment key={cid}>
            <Polyline
              points={points}
              stroke={color}
              strokeWidth={2}
              fill="none"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {CHART_MONTHS.map((m) => {
              const n = agg.months[m - 1]?.byCategory[cid] ?? 0;
              if (n === 0) return null;
              return (
                <Circle
                  key={`${cid}-${m}`}
                  cx={chartX(m)}
                  cy={chartY(n, yMax)}
                  r={3}
                  fill={color}
                  accessibilityLabel={`${m}월 ${labelOf(cid)} ${n}건`}
                />
              );
            })}
          </React.Fragment>
        );
      })}

      {/* x축 월 숫자 레이블 (1~12) */}
      {CHART_MONTHS.map((m) => (
        <SvgText
          key={`xlabel-${m}`}
          x={chartX(m)}
          y={CHART_VB_HEIGHT - 8}
          fontSize={9}
          fill="#888888"
          textAnchor="middle"
        >
          {String(m)}
        </SvgText>
      ))}
    </Svg>
  );
}

function buildGraphSummary(
  year: number,
  agg: YearAggregate,
  labelOf: (cid: number) => string,
): string {
  const parts = agg.months
    .filter((b) => b.total > 0)
    .map((b) => {
      const inner = agg.seriesCategoryIds
        .filter((cid) => (b.byCategory[cid] ?? 0) > 0)
        .map((cid) => `${labelOf(cid)} ${b.byCategory[cid] ?? 0}건`)
        .join(', ');
      return `${b.month}월 ${inner}`;
    });
  return parts.length > 0
    ? `${year}년 · ${parts.join(' · ')}`
    : `${year}년 · 표시할 데이터가 없습니다`;
}

export function StatisticsScreen() {
  const { schedules, categories, clock } = useServices();
  const tz = clock.timeZone();

  const [selectedYear, setSelectedYear] = useState<number>(() =>
    currentYear(clock.now(), tz),
  );
  const [totals, setTotals] = useState<StatTotals | null>(null);
  const [catList, setCatList] = useState<Category[]>([]);
  const [yearAgg, setYearAgg] = useState<YearAggregate | null>(null);
  // F-17: 전체 로딩(카드+그래프) / 연도 전환 시 그래프만 로딩. 둘 다 인라인 인디케이터 1개로 표현(E-17-8).
  const [loading, setLoading] = useState(true);
  const [graphLoading, setGraphLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadSeqRef = useRef(0); // 연속 연도 화살표 조작 시 stale 응답 폐기(§7.2.3)
  const catRef = useRef<Category[]>([]); // 연도 전용 재조회가 참조할 최신 유형 목록
  const selectedYearRef = useRef(selectedYear);
  useEffect(() => {
    selectedYearRef.current = selectedYear;
  }, [selectedYear]);

  /** [from, to) 를 nextCursor 소진까지 루프해 전건 수집(§7.2.1). */
  const collectInRange = useCallback(
    async (from: number, to: number): Promise<Schedule[]> => {
      const acc: Schedule[] = [];
      let cursor: string | null = null;
      for (let page = 0; page < MAX_PAGES; page += 1) {
        const res = await schedules.findInRange(
          from,
          to,
          undefined,
          'startAt',
          STATISTICS_PAGE_SIZE,
          cursor,
        );
        acc.push(...res.items);
        if (!res.nextCursor) break;
        cursor = res.nextCursor;
      }
      return acc;
    },
    [schedules],
  );

  /** 하단 그래프만 재조회·재집계. 상단 카드는 건드리지 않는다(D-21(a) / R-23-2 / AC-70 / AC-72). */
  const loadYear = useCallback(
    async (year: number) => {
      const seq = ++loadSeqRef.current;
      setGraphLoading(true);
      try {
        const { startTs, endTs } = yearRangeEpochs(year, tz);
        const boundaries = monthBoundaries(year, tz);
        const rows = await collectInRange(startTs, endTs);
        if (!isFreshLoadSequence(seq, loadSeqRef.current)) return;
        setYearAgg(aggregateYear(rows, catRef.current, boundaries));
        setLoadError(false);
      } catch {
        if (!isFreshLoadSequence(seq, loadSeqRef.current)) return;
        setLoadError(true); // E-23-4
      } finally {
        if (isFreshLoadSequence(seq, loadSeqRef.current)) setGraphLoading(false);
      }
    },
    [collectInRange, tz],
  );

  /** 전체 재조회(포커스 진입·복귀 / pull-to-refresh): 유형 목록 + 상단 카드 + 하단 그래프. */
  const load = useCallback(async () => {
    setLoadError(false);
    try {
      const cats = await categories.list();
      catRef.current = cats;
      setCatList(cats);
      const totalRows = await collectInRange(0, Number.MAX_SAFE_INTEGER);
      setTotals(aggregateTotals(totalRows));
      await loadYear(selectedYearRef.current);
    } catch {
      setLoadError(true); // E-23-4
    } finally {
      setLoading(false);
    }
  }, [categories, collectInRange, loadYear]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void load();
    }, [load]),
  );

  const retry = useCallback(() => {
    setLoading(true);
    setLoadError(false);
    void load();
  }, [load]);

  const stepYear = useCallback(
    (delta: number) => {
      const next = selectedYearRef.current + delta;
      selectedYearRef.current = next;
      setSelectedYear(next);
      void loadYear(next);
    },
    [loadYear],
  );

  const catMap = useMemo(() => {
    const m = new Map<number, Category>();
    for (const c of catList) m.set(c.id, c);
    return m;
  }, [catList]);
  const labelOf = useCallback(
    (cid: number) => catMap.get(cid)?.name ?? UNKNOWN_CATEGORY_LABEL,
    [catMap],
  );
  const colorOf = useCallback(
    (cid: number) => catMap.get(cid)?.color ?? UNKNOWN_CATEGORY_COLOR,
    [catMap],
  );

  const allRowsLen = totals?.total ?? 0;
  const meaningful = hasMeaningfulCategories(catList);
  const yearRows = yearAgg?.placedRowCount ?? 0;
  const emptyState = statisticsEmptyState(allRowsLen, meaningful, yearRows, loadError);

  const busy = loading || graphLoading;
  const cardTotal = totals !== null && !loading ? totals.total : null;
  const cardDone = totals !== null && !loading ? totals.done : null;

  const graphSummary =
    yearAgg && emptyState === 'ok' ? buildGraphSummary(selectedYear, yearAgg, labelOf) : '';

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
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
        {/* 1. 상단 요약 카드 2장 — 전체 기간 누적(D-21(a), P-55). 완료율 병기 안 함(OI-22). */}
        <View style={styles.cardRow}>
          <View style={styles.card} accessibilityLabel={`총 할 일 ${cardTotal ?? 0}건`}>
            <Text style={styles.cardLabel}>총 할 일 건수</Text>
            <Text style={styles.cardValue}>{cardTotal ?? '—'}</Text>
          </View>
          <View style={styles.card} accessibilityLabel={`완료된 건수 ${cardDone ?? 0}건`}>
            <Text style={styles.cardLabel}>완료된 건수</Text>
            <Text style={styles.cardValue}>{cardDone ?? '—'}</Text>
          </View>
        </View>

        {/* 2. 연도 선택 컨트롤 — ‹ [연도]년 › (비영속, 기본 올해). 이동 범위 제한 없음. */}
        <View style={styles.yearRow}>
          <Pressable
            onPress={() => stepYear(-1)}
            accessibilityRole="button"
            accessibilityLabel="이전 해"
            hitSlop={8}
            style={styles.yearArrow}
          >
            <Text style={styles.yearArrowText}>‹</Text>
          </Pressable>
          <Text style={styles.yearLabel}>{selectedYear}년</Text>
          <Pressable
            onPress={() => stepYear(1)}
            accessibilityRole="button"
            accessibilityLabel="다음 해"
            hitSlop={8}
            style={styles.yearArrow}
          >
            <Text style={styles.yearArrowText}>›</Text>
          </Pressable>
        </View>

        {/* 3. 하단 유형별 월별 그래프 영역 */}
        <View style={styles.graphArea}>
          {busy ? null : emptyState === 'load-error' ? (
            <View style={styles.centerBox}>
              <Text style={styles.emptyText}>{STATISTICS_LOAD_ERROR_TEXT}</Text>
              <Pressable onPress={retry} accessibilityRole="button" style={styles.retryBtn}>
                <Text style={styles.retryBtnText}>다시 시도</Text>
              </Pressable>
            </View>
          ) : emptyState === 'no-data' ? (
            <View style={styles.centerBox}>
              <Text style={styles.emptyText}>{STATISTICS_NO_DATA_TEXT}</Text>
            </View>
          ) : emptyState === 'no-categories' ? (
            <View style={styles.centerBox}>
              <Text style={styles.emptyText}>{STATISTICS_NO_CATEGORIES_TEXT}</Text>
            </View>
          ) : emptyState === 'no-year-data' ? (
            <View style={styles.centerBox}>
              <Text style={styles.emptyText}>{STATISTICS_NO_YEAR_DATA_TEXT}</Text>
            </View>
          ) : yearAgg ? (
            <>
              {/* 스크린리더용 데이터 요약(색·시각 비의존, nfr §16.3) — 막대→선 교체 무관하게 불변 */}
              <Text style={styles.graphSummary} accessibilityLabel={graphSummary}>
                {graphSummary}
              </Text>

              <View style={styles.chart}>
                <MonthlyLineChart agg={yearAgg} colorOf={colorOf} labelOf={labelOf} />
              </View>

              {/* 범례 — 텍스트 라벨 + 색 스와치(색만으로 구분하지 않음) */}
              <View style={styles.legend}>
                {yearAgg.seriesCategoryIds.map((cid) => (
                  <View key={cid} style={styles.legendItem}>
                    <View style={[styles.swatch, { backgroundColor: colorOf(cid) }]} />
                    <Text style={styles.legendText}>{labelOf(cid)}</Text>
                  </View>
                ))}
              </View>
            </>
          ) : null}
        </View>
      </ScrollView>

      {/* F-17 인라인 인디케이터 — 콘텐츠(카드·그래프) 영역. 헤더·연도 컨트롤은 유지. 화면당 1개(E-17-8). */}
      {busy || loadError ? (
        <View style={styles.overlay} pointerEvents={loadError ? 'auto' : 'none'}>
          <BrandLoadingIndicator
            variant="inline"
            loading={busy}
            endReason={loadError ? 'error' : 'success'}
            onRetry={retry}
            testID="statistics-loading"
          />
          {loadError ? (
            <Pressable onPress={retry} accessibilityRole="button" style={{ marginTop: 4 }}>
              <Text style={{ color: '#007AFF', fontWeight: '600' }}>
                통계를 불러오지 못했어요 · 다시 시도
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  cardRow: {
    flexDirection: 'row',
    gap: 12,
  },
  card: {
    flex: 1,
    paddingVertical: 20,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: '#f5f7fa',
    alignItems: 'center',
    gap: 8,
  },
  cardLabel: {
    fontSize: 13,
    color: '#666',
    fontWeight: '600',
  },
  cardValue: {
    fontSize: 32,
    fontWeight: '800',
    color: '#111',
  },
  yearRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    marginTop: 20,
    marginBottom: 12,
  },
  yearArrow: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  yearArrowText: {
    fontSize: 24,
    color: '#007AFF',
    lineHeight: 26,
  },
  yearLabel: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111',
    minWidth: 72,
    textAlign: 'center',
  },
  graphArea: {
    minHeight: CHART_HEIGHT + 80,
    marginTop: 4,
  },
  graphSummary: {
    fontSize: 12,
    color: '#888',
    marginBottom: 12,
  },
  chart: {
    width: '100%',
    height: CHART_HEIGHT,
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 16,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  swatch: {
    width: 12,
    height: 12,
    borderRadius: 3,
  },
  legendText: {
    fontSize: 12,
    color: '#444',
  },
  centerBox: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 12,
  },
  emptyText: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
  },
  retryBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#007AFF',
  },
  retryBtnText: {
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
