import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { parseSavedSchedule, savedScheduleDestination, savedDashboardView, savedCalendarView } from '../../src/app/navigation/savedSchedule.ts';

const require = createRequire(import.meta.url);
const { StackRouter, CommonActions } = require('@react-navigation/routers');
const saved = { scheduleId: 17, startAt: Date.parse('2026-11-17T00:00:00+09:00'), done: false };

test('23시대 다음 정시/다른 날짜 저장은 저장일 자정과 빈 검색 상태를 선택한다', () => {
  assert.deepEqual(savedDashboardView(saved, 'Asia/Seoul'), {
    referenceDate: saved.startAt, inlineQuery: '', debouncedQuery: '', searchExpanded: false,
  });
  const moved = { ...saved, startAt: Date.parse('2026-12-03T14:30:00+09:00'), done: true };
  assert.equal(savedDashboardView(moved, 'Asia/Seoul').referenceDate, Date.parse('2026-12-03T00:00:00+09:00'));
  assert.equal(moved.done, true); // display selection never changes persisted completion
});

test('캘린더 결과는 월과 선택일을 함께 이동한다', () => {
  const startAt = new Date(2027, 0, 5, 12).getTime();
  assert.deepEqual(savedCalendarView({ ...saved, startAt }), {
    view: { y: 2027, m: 0 }, selKey: 20270105, selLabel: { m: 1, d: 5 },
  });
});

test('상세/검색/편집 아래 기존 목록 출처를 사용하고 외부 진입은 대시보드다', () => {
  assert.equal(savedScheduleDestination({ routes: [{ name: 'ScheduleEditor' }] }), 'DashboardTab');
  for (const name of ['CalendarTab', 'DashboardTab', 'SettingsTab']) {
    assert.equal(savedScheduleDestination({ routes: [
      { name: 'Tabs', state: { index: 1, routes: [{ name: 'DashboardTab' }, { name }] } },
      { name: 'Search' }, { name: 'ScheduleDetail' }, { name: 'ScheduleEditor' },
    ] }), name === 'CalendarTab' ? 'CalendarTab' : 'DashboardTab');
  }
});

test('React Navigation 6 성공 navigate는 기존 Tabs 위 검색/상세/편집을 제거한다', () => {
  const router = StackRouter({ initialRouteName: 'Tabs' });
  const options = { routeNames: ['Tabs', 'Search', 'ScheduleDetail', 'ScheduleEditor'], routeParamList: {}, routeGetIdList: {} };
  let state = router.getInitialState(options);
  for (const name of ['Search', 'ScheduleDetail', 'ScheduleEditor']) {
    state = router.getStateForAction(state, CommonActions.navigate(name), options);
  }
  const before = state;
  const params = { screen: 'CalendarTab', params: { savedSchedule: saved } };
  state = router.getStateForAction(state, CommonActions.navigate('Tabs', params), options);
  assert.equal(state.routes.length, 1);
  assert.equal(state.routes[0].key, before.routes[0].key);
  assert.deepEqual(state.routes[0].params, params);
});

test('무효 route 결과는 화면 전이 힌트로 사용하지 않는다', () => {
  assert.deepEqual(parseSavedSchedule(saved), saved);
  for (const value of [null, {}, { ...saved, scheduleId: -1 }, { ...saved, startAt: Infinity }, { ...saved, startAt: 1e20 }, { ...saved, done: 'false' }]) {
    assert.equal(parseSavedSchedule(value), null);
  }
});
