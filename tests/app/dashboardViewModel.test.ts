/**
 * 대시보드 날짜 네비게이션 · 진행률 한 줄 · 접이식 검색 순수 로직 (F-20 / F-21 / F-22).
 * 대응: nfr.md v1.9 §9 V-41(기준 날짜 파라미터화·DST 스텝·stale) / V-43(접이식 필터·문구 분기) /
 *       V-44(접이식 토글·D-18 초기화) / V-45(미래 날짜 진행률·P-52),
 *       logic.md v1.11 §7.1.1 / §7.1.2 / §7.1.3 / §16.3.7.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { startOfLocalDay, DAY_MS } from '../../src/core/domain/time.ts';
import {
  DASHBOARD_INLINE_SEARCH_DEBOUNCE_MS,
  dashboardListEmptyState,
  editorPresetStartAt,
  filterByInlineQuery,
  inlineNormalize,
  isFreshLoadSequence,
  isFutureDate,
  matchesInlineQuery,
  progressFillRatio,
  resolveMidnightRollover,
  resolveSearchToggle,
  resolveTodayStart,
  stepReferenceDate,
} from '../../src/app/screens/dashboardViewModel.ts';

// ── F-20: 날짜 스텝 (자정/DST 안전) ──────────────────────────────────────────

test('V-41: stepReferenceDate — UTC 인접일로 정확히 이동', () => {
  const ref = startOfLocalDay(Date.UTC(2026, 8, 9, 13, 30, 0), 'UTC');
  assert.equal(stepReferenceDate(ref, 1, 'UTC'), ref + DAY_MS);
  assert.equal(stepReferenceDate(ref, -1, 'UTC'), ref - DAY_MS);
});

test('V-41: stepReferenceDate — 결과는 항상 로컬 자정(고정점)', () => {
  const tz = 'America/New_York';
  const ref = startOfLocalDay(Date.UTC(2026, 2, 7, 12, 0, 0), tz); // 3/7, DST 전환(3/8) 직전
  for (let d = -3; d <= 3; d += 1) {
    let cur = ref;
    for (let i = 0; i < Math.abs(d); i += 1) cur = stepReferenceDate(cur, d < 0 ? -1 : 1, tz);
    assert.equal(startOfLocalDay(cur, tz), cur, `d=${d} 결과가 로컬 자정이 아님`);
  }
});

test('V-41: stepReferenceDate — DST 전환(봄/가을) 넘어도 인접 달력일로만 이동', () => {
  const tz = 'America/New_York';
  const wallDay = (ts: number) =>
    new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(
      new Date(ts),
    );

  // 봄 전환: 3/7 → 3/8 (그날 23시간)
  const spring = startOfLocalDay(Date.UTC(2026, 2, 7, 12, 0, 0), tz);
  const springNext = stepReferenceDate(spring, 1, tz);
  assert.equal(wallDay(spring), '2026-03-07');
  assert.equal(wallDay(springNext), '2026-03-08');
  assert.ok(springNext - spring >= 22 * 3_600_000 && springNext - spring <= 24 * 3_600_000);

  // 가을 전환: 11/1 → 11/2 (그날 25시간)
  const fall = startOfLocalDay(Date.UTC(2026, 10, 1, 12, 0, 0), tz);
  const fallNext = stepReferenceDate(fall, 1, tz);
  assert.equal(wallDay(fall), '2026-11-01');
  assert.equal(wallDay(fallNext), '2026-11-02');
  assert.ok(fallNext - fall >= 24 * 3_600_000 && fallNext - fall <= 26 * 3_600_000);
});

test('V-41: stepReferenceDate — +1 후 -1 은 원래 날짜로 왕복(DST 경계 포함)', () => {
  for (const tz of ['UTC', 'Asia/Seoul', 'America/New_York', 'Australia/Lord_Howe']) {
    for (const base of [Date.UTC(2026, 2, 7, 5, 0, 0), Date.UTC(2026, 10, 1, 5, 0, 0), Date.UTC(2026, 5, 15, 5, 0, 0)]) {
      const ref = startOfLocalDay(base, tz);
      assert.equal(stepReferenceDate(stepReferenceDate(ref, 1, tz), -1, tz), ref, `${tz} @ ${base}`);
    }
  }
});

test('V-41: resolveTodayStart 는 startOfLocalDay 와 동일', () => {
  const now = Date.UTC(2026, 8, 9, 21, 45, 0);
  assert.equal(resolveTodayStart(now, 'Asia/Seoul'), startOfLocalDay(now, 'Asia/Seoul'));
});

// ── F-20: 자정 롤오버 (P-46 / E-10-2 / E-20-3) ──────────────────────────────

test('V-41: resolveMidnightRollover — 오늘을 보던 중 자정 경과 → 새 오늘로 이동', () => {
  const oldToday = startOfLocalDay(Date.UTC(2026, 8, 8, 12, 0, 0), 'UTC');
  const newToday = oldToday + DAY_MS;
  const r = resolveMidnightRollover({ referenceDate: oldToday, prevTodayStart: oldToday, newTodayStart: newToday });
  assert.equal(r.nextReferenceDate, newToday);
  assert.equal(r.changed, true);
  assert.equal(r.nextPrevTodayStart, newToday);
});

test('V-41: resolveMidnightRollover — 다른 날짜를 보던 중 자정 경과 → 기준 날짜 유지', () => {
  const oldToday = startOfLocalDay(Date.UTC(2026, 8, 8, 12, 0, 0), 'UTC');
  const viewing = oldToday - 3 * DAY_MS;
  const newToday = oldToday + DAY_MS;
  const r = resolveMidnightRollover({ referenceDate: viewing, prevTodayStart: oldToday, newTodayStart: newToday });
  assert.equal(r.nextReferenceDate, viewing);
  assert.equal(r.changed, false);
  assert.equal(r.nextPrevTodayStart, newToday);
});

test('V-41: resolveMidnightRollover — 자정 안 지남 → 변화 없음', () => {
  const today = startOfLocalDay(Date.UTC(2026, 8, 8, 12, 0, 0), 'UTC');
  const r = resolveMidnightRollover({ referenceDate: today, prevTodayStart: today, newTodayStart: today });
  assert.equal(r.changed, false);
  assert.equal(r.nextReferenceDate, today);
});

// ── F-20: 연속 탭 stale 토큰 (E-20-4) ───────────────────────────────────────

test('V-41: isFreshLoadSequence — 시작 시퀀스가 최신이면 반영, 아니면 폐기', () => {
  assert.equal(isFreshLoadSequence(3, 3), true);
  assert.equal(isFreshLoadSequence(2, 3), false);
});

// ── F-21: 미래 날짜 판정 (P-52 / D-19(a) / E-21-4 / AC-68) ──────────────────

test('V-45: isFutureDate — referenceDate > todayStart 일 때만 true', () => {
  const today = startOfLocalDay(Date.UTC(2026, 8, 9, 3, 0, 0), 'Asia/Seoul');
  assert.equal(isFutureDate(today + DAY_MS, today), true); // 내일
  assert.equal(isFutureDate(today, today), false); // 오늘
  assert.equal(isFutureDate(today - DAY_MS, today), false); // 어제
});

test('V-45: isFutureDate — 같은 날 안의 시각차는 미래로 보지 않음(둘 다 로컬 자정 전제)', () => {
  const today = startOfLocalDay(Date.UTC(2026, 0, 1, 12, 0, 0), 'UTC');
  assert.equal(isFutureDate(today, today), false);
});

// ── F-21: 진행률 한 줄 채움 비율 (P-07) ─────────────────────────────────────

test('V-42/V-45: progressFillRatio — total 0 이하면 0, 그 외 done/total', () => {
  assert.equal(progressFillRatio(0, 0), 0);
  assert.equal(progressFillRatio(-3, 1), 0);
  assert.equal(progressFillRatio(4, 1), 0.25);
  assert.equal(progressFillRatio(2, 1), 0.5);
  assert.equal(progressFillRatio(5, 5), 1);
});

test('V-42: progressFillRatio — [0,1] 범위로 클램프(비정상 입력 방어)', () => {
  assert.equal(progressFillRatio(3, 9), 1); // done > total
  assert.equal(progressFillRatio(3, -2), 0); // done < 0
});

// ── F-22: 접이식 검색 토글 (D-18(a) / E-22-6 / AC-67) ───────────────────────

test('V-44: resolveSearchToggle — 접힘→펼침 시 검색어 유지, 펼침→접힘 시 초기화', () => {
  assert.deepEqual(resolveSearchToggle(false), { searchExpanded: true, clearQuery: false });
  assert.deepEqual(resolveSearchToggle(true), { searchExpanded: false, clearQuery: true });
});

test('V-44: resolveSearchToggle — 두 번 토글하면 원래 상태(접힘)로 복귀', () => {
  const first = resolveSearchToggle(false); // 펼침
  const second = resolveSearchToggle(first.searchExpanded); // 접힘
  assert.equal(second.searchExpanded, false);
  assert.equal(second.clearQuery, true); // 접힐 때 항상 검색어 비움
});

// ── F-22: 인라인 검색 필터 술어 (D-15, P-48) ────────────────────────────────

const S = (title: string, memo: string | null) => ({ title, memo });

test('V-43: matchesInlineQuery — 제목·메모 부분일치, 대소문자·공백 무시', () => {
  assert.equal(matchesInlineQuery(S('주간 회의', null), inlineNormalize('회의')), true);
  assert.equal(matchesInlineQuery(S('산책', '저녁 회의 준비'), inlineNormalize('회의')), true);
  assert.equal(matchesInlineQuery(S('Standup', null), inlineNormalize('  STANDUP ')), true);
  assert.equal(matchesInlineQuery(S('점심', '메모 없음'), inlineNormalize('회의')), false);
  assert.equal(matchesInlineQuery(S('무엇이든', null), inlineNormalize('')), true); // 빈 질의 → 통과
});

test('V-43: filterByInlineQuery — 제목 2건 + 메모 1건만 남고 무관 3건 제외 (AC-62)', () => {
  const items = [
    S('회의 A', null),
    S('회의 B', '안건'),
    S('산책', '점심 후 회의 논의'),
    S('독서', null),
    S('운동', '헬스장'),
    S('청소', ''),
  ];
  const visible = filterByInlineQuery(items, '회의');
  assert.deepEqual(
    visible.map((x) => x.title),
    ['회의 A', '회의 B', '산책'],
  );
});

test('V-43: filterByInlineQuery — 빈/공백 검색어는 전체 목록 (E-22-4 / AC-64)', () => {
  const items = [S('a', null), S('b', 'x')];
  assert.deepEqual(filterByInlineQuery(items, ''), items);
  assert.deepEqual(filterByInlineQuery(items, '   '), items);
  // 원본 배열을 변형하지 않는다(복사본 반환) — 접힘 시 inlineQuery='' 경로도 여기로 수렴
  assert.notEqual(filterByInlineQuery(items, ''), items);
});

// ── F-22: 빈 상태 vs 검색 무결과 문구 분기 (E-10-1 vs E-22-1 / AC-63) ────────

test('V-43: dashboardListEmptyState — 기준 날짜 0건이면 검색어가 있어도 no-schedules 우선 (E-22-5)', () => {
  assert.equal(dashboardListEmptyState(0, 0, ''), 'no-schedules');
  assert.equal(dashboardListEmptyState(0, 0, '회의'), 'no-schedules');
});

test('V-43: dashboardListEmptyState — 일정은 있으나 검색 무결과 → no-search-results', () => {
  assert.equal(dashboardListEmptyState(5, 0, '회의'), 'no-search-results');
  assert.equal(dashboardListEmptyState(5, 0, '  '), 'hidden'); // 공백만 → 필터 미적용, 무결과 아님
});

test('V-43: dashboardListEmptyState — 표시할 항목이 있으면 hidden', () => {
  assert.equal(dashboardListEmptyState(5, 3, '회의'), 'hidden');
  assert.equal(dashboardListEmptyState(5, 5, ''), 'hidden');
});

// ── OI-19: 프리셋 시작 일시 ─────────────────────────────────────────────────

test('OI-19: editorPresetStartAt — presetDate + 9h', () => {
  const preset = startOfLocalDay(Date.UTC(2026, 8, 20, 0, 0, 0), 'UTC');
  assert.equal(editorPresetStartAt(preset), preset + 9 * 3_600_000);
});

// ── 설계 상수 고정 ─────────────────────────────────────────────────────────

test('§16.3.7: 인라인 검색 디바운스 상수 = 200ms', () => {
  assert.equal(DASHBOARD_INLINE_SEARCH_DEBOUNCE_MS, 200);
});
