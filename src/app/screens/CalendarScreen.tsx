/**
 * 캘린더/목록 — 기간 조회 + 완료 토글 + 무한 스크롤 (F-02/05, AC-11/12).
 * 바인딩: ScheduleService.findInRange / toggleDone → list·dashboard 무효화.
 * 환경 제약: react / react-native 의존 → 파이프라인 미실행(정적 리뷰).
 */
import React, { useCallback, useEffect } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { useServices } from '../bootstrap/AppContext.tsx';
import { useShellStore } from '../state/stores.native.ts';

const DAY = 86_400_000;

export function CalendarScreen() {
  const { schedules } = useServices();
  const list = useShellStore((s) => s.list);
  const setList = useShellStore((s) => s.setList);
  const invalidate = useShellStore((s) => s.invalidate);

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
