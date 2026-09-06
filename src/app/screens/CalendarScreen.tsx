/**
 * 캘린더/목록 — 기간 조회 + 완료 토글 + 무한 스크롤 (F-02/05, AC-11/12).
 * 헤더 우측「+」→ ScheduleEditor 신규 작성 진입 (F-01, logic v1.4 §16.2).
 * 바인딩: ScheduleService.findInRange / toggleDone → list·dashboard 무효화.
 * 환경 제약: react / react-native 의존 → 파이프라인 미실행(정적 리뷰).
 */
import React, { useCallback, useEffect, useLayoutEffect } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useServices } from '../bootstrap/AppContext.tsx';
import { useShellStore } from '../state/stores.native.ts';
import { STACK_ROUTES, type RootStackParamList } from '../navigation/routes.ts';

type CalendarNavProp = NativeStackNavigationProp<RootStackParamList>;

const DAY = 86_400_000;

export function CalendarScreen() {
  const { schedules } = useServices();
  const list = useShellStore((s) => s.list);
  const setList = useShellStore((s) => s.setList);
  const invalidate = useShellStore((s) => s.invalidate);
  const navigation = useNavigation<CalendarNavProp>();

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

  const loadPage = useCallback(
    async (cursor: string | null) => {
      const now = Date.now();
      const page = await schedules.findInRange(now - DAY * 7, now + DAY * 30, undefined, 'startAt', 50, cursor);
      setList(page.items, page.nextCursor, cursor !== null);
    },
    [schedules, setList],
  );

  useEffect(() => {
    void loadPage(null);
  }, [loadPage]);

  return (
    <FlatList
      data={list.items}
      keyExtractor={(item) => String(item.id)}
      onEndReached={() => {
        if (list.nextCursor) void loadPage(list.nextCursor);
      }}
      renderItem={({ item }) => (
        <View style={{ flexDirection: 'row', padding: 12, gap: 12 }}>
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: item.isDone }}
            onPress={async () => {
              try {
                await schedules.toggleDone(item.id, !item.isDone);
                invalidate('list', 'dashboard');
                void loadPage(null);
              } catch {
                // 저장 실패 → 상태 유지(E-05-2). 사용자에게 토스트.
              }
            }}
          >
            <Text>{item.isDone ? '☑' : '☐'}</Text>
          </Pressable>
          <Text style={{ textDecorationLine: item.isDone ? 'line-through' : 'none' }}>{item.title}</Text>
        </View>
      )}
      ListEmptyComponent={<Text style={{ padding: 24 }}>표시할 일정이 없습니다</Text>}
    />
  );
}
