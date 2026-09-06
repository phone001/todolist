/**
 * 온보딩 권한 요청 — 알림 / (선택) 캘린더 (7.1, AC-07, E-08-1/E-14-1).
 * 거부해도 진행 가능. 권한 게이트웨이는 서비스가 아니라 어댑터를 직접 쓴다(코어 포트는 서비스 뒤).
 * 환경 제약: react / react-native 의존 → 파이프라인 미실행(정적 리뷰).
 */
import React, { useState } from 'react';
import { Button, Text, View } from 'react-native';
import notifee from '@notifee/react-native';
import RNCalendarEvents from 'react-native-calendar-events';
import { normalizePermission } from '../adapters/errors.ts';

type Props = { navigation: { goBack: () => void } };

export function PermissionsScreen({ navigation }: Props) {
  const [notif, setNotif] = useState<string>('undetermined');
  const [cal, setCal] = useState<string>('undetermined');

  return (
    <View style={{ padding: 24, gap: 16 }}>
      <Text>알림 권한: {notif}</Text>
      <Button
        title="알림 허용 요청"
        onPress={async () => {
          const s = await notifee.requestPermission();
          setNotif(normalizePermission(s.authorizationStatus));
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
