/**
 * 일정 작성/수정 (F-01/F-03, AC-01~03).
 * 바인딩: ScheduleService.create/update/getById, CategoryService.list. 검증 오류는 필드 인라인.
 * 환경 제약: react / react-native 의존 → 파이프라인 미실행(정적 리뷰).
 */
import React, { useState, useEffect } from 'react';
import {
  Button,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useServices } from '../bootstrap/AppContext.tsx';
import { useShellStore } from '../state/stores.native.ts';
import { ValidationError, AppError } from '../../core/domain/errors.ts';
import { localWallToEpoch } from '../../core/domain/time.ts';
import type { RootStackParamList } from '../navigation/routes.ts';

type Props = {
  route: { params?: RootStackParamList['ScheduleEditor'] };
  navigation: { goBack: () => void };
};

/** epoch ms → 로컬 wall-clock 문자열 파싱용 헬퍼 (표시 초기값) */
function epochToWall(ts: number): { date: string; time: string } {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return { date, time };
}

/** 'YYYY-MM-DD' + 'HH:mm' → epoch ms. 파싱 실패 시 NaN. */
function wallToEpoch(date: string, time: string, timeZone: string): number {
  // date: YYYY-MM-DD, time: HH:mm
  const dp = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const tp = time.match(/^(\d{2}):(\d{2})$/);
  if (!dp || !tp) return NaN;
  const [, y, mo, d] = dp.map(Number);
  const [, h, mi] = tp.map(Number);
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59) return NaN;
  return localWallToEpoch(y, mo, d, h, mi, timeZone);
}

export function ScheduleEditorScreen({ route, navigation }: Props) {
  const { schedules } = useServices();
  const invalidate = useShellStore((s) => s.invalidate);
  const editingId = route.params?.scheduleId;

  // 단말 로컬 타임존 (P-16)
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  // 시작 일시 초기값: 다음 정시 (1시간 후 정각)
  const defaultStart = (() => {
    const d = new Date(Date.now() + 3_600_000);
    d.setMinutes(0, 0, 0);
    return epochToWall(d.getTime());
  })();

  const [title, setTitle] = useState('');
  const [startDate, setStartDate] = useState(defaultStart.date);
  const [startTime, setStartTime] = useState(defaultStart.time);
  const [memo, setMemo] = useState('');
  const [notifyAtStart, setNotifyAtStart] = useState(true);
  // field → error message
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [globalError, setGlobalError] = useState<string | null>(null);

  // 수정 모드: 기존 일정 데이터로 프리필
  useEffect(() => {
    if (editingId === undefined) return;
    schedules.getById(editingId).then((s) => {
      if (!s) {
        setGlobalError('일정을 찾을 수 없습니다.');
        navigation.goBack();
        return;
      }
      setTitle(s.title);
      const w = epochToWall(s.startAt);
      setStartDate(w.date);
      setStartTime(w.time);
      setMemo(s.memo ?? '');
      setNotifyAtStart(s.notifyAtStart);
    });
  }, [editingId]); // eslint-disable-line react-hooks/exhaustive-deps

  function clearErrors() {
    setFieldErrors({});
    setGlobalError(null);
  }

  function applyValidationError(err: ValidationError | AppError) {
    if (err instanceof ValidationError && err.errors.length > 0) {
      const map: Record<string, string> = {};
      let hasGlobal = false;
      for (const e of err.errors) {
        if (e.field) {
          map[e.field] = e.message;
        } else if (!hasGlobal) {
          setGlobalError(e.message);
          hasGlobal = true;
        }
      }
      setFieldErrors(map);
    } else {
      // AppError or single-error ValidationError
      if (err.field) {
        setFieldErrors({ [err.field]: err.message });
      } else {
        setGlobalError(err.message);
      }
    }
  }

  async function save() {
    clearErrors();

    const startAt = wallToEpoch(startDate, startTime, timeZone);
    if (Number.isNaN(startAt)) {
      setFieldErrors({ startAt: '올바른 날짜(YYYY-MM-DD)와 시각(HH:mm)을 입력하세요.' });
      return;
    }

    const memoVal = memo.trim() === '' ? undefined : memo.trim();

    try {
      if (editingId === undefined) {
        await schedules.create({
          title,
          startAt,
          memo: memoVal,
          notifyAtStart,
          reminderOffsets: [10],
        });
      } else {
        await schedules.update(editingId, {
          title,
          startAt,
          memo: memoVal ?? null,
          notifyAtStart,
        });
      }
      invalidate('list', 'dashboard', 'search', 'categories');
      navigation.goBack();
    } catch (err) {
      if (err instanceof ValidationError || err instanceof AppError) {
        applyValidationError(err);
      } else {
        setGlobalError('저장에 실패했습니다.');
      }
    }
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 24, gap: 12 }}>
      {/* 전역 오류 */}
      {globalError ? (
        <Text style={{ color: 'red', marginBottom: 4 }}>{globalError}</Text>
      ) : null}

      {/* 제목 */}
      <Text style={{ fontWeight: 'bold' }}>제목 *</Text>
      <TextInput
        placeholder="제목"
        value={title}
        onChangeText={setTitle}
        style={{ borderBottomWidth: 1, paddingVertical: 4 }}
      />
      {fieldErrors.title ? (
        <Text style={{ color: 'red', fontSize: 12 }}>{fieldErrors.title}</Text>
      ) : null}

      {/* 시작 날짜 */}
      <Text style={{ fontWeight: 'bold', marginTop: 8 }}>시작 날짜 * (YYYY-MM-DD)</Text>
      <TextInput
        placeholder="2026-09-06"
        value={startDate}
        onChangeText={setStartDate}
        keyboardType="numbers-and-punctuation"
        style={{ borderBottomWidth: 1, paddingVertical: 4 }}
      />

      {/* 시작 시각 */}
      <Text style={{ fontWeight: 'bold', marginTop: 8 }}>시작 시각 * (HH:mm)</Text>
      <TextInput
        placeholder="09:00"
        value={startTime}
        onChangeText={setStartTime}
        keyboardType="numbers-and-punctuation"
        style={{ borderBottomWidth: 1, paddingVertical: 4 }}
      />
      {fieldErrors.startAt ? (
        <Text style={{ color: 'red', fontSize: 12 }}>{fieldErrors.startAt}</Text>
      ) : null}

      {/* 내용/메모 */}
      <Text style={{ fontWeight: 'bold', marginTop: 8 }}>내용 (선택)</Text>
      <TextInput
        placeholder="내용을 입력하세요"
        value={memo}
        onChangeText={setMemo}
        multiline
        numberOfLines={4}
        style={{
          borderWidth: 1,
          borderColor: '#ccc',
          borderRadius: 4,
          padding: 8,
          minHeight: 80,
          textAlignVertical: 'top',
        }}
      />
      {fieldErrors.memo ? (
        <Text style={{ color: 'red', fontSize: 12 }}>{fieldErrors.memo}</Text>
      ) : null}

      {/* 알림 여부 */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: 8,
        }}
      >
        <Text style={{ fontWeight: 'bold' }}>시작 시 알림</Text>
        <Switch value={notifyAtStart} onValueChange={setNotifyAtStart} />
      </View>

      {/* 저장 버튼 */}
      <View style={{ marginTop: 16 }}>
        <Button title="저장" onPress={save} />
      </View>
    </ScrollView>
  );
}
