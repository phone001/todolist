/**
 * 일정 상세 — 제목·일시·중요도·유형·알림·내용 표시 + 완료 토글 / 삭제 (F-04/F-05, AC-10, N-3).
 * 헤더 우측「편집」→ ScheduleEditor 수정 진입 (F-03, logic §16.2, §16.3).
 * 바인딩: ScheduleService.getById/toggleDone/softDelete, CategoryService.list.
 * 환경 제약: react / react-native 의존 → 파이프라인 미실행(정적 리뷰).
 */
import React, { useEffect, useLayoutEffect, useState } from 'react';
import { Alert, Button, Pressable, ScrollView, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useServices } from '../bootstrap/AppContext.tsx';
import { useShellStore } from '../state/stores.native.ts';
import type { Priority, Schedule } from '../../core/domain/types.ts';
import { STACK_ROUTES, type RootStackParamList } from '../navigation/routes.ts';

type DetailNavProp = NativeStackNavigationProp<RootStackParamList>;

type Props = {
  route: { params: RootStackParamList['ScheduleDetail'] };
  navigation: { goBack: () => void };
};

const PRIORITY_LABEL: Record<Priority, string> = { LOW: '낮음', NORMAL: '보통', HIGH: '높음' };

function fmt(ts: number): string {
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', gap: 12 }}>
      <Text style={{ width: 64, color: '#888', fontSize: 14 }}>{label}</Text>
      <View style={{ flex: 1 }}>{children}</View>
    </View>
  );
}

export function ScheduleDetailScreen({ route, navigation }: Props) {
  const { schedules, categories } = useServices();
  const invalidate = useShellStore((s) => s.invalidate);
  const nav = useNavigation<DetailNavProp>();
  const { scheduleId } = route.params;

  const [item, setItem] = useState<Schedule | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [categoryName, setCategoryName] = useState<string>('');

  useEffect(() => {
    void (async () => {
      const [s, cats] = await Promise.all([schedules.getById(scheduleId), categories.list()]);
      setItem(s);
      setLoaded(true);
      if (s) setCategoryName(cats.find((c) => c.id === s.categoryId)?.name ?? '기타');
    })();
  }, [schedules, categories, scheduleId]);

  // 헤더 우측「편집」— ScheduleEditor 수정 진입 (F-03, logic §16.2, §16.3)
  useLayoutEffect(() => {
    nav.setOptions({
      headerRight: () => (
        <Pressable
          onPress={() => nav.navigate(STACK_ROUTES.ScheduleEditor, { scheduleId })}
          accessibilityLabel="일정 편집"
          style={{ paddingHorizontal: 12 }}
        >
          <Text style={{ fontSize: 16 }}>편집</Text>
        </Pressable>
      ),
    });
  }, [nav, scheduleId]);

  if (!loaded) return <Text style={{ padding: 24, color: '#888' }}>불러오는 중…</Text>;
  if (!item) return <Text style={{ padding: 24 }}>일정을 찾을 수 없습니다</Text>;

  const confirmDelete = () => {
    Alert.alert('일정 삭제', `"${item.title}" 을(를) 삭제할까요?`, [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: async () => {
          await schedules.softDelete(item.id);
          invalidate('list', 'dashboard', 'search');
          navigation.goBack();
          // UI: 스낵바 "실행취소" → schedules.restore(item.id) (N-3: 5분/세션 내)
        },
      },
    ]);
  };

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 24, gap: 16 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Text
          style={{
            fontSize: 20,
            fontWeight: '700',
            flex: 1,
            textDecorationLine: item.isDone ? 'line-through' : 'none',
            color: item.isDone ? '#999' : '#111',
          }}
        >
          {item.title}
        </Text>
        <View
          style={{
            paddingVertical: 3,
            paddingHorizontal: 10,
            borderRadius: 12,
            backgroundColor: item.isDone ? '#e6f0ff' : '#f0f0f0',
          }}
        >
          <Text style={{ fontSize: 12, color: item.isDone ? '#007AFF' : '#666' }}>
            {item.isDone ? '완료' : '미완료'}
          </Text>
        </View>
      </View>

      <View style={{ gap: 12 }}>
        <Row label="일시">
          <Text style={{ fontSize: 15 }}>
            {fmt(item.startAt)}
            {item.endAt != null ? `\n~ ${fmt(item.endAt)}` : ''}
          </Text>
        </Row>
        <Row label="중요도">
          <Text style={{ fontSize: 15 }}>{PRIORITY_LABEL[item.priority]}</Text>
        </Row>
        <Row label="유형">
          <Text style={{ fontSize: 15 }}>{categoryName}</Text>
        </Row>
        <Row label="알림">
          <Text style={{ fontSize: 15 }}>{item.notifyAtStart ? '시작 시 알림' : '없음'}</Text>
        </Row>
        <Row label="내용">
          <Text style={{ fontSize: 15, color: item.memo ? '#111' : '#aaa', lineHeight: 21 }}>
            {item.memo && item.memo.trim() !== '' ? item.memo : '내용 없음'}
          </Text>
        </Row>
      </View>

      <View style={{ gap: 8, marginTop: 8 }}>
        <Button
          title={item.isDone ? '미완료로' : '완료로'}
          onPress={async () => {
            await schedules.toggleDone(item.id, !item.isDone);
            invalidate('list', 'dashboard');
            setItem({ ...item, isDone: !item.isDone });
          }}
        />
        <Button title="삭제" color="#FF3B30" onPress={confirmDelete} />
      </View>
    </ScrollView>
  );
}
