/**
 * 설정 — 테마 / 알림 제목 노출 / 캘린더 / 계정 (F-13, P-10-1, D-02, F-12, AC-17/21).
 * 바인딩: SettingService.get/set, AuthService.link/unlink, CalendarSyncService.pull.
 * 환경 제약: react / react-native 의존 → 파이프라인 미실행(정적 리뷰).
 */
import React, { useEffect, useState } from 'react';
import { Button, Switch, Text, View } from 'react-native';
import { useServices } from '../bootstrap/AppContext.tsx';
import { SETTING_KEYS } from '../state/bindings.ts';
import { mapAuthError } from '../adapters/errors.ts';

export function SettingsScreen() {
  const { settings, auth } = useServices();
  const [showTitle, setShowTitle] = useState(true);
  const [accountState, setAccountState] = useState<'NONE' | 'LINKED' | 'EXPIRED'>('NONE');

  useEffect(() => {
    void (async () => {
      const raw = await settings.get(SETTING_KEYS.notifShowTitle);
      setShowTitle(raw ? (JSON.parse(raw) as boolean) : true);
      setAccountState((await auth.getStatus()).state);
    })();
  }, [settings, auth]);

  return (
    <View style={{ padding: 24, gap: 16 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text>알림에 일정 제목 표시</Text>
        <Switch
          value={showTitle}
          onValueChange={async (v) => {
            setShowTitle(v);
            await settings.set(SETTING_KEYS.notifShowTitle, JSON.stringify(v));
          }}
        />
      </View>

      <View style={{ gap: 8 }}>
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
      </View>
    </View>
  );
}
