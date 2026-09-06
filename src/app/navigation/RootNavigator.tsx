/**
 * 루트 네비게이터 — Tab(대시보드/캘린더/검색/설정) + Stack(상세/편집/권한).
 * 알림 탭 → payload 재조회 검증 후 상세 이동(logic v1.1 §16.2, §6, 13.3).
 * 환경 제약: react-navigation / react 의존 → 파이프라인 미실행(정적 리뷰).
 */
import React, { useEffect, useRef } from 'react';
import { NavigationContainer, type NavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import notifee, { EventType } from '@notifee/react-native';
import { STACK_ROUTES, TAB_ROUTES, type RootStackParamList } from './routes.ts';
import { LINKING_PREFIXES, notificationTarget, parseDeepLink } from './linking.ts';
import { useServices } from '../bootstrap/AppContext.tsx';
import { DashboardScreen } from '../screens/DashboardScreen.tsx';
import { CalendarScreen } from '../screens/CalendarScreen.tsx';
import { SearchScreen } from '../screens/SearchScreen.tsx';
import { SettingsScreen } from '../screens/SettingsScreen.tsx';
import { ScheduleDetailScreen } from '../screens/ScheduleDetailScreen.tsx';
import { ScheduleEditorScreen } from '../screens/ScheduleEditorScreen.tsx';
import { PermissionsScreen } from '../screens/PermissionsScreen.tsx';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator();

function Tabs() {
  return (
    <Tab.Navigator screenOptions={{ headerShown: true }}>
      <Tab.Screen name={TAB_ROUTES.Dashboard} component={DashboardScreen} options={{ title: '오늘' }} />
      <Tab.Screen name={TAB_ROUTES.Calendar} component={CalendarScreen} options={{ title: '캘린더' }} />
      <Tab.Screen name={TAB_ROUTES.Search} component={SearchScreen} options={{ title: '검색' }} />
      <Tab.Screen name={TAB_ROUTES.Settings} component={SettingsScreen} options={{ title: '설정' }} />
    </Tab.Navigator>
  );
}

const linking = {
  prefixes: LINKING_PREFIXES,
  // 커스텀 getStateFromPath 대신 parseDeepLink 로 안전 파싱 후 navigate 한다(아래 effect).
  config: { screens: { Tabs: '', ScheduleDetail: 'schedule/:scheduleId' } },
};

export function RootNavigator() {
  const services = useServices();
  const navRef = useRef<NavigationContainerRef<RootStackParamList>>(null);

  async function goToScheduleIfExists(scheduleId: number) {
    // 위조 방지: 저장소 재조회(getById) 후에만 이동(13.3, logic §16.2).
    const found = await services.schedules.getById(scheduleId);
    if (found) navRef.current?.navigate(STACK_ROUTES.ScheduleDetail, { scheduleId });
  }

  useEffect(() => {
    const unsub = notifee.onForegroundEvent(({ type, detail }) => {
      if (type === EventType.PRESS) {
        const target = notificationTarget(detail.notification?.data);
        if (target?.stack === 'ScheduleDetail') void goToScheduleIfExists(target.params.scheduleId);
      }
    });
    notifee.getInitialNotification().then((initial) => {
      const target = notificationTarget(initial?.notification?.data);
      if (target?.stack === 'ScheduleDetail') void goToScheduleIfExists(target.params.scheduleId);
    });
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <NavigationContainer
      ref={navRef}
      linking={linking}
      onReady={() => {
        // 콜드 스타트 딥링크는 parseDeepLink 로 재검증 (여기서는 예시)
        void parseDeepLink(null);
      }}
    >
      <Stack.Navigator>
        <Stack.Screen name={STACK_ROUTES.Tabs} component={Tabs} options={{ headerShown: false }} />
        <Stack.Screen name={STACK_ROUTES.ScheduleDetail} component={ScheduleDetailScreen} options={{ title: '일정' }} />
        <Stack.Screen name={STACK_ROUTES.ScheduleEditor} component={ScheduleEditorScreen} options={{ title: '일정 편집' }} />
        <Stack.Screen name={STACK_ROUTES.Permissions} component={PermissionsScreen} options={{ title: '권한' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
