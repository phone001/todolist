/**
 * React Native 엔트리포인트 (AppRegistry).
 * 설계 근거: document/architect/logic.md v1.1 §16.4.
 *
 * Android 부팅 완료(BOOT_COMPLETED) headless JS 는 notifee 백그라운드 이벤트로 처리한다
 * (별도 headless task 등록은 android 네이티브에서 연결 — NATIVE-SETUP.md 참조).
 */
import { AppRegistry } from 'react-native';
import notifee, { EventType } from '@notifee/react-native';
import App from './App';
import { name as appName } from './app.json';

// 백그라운드/부팅 시 알림 이벤트 → 재예약 트리거. 실제 sync 조립은 App 부트스트랩과 공유되며,
// 여기서는 최소한으로 로깅만 하고 앱 기동 시 ReminderScheduler.sync() 가 자가 치유한다(P-09).
notifee.onBackgroundEvent(async ({ type }) => {
  if (type === EventType.DELIVERED || type === EventType.PRESS) {
    // no-op: 앱 기동 시 sync() 가 상태를 정리한다.
  }
});

AppRegistry.registerComponent(appName, () => App);
