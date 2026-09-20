/**
 * 온보딩 권한 요청 — 알림 / (선택) 캘린더 (7.1, AC-07, E-08-1/E-14-1).
 * 거부해도 진행 가능. 권한 게이트웨이는 서비스가 아니라 어댑터를 직접 쓴다(코어 포트는 서비스 뒤).
 * v1.23(F-27): 알림 권한을 허용하면 로컬 알림(F-08/F-09)과 동일 권한을 재사용해 원격 푸시 등록도
 *   fire-and-forget 으로 함께 시도한다(P-77, §19.3 호출 지점 1). 실패해도 이 화면의 흐름·로컬 알림
 *   권한 상태에는 영향이 없다(E-27-2, AC-99 — `RemotePushService.registerRemotePush()` 내부 격리).
 * 환경 제약: react / react-native 의존 → 파이프라인 미실행(정적 리뷰).
 */
import React, { useState } from 'react';
import { Button, Text, View } from 'react-native';
import notifee from '@notifee/react-native';
import RNCalendarEvents from 'react-native-calendar-events';
import { normalizePermission } from '../adapters/errors.ts';
import { useServices } from '../bootstrap/AppContext.tsx';

type Props = { navigation: { goBack: () => void } };

export function PermissionsScreen({ navigation }: Props) {
  const { remotePush } = useServices();
  const [notif, setNotif] = useState<string>('undetermined');
  const [cal, setCal] = useState<string>('undetermined');

  return (
    <View style={{ padding: 24, gap: 16 }}>
      <Text>알림 권한: {notif}</Text>
      <Button
        title="알림 허용 요청"
        onPress={async () => {
          const s = await notifee.requestPermission();
          const status = normalizePermission(s.authorizationStatus);
          setNotif(status);
          if (status === 'granted') {
            // F-27(v1.23, P-77): 원격 등록은 fire-and-forget — 실패해도 이 화면/로컬 알림 무영향.
            void remotePush.registerRemotePush();
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
