/**
 * 일정 작성/수정 (F-01/F-03, AC-01~03).
 * 바인딩: ScheduleService.create/update, CategoryService.list. 검증 오류는 필드 인라인.
 * 환경 제약: react / react-native 의존 → 파이프라인 미실행(정적 리뷰).
 */
import React, { useState } from 'react';
import { Button, Text, TextInput, View } from 'react-native';
import { useServices } from '../bootstrap/AppContext.tsx';
import { useShellStore } from '../state/stores.native.ts';
import { ValidationError, AppError } from '../../core/domain/errors.ts';
import type { RootStackParamList } from '../navigation/routes.ts';

type Props = {
  route: { params?: RootStackParamList['ScheduleEditor'] };
  navigation: { goBack: () => void };
};

export function ScheduleEditorScreen({ route, navigation }: Props) {
  const { schedules } = useServices();
  const invalidate = useShellStore((s) => s.invalidate);
  const editingId = route.params?.scheduleId;

  const [title, setTitle] = useState('');
  const [startAt, setStartAt] = useState<number>(Date.now() + 3_600_000);
  const [fieldError, setFieldError] = useState<{ field?: string; message: string } | null>(null);

  async function save() {
    setFieldError(null);
    try {
      if (editingId === undefined) {
        await schedules.create({ title, startAt, reminderOffsets: [10], notifyAtStart: true });
      } else {
        await schedules.update(editingId, { title, startAt });
      }
      invalidate('list', 'dashboard', 'search', 'categories');
      navigation.goBack();
    } catch (err) {
      if (err instanceof ValidationError || err instanceof AppError) {
        setFieldError({ field: err.field, message: err.message });
      } else {
        setFieldError({ message: '저장에 실패했습니다.' });
      }
    }
  }

  return (
    <View style={{ padding: 24, gap: 12 }}>
      <TextInput placeholder="제목" value={title} onChangeText={setTitle} style={{ borderBottomWidth: 1 }} />
      {fieldError?.field === 'title' ? <Text style={{ color: 'red' }}>{fieldError.message}</Text> : null}
      <TextInput
        placeholder="시작 시각(epoch ms)"
        keyboardType="numeric"
        value={String(startAt)}
        onChangeText={(t) => setStartAt(Number(t) || 0)}
        style={{ borderBottomWidth: 1 }}
      />
      {fieldError && !fieldError.field ? <Text style={{ color: 'red' }}>{fieldError.message}</Text> : null}
      <Button title="저장" onPress={save} />
    </View>
  );
}
