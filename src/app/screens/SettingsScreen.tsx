/**
 * 설정 — 알림 / 테마 / 새 일정 기본값(중요도·유형) / 유형 관리 / 계정
 * (F-13, P-10-1, D-02, F-06, F-12, AC-17/21).
 * 바인딩: SettingService.get/set, CategoryService.list/create/remove, AuthService.link/unlink.
 * 환경 제약: react / react-native 의존 → 파이프라인 미실행(정적 리뷰).
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Button, Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useServices } from '../bootstrap/AppContext.tsx';
import { SETTING_KEYS } from '../state/bindings.ts';
import { STACK_ROUTES, type RootStackParamList } from '../navigation/routes.ts';
import { mapAuthError } from '../adapters/errors.ts';
import type { Category, Priority, ThemeMode } from '../../core/domain/types.ts';

type SettingsNavProp = NativeStackNavigationProp<RootStackParamList>;

const THEME_OPTIONS: Array<{ value: ThemeMode; label: string }> = [
  { value: 'system', label: '시스템' },
  { value: 'light', label: '라이트' },
  { value: 'dark', label: '다크' },
];

const PRIORITY_OPTIONS: Array<{ value: Priority; label: string }> = [
  { value: 'LOW', label: '낮음' },
  { value: 'NORMAL', label: '보통' },
  { value: 'HIGH', label: '높음' },
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 10 }}>
      <Text style={{ fontSize: 13, fontWeight: '700', color: '#888' }}>{title}</Text>
      {children}
    </View>
  );
}

function SwitchRow({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
      <Text style={{ color: disabled ? '#aaa' : '#111' }}>{label}</Text>
      <Switch value={value} onValueChange={onChange} disabled={disabled} />
    </View>
  );
}

function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View style={{ flexDirection: 'row', borderWidth: 1, borderColor: '#ddd', borderRadius: 8, overflow: 'hidden' }}>
      {options.map((o, i) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
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
  );
}

export function SettingsScreen() {
  const { settings, auth, categories } = useServices();
  const navigation = useNavigation<SettingsNavProp>();

  const [notifEnabled, setNotifEnabled] = useState(true);
  const [showTitle, setShowTitle] = useState(true);
  const [themeMode, setThemeMode] = useState<ThemeMode>('system');
  const [defaultPriority, setDefaultPriority] = useState<Priority>('NORMAL');
  const [defaultCategoryId, setDefaultCategoryId] = useState<number | null>(null);
  const [cats, setCats] = useState<Category[]>([]);
  const [accountState, setAccountState] = useState<'NONE' | 'LINKED' | 'EXPIRED'>('NONE');

  const parse = <T,>(raw: string | null, fallback: T): T => {
    if (raw === null) return fallback;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  };

  const load = useCallback(async () => {
    const [nEnabled, nTitle, tMode, dPrio, dCat] = await Promise.all([
      settings.get(SETTING_KEYS.notifEnabled),
      settings.get(SETTING_KEYS.notifShowTitle),
      settings.get(SETTING_KEYS.themeMode),
      settings.get(SETTING_KEYS.scheduleDefaultPriority),
      settings.get(SETTING_KEYS.scheduleDefaultCategoryId),
    ]);
    setNotifEnabled(parse<boolean>(nEnabled, true));
    setShowTitle(parse<boolean>(nTitle, true));
    setThemeMode(parse<ThemeMode>(tMode, 'system'));
    setDefaultPriority(parse<Priority>(dPrio, 'NORMAL'));
    setDefaultCategoryId(parse<number | null>(dCat, null));
    setCats(await categories.list());
    setAccountState((await auth.getStatus()).state);
  }, [settings, categories, auth]);

  useEffect(() => {
    void load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const save = (key: string, value: unknown) => settings.set(key, JSON.stringify(value));

  // 삭제된 유형이 기본 유형으로 지정돼 있으면 "기타(기본)"로 되돌린다 (포커스 복귀 시 정합성).
  useEffect(() => {
    if (defaultCategoryId !== null && cats.length > 0 && !cats.some((c) => c.id === defaultCategoryId)) {
      setDefaultCategoryId(null);
      void save(SETTING_KEYS.scheduleDefaultCategoryId, null);
    }
  }, [cats, defaultCategoryId]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 24, gap: 24 }}>
      <Section title="알림">
        <SwitchRow
          label="알림 사용"
          value={notifEnabled}
          onChange={async (v) => {
            setNotifEnabled(v);
            await save(SETTING_KEYS.notifEnabled, v);
          }}
        />
        <SwitchRow
          label="알림에 일정 제목 표시"
          value={showTitle}
          disabled={!notifEnabled}
          onChange={async (v) => {
            setShowTitle(v);
            await save(SETTING_KEYS.notifShowTitle, v);
          }}
        />
        {!notifEnabled ? (
          <Text style={{ fontSize: 12, color: '#999' }}>
            끄면 새로 추가하거나 수정하는 일정에 알림이 걸리지 않습니다.
          </Text>
        ) : null}
      </Section>

      <Section title="테마">
        <Segmented
          options={THEME_OPTIONS}
          value={themeMode}
          onChange={async (v) => {
            setThemeMode(v);
            await save(SETTING_KEYS.themeMode, v);
          }}
        />
      </Section>

      <Section title="새 일정 기본값">
        <Text style={{ fontSize: 13, color: '#555' }}>기본 중요도</Text>
        <Segmented
          options={PRIORITY_OPTIONS}
          value={defaultPriority}
          onChange={async (v) => {
            setDefaultPriority(v);
            await save(SETTING_KEYS.scheduleDefaultPriority, v);
          }}
        />
        <Text style={{ fontSize: 13, color: '#555', marginTop: 4 }}>기본 유형</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {[{ id: null as number | null, name: '기타(기본)' }, ...cats].map((c) => {
            const active = defaultCategoryId === c.id || (c.id === null && defaultCategoryId === null);
            return (
              <Pressable
                key={String(c.id)}
                onPress={async () => {
                  setDefaultCategoryId(c.id);
                  await save(SETTING_KEYS.scheduleDefaultCategoryId, c.id);
                }}
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
      </Section>

      <Section title="유형 관리">
        <Pressable
          onPress={() => navigation.navigate(STACK_ROUTES.CategoryManager)}
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingVertical: 14,
            paddingHorizontal: 12,
            borderWidth: 1,
            borderColor: '#eee',
            borderRadius: 8,
          }}
        >
          <Text style={{ fontSize: 15 }}>유형 추가·삭제</Text>
          <Text style={{ fontSize: 15, color: '#999' }}>{cats.length}개 ›</Text>
        </Pressable>
      </Section>

      <Section title="계정">
        <Text>계정: {accountState === 'NONE' ? '연동 안 됨' : accountState}</Text>
        {accountState === 'NONE' ? (
          <Button
            title="계정 연동"
            onPress={async () => {
              try {
                const link = await auth.link();
                setAccountState(link.state);
              } catch (err) {
                mapAuthError(err); // 취소는 무해, 실패는 재시도 안내
              }
            }}
          />
        ) : (
          <Button
            title="연동 해제"
            onPress={async () => {
              const link = await auth.unlink(); // 로컬 데이터는 유지(AC-21)
              setAccountState(link.state);
            }}
          />
        )}
      </Section>
    </ScrollView>
  );
}
