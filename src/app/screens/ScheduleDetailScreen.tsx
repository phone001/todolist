/**
 * 일정 상세 — 완료 토글 / 삭제 + 실행취소 (F-04/F-05, AC-10, N-3).
 * 헤더 우측「편집」→ ScheduleEditor 수정 진입 (F-03, logic v1.4 §16.2, §16.3).
 * 바인딩: ScheduleService.softDelete/restore/toggleDone.
 * 환경 제약: react / react-native 의존 → 파이프라인 미실행(정적 리뷰).
 */
import React, { useEffect, useLayoutEffect, useState } from 'react';
import { Button, Pressable, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useServices } from '../bootstrap/AppContext.tsx';
import { useShellStore } from '../state/stores.native.ts';
import type { Schedule } from '../../core/domain/types.ts';
import { STACK_ROUTES, type RootStackParamList } from '../navigation/routes.ts';

type DetailNavProp = NativeStackNavigationProp<RootStackParamList>;

type Props = {
  route: { params: RootStackParamList['ScheduleDetail'] };
  navigation: { goBack: () => void };
};

export function ScheduleDetailScreen({ route, navigation }: Props) {
  const { schedules } = useServices();
  const invalidate = useShellStore((s) => s.invalidate);
  const nav = useNavigation<DetailNavProp>();
  const { scheduleId } = route.params;
  const [item, setItem] = useState<Schedule | null>(null);

  useEffect(() => {
    void (async () => {
      setItem(await schedules.getById(scheduleId));
    })();
  }, [schedules, scheduleId]);

  // 헤더 우측「편집」— ScheduleEditor 수정 진입 (F-03, logic §16.2, §16.3)
  useLayoutEffect(() => {
    nav.setOptions({
      headerRight: () => (
        <Pressable
          onPress={() => nav.navigate(STACK_ROUTES.ScheduleEditor, { scheduleId })}
          accessibilityLabel="일정 편집"
          style={{ paddingHorizontal: 12 }}
        >
          <Text>편집</Text>
        </Pressable>
      ),
    });
  }, [nav, scheduleId]);

  if (!item) return <Text style={{ padding: 24 }}>일정을 찾을 수 없습니다</Text>;

  return (
    <View style={{ padding: 24, gap: 12 }}>
      <Text style={{ fontSize: 18 }}>{item.title}</Text>
      <Text>{new Date(item.startAt).toLocaleString()}</Text>
      <Button
        title={item.isDone ? '미완료로' : '완료로'}
        onPress={async () => {
          await schedules.toggleDone(item.id, !item.isDone);
          invalidate('list', 'dashboard');
          setItem({ ...item, isDone: !item.isDone });
        }}
      />
      <Button
        title="삭제"
        onPress={async () => {
          await schedules.softDelete(item.id);
          invalidate('list', 'dashboard');
          navigation.goBack();
          // UI: 스낵바 "실행취소" → schedules.restore(item.id) (N-3: 5분/세션 내)
        }}
      />
    </View>
  );
}
