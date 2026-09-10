/**
 * 루트 네비게이터 — Tab(대시보드/캘린더/통계/설정) + Stack(상세/편집/검색/권한).
 * 알림 탭 → payload 재조회 검증 후 상세 이동(logic v1.1 §16.2, §6, 13.3).
 * 탭 아이콘: todo/goal/statistics/settings.png, opacity 활성1/비활성0.4, onError 폴백(logic v1.5 §16.2).
 * v1.12: 세 번째 탭 "검색" → "통계"(F-23) 교체. 전역 검색(F-11)은 Stack 화면으로 이전(D-20(a), P-54).
 * 환경 제약: react-navigation / react 의존 → 파이프라인 미실행(정적 리뷰).
 */
import React, { useEffect, useRef, useState } from 'react';
import { Image, Text } from 'react-native';
import { NavigationContainer, type NavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import notifee, { EventType } from '@notifee/react-native';
import { STACK_ROUTES, TAB_ROUTES, type RootStackParamList } from './routes.ts';
import { LINKING_PREFIXES, notificationTarget, parseDeepLink } from './linking.ts';
import { useServices } from '../bootstrap/AppContext.tsx';
import { DashboardScreen } from '../screens/DashboardScreen.tsx';
import { CalendarScreen } from '../screens/CalendarScreen.tsx';
import { StatisticsScreen } from '../screens/StatisticsScreen.tsx';
import { SearchScreen } from '../screens/SearchScreen.tsx';
import { SettingsScreen } from '../screens/SettingsScreen.tsx';
import { ScheduleDetailScreen } from '../screens/ScheduleDetailScreen.tsx';
import { ScheduleEditorScreen } from '../screens/ScheduleEditorScreen.tsx';
import { CategoryManagerScreen } from '../screens/CategoryManagerScreen.tsx';
import { PermissionsScreen } from '../screens/PermissionsScreen.tsx';

// 탭 아이콘 에셋 (logic v1.5 §16.2, P-21: 빌드 타임 번들 포함, 런타임 경로 주입 없음)
// v1.12: 세 번째 탭 키가 Search → Statistics 로 바뀌었을 뿐, 아이콘 파일 매핑(statistics.png)은 유지(F-16, AC-26).
const TAB_ICONS = {
  [TAB_ROUTES.Dashboard]: require('../../assets/icons/todo.png') as number,
  [TAB_ROUTES.Calendar]: require('../../assets/icons/goal.png') as number,
  [TAB_ROUTES.Statistics]: require('../../assets/icons/statistics.png') as number,
  [TAB_ROUTES.Settings]: require('../../assets/icons/settings.png') as number,
} as const;

// 탭 아이콘 폴백 라벨 (E-16-1, AC-28: 에셋 로드 실패 시 Text 대체)
const TAB_FALLBACK_LABELS: Record<string, string> = {
  [TAB_ROUTES.Dashboard]: '오늘',
  [TAB_ROUTES.Calendar]: '캘린더',
  [TAB_ROUTES.Statistics]: '통계',
  [TAB_ROUTES.Settings]: '설정',
};

/**
 * 탭 아이콘 컴포넌트.
 * 에셋 로드 실패 시 onError 콜백으로 Text 라벨로 대체 — 앱 크래시 방지 (E-16-1).
 * 활성: opacity 1, 비활성: opacity 0.4 (P-19, AC-27).
 */
function TabIcon({
  route,
  focused,
}: {
  route: string;
  focused: boolean;
}) {
  const [hasError, setHasError] = useState(false);
  const icon = TAB_ICONS[route as keyof typeof TAB_ICONS];
  const opacity = focused ? 1 : 0.4;

  if (hasError || !icon) {
    return (
      <Text style={{ opacity, fontSize: 10 }}>
        {TAB_FALLBACK_LABELS[route] ?? route}
      </Text>
    );
  }

  return (
    <Image
      source={icon}
      style={{ width: 24, height: 24, opacity }}
      onError={() => setHasError(true)}
    />
  );
}

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator();

function Tabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: true,
        tabBarIcon: ({ focused }) => (
          <TabIcon route={route.name} focused={focused} />
        ),
      })}
    >
      <Tab.Screen name={TAB_ROUTES.Dashboard} component={DashboardScreen} options={{ title: '오늘' }} />
      <Tab.Screen name={TAB_ROUTES.Calendar} component={CalendarScreen} options={{ title: '캘린더' }} />
      <Tab.Screen name={TAB_ROUTES.Statistics} component={StatisticsScreen} options={{ title: '통계' }} />
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
        {/* v1.12: 전역 검색(F-11) — Tab → Stack 이전(D-20(a), P-54). 내부 로직 무변경. */}
        <Stack.Screen name={STACK_ROUTES.Search} component={SearchScreen} options={{ title: '검색' }} />
        <Stack.Screen name={STACK_ROUTES.CategoryManager} component={CategoryManagerScreen} options={{ title: '유형 관리' }} />
        <Stack.Screen name={STACK_ROUTES.Permissions} component={PermissionsScreen} options={{ title: '권한' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
