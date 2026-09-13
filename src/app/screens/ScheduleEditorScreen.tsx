/**
 * 일정 작성/수정 (F-01/F-03, AC-01~03).
 * 바인딩: ScheduleService.create/update/getById/getReminderOffsets/updateRecurrenceRule, CategoryService.list.
 * 검증 오류는 필드 인라인.
 * v1.15 변경(F-08 §6.1): 사전 알림 5개 프리셋 다중 선택 칩(REMINDER_OFFSET_PRESETS) 도입 — 신규 기본값 [10], 수정 시 getReminderOffsets 로 프리필, 저장 시 reminderOffsets 항상 명시 전송.
 * v1.9 변경(F-24, logic §16.3.1/§18.6): 반복 섹션(없음/매일/매월/매년 + 종료조건) — **신규 생성 경로만**.
 *   수정 대상이 반복 회차(recurrenceParentId !== null)면 반복 섹션은 읽기 전용 표시 + "반복 설정 변경"
 *   보조 액션(→ `ScheduleService.updateRecurrenceRule`)으로 분리한다. 나머지 필드는 그 회차 행에 대한
 *   일반 update("이 일정만", §18.4/§18.5 — 신규 로직 불필요)로 저장된다.
 * v1.9 변경(F-26/D-29(a), 구 OI-19 통일): route.params.presetStartAt(완결된 epoch ms, logic §7.6)가
 *   있으면 신규 모드 시작 일시 초기값으로 사용한다(이후 피커로 자유롭게 덮어쓸 수 있음).
 *
 * v1.6 변경: 날짜/시각 TextInput → @react-native-community/datetimepicker 8.6.0
 *   - startAt: number (epoch ms) 단일 상태
 *   - endAt: number | null (epoch ms), Switch 토글로 활성화
 *   - localWallToEpoch 저장 경로 사용 제거 (함수·V-26 테스트 유지)
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
import type { Category, Priority, RecurrenceRule } from '../../core/domain/types.ts';
import type { RootStackParamList } from '../navigation/routes.ts';
import { REMINDER_OFFSET_PRESETS } from '../../core/domain/reminders.ts';

const PRIORITY_OPTIONS: Array<{ value: Priority; label: string }> = [
  { value: 'LOW', label: '낮음' },
  { value: 'NORMAL', label: '보통' },
  { value: 'HIGH', label: '높음' },
];

/** F-24(v1.9, D-25(a)): "매주"는 코어·DB 상 유효하나 UI 비노출. */
const RECURRENCE_RULE_OPTIONS: Array<{ value: RecurrenceRule | null; label: string }> = [
  { value: null, label: '없음' },
  { value: 'DAILY', label: '매일' },
  { value: 'MONTHLY', label: '매월' },
  { value: 'YEARLY', label: '매년' },
];

function recurrenceRuleLabel(rule: RecurrenceRule | null): string {
  return RECURRENCE_RULE_OPTIONS.find((o) => o.value === rule)?.label ?? '없음';
}

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

