/**
 * 일정 작성/수정 (F-01/F-03, AC-01~03).
 * 바인딩: ScheduleService.create/update/getById, CategoryService.list. 검증 오류는 필드 인라인.
 * 환경 제약: react / react-native 의존 → 파이프라인 미실행(정적 리뷰).
 *
 * v1.6 변경: 날짜/시각 TextInput → @react-native-community/datetimepicker 8.6.0
 *   - startAt: number (epoch ms) 단일 상태
 *   - endAt: number | null (epoch ms), Switch 토글로 활성화
 *   - localWallToEpoch 저장 경로 사용 제거 (함수·V-26 테스트 유지)
 * v1.10 변경(OI-19): 신규 모드에서 route.params.presetDate(대시보드 기준 날짜, F-20)가 있으면
 *   기본 시작 일시 = presetDate + 9h. 저장·검증 규칙은 불변.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  Button,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { useServices } from '../bootstrap/AppContext.tsx';
import { useShellStore } from '../state/stores.native.ts';
import { SETTING_KEYS } from '../state/bindings.ts';
import { ValidationError, AppError } from '../../core/domain/errors.ts';
import type { Category, Priority } from '../../core/domain/types.ts';
import type { RootStackParamList } from '../navigation/routes.ts';
import { editorPresetStartAt } from './dashboardViewModel.ts';

const PRIORITY_OPTIONS: Array<{ value: Priority; label: string }> = [
  { value: 'LOW', label: '낮음' },
  { value: 'NORMAL', label: '보통' },
  { value: 'HIGH', label: '높음' },
];

function parseJson<T>(raw: string | null, fallback: T): T {
  if (raw === null) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

type Props = {
  route: { params?: RootStackParamList['ScheduleEditor'] };
  navigation: { goBack: () => void };
};

// ── 헬퍼 ──────────────────────────────────────────────────────────────────────

/** epoch ms → 로컬 wall-clock 표시 문자열 (시작/종료 버튼 레이블용) */
function formatEpochLabel(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    ` ${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
}

/** 다음 정시(현재 + 1시간, 분/초/ms = 0) epoch ms */
function defaultStartEpoch(): number {
  const d = new Date(Date.now() + 3_600_000);
  d.setMinutes(0, 0, 0);
  return d.getTime();
}

// ── 피커 표시 단계 ─────────────────────────────────────────────────────────────

type PickerTarget = 'start' | 'end';
type PickerMode = 'date' | 'time';

// ── 컴포넌트 ───────────────────────────────────────────────────────────────────

export function ScheduleEditorScreen({ route, navigation }: Props) {
  const { schedules, settings, categories } = useServices();
  const invalidate = useShellStore((s) => s.invalidate);
  const editingId = route.params?.scheduleId;
  const presetDate = route.params?.presetDate;

  // ── 폼 상태 ────────────────────────────────────────────────────────────────
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<Priority>('NORMAL');
  const [categoryId, setCategoryId] = useState<number | undefined>(undefined);
  const [cats, setCats] = useState<Category[]>([]);
  /** 설정의 "알림 사용" 전역 스위치. false 면 알림 필드 비활성 + 저장 시 알림 미포함. */
  const [notifGloballyOn, setNotifGloballyOn] = useState(true);
  /**
   * 시작 일시: epoch ms 단일 상태.
   * 신규 + presetDate(OI-19) → 해당 날짜 09:00 로컬, 그 외 → 다음 정시.
   */
  const [startAt, setStartAt] = useState<number>(() =>
    editingId === undefined && presetDate !== undefined
      ? editorPresetStartAt(presetDate)
      : defaultStartEpoch(),
  );
  /** 종료 일시 활성화 여부 */
  const [endAtEnabled, setEndAtEnabled] = useState(false);
  /** 종료 일시: epoch ms (endAtEnabled=false 시 null 전송) */
  const [endAt, setEndAt] = useState<number>(defaultStartEpoch);
  const [memo, setMemo] = useState('');
  const [notifyAtStart, setNotifyAtStart] = useState(true);

  // ── 피커 표시 상태 ─────────────────────────────────────────────────────────
  /**
   * Android: OS 다이얼로그 방식. 피커 표시 여부 + 2단계(date→time) 관리.
   * iOS: Modal 안에 인라인 피커 표시.
   */
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerTarget, setPickerTarget] = useState<PickerTarget>('start');
  const [pickerMode, setPickerMode] = useState<PickerMode>('date');
  /** iOS Modal 내부 임시 Date (확인 전 취소 지원) */
  const [tempDate, setTempDate] = useState<Date>(new Date(startAt));

  // ── 오류 상태 ─────────────────────────────────────────────────────────────
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [globalError, setGlobalError] = useState<string | null>(null);

  // ── 유형 목록 + 설정(전역 알림·신규 기본값) 로드 ───────────────────────────
  useEffect(() => {
    void (async () => {
      const [list, notifRaw, prioRaw, catRaw] = await Promise.all([
        categories.list(),
        settings.get(SETTING_KEYS.notifEnabled),
        settings.get(SETTING_KEYS.scheduleDefaultPriority),
        settings.get(SETTING_KEYS.scheduleDefaultCategoryId),
      ]);
      setCats(list);
      const notifOn = parseJson<boolean>(notifRaw, true);
      setNotifGloballyOn(notifOn);
      if (!notifOn) setNotifyAtStart(false);
      // 신규 작성일 때만 설정 기본값 적용
      if (editingId === undefined) {
        setPriority(parseJson<Priority>(prioRaw, 'NORMAL'));
        const defCat = parseJson<number | null>(catRaw, null);
        if (defCat != null && list.some((c) => c.id === defCat)) setCategoryId(defCat);
      }
    })();
  }, [categories, settings, editingId]);

  // ── 수정 모드 프리필 ───────────────────────────────────────────────────────
  useEffect(() => {
    if (editingId === undefined) return;
    schedules.getById(editingId).then((s) => {
      if (!s) {
        setGlobalError('일정을 찾을 수 없습니다.');
        navigation.goBack();
        return;
      }
      setTitle(s.title);
      setStartAt(s.startAt);
      if (s.endAt != null) {
        setEndAtEnabled(true);
        setEndAt(s.endAt);
      }
      setMemo(s.memo ?? '');
      setNotifyAtStart(s.notifyAtStart);
      setPriority(s.priority);
      setCategoryId(s.categoryId);
    });
  }, [editingId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── 오류 헬퍼 ─────────────────────────────────────────────────────────────
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
      if (err.field) {
        setFieldErrors({ [err.field]: err.message });
      } else {
        setGlobalError(err.message);
      }
    }
  }

  // ── 피커 열기 ─────────────────────────────────────────────────────────────
  const openPicker = useCallback(
    (target: PickerTarget, mode: PickerMode) => {
      const current = target === 'start' ? startAt : endAt;
      setPickerTarget(target);
      setPickerMode(mode);
      setTempDate(new Date(current));
      setPickerVisible(true);
    },
    [startAt, endAt],
  );

  // ── DateTimePicker onChange ────────────────────────────────────────────────
  /**
   * Android: dismissed 이벤트이면 닫기. set 이면:
   *   - mode='date' → 날짜 반영 후 time 다이얼로그 자동 연속 열기
   *   - mode='time' → 최종 반영 후 닫기
   * iOS (Modal 내): tempDate 업데이트만. 확인 버튼 클릭 시 커밋.
   */
  const onPickerChange = useCallback(
    (event: DateTimePickerEvent, selected: Date | undefined) => {
      if (Platform.OS === 'android') {
        if (event.type === 'dismissed') {
          setPickerVisible(false);
          return;
        }
        // event.type === 'set'
        const picked = selected ?? new Date(pickerTarget === 'start' ? startAt : endAt);
        const ms = picked.getTime();
        if (!Number.isInteger(ms)) {
          setPickerVisible(false);
          return;
        }

        if (pickerMode === 'date') {
          // 날짜를 반영하되 기존 시/분은 유지
          const base = new Date(pickerTarget === 'start' ? startAt : endAt);
          const merged = new Date(ms);
          merged.setHours(base.getHours(), base.getMinutes(), 0, 0);
          const mergedMs = merged.getTime();
          if (pickerTarget === 'start') {
            setStartAt(mergedMs);
          } else {
            setEndAt(mergedMs);
          }
          // Android 2단계: 날짜 → 시각 연속 열기
          setPickerMode('time');
          setTempDate(merged);
          // 피커를 일단 닫았다가 time 모드로 재열기 (Android 다이얼로그 특성)
          setPickerVisible(false);
          // 다음 틱에 time 다이얼로그 오픈
          setTimeout(() => setPickerVisible(true), 0);
        } else {
          // mode='time' — 최종 반영
          const base = new Date(pickerTarget === 'start' ? startAt : endAt);
          base.setHours(picked.getHours(), picked.getMinutes(), 0, 0);
          const finalMs = base.getTime();
          if (pickerTarget === 'start') {
            setStartAt(finalMs);
          } else {
            setEndAt(finalMs);
          }
          setPickerVisible(false);
        }
      } else {
        // iOS: Modal 내부 임시 Date 업데이트
        if (selected) {
          setTempDate(selected);
        }
      }
    },
    [pickerMode, pickerTarget, startAt, endAt],
  );

  /** iOS Modal 확인 버튼 */
  const onIOSConfirm = useCallback(() => {
    const ms = tempDate.getTime();
    if (Number.isInteger(ms)) {
      if (pickerMode === 'date') {
        // 날짜만 반영, 기존 시/분 유지 → time 피커로 이동
        const base = new Date(pickerTarget === 'start' ? startAt : endAt);
        base.setFullYear(tempDate.getFullYear(), tempDate.getMonth(), tempDate.getDate());
        const merged = base.getTime();
        if (pickerTarget === 'start') {
          setStartAt(merged);
        } else {
          setEndAt(merged);
        }
        // time 단계로 전환
        setPickerMode('time');
        setTempDate(base);
      } else {
        // time 최종 반영
        const base = new Date(pickerTarget === 'start' ? startAt : endAt);
        base.setHours(tempDate.getHours(), tempDate.getMinutes(), 0, 0);
        const finalMs = base.getTime();
        if (pickerTarget === 'start') {
          setStartAt(finalMs);
        } else {
          setEndAt(finalMs);
        }
        setPickerVisible(false);
      }
    } else {
      setPickerVisible(false);
    }
  }, [tempDate, pickerMode, pickerTarget, startAt, endAt]);

  /** iOS Modal 취소 버튼 */
  const onIOSCancel = useCallback(() => {
    setPickerVisible(false);
  }, []);

  // ── 저장 ──────────────────────────────────────────────────────────────────
  async function save() {
    clearErrors();

    // 심층 방어: DateTimePicker는 항상 유효한 Date를 반환하지만 정수 검증 유지
    if (!Number.isInteger(startAt)) {
      setFieldErrors({ startAt: '유효한 시작 일시를 선택하세요.' });
      return;
    }

    const memoVal = memo.trim() === '' ? undefined : memo.trim();
    const endAtVal = endAtEnabled ? endAt : undefined;

    if (endAtEnabled && !Number.isInteger(endAt)) {
      setFieldErrors({ endAt: '유효한 종료 일시를 선택하세요.' });
      return;
    }

    // 설정에서 알림 전역 OFF 면 이 일정에는 알림을 걸지 않는다.
    const effNotify = notifGloballyOn && notifyAtStart;
    const effOffsets = notifGloballyOn ? [10] : [];

    try {
      if (editingId === undefined) {
        await schedules.create({
          title,
          startAt,
          endAt: endAtVal,
          memo: memoVal,
          priority,
          categoryId,
          notifyAtStart: effNotify,
          reminderOffsets: effOffsets,
        });
      } else {
        await schedules.update(editingId, {
          title,
          startAt,
          endAt: endAtEnabled ? endAt : null,
          memo: memoVal ?? null,
          priority,
          categoryId,
          notifyAtStart: effNotify,
          // 알림 전역 OFF 면 기존 알림도 제거. ON 이면 기존 사전 알림 오프셋은 유지(미전달).
          ...(notifGloballyOn ? {} : { reminderOffsets: [] }),
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

  // ── 렌더 ──────────────────────────────────────────────────────────────────
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

      {/* 시작 일시 */}
      <Text style={{ fontWeight: 'bold', marginTop: 8 }}>시작 일시 *</Text>
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
        <Pressable
          onPress={() => openPicker('start', 'date')}
          style={{
            flex: 1,
            borderWidth: 1,
            borderColor: '#888',
            borderRadius: 4,
            padding: 8,
          }}
        >
          <Text>{formatEpochLabel(startAt).split(' ')[0]}</Text>
        </Pressable>
        <Pressable
          onPress={() => openPicker('start', 'time')}
          style={{
            flex: 1,
            borderWidth: 1,
            borderColor: '#888',
            borderRadius: 4,
            padding: 8,
          }}
        >
          <Text>{formatEpochLabel(startAt).split(' ')[1]}</Text>
        </Pressable>
      </View>
      {fieldErrors.startAt ? (
        <Text style={{ color: 'red', fontSize: 12 }}>{fieldErrors.startAt}</Text>
      ) : null}

      {/* 종료 일시 */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: 8,
        }}
      >
        <Text style={{ fontWeight: 'bold' }}>종료 일시</Text>
        <Switch value={endAtEnabled} onValueChange={setEndAtEnabled} />
      </View>
      {endAtEnabled ? (
        <>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
            <Pressable
              onPress={() => openPicker('end', 'date')}
              style={{
                flex: 1,
                borderWidth: 1,
                borderColor: '#888',
                borderRadius: 4,
                padding: 8,
              }}
            >
              <Text>{formatEpochLabel(endAt).split(' ')[0]}</Text>
            </Pressable>
            <Pressable
              onPress={() => openPicker('end', 'time')}
              style={{
                flex: 1,
                borderWidth: 1,
                borderColor: '#888',
                borderRadius: 4,
                padding: 8,
              }}
            >
              <Text>{formatEpochLabel(endAt).split(' ')[1]}</Text>
            </Pressable>
          </View>
          {fieldErrors.endAt ? (
            <Text style={{ color: 'red', fontSize: 12 }}>{fieldErrors.endAt}</Text>
          ) : null}
        </>
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

      {/* 중요도 */}
      <Text style={{ fontWeight: 'bold', marginTop: 8 }}>중요도</Text>
      <View
        style={{
          flexDirection: 'row',
          borderWidth: 1,
          borderColor: '#ddd',
          borderRadius: 6,
          overflow: 'hidden',
          marginTop: 4,
        }}
      >
        {PRIORITY_OPTIONS.map((o, i) => {
          const active = o.value === priority;
          return (
            <Pressable
              key={o.value}
              onPress={() => setPriority(o.value)}
              style={{
                flex: 1,
                paddingVertical: 10,
                alignItems: 'center',
                backgroundColor: active ? '#007AFF' : '#fff',
                borderLeftWidth: i === 0 ? 0 : 1,
                borderLeftColor: '#ddd',
              }}
            >
              <Text style={{ color: active ? '#fff' : '#333' }}>{o.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {/* 유형 */}
      <Text style={{ fontWeight: 'bold', marginTop: 8 }}>유형</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
        {cats.map((c) => {
          // 미선택 상태에서는 시스템 기본 유형("기타")이 저장 시 적용되므로 그것을 활성 표시
          const active = categoryId === undefined ? c.isSystem : c.id === categoryId;
          return (
            <Pressable
              key={c.id}
              onPress={() => setCategoryId(c.id)}
              style={{
                paddingVertical: 6,
                paddingHorizontal: 12,
                borderRadius: 16,
                backgroundColor: active ? '#007AFF' : '#f0f0f0',
              }}
            >
              <Text style={{ color: active ? '#fff' : '#333' }}>{c.name}</Text>
            </Pressable>
          );
        })}
      </View>

      {/* 알림 여부 */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: 8,
        }}
      >
        <Text style={{ fontWeight: 'bold', color: notifGloballyOn ? '#111' : '#aaa' }}>시작 시 알림</Text>
        <Switch
          value={notifGloballyOn && notifyAtStart}
          disabled={!notifGloballyOn}
          onValueChange={setNotifyAtStart}
        />
      </View>
      {!notifGloballyOn ? (
        <Text style={{ fontSize: 12, color: '#999' }}>
          설정에서 "알림 사용"이 꺼져 있어 이 일정에는 알림이 걸리지 않습니다.
        </Text>
      ) : null}

      {/* 저장 버튼 */}
      <View style={{ marginTop: 16 }}>
        <Button title="저장" onPress={save} />
      </View>

      {/* ── DateTimePicker ──────────────────────────────────────────────────── */}
      {pickerVisible && Platform.OS === 'android' ? (
        <DateTimePicker
          value={tempDate}
          mode={pickerMode}
          display="default"
          onChange={onPickerChange}
        />
      ) : null}

      {/* iOS: Modal 안에 인라인 피커 */}
      {Platform.OS === 'ios' ? (
        <Modal
          visible={pickerVisible}
          transparent
          animationType="slide"
          onRequestClose={onIOSCancel}
        >
          <View
            style={{
              flex: 1,
              justifyContent: 'flex-end',
              backgroundColor: 'rgba(0,0,0,0.3)',
            }}
          >
            <View style={{ backgroundColor: '#fff', borderRadius: 12, padding: 16 }}>
              {/* 툴바 */}
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  marginBottom: 8,
                }}
              >
                <Pressable onPress={onIOSCancel}>
                  <Text style={{ color: '#888', fontSize: 16 }}>취소</Text>
                </Pressable>
                <Text style={{ fontWeight: 'bold', fontSize: 16 }}>
                  {pickerMode === 'date' ? '날짜 선택' : '시각 선택'}
                </Text>
                <Pressable onPress={onIOSConfirm}>
                  <Text style={{ color: '#007AFF', fontSize: 16 }}>확인</Text>
                </Pressable>
              </View>
              <DateTimePicker
                value={tempDate}
                mode={pickerMode}
                display="spinner"
                onChange={onPickerChange}
                style={{ height: 200 }}
              />
            </View>
          </View>
        </Modal>
      ) : null}
    </ScrollView>
  );
}
