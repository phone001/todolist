/**
 * 온보딩 권한 요청 — 알림 / (선택) 캘린더 (7.1, AC-07, E-08-1/E-14-1).
 * 거부해도 진행 가능. 알림 권한은 로컬·원격 알림이 공유하는 게이트웨이로 조회·요청한다.
 * v1.23(F-27): 알림 권한을 허용하면 로컬 알림(F-08/F-09)과 동일 권한을 재사용해 원격 푸시 등록도
 *   fire-and-forget 으로 함께 시도한다(P-77, §19.3 호출 지점 1). 실패해도 이 화면의 흐름·로컬 알림
 *   권한 상태에는 영향이 없다(E-27-2, AC-99 — `RemotePushService.registerRemotePush()` 내부 격리).
 * 환경 제약: react / react-native 의존 → 파이프라인 미실행(정적 리뷰).
 */
import React, { useCallback, useState } from 'react';
import { AppState, Button, Linking, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import RNCalendarEvents from 'react-native-calendar-events';
import { useServices } from '../bootstrap/AppContext.tsx';
import type { PermissionStatus } from '../../core/ports/gateways.ts';

type Props = { navigation: { goBack: () => void } };

export function PermissionsScreen({ navigation }: Props) {
  const { notificationPermission } = useServices();
  const [notif, setNotif] = useState<PermissionStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cal, setCal] = useState<string>('undetermined');

  useFocusEffect(useCallback(() => {
    let active = true;
    const refresh = () => {
      void notificationPermission.refresh().then((status) => {
        if (active) setNotif(status);
      }).catch(() => {
        if (active) setError('알림 권한을 확인하지 못했습니다. 다시 시도해 주세요.');
      });
    };
    refresh();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => { active = false; subscription.remove(); };
  }, [notificationPermission]));

  return (
    <View style={{ padding: 24, gap: 16 }}>
      <Text>일정 알림과 푸시 알림을 받으려면 알림 권한을 허용해 주세요.</Text>
      <Text>알림 권한: {notif === null ? '확인 중' : notif === 'granted' ? '허용됨' : notif === 'denied' ? '거부됨' : '아직 요청하지 않음'}</Text>
      {error ? <Text accessibilityRole="alert">{error}</Text> : null}
      {notif === 'denied' ? <Text>아이폰 또는 기기의 설정에서 알림을 허용해 주세요.</Text> : null}
      <Button
        title={notif === 'denied' ? '기기 설정 열기' : notif === 'granted' ? '알림 허용됨' : '알림 허용 요청'}
        disabled={busy || notif === 'granted'}
        onPress={async () => {
          setBusy(true);
          setError(null);
          try {
            if (notif === 'denied') {
              await Linking.openSettings();
            } else {
              setNotif(await notificationPermission.request());
            }
          } catch {
            setError('알림 권한을 변경하지 못했습니다. 다시 시도해 주세요.');
          } finally {
            setBusy(false);
          }
        }}
      />
      <Text>캘린더 권한(선택): {cal}</Text>
      <Button
        title="캘린더 허용 요청"
        onPress={async () => {
          const s = await RNCalendarEvents.requestPermissions();
          setCal(s);
        }}
      />
      <Button title="건너뛰고 시작" onPress={() => navigation.goBack()} />
    </View>
  );
}