/** epoch ms → 로컬 날짜만(YYYY-MM-DD). 반복 종료일 버튼 레이블용(시각 불필요). */
function formatDateOnlyLabel(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** 다음 정시(현재 + 1시간, 분/초/ms = 0) epoch ms */
function defaultStartEpoch(): number {
  const d = new Date(Date.now() + 3_600_000);
  d.setMinutes(0, 0, 0);
  return d.getTime();
}

/** 반복 종료일 기본값(시작 30일 뒤, 로컬 자정). */
function defaultRecurrenceEndEpoch(startAt: number): number {
  const d = new Date(startAt + 30 * 86_400_000);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

// ── 피커 표시 단계 ─────────────────────────────────────────────────────────────

type PickerTarget = 'start' | 'end' | 'recurrenceEnd';
type PickerMode = 'date' | 'time';

// ── 컴포넌트 ───────────────────────────────────────────────────────────────────

export function ScheduleEditorScreen({ route, navigation }: Props) {
  const { schedules, settings, categories } = useServices();
  const invalidate = useShellStore((s) => s.invalidate);
  const editingId = route.params?.scheduleId;
  const presetStartAt = route.params?.presetStartAt;

  // ── 폼 상태 ────────────────────────────────────────────────────────────────
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<Priority>('NORMAL');
  const [categoryId, setCategoryId] = useState<number | undefined>(undefined);
  const [cats, setCats] = useState<Category[]>([]);
  /** 설정의 "알림 사용" 전역 스위치. false 면 알림 필드 비활성 + 저장 시 알림 미포함. */
  const [notifGloballyOn, setNotifGloballyOn] = useState(true);
  /**
   * 시작 일시: epoch ms 단일 상태.
   * 신규 + presetStartAt(F-26/D-29(a), 구 OI-19 통일) → 완결된 프리필 값, 그 외 → 다음 정시.
   */
  const [startAt, setStartAt] = useState<number>(() =>
    editingId === undefined && presetStartAt !== undefined ? presetStartAt : defaultStartEpoch(),
  );
  /** 종료 일시 활성화 여부 */
  const [endAtEnabled, setEndAtEnabled] = useState(false);
  /** 종료 일시: epoch ms (endAtEnabled=false 시 null 전송) */
  const [endAt, setEndAt] = useState<number>(defaultStartEpoch);
  const [memo, setMemo] = useState('');
  const [notifyAtStart, setNotifyAtStart] = useState(true);
  /**
   * F-08 §6.1: 사전 알림 프리셋 다중 선택(분 단위). 신규 작성 기본값 = [10](기존 하드코딩 기본값 유지, 회귀 최소화).
   * 수정 모드는 아래 프리필 useEffect 가 `getReminderOffsets` 로 덮어쓴다.
   */
  const [reminderOffsets, setReminderOffsets] = useState<number[]>([10]);

  // ── F-24(v1.9) 반복 상태 ──────────────────────────────────────────────────
  /** 신규 생성 경로의 반복 규칙 선택(§16.3.1). */
  const [recurrenceRule, setRecurrenceRule] = useState<RecurrenceRule | null>(null);
  /** true = "종료 없음"(무기한, E-24-3 — horizon 내에서만 실제 회차 생성). */
  const [recurrenceEndless, setRecurrenceEndless] = useState(true);
  const [recurrenceEndAt, setRecurrenceEndAt] = useState<number>(() => defaultRecurrenceEndEpoch(startAt));
  /** 수정 대상이 반복 회차인지(§18.4 마스터/회차 분리) — 읽기 전용 표시 분기용. */
  const [existingRecurrenceParentId, setExistingRecurrenceParentId] = useState<number | null>(null);
  /** "반복 설정 변경" 보조 액션 펼침 여부(§18.5, E-24-1 스코프 한정 지원). */
  const [showRecurrenceRuleEditor, setShowRecurrenceRuleEditor] = useState(false);

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
      // F-24(v1.9, §18.6): 회차 행이면 반복 섹션을 읽기 전용으로 전환(그 마스터 규칙은 별도 조회 없이
      // "반복 설정 변경" 진입 시에만 필요 — 여기서는 존재 여부만 표시).
      setExistingRecurrenceParentId(s.recurrenceParentId);
    });
    // F-08 §6.1: 기존 사전 알림 프리셋 선택 상태를 프리필(조회 실패 시 빈 배열 — 안전한 저하).
    schedules.getReminderOffsets(editingId).then(setReminderOffsets);
  }, [editingId]); // eslint-disable-line react-hooks/exhaustive-deps

  /** F-08 §6.1: 프리셋 체크박스/칩 토글. 전역 알림이 off 면 화면에서 비활성 표시하므로 호출되지 않는다. */
  const toggleReminderOffset = useCallback((minutes: number) => {
    setReminderOffsets((prev) =>
      prev.includes(minutes) ? prev.filter((m) => m !== minutes) : [...prev, minutes].sort((a, b) => a - b),
    );
  }, []);

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
      const current = target === 'start' ? startAt : target === 'end' ? endAt : recurrenceEndAt;
      setPickerTarget(target);
      setPickerMode(mode);
      setTempDate(new Date(current));
      setPickerVisible(true);
    },
    [startAt, endAt, recurrenceEndAt],
  );

  const currentPickerValue = useCallback(
    (target: PickerTarget) => (target === 'start' ? startAt : target === 'end' ? endAt : recurrenceEndAt),
    [startAt, endAt, recurrenceEndAt],
  );
  const setPickerValue = useCallback((target: PickerTarget, ms: number) => {
    if (target === 'start') setStartAt(ms);
    else if (target === 'end') setEndAt(ms);
    else setRecurrenceEndAt(ms);
  }, []);

  // ── DateTimePicker onChange ────────────────────────────────────────────────
  /**
   * Android: dismissed 이벤트이면 닫기. set 이면:
   *   - mode='date' → 날짜 반영 후 time 다이얼로그 자동 연속 열기(반복 종료일은 날짜만 필요하므로 즉시 종료)
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
        const picked = selected ?? new Date(currentPickerValue(pickerTarget));
        const ms = picked.getTime();
        if (!Number.isInteger(ms)) {
          setPickerVisible(false);
          return;
        }

        if (pickerMode === 'date') {
          // 날짜를 반영하되 기존 시/분은 유지
          const base = new Date(currentPickerValue(pickerTarget));
          const merged = new Date(ms);
          merged.setHours(base.getHours(), base.getMinutes(), 0, 0);
          const mergedMs = merged.getTime();
          setPickerValue(pickerTarget, mergedMs);
          if (pickerTarget === 'recurrenceEnd') {
            // 반복 종료일은 날짜만 필요 — 시각 단계로 넘어가지 않는다.
            setPickerVisible(false);
            return;
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
          const base = new Date(currentPickerValue(pickerTarget));
          base.setHours(picked.getHours(), picked.getMinutes(), 0, 0);
          const finalMs = base.getTime();
          setPickerValue(pickerTarget, finalMs);
          setPickerVisible(false);
        }
      } else {
        // iOS: Modal 내부 임시 Date 업데이트
        if (selected) {
          setTempDate(selected);
        }
      }
    },
    [pickerMode, pickerTarget, currentPickerValue, setPickerValue],
  );

  /** iOS Modal 확인 버튼 */
  const onIOSConfirm = useCallback(() => {
    const ms = tempDate.getTime();
    if (Number.isInteger(ms)) {
      if (pickerMode === 'date') {
        // 날짜만 반영, 기존 시/분 유지 → time 피커로 이동(반복 종료일은 날짜만 필요하므로 즉시 종료)
        const base = new Date(currentPickerValue(pickerTarget));
        base.setFullYear(tempDate.getFullYear(), tempDate.getMonth(), tempDate.getDate());
        const merged = base.getTime();
        setPickerValue(pickerTarget, merged);
        if (pickerTarget === 'recurrenceEnd') {
          setPickerVisible(false);
          return;
        }
        // time 단계로 전환
        setPickerMode('time');
        setTempDate(base);
      } else {
        // time 최종 반영
        const base = new Date(currentPickerValue(pickerTarget));
        base.setHours(tempDate.getHours(), tempDate.getMinutes(), 0, 0);
        const finalMs = base.getTime();
        setPickerValue(pickerTarget, finalMs);
        setPickerVisible(false);
      }
    } else {
      setPickerVisible(false);
    }
  }, [tempDate, pickerMode, pickerTarget, currentPickerValue, setPickerValue]);

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
    // F-08 §6.1/E-08-6/AC-81: 항상 명시적으로 reminderOffsets 를 전송한다(0개 선택이면 빈 배열 그대로).
    const effOffsets = notifGloballyOn ? reminderOffsets : [];

    // F-24(v1.9, §16.3.1): 신규 생성 경로에서만 반복 입력을 구성한다. "없음" → undefined(비반복).
    const recurrenceInput =
      editingId === undefined && recurrenceRule !== null
        ? { rule: recurrenceRule, endAt: recurrenceEndless ? null : recurrenceEndAt }
        : undefined;

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
          recurrence: recurrenceInput,
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
          reminderOffsets: effOffsets,
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

  /**
   * F-24(v1.9, §18.5, E-24-1): "반복 설정 변경" 보조 액션 저장.
   * 마스터 규칙을 갱신하고, 아직 지나지 않은 활성 회차는 삭제되어 다음 RecurrenceScheduler.sync 때
   * 새 규칙으로 재생성된다. 과거·완료 회차는 보존.
   */
  async function saveRecurrenceRuleChange() {
    if (editingId === undefined || recurrenceRule === null) return;
    clearErrors();
    try {
      await schedules.updateRecurrenceRule(editingId, {
        rule: recurrenceRule,
        endAt: recurrenceEndless ? null : recurrenceEndAt,
      });
      invalidate('list', 'dashboard', 'search');
      setShowRecurrenceRuleEditor(false);
      navigation.goBack();
    } catch (err) {
      if (err instanceof ValidationError || err instanceof AppError) {
        applyValidationError(err);
      } else {
        setGlobalError('반복 설정 변경에 실패했습니다.');
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

      {/* 반복(F-24, v1.9, §16.3.1/§18.6) */}
      <Text style={{ fontWeight: 'bold', marginTop: 8 }}>반복</Text>
      {editingId === undefined ? (
        // 신규 생성 경로만 — 규칙 세그먼트 + 종료조건
        <>
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
            {RECURRENCE_RULE_OPTIONS.map((o, i) => {
              const active = o.value === recurrenceRule;
              return (
                <Pressable
                  key={String(o.value)}
                  onPress={() => setRecurrenceRule(o.value)}
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
          {recurrenceRule !== null ? (
            <View style={{ marginTop: 8, gap: 8 }}>
              <View
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
              >
                <Text style={{ fontSize: 13, color: '#555' }}>종료 없음(무기한)</Text>
                <Switch value={recurrenceEndless} onValueChange={setRecurrenceEndless} />
              </View>
              {!recurrenceEndless ? (
                <Pressable
                  onPress={() => openPicker('recurrenceEnd', 'date')}
                  style={{ borderWidth: 1, borderColor: '#888', borderRadius: 4, padding: 8 }}
                >
                  <Text>종료일: {formatDateOnlyLabel(recurrenceEndAt)}</Text>
                </Pressable>
              ) : null}
              <Text style={{ fontSize: 12, color: '#999' }}>
                생성 즉시 표시되는 회차#1 외의 회차는 이후 최대 60일 내로 순차 생성됩니다.
              </Text>
            </View>
          ) : null}
          {fieldErrors.recurrence ? (
            <Text style={{ color: 'red', fontSize: 12 }}>{fieldErrors.recurrence}</Text>
          ) : null}
        </>
      ) : existingRecurrenceParentId !== null ? (
        // 수정 대상이 반복 회차 — 읽기 전용 표시 + "반복 설정 변경" 보조 액션(§18.5)
        <View style={{ marginTop: 4, gap: 8 }}>
          <Text style={{ fontSize: 13, color: '#555' }}>
            이 일정은 반복 일정의 한 회차입니다(연결된 반복 일정). 제목·시각 등은 이 회차에만
            적용되며, 반복 주기 자체를 바꾸려면 아래에서 변경하세요.
          </Text>
          <Pressable
            onPress={() => setShowRecurrenceRuleEditor((v) => !v)}
            style={{
              paddingVertical: 8,
              paddingHorizontal: 12,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: '#007AFF',
              alignSelf: 'flex-start',
            }}
          >
            <Text style={{ color: '#007AFF', fontWeight: '600' }}>반복 설정 변경</Text>
          </Pressable>
          {showRecurrenceRuleEditor ? (
            <View style={{ gap: 8, borderWidth: 1, borderColor: '#eee', borderRadius: 8, padding: 12 }}>
              <View
                style={{
                  flexDirection: 'row',
                  borderWidth: 1,
                  borderColor: '#ddd',
                  borderRadius: 6,
                  overflow: 'hidden',
                }}
              >
                {RECURRENCE_RULE_OPTIONS.filter((o) => o.value !== null).map((o, i) => {
                  const active = o.value === recurrenceRule;
                  return (
                    <Pressable
                      key={String(o.value)}
                      onPress={() => setRecurrenceRule(o.value)}
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
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 13, color: '#555' }}>종료 없음(무기한)</Text>
                <Switch value={recurrenceEndless} onValueChange={setRecurrenceEndless} />
              </View>
              {!recurrenceEndless ? (
                <Pressable
                  onPress={() => openPicker('recurrenceEnd', 'date')}
                  style={{ borderWidth: 1, borderColor: '#888', borderRadius: 4, padding: 8 }}
                >
                  <Text>종료일: {formatDateOnlyLabel(recurrenceEndAt)}</Text>
                </Pressable>
              ) : null}
              {fieldErrors.recurrence ? (
                <Text style={{ color: 'red', fontSize: 12 }}>{fieldErrors.recurrence}</Text>
              ) : null}
              <Button
                title="반복 설정 저장"
                disabled={recurrenceRule === null}
                onPress={() => void saveRecurrenceRuleChange()}
              />
            </View>
          ) : null}
        </View>
      ) : (
        <Text style={{ fontSize: 13, color: '#999', marginTop: 4 }}>{recurrenceRuleLabel(null)}</Text>
      )}

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

      {/* 사전 알림 프리셋(F-08 §6.1, D-24 — 자유 입력 없음) — 다중 선택 칩. 전역 알림 off 면 비활성 표시 */}
      <Text style={{ fontWeight: 'bold', marginTop: 8, color: notifGloballyOn ? '#111' : '#aaa' }}>
        사전 알림
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
        {REMINDER_OFFSET_PRESETS.map((preset) => {
          const active = notifGloballyOn && reminderOffsets.includes(preset.minutes);
          return (
            <Pressable
              key={preset.minutes}
              disabled={!notifGloballyOn}
              onPress={() => toggleReminderOffset(preset.minutes)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: active, disabled: !notifGloballyOn }}
              accessibilityLabel={preset.label}
              style={{
                paddingVertical: 6,
                paddingHorizontal: 12,
                borderRadius: 16,
                backgroundColor: active ? '#007AFF' : '#f0f0f0',
                opacity: notifGloballyOn ? 1 : 0.5,
              }}
            >
              <Text style={{ color: active ? '#fff' : '#333' }}>{preset.label}</Text>
            </Pressable>
          );
        })}
      </View>

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
