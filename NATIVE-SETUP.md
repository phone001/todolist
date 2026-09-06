# 네이티브 셸 설정 (오늘뭐해 · React Native 0.74)

이 저장소는 **플랫폼 비의존 코어(`src/core`) + 앱 셸 로직(`src/app`)** 을 담는다.
`android/`·`ios/` 네이티브 프로젝트와 온디바이스 빌드는 **RN 툴체인이 있는 환경**에서 완성한다
(설계 근거: `document/architect/overview.md` v1.1 "빌드 환경 제약", `nfr.md` §11.2).

## 1. 의존성 설치

```bash
npm install
cd ios && pod install && cd ..   # macOS
```

버전은 `package.json` 에 major 고정되어 있다(overview 기술 스택 표).

## 2. 네이티브 프로젝트 생성 (최초 1회)

이 저장소에는 앱 코드(`App.tsx`, `index.js`, `src/`)와 JS 설정만 있다.
`android/`·`ios/` 골격은 아래로 생성한 뒤 3장 보안 설정을 적용한다.

```bash
npx @react-native-community/cli init TodayWhat --version 0.74.5 --directory .tmp-native
# .tmp-native/android, .tmp-native/ios 를 이 저장소 루트로 이동하고 패키지명/번들ID를 맞춘다.
```

앱 이름/스킴: `app.json` = `{ name: "todaywhat", displayName: "오늘뭐해" }`,
URL 스킴 = `todaywhat://` (딥링크·OAuth redirect).

## 3. 필수 보안/기능 설정 (logic.md v1.1 §16.7, 13.x)

### Android (`android/app/src/main/AndroidManifest.xml`)

- `android:usesCleartextTraffic="false"` (전송 암호화 강제, 13.4/13.6)
- `android:allowBackup="false"` 또는 백업 규칙에서 `todaywhat.db` 제외 (13.4)
- 딥링크 `intent-filter` 는 `todaywhat` 스킴 **1개만**, `android:exported` 명시
- `POST_NOTIFICATIONS`(Android 13+), `SCHEDULE_EXACT_ALARM`/`USE_EXACT_ALARM`(정확 알람, nfr §1.1), `RECEIVE_BOOT_COMPLETED`(P-09)
- `READ_CALENDAR`/`WRITE_CALENDAR` (F-14; WRITE 는 D-02=on 일 때만)
- notifee 부팅 재예약: `RECEIVE_BOOT_COMPLETED` 수신 → headless JS → `ReminderScheduler.sync()` (샘플: `android/app/src/main/AndroidManifest.xml` 주석 참조)
- New Architecture: `gradle.properties` 의 `newArchEnabled` (N-9, 온디바이스 확정)

### iOS (`ios/todaywhat/Info.plist`)

- ATS: `NSAppTransportSecurity` 예외 없음 (13.6)
- `CFBundleURLTypes` 에 `todaywhat` 스킴 1개
- `NSCalendarsUsageDescription` (F-14), 알림은 `UNUserNotificationCenter` 런타임 권한
- 파일 보호: DB 파일에 `NSFileProtectionComplete` (13.4)
- 백그라운드: 부팅 재예약은 앱 기동 시 `bootstrapSequence` 6)단계가 수행(iOS 는 BootReceiver 없음)

## 4. OAuth 설정 주입 (커밋 금지)

`App.tsx` 의 `NATIVE_CONFIG.auth` 는 환경변수/빌드 설정으로 주입한다:
`OAUTH_ISSUER`, `OAUTH_CLIENT_ID`, redirect = `todaywhat://oauthredirect`.
`client_secret` 은 **사용하지 않는다**(PKCE public client, 13.5).

## 5. 워치 타깃 (NFR-10, 후속)

iOS WatchConnectivity / Android Wear Data Layer 로 모바일과 동기화.
데이터 스키마·시각 표현(epoch ms + IANA tz)은 코어와 공유한다.

## 6. 설정 파일이 `.cjs` 인 이유

`package.json` 의 `"type": "module"` 때문에 `.js` 는 ESM 으로 해석된다.
Metro/Babel/ESLint/RN-CLI 설정은 CommonJS(`module.exports`)라서 `.cjs` 확장자를 쓴다
(`metro.config.cjs`, `babel.config.cjs`, `react-native.config.cjs`, `.eslintrc.cjs`).

## 7. 이 환경에서 검증되는 것 / 안 되는 것

| 구분 | 항목 |
| --- | --- |
| 검증됨 (`npm test`) | 코어 81 assertion, 셸 순수 로직(부트스트랩·딥링크·커서·마스킹·정제·토큰매핑), `buildApp` 후방호환 |
| 정적 리뷰만 | `.native.ts` 어댑터 본문, `.tsx` 화면, `android/`·`ios/` 설정, Metro 번들 |
| 후속 환경 | Gradle/Pod 빌드, 온디바이스 알림 정확도, 워치 연동 (nfr §11.2) |
