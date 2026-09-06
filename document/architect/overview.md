# 설계 개요 — 일정관리 앱 "오늘뭐해"

| 항목 | 값 |
| --- | --- |
| 문서 종류 | 설계 총괄 (Overview) |
| 버전 | v1.5 |
| 상태 | 작성 완료 (Developer 착수 가능) |
| 근거 기획서 | `document/planner/plan.md` v1.1 |
| 작성 주체 | Architect |

## 변경 이력

| 버전 | 일자 | 변경 내용 |
| --- | --- | --- |
| v1.0 | 2026-09-04 | 신규 규약(overview/logic/database/nfr 4종)에 따른 최초 설계. 2026-09-02 구버전(7종 + 별도 보안 문서)은 폐기하고 재작성 |
| v1.5 | 2026-09-06 | **설계 델타 — F-16 앱 아이덴티티 UI** (plan.md v1.1). 탭 바 아이콘(todo/goal/statistics/settings.png) 및 대시보드 헤더 로고(logo.png)·태그라인(tagline.png) 적용. `logic.md` §16.2 탭 아이콘 설계·§16.3 DashboardScreen 헤더 설계·§16.3.2 로고/태그라인 렌더링 규약 추가. 코어·DB·포트 계약 무변경. 기획 검증 PASS |
| v1.4 | 2026-09-04 | **설계 델타 — "일정 추가/수정 화면 연결"(Feature)**. 기존 `ScheduleEditorScreen` 이 `RootStack` 에 등록만 되고 호출부가 없어 도달 불가 + 폼이 스켈레톤(제목 + raw epoch). 델타: (1) `logic.md` §16.2 진입 엣지(Dashboard/Calendar `headerRight`「+」→ `ScheduleEditor {}`, `ScheduleDetail`「편집」→ `ScheduleEditor { scheduleId }`), (2) `logic.md` §16.3 표 확장 + 신규 §16.3.1(F-01 필드 매트릭스: 제목/시작·종료 일시/유형/우선순위/메모/반복 — 서비스 매핑·코어 검증 코드·인라인 `field`·저장 후 4-슬라이스 무효화+`goBack`), (3) **날짜/시간 입력**: RN 코어에 date 컴포넌트 없음 + 빌드 호스트 디스크 고갈로 네이티브 픽커(`@react-native-community/datetimepicker`) **미도입** — `YYYY-MM-DD`/`HH:mm` 텍스트 입력 + `Clock.timeZone()` 기반 epoch ms 변환(순수 함수)으로 AC-01~03 충족, 픽커 교체는 후속 N-10. **포트 계약(`ScheduleService.create/update/getById`, `CategoryService.list/create`) 무변경**, `database.md` v1.0 유지(스키마 무변경), `routes.ts`/`bindings.ts` 는 이미 계약 반영. `logic.md` v1.4·`nfr.md` v1.3 동반 개정. 기획 재검증 PASS(F-01/F-03/AC-01~03 내 UI 연결, 신규 제품 요구사항 없음; D-05 반복 게이트는 단순 반복 가정값으로 진행 — 비차단) |
| v1.1 | 2026-09-04 | 코어 계층(`src/core/**`) 구현·검증 완료 반영. **React Native 앱 셸 + 코어 포트용 네이티브 어댑터 설계 델타** 추가(신규 §"클라이언트 셸 아키텍처", "빌드 환경 제약과 파이프라인 검증 전략"). `database.md`는 스키마 무변경으로 v1.0 유지. 기획 재검증 결과 PASS(신규 제품 요구사항 없음) |
| v1.3 | 2026-09-04 | **Bug Fix 설계 델타 (RENDER-003)** — iOS 앱이 대시보드에 도달하지 못하고 Safe Mode 에 안착하는 버그. 확정 원인: op-sqlite 9.x `execute(sql, params)` 가 **positional `?` 배열 전용**이며 named 파라미터(`:name`/`$name`/`@name`)를 어떤 API 로도 지원하지 않음 → 리포지토리 헬퍼가 named 파라미터 객체를 넘기면 내부 `params.map` 호출에서 `TypeError: params?.map is not a function`, 첫 실패 지점은 부트스트랩 `load-settings`(`SqliteSettingRepository.get()`). 구현 방식(Orchestrator 확정): `OpSqliteDb.native.ts` 어댑터에 named→positional 변환 shim 추가 — 리포지토리 SQL 은 named 바인딩 유지, 어댑터가 실행 직전 `:name` → `?` 치환 + 값 객체를 위치 배열로 정렬(이름당 슬롯 1개 dedup·최초 등장 순서, 문자열/주석 내 `:` 스킵). "코어 포트 → 네이티브 어댑터 매핑" 각주에 1줄 추가. **포트 계약(`UnitOfWork`/`MigrationDb`/`Repository` 시그니처) 무변경** — shim 은 어댑터 내부 구현. `database.md` v1.0 유지(바인딩 표기 무언급 → 개정 불요). `logic.md` v1.3(§13.3/§16.5/§16.1/§14) 동반 개정. 부수: `SafeModeScreen` 이 `failedAt < 0`(부트스트랩 예외)와 실제 마이그레이션 실패를 구분해 문구를 분기하도록 `logic.md` §16.1 에 구현 권고 기록. 기획 재검증 PASS(기확정 요구사항 F-01~F-15 내 버그 수정, 신규 제품 요구사항 없음) |
| v1.2 | 2026-09-04 | **Bug Fix 설계 델타** — `@op-engineering/op-sqlite` 버전 핀을 `6.x` → `9.x`(9.3.x)로 상향. 근거: 실제 온디바이스 iOS 빌드 검증 환경(Xcode 26.2 / clang) 도입 결과 op-sqlite 6.2.x `cpp/types.h`가 `<vector>` 미include로 컴파일 불가(전이 include 불허). 9.x에서 헤더 정합 수정 + RN 0.74 peer 호환(`react-native: >0.73.0`) + 구아키텍처(`newArchEnabled=false`) 지원 유지. 설계 의도(SQLite 로컬 저장소, sync/async·prepared statement·SQLCipher 옵션) 불변. 부수: 9.x JS 래퍼가 `QueryResult.rows`를 평면 배열로 반환(6.x는 `{_array}`) — §"코어 포트 → 네이티브 어댑터 매핑" 각주에 반영. 포트 계약(`UnitOfWork`/`MigrationDb`/`Repository`) 무변경. 기획 재검증 PASS(신규 제품 요구사항 없음). `logic.md` v1.2(§16.5/§13.6/§16.8)·`nfr.md` v1.2(§11 iOS 빌드·실행을 정식 검증으로 이동) 동반 개정, `database.md`는 v1.0 유지(스키마 무변경) |

---

## 설계 개요

- **기능 목적**: 개인이 일정을 등록·분류·완료 관리하고, 일정 전/정시에 로컬 알림을 받으며, 금일 현황을 대시보드로 파악하고, 검색·테마·계정 연동·기본 캘린더 연동을 사용하는 오프라인 우선 모바일 앱.
- **설계 대상**: 신규 시스템 전체. 클라이언트(React Native) + 로컬 저장소(SQLite) + OS 연동(로컬 알림 / 기본 캘린더 / OAuth).
- **변경 범위**: 저장소는 현재 `src/index.ts` 스캐폴드뿐이므로 신규 구축. 서버 컴포넌트는 이번 범위 없음(기획 게이트 D-01 = (c) 가정).

---

## 기획 검증 결과

### v1.5 재검증 (F-16 앱 아이덴티티 UI 요청)

**결과: PASS (설계 가능, Planner 재작업 불필요)**

| 검증 항목 | 판정 | 비고 |
| --- | --- | --- |
| 신규 제품 요구사항 유무 | OK | F-16(앱 아이덴티티 UI)·P-18~P-21·AC-25~28 기획서에 명시됨. 코어/DB/포트 변경 없음 — UI 계층 단독 변경 |
| 에셋 존재 여부 | OK | `src/assets/icons/`(logo.png, todo.png, goal.png, statistics.png, settings.png), `src/assets/images/`(tagline.png) 확인 완료 |
| 탭 매핑 명확성 | OK | F-16: 오늘탭→todo.png, 캘린더탭→goal.png, 검색탭→statistics.png, 설정탭→settings.png |
| 에셋 로드 실패 정책 | OK | E-16-1: 빈 공간 또는 텍스트 라벨 대체, 앱 크래시 없음 (AC-28) |
| 다크 테마 / 고해상도 정책 | OK | E-16-2: 원본 PNG 그대로 사용. E-16-3: RN `Image` 자동 스케일링 위임. 이번 범위 외 명시 |
| 미결정 게이트 영향 | 비차단 | D-01~D-05 모두 F-16과 무관 |

### v1.4 재검증 ("일정 추가/수정 화면 연결" 요청)

**결과: PASS (설계 가능, Planner 재작업 불필요)**

| 검증 항목 | 판정 | 비고 |
| --- | --- | --- |
| 신규 제품 요구사항 유무 | 없음 | F-01(일정 등록)·F-03(일정 수정)·AC-01~03 이 이미 명세. 요청은 기확정 기능의 **UI 연결·폼 완성** |
| 화면/흐름 근거 | OK | `plan.md` 7.1("일정 추가 유도"), 7.2("대시보드/캘린더에서 '+' → 일정 작성 화면 … 제목·일시·유형·우선순위·메모 입력"), 7.3(검색 결과 → 수정), AC-15/E-10-1(빈 대시보드에 일정 추가 진입점) |
| 입력·검증 명세 | OK | F-01 Action, E-01-1~4, AC-02(필수값), AC-03(종료<시작). 코어 `validation.ts` 에 대응 오류 코드 존재 |
| 미결정 게이트 영향 | 비차단 | **D-05(반복 범위)** = OPEN("단순 반복 가정"). 단순 반복(P-01: NONE/DAILY/WEEKLY/MONTHLY/YEARLY + 종료일 또는 횟수)은 가정값으로 설계 가능하며 코어(`Recurrence` 타입·`expandOccurrences`·검증)·DB 스키마에 이미 구현되어 **이번 사이클 착수를 BLOCK 하지 않는다**. 개별 회차 편집("이 일정만/이후 모두", P-02)만 범위 제외(N-10). D-04(우선순위 3단계)도 가정값으로 이미 구현 |

**이번 사이클 반복(F-01 반복) 범위**: 신규 생성 화면에서 **단순 반복 rule + 종료조건(없음/종료일/횟수)** 입력을 `ScheduleService.create({ recurrence })` 로 그대로 전달(코어가 검증·저장). 수정 화면에서는 기존 반복 규칙을 **읽기 전용** 표시하고 미전송으로 보존. 개별 회차 편집(P-02)은 이번 사이클 제외.

### v1.1 재검증 (RN 앱 셸 요청)

**결과: PASS (설계 가능, Planner 재작업 불필요)**

| 검증 항목 | 판정 | 비고 |
| --- | --- | --- |
| 신규 제품 요구사항 유무 | 없음 | "RN 앱 셸"은 기확정 기능(F-01~F-15)의 **클라이언트 계층 구현**이다. 신규 화면·정책·데이터가 추가되지 않음 |
| 화면/흐름 근거 존재 | OK | `plan.md` 7장(7.1 최초 실행, 7.2 등록→알림→완료, 7.3 검색, 7.4 캘린더, 7.5 계정, 7.6 상태 전이)이 셸 화면·네비게이션 근거 |
| 플랫폼/스택 근거 | OK | NFR-01(모바일+워치), NFR-02(RN+TS+git+SQLite 확정), NFR-08 접근성, NFR-09 국제화 |
| 권한 흐름 근거 | OK | 7.1 알림/캘린더 권한 요청, E-08-1/E-14-1 거부 시 기능 비활성 |
| 미결정 게이트 영향 | 영향 없음 | D-01~D-05는 셸 착수를 BLOCK하지 않음(어댑터 인터페이스는 게이트와 무관, 가정값 유지) |

→ Planner 반려 없음. 본 개정은 **설계 델타**만 추가한다(overview/logic/nfr). `database.md`는 스키마 변경이 없으므로 v1.0 그대로 사용하며 RN SQLite 어댑터가 v1.0 DDL을 그대로 구현한다.

### v1.0 최초 검증

**결과: PASS (설계 가능)**

| 검증 항목 | 판정 | 비고 |
| --- | --- | --- |
| 원본 요구사항 반영 | OK | `plan.md` 10장 커버리지 매핑으로 `알림앱.md` 전 항목 대응 확인 |
| 기능 목적/범위/흐름/정책 명확성 | OK | F-01~F-15, P-01~P-17, 7장 사용자 흐름, 6절 NFR 초안 |
| 입출력/상태변화/예외 정의 | OK | 각 기능에 Exception, 7.6 상태 전이도 |
| 비기능 요구사항 기술 | 부분 | 6절이 초안 수준 → 본 설계 `nfr.md`에서 구체화 (기획에 없는 SLO는 신설하지 않고 미결정으로 표기) |
| 요구사항 충돌 | 없음 | |
| 가정/확정 구분 | OK | "확정/가정" 라벨, 8절 게이트 D-01~D-05 |
| Acceptance Criteria 검증 가능성 | OK | AC-01~AC-24 Given/When/Then |

**미결정(반려 아님, 가정값으로 설계 진행)**: D-01(계정 연동 의미) = (c), D-02(캘린더 쓰기) = 읽기 필수·쓰기 옵션, D-03(DB 암호화) = 본 설계에서 "민감필드 보호 + 선택적 전체 암호화(SQLCipher)" 제안, D-04(우선순위 단계) = 3단계, D-05(반복 범위) = 단순 반복. 게이트가 확정되면 관련 섹션을 개정한다. 어느 것도 설계를 BLOCK하지 않는다.

---

## 요구사항 요약 (설계 근거)

| 근거 | 설계 반영 |
| --- | --- |
| F-01~F-07 일정 CRUD/완료/유형/우선순위 | `SCHEDULE`, `CATEGORY` 테이블 + ScheduleService (logic 3.1~3.5) |
| F-08/F-09 사전·정시 알림, P-09 재부팅 복원, P-10 오프셋 최대 5 | `REMINDER` 테이블 + ReminderScheduler + OS 트리거 어댑터 (logic 3.6) |
| F-10 대시보드, P-07 완료율 | DashboardService 집계 쿼리 (logic 3.7) |
| F-11 검색, P-11/P-12 | SearchService + FTS 인덱스 (logic 3.8, database 5) |
| F-12 계정 연동, D-01=(c) | AuthService + OAuth(app-auth) + Keychain 토큰 저장 (logic 3.9, 보안 설계) |
| F-13 테마 | `APP_SETTING` 키/값 + ThemeStore (logic 3.10) |
| F-14 캘린더 연동, P-08 중복판정 | CalendarSyncService + `CALENDAR_LINK` 매핑 (logic 3.11) |
| F-15 영속화, NFR-06 마이그레이션 | SQLite + user_version 마이그레이션 러너 (database 6) |
| NFR-01/10 모바일+워치 | 코어 도메인 계층을 플랫폼 비의존 TS로 분리, 워치는 동일 스키마 보조 클라이언트 |

---

## 기존 시스템

- 현재 저장소(v1.1 시점):
  - `package.json`(TS 5.5, `type: module`, `engines.node >= 22.7`, 스크립트 `build`/`typecheck`/`test`/`demo`), `tsconfig.json`(strict, `nodenext`, `allowImportingTsExtensions`), 의존성 0.
  - **`src/core/**` — 플랫폼 비의존 코어 계층 구현·검증 완료**: `domain/`(clock, errors, recurrence, reminders, search, time, types, validation), `ports/`(repositories, gateways), `services/`(schedule, reminderScheduler, dashboard, search, category, setting, auth, calendarSync), `infra/memory/`(InMemoryDb=UnitOfWork + 6 repository), `infra/fakes/`(Fake Notification/Calendar/Auth Gateway, InMemoryTokenStore, ArrayLogger), `migration/runner.ts`(엔진 비의존 `MigrationDb` + `runMigrations`).
  - `src/core/app.ts` — 조립 지점(Composition Root). 현재는 인메모리/Fake 어댑터를 하드코딩해 `buildApp(options)` 반환.
  - `src/index.ts` — `npm run demo` 스모크(코어를 인메모리로 조립해 핵심 흐름 실행).
  - `tests/**` — `node:test` 러너 기반 12개 스펙(81 assertion 통과, `document/test/test-result.md`). 린트는 아직 없음.
- 재사용: TypeScript strict 설정, git, `node:test` 러너, 코어 계층 전체(포트·서비스·도메인·인메모리 어댑터·마이그레이션 러너)를 **무변경**으로 재사용. RN 앱 셸은 이 위에 UI·네비게이션·상태 스토어·네이티브 어댑터를 얹는다.
- 아직 없는 것 → 본 개정의 설계 대상: **React Native 앱 셸**(엔트리/네비게이션/화면/상태 스토어/RN용 조립 지점) + **코어 포트를 구현하는 네이티브 어댑터**(op-sqlite / notifee / react-native-calendar-events / react-native-app-auth / react-native-keychain / SystemClock·부팅 수신), `android/`·`ios/`·워치 타깃, `metro.config.js` 등 RN 툴링 파일.

### 빌드 환경 제약과 파이프라인 검증 전략

- **제약 (v1.0~v1.1 기준, v1.2에서 부분 해소)**: 최초 셸 설계 시 실행 환경에 RN 툴체인·Xcode/iOS SDK·Android SDK·CocoaPods가 없어 네이티브 빌드·온디바이스 실행을 검증할 수 없었다.
- **v1.2 갱신**: 검증 환경에 **Xcode 26.2 + CocoaPods 1.16.2 + RN CLI**가 도입되어 **iOS 네이티브 빌드(`xcodebuild` / `react-native run-ios`)와 시뮬레이터 설치·실행이 이 파이프라인에서 검증 가능**하다. op-sqlite 버전 핀 관련 빌드 결함은 정식 검증 대상이며 "환경 외 후속"으로 미루지 않는다. Android Gradle 빌드는 여전히 환경 제약(ANDROID_HOME 등)일 수 있으며 그 경우에만 후속으로 분리한다.
- **전략** — 셸을 두 층으로 나눠 "검증 가능 최대치"를 이 파이프라인에서 확보한다:
  1. **플랫폼 비의존 셸 로직 (검증 대상)**: 조립 지점 리팩터(어댑터 주입 seam), 네비게이션 그래프 정의(순수 데이터), 딥링크 파서, 화면↔서비스 바인딩 맵, 앱 부트스트랩 오케스트레이터(logic §12를 RN 라이프사이클에 매핑한 순수 함수), 각 네이티브 어댑터의 **계약 준수 테스트**(포트 인터페이스에 대한 타입 체크 + Fake 대역과의 행위 동치성). → `npm run typecheck` + `npm test`로 검증.
  2. **네이티브 바인딩**: 실제 `NativeModules` 호출부, `AndroidManifest.xml`/`Info.plist`, Gradle/Pod 설정, Metro/Babel 설정. → **v1.2부터 iOS는** `pod install` + `xcodebuild` + 시뮬레이터 설치·실행·첫 화면 렌더까지 정식 검증한다. Android Gradle 빌드와 온디바이스 알림 정확도(BOOT_COMPLETED, 워치 연동)는 환경이 허용하지 않을 때에 한해 "환경 외 후속 검증"으로 분리한다.
- Tester는 (1)을 기능/리뷰/보안 정식 검증하고, (2) 중 iOS 빌드·시뮬레이터 실행은 정식 검증하며, 나머지 미검증 항목만 `test-result.md`에 BLOCKED(ENVIRONMENT)가 아닌 "환경 외 후속 검증"으로 분리 기록한다.

---

## 전체 구조 및 처리 흐름

계층형 구조. 의존 방향은 항상 UI → Application → Domain ← Infrastructure(어댑터가 Domain 포트를 구현).

```text
┌───────────────────────────────────────────────────────────────┐
│ UI (React Native / React Navigation)                           │
│  - Dashboard / Calendar / ScheduleEditor / Search / Settings   │
│  - Watch companion UI (별도 타깃, 동일 Application API 호출)     │
├───────────────────────────────────────────────────────────────┤
│ Application (services / use-cases, 플랫폼 비의존 TS)            │
│  ScheduleService · ReminderScheduler · DashboardService ·      │
│  SearchService · CategoryService · SettingService ·            │
│  AuthService · CalendarSyncService                             │
├───────────────────────────────────────────────────────────────┤
│ Domain (엔티티 · 값객체 · 정책 · 포트 인터페이스)               │
│  Schedule, Category, Reminder, Priority, RecurrenceRule,       │
│  DateRange … / Ports: ScheduleRepository, ReminderRepository,  │
│  NotificationGateway, CalendarGateway, AuthGateway, Clock      │
├───────────────────────────────────────────────────────────────┤
│ Infrastructure (어댑터 — 포트 구현)                             │
│  SqliteScheduleRepository (op-sqlite) · NotifeeNotification    │
│  Gateway · RNCalendarEventsGateway · AppAuthGateway ·          │
│  KeychainTokenStore · SystemClock · MigrationRunner            │
└───────────────────────────────────────────────────────────────┘
                         │
        SQLite(암호화 옵션) · OS 로컬 알림 · OS 기본 캘린더 · OAuth Provider
```

대표 흐름 (일정 등록 → 알림):

```text
ScheduleEditor 입력
 → ScheduleService.create(dto)
 → 입력검증(Domain: 제목/일시/종료>=시작) → 정책검증(카테고리 기본값, 우선순위 기본값, 오프셋<=5)
 → TX{ ScheduleRepository.insert(SCHEDULE) ; ReminderRepository.replaceForSchedule(REMINDER[]) }
 → ReminderScheduler.sync(scheduleId): 과거 오프셋 skip, 미래분만 NotificationGateway.schedule()
 → 대시보드/캘린더 뷰 무효화(store invalidate)
 → 결과 반환
```

---

## 클라이언트 셸 아키텍처 (RN App Shell) — v1.1

코어 계층(`src/core/**`) 위에 얹는 React Native 클라이언트의 구조. **코어는 무변경**이며, 셸은 (a) 포트를 구현하는 네이티브 어댑터, (b) RN용 조립 지점, (c) 네비게이션·화면·상태 스토어, (d) 앱 라이프사이클 오케스트레이터로 구성된다.

### 모듈 배치

```text
src/
├── core/**                      # 기존, 무변경 (domain/ports/services/infra/migration/app.ts)
├── index.ts                     # 기존 Node 데모 (무변경)
└── app/                         # 신규 — React Native 앱 셸 (플랫폼 비의존 로직 + 네이티브 바인딩)
    ├── bootstrap/
    │   ├── composeNative.ts      # RN용 Composition Root: 네이티브 어댑터를 buildApp 에 주입
    │   ├── bootstrapSequence.ts  # logic §12 부트스트랩을 순수 오케스트레이터로 (DB open→migrate→settings→sync)
    │   └── AppContext.tsx        # 조립된 App(서비스 묶음)을 React 트리에 제공 (Context)
    ├── navigation/
    │   ├── routes.ts             # 라우트 이름·파라미터 타입 (순수 데이터)
    │   ├── linking.ts            # 딥링크 config + 알림 payload 파서 (scheduleId 정수만)
    │   └── RootNavigator.tsx     # Tab(대시보드/캘린더/검색/설정) + Stack(상세/편집)
    ├── screens/
    │   ├── DashboardScreen.tsx   Calendar / ScheduleListScreen.tsx
    │   ├── ScheduleEditorScreen.tsx / ScheduleDetailScreen.tsx
    │   ├── SearchScreen.tsx / SettingsScreen.tsx
    │   └── onboarding/PermissionsScreen.tsx
    ├── state/
    │   └── stores.ts             # Zustand 슬라이스 (dashboard/list/search/settings/account) + invalidate 훅
    ├── adapters/                 # 코어 포트를 구현하는 네이티브 어댑터 (검증: 계약 테스트 / 온디바이스는 후속)
    │   ├── sqlite/OpSqliteDb.ts           # UnitOfWork + MigrationDb (op-sqlite)
    │   ├── sqlite/SqliteScheduleRepository.ts … (6개 저장소)
    │   ├── notifications/NotifeeNotificationGateway.ts
    │   ├── calendar/RNCalendarEventsGateway.ts
    │   ├── auth/AppAuthGateway.ts
    │   ├── secure/KeychainTokenStore.ts
    │   ├── clock/SystemClock.ts (core 재noop 또는 재사용) + boot/BootReschedule.ts
    │   └── logging/MaskingLogger.ts       # nfr 5.1 마스킹 규칙 구현
    └── ui/                       # 공용 컴포넌트·테마 (theme.mode/accent/fontScale 반영)
```

RN 프로젝트 파일: `index.js`(AppRegistry), `App.tsx`, `app.json`, `metro.config.js`, `babel.config.js`, `react-native.config.js`, `.eslintrc`(`@react-native/eslint-config`), `android/`, `ios/`, 워치 타깃(`ios/<App>Watch*`, `android` Wear 모듈)은 스캐폴드로 생성하되 온디바이스 빌드는 후속 환경에서 검증.

### 코어 포트 → 네이티브 어댑터 매핑

| 코어 포트 (`src/core/ports`) | 네이티브 어댑터 | 라이브러리 (버전 고정: overview 기술 스택 표) | 검증 방식(본 파이프라인) |
| --- | --- | --- | --- |
| `UnitOfWork` + `MigrationDb` | `OpSqliteDb` | `@op-engineering/op-sqlite` 9.x (+ 선택 SQLCipher) | 계약 테스트(트랜잭션 커밋/롤백, user_version 순차 적용) — SQLite in-proc 불가 시 인터페이스·SQL 문자열 정적 리뷰 |
| `ScheduleRepository` 외 5개 | `SqliteXxxRepository` | op-sqlite prepared statement | 포트 타입 준수 + SQL 바인딩 정적 점검 + (가능 시) better-sqlite 대역으로 행위 동치 |

> **op-sqlite 9.x API 주의 (v1.2)**: 9.x JS 래퍼는 `execute()`가 `Promise<QueryResult>`(6.x는 동기)이며, `QueryResult.rows`가 **평면 배열**(`Array<Record<string, …>>`)이다. 6.x의 `rows._array` / `rows.item()` 접근자는 제거되었다. 어댑터(`OpSqliteDb.native.ts`, `SqliteRepositories.native.ts`)는 결과 행을 `res.rows`(`?? []`)로 읽는다. `open()`·`insertId`·`rowsAffected`·`close()` 시그니처는 6.x와 동일하다. 포트 계약(`UnitOfWork`/`MigrationDb`/`Repository` 인터페이스)은 변경되지 않는다.
>
> **op-sqlite 9.x named 파라미터 미지원 (v1.3, RENDER-003)**: 9.x `execute(sql, params)` 는 **positional 배열 전용**이며 named 파라미터(`:name`/`$name`/`@name`)를 어떤 API 로도 바인딩하지 못한다(객체 전달 시 내부 `params.map` → `TypeError: params?.map is not a function`). `OpSqliteDb.native.ts` 어댑터가 실행 직전 **named→positional 변환 shim** 을 적용하고(문자열/주석 내 `:` 스킵, 이름당 슬롯 1개 dedup·최초 등장 순서로 유니크 값 배열 생성), 리포지토리 SQL 은 named 바인딩(`:name`)을 유지한다. shim 은 어댑터 내부 구현이며 포트 계약(`UnitOfWork`/`MigrationDb`/`Repository`)은 변경되지 않는다. 상세는 `logic.md` §13.3 / §16.5.
| `NotificationGateway` | `NotifeeNotificationGateway` | `@notifee/react-native` 9.x (`TimestampTrigger`) | `ReminderScheduler`가 기대하는 계약(schedule→osId 반환, cancel 멱등)에 대한 Fake 동치 테스트 |
| `CalendarGateway` | `RNCalendarEventsGateway` | `react-native-calendar-events` 2.x | 외부 데이터 정제(길이/제어문자, logic 13.3) 단위 테스트 |
| `AuthGateway` | `AppAuthGateway` | `react-native-app-auth` 7.x (Auth Code + PKCE) | 토큰셋 매핑·만료 계산 단위 테스트, `client_secret` 미사용 정적 확인 |
| `TokenStore` | `KeychainTokenStore` | `react-native-keychain` 8.x (`WHEN_UNLOCKED_THIS_DEVICE_ONLY`) | `AuthService`와의 계약 동치 테스트, DB 미저장 정적 확인(V-14) |
| `Clock` | `SystemClock` | RN 런타임 `Date`/`Intl` | 이미 core 에 존재, 재사용 |
| `Logger` | `MaskingLogger` | 자체 | 마스킹 규칙 테스트(V-15) |
| 부팅 재예약 | `BootReschedule` (Android `BootReceiver` headless JS / iOS 앱 기동 시) | `@notifee/react-native` + Android receiver | `bootstrapSequence`가 `ReminderScheduler.sync()` 호출함을 테스트(AC-08) |

### 조립 지점 리팩터 (seam)

- 현 `buildApp(options)`는 인메모리/Fake를 하드코딩한다. **후방 호환**을 유지하며 어댑터 오버라이드 주입 파라미터를 추가한다:
  `buildApp({ clock?, logger?, uow?, repositories?, notifications?, calendar?, auth?, tokenStore? })` — 미지정 항목은 현재의 인메모리/Fake 기본값. 코어 테스트·`npm run demo`는 무변경 동작.
- `composeNative.ts`는 `OpSqliteDb`로 열고 `runMigrations` 적용 후, 위 표의 네이티브 어댑터로 `buildApp`을 호출해 `App`을 만든다. `AppContext`가 이를 React 트리에 제공한다.

### 화면 ↔ 서비스 바인딩 (요약; 상세는 logic §16.3)

| 화면 | 사용 서비스/메서드 | 상태 슬라이스 |
| --- | --- | --- |
| Dashboard | `DashboardService.getSummary` | `dashboard` |
| Calendar / List | `ScheduleService.findInRange` (keyset cursor), `toggleDone` | `list` |
| ScheduleEditor | `ScheduleService.create/update/getById`, `CategoryService.list/create` | 저장 후 `list`·`dashboard`·`search`·`categories` invalidate → `goBack` (상세 §16.3.1) |
| ScheduleDetail | `ScheduleService`(findById 경유 조회), `softDelete/restore` | `list` invalidate |
| Search | `SearchService.search` (2자↑ FTS / 미만 LIKE) | `search` |
| Settings | `SettingService.get/set` (theme.*, notif.showTitle, calendar.*), `AuthService.link/unlink` | `settings`, `account` |
| Permissions(온보딩) | `NotificationGateway.requestPermission`, `CalendarGateway.requestPermission` | `settings` |

### 앱 라이프사이클 → 부트스트랩

`index.js` → `App.tsx` 마운트 → `bootstrapSequence.run()`:
`OpSqliteDb.open`(PRAGMA foreign_keys/WAL, 옵션 key) → `runMigrations`(실패 시 안전 모드 UI, E-15-1) → `SettingService.getAll` → `ThemeStore` 초기화 → 첫 화면 렌더 → 렌더 후 비동기 `ReminderScheduler.sync()` 전체(P-09) → 연동 상태면 `AuthService.ensureFreshToken()`.
`AppState`가 `active` 전이 시 `sync()` 재호출. Android 부팅 완료 브로드캐스트 → headless JS → `sync()`. (logic §16.4)

---

## 인증 / 권한 및 오류 처리 요약

- **인증**: 앱 자체 인증 없음(단말 로컬 앱). 계정 연동은 **OAuth 2.0 + PKCE**(외부 IdP)로 위임하며, 액세스/리프레시 토큰은 OS 보안 저장소(Keychain/Keystore)에 저장. 세부는 `logic.md` 「보안 설계」.
- **권한(앱 내)**: 단일 사용자, 역할 구분 없음. 모든 로컬 데이터는 단말 소유자만 접근. OS 권한(알림, 캘린더)은 런타임 요청하며 거부 시 해당 기능만 비활성(E-08-1, E-14-1).
- **오류 처리 방침**:
  - 입력 검증 실패는 저장 이전에 필드 단위 오류로 반환(AC-02/03), 데이터 변경 없음.
  - 쓰기 작업은 단일 SQLite 트랜잭션. 실패 시 전체 롤백, UI 상태 롤백(E-05-2).
  - OS 게이트웨이(알림/캘린더/OAuth) 실패는 도메인 데이터에 영향 주지 않음(부분 실패 격리). 사용자 안내 + 재시도 경로 제공.
  - 상세 예외 흐름과 에러 코드 체계는 `logic.md` 참조.

---

## 보안 요약

`logic.md` 「보안 설계」의 핵심만 요약:

| 위협(STRIDE/OWASP) | 대응 |
| --- | --- |
| 단말 분실 시 로컬 일정(제목/메모) 유출 — Information Disclosure | 민감필드 취급 정책 + 선택적 SQLCipher 전체 암호화(키는 Keychain/Keystore), 알림 본문 제목 마스킹 토글(P-10-1) |
| OAuth 토큰 탈취 — Spoofing/Elevation | Authorization Code + PKCE, 토큰은 Keychain(`ACCESSIBLE_WHEN_UNLOCKED_THIS_DEVICE_ONLY`), 리프레시 실패 시 로컬 모드 강등 |
| SQL Injection (검색어/제목) — Injection | 모든 쿼리 파라미터 바인딩, FTS 쿼리 이스케이프, 동적 SQL 금지 |
| 캘린더 데이터 역주입 / 과신 — Tampering | 외부 캘린더 필드는 신뢰 경계 밖 입력으로 취급, 길이/타입 검증 후 저장, 로컬 편집 필드 우선 병합 |
| 딥링크/알림 페이로드 위조 — Tampering | 알림 payload는 scheduleId(정수)만, 수신 시 저장소 재조회로 검증 |
| 민감정보 로그 노출 — Information Disclosure | 로그에서 제목/메모/토큰/좌표 마스킹, 릴리스 빌드 로그 레벨 축소 |

잔여 위험: 루팅/탈옥 단말, OS 백업에 포함되는 평문(암호화 미선택 시), 디바이스 잠금 미설정 사용자 — `nfr.md`/`logic.md`에 residual risk로 기록.

---

## 설계 문서

| 문서 | 목적 |
| --- | --- |
| `overview.md` | 전체 구조, 기술 스택 결정, 설계 간 관계, **클라이언트 셸 아키텍처(v1.1)**, 미결정 사항 (본 문서) |
| `logic.md` | 8개 서비스의 처리 흐름 + 상태 변화 + 예외, 「API 설계」(외부 OAuth/캘린더 연동 계약), 「보안 설계」, **§16 클라이언트 셸 처리 흐름(v1.1)** |
| `database.md` | SQLite 스키마(테이블·인덱스·FTS·제약), 마이그레이션 러너, 초기 데이터. **v1.0 유지(RN 앱 셸은 스키마 무변경)** |
| `nfr.md` | 성능/용량/가용성/관측성 목표의 기술적 구체화, Tester 검증 관점, **§11 셸 검증 관점(v1.1)** |

---

## 영향 범위

### v1.5 (F-16 앱 아이덴티티 UI)

- **구현 예정(Developer)**:
  - `src/app/navigation/RootNavigator.tsx`: `Tab.Navigator`의 각 `Tab.Screen`에 `tabBarIcon` 옵션 추가 — PNG 에셋을 `Image`로 렌더하고 활성 여부에 따라 `opacity` 또는 `tintColor` 적용 (P-19, AC-27).
  - `src/app/screens/DashboardScreen.tsx`: 헤더 로고(logo.png) + 태그라인(tagline.png) 렌더 영역 추가 — 화면 폭 60% 이하 제한(P-20), ScrollView 최상단 배치 (AC-25).
- **무변경**: 코어 서비스·포트 계약·DB 스키마·라우트·상태 슬라이스·기존 12개 코어 테스트.
- **신규 의존성**: 없음 — `Image`는 react-native 내장 컴포넌트.
- **회귀 위험**: 없음 — 기존 기능 변경 없이 UI 요소만 추가.

### v1.4 (일정 추가/수정 화면 연결)

- **구현 예정(Developer)**: `src/app/navigation/RootNavigator.tsx`(Dashboard/Calendar `headerRight`「+」, `ScheduleDetail`「편집」 — `useNavigation`), `src/app/screens/ScheduleEditorScreen.tsx`(F-01 폼으로 확장), `src/app/screens/DashboardScreen.tsx`·`CalendarScreen.tsx`·`ScheduleDetailScreen.tsx`(진입 버튼), 신규 날짜/시간 입력 컴포넌트(`src/app/ui/` 하위), 선택 `src/core/domain/time.ts`(`localWallToEpoch` 순수 함수 + 단위 테스트).
- **`bindings.ts` 정정 필요**: `ScheduleEditorScreen.reads` 에 `{ service: 'schedules', method: 'getById' }` 추가(수정 모드 프리필). `ScheduleDetailScreen.reads` 를 `findInRange` → `getById` 로 정정(실제 화면 코드와 일치). `invalidates` 는 이미 4-슬라이스.
- **무변경**: 코어 서비스 계약(`ScheduleService.create/update/getById`, `CategoryService.list/create`), 포트 인터페이스, `routes.ts`(`ScheduleEditor { scheduleId? }` 이미 정의), DB 스키마(`database.md` v1.0), 코어 도메인/서비스/검증 로직, 기존 12개 스펙·`npm run demo`.
- **신규 의존성**: 없음(네이티브 date picker 미도입 — N-10).
- **회귀 위험**: 낮음. 코어 무영향. 셸 화면 단위 테스트(서비스 목)로 폼 검증 매핑·무효화·네비게이션 확인.

### v1.1 (RN 앱 셸)

- **회귀 위험 영역**: `src/core/app.ts`의 `buildApp` 시그니처 확장(어댑터 오버라이드 파라미터 추가). **후방 호환 필수** — 기존 12개 테스트·`npm run demo`가 무변경 통과해야 한다(REGRESSION 검증 대상).
- **무변경**: `src/core/{domain,ports,services,infra,migration}/**`, `tests/**`, `tsconfig.json`(단, RN/JSX용 컴파일 옵션은 셸 전용 `tsconfig.app.json` 분리 또는 `jsx` 옵션 추가 — 코어 `typecheck` 결과에 영향 없도록), `document/architect/database.md`.
- **신규**: `src/app/**`, RN 프로젝트 파일(`index.js`, `App.tsx`, `metro.config.js`, `babel.config.js`, `react-native.config.js`, `app.json`), `android/`, `ios/`, 워치 타깃, `package.json` 의존성 추가(react, react-native, @react-navigation/*, zustand, @op-engineering/op-sqlite, @notifee/react-native, react-native-calendar-events, react-native-app-auth, react-native-keychain — 전부 overview 기술 스택 표의 고정 버전).
- **package.json 스크립트**: 기존 `test`/`typecheck`/`demo` 유지. 셸용 `lint`, (후속 환경용) `android`/`ios`/`start` 추가.

### v1.0 (코어 계층) — 완료

- 신규 프로젝트이므로 회귀 영향 대상 없음. 유지: `tsconfig.json` strict, TS 5.5 계열, git.
- `src/index.ts`는 코어 스모크 데모로 대체됨(유지).
- 코어 도메인/서비스/인메모리 어댑터/마이그레이션 러너 구현·검증 완료.

---

## 기술 스택 및 주요 기술 결정

기존 코드베이스 스택(**TypeScript 5.5 / npm / git / tsc strict**)을 계승한다. 그 위에 아래를 신규 선정한다. 런타임·주요 라이브러리는 major 고정.

| 영역 | 선정 | 고정 버전 | 근거 | 검토한 대안 |
| --- | --- | --- | --- | --- |
| 언어 | TypeScript | 5.5.x (repo 계승) | 기존 `devDependencies` 및 strict 설정 유지 | — |
| 앱 프레임워크 | React Native | 0.74.x | `알림앱.md` 확정("JS(TS)/react-native"). 0.74는 New Architecture 안정화·유지보수 대상 | Expo(관리형) — 네이티브 알림/캘린더/워치 커스텀 모듈 자유도 위해 제외 |
| 툴링 런타임 | Node.js | 20 LTS | RN 0.74 요구, LTS | Node 18(지원 종료 임박) |
| 화면 이동 | React Navigation | 6.x | RN 표준, 딥링크 지원(알림 탭 이동) | React Native Navigation(native) — 러닝코스트 |
| 상태 관리 | Zustand | 4.x | 경량, 코어 서비스와 분리 용이, 보일러플레이트 최소 | Redux Toolkit 2.x — 이번 범위엔 과함 / Context — 성능 |
| 로컬 DB | SQLite (`@op-engineering/op-sqlite`) | 9.x major 고정 (9.3.x pin) | `알림앱.md` 확정(SQLite). op-sqlite는 동기/비동기 API·prepared statement·**SQLCipher 옵션**(D-03 대응) 제공, New Arch 호환. **v1.2**: 6.x는 `cpp/types.h`가 `<vector>`를 include하지 않아 Xcode 26.2 clang(전이 include 불허)에서 컴파일 불가 → 9.x로 상향. 9.3.x는 헤더 정합 수정 + RN 0.74 peer 호환(`react-native: >0.73.0`) + 구아키텍처(`newArchEnabled=false`) 지원. 10.x는 동급 대체안, 11.x+는 RN 0.75+ 타깃이라 회피 | `react-native-quick-sqlite`(유지보수 둔화), `react-native-sqlite-storage`(구형 API), WatermelonDB(추상화 과다) |
| 마이그레이션 | 자체 러너 (`PRAGMA user_version`) | — | 스키마 소수·단일 클라이언트, ORM 불필요. 순번 SQL 파일 적용 | Drizzle/TypeORM 마이그레이션 — 의존성·번들 비용 |
| 로컬 알림 | `@notifee/react-native` | 9.x | 정밀 트리거(TimestampTrigger), 채널/카테고리, iOS/Android 통합 API, 부팅 후 재예약 훅 | RN PushNotificationIOS + 별도 안드로이드 구현 — 파편화 |
| 기본 캘린더 | `react-native-calendar-events` | 2.x | EventKit(iOS)/CalendarProvider(Android) 읽기·쓰기·권한 통합 | 플랫폼별 자체 브리지 — 유지비 |
| OAuth | `react-native-app-auth` | 7.x | Authorization Code + PKCE 표준 구현, IdP 중립(D-01=(c)에 부합) | WebView 직접 구현 — 보안 위험, 스토어 정책 |
| 보안 저장소 | `react-native-keychain` | 8.x | 토큰·DB 암호화 키를 Keychain/Keystore에 보관, 접근성 클래스 지정 | AsyncStorage 평문 — 금지 |
| 백그라운드/부팅 | `@notifee/react-native` + `react-native-boot-receiver`(Android) / iOS는 재예약을 앱 기동 시 수행 | — | P-09 알림 복원 | Headless JS 직접 구현 |
| 워치 | iOS: WatchConnectivity, Android: Wear OS Data Layer — **네이티브 모듈로 별도 구현**, 데이터 스키마·동기화 규약은 코어와 공유 | — | NFR-10. RN이 워치 UI를 직접 렌더하지 않으므로 브리지 필요 | react-native-watch-connectivity(iOS 전용) — Android 미지원이라 부분 채택 |
| 테스트 | Jest 29 + ts-jest, `@testing-library/react-native` 12.x | Jest 29.x | RN 기본 러너. **코어 도메인/서비스는 순수 단위 테스트로 즉시 검증** | Vitest — RN 프리셋 미성숙 |
| 린트/포맷 | ESLint + `@react-native/eslint-config`, Prettier 3 | — | RN 표준 | Biome — RN 커뮤니티 채택 낮음 |

**주요 기술 결정**

1. **코어 도메인/서비스 계층을 React Native에 비의존적인 순수 TypeScript로 작성**하고, SQLite·알림·캘린더·OAuth·시계(Clock)를 **포트 인터페이스**로 추상화한다. 이유: (a) 모바일·워치가 동일 로직 공유(NFR-10), (b) 네이티브 없이 Jest로 즉시 검증 가능(현 파이프라인 Tester 단계), (c) 어댑터 교체 용이(op-sqlite → 다른 드라이버).
2. **시각은 UTC epoch(ms) + IANA 타임존 문자열로 저장**, 표시는 로컬 변환(P-16). 날짜 경계 계산은 `Clock` 포트를 통해 결정적으로 테스트.
3. **알림 예약은 "논리 예약(REMINDER 행)"과 "OS 예약"을 분리**. OS는 향후 일정 범위만 실제 예약, 나머지는 앱 기동/부팅/일정 변경 시 `ReminderScheduler.sync()`로 재조정(P-03, P-09).
4. **검색은 SQLite FTS5(external content) + `unicode61` + 서브스트링 대응을 위한 `LIKE` 폴백**. 2자 미만 검색은 결과 상한(P-11). (구버전 설계의 trigram 2자 이슈를 회피: FTS는 토큰 검색, 짧은 질의는 LIKE 폴백으로 처리.)
5. **DB 암호화는 빌드 플래그로 토글(SQLCipher)**. 기본 릴리스는 암호화 ON 제안, 키는 최초 실행 시 생성해 Keychain 저장(D-03 최종 확정 전까지 설계상 지원, 정책 결정 대기).
6. **일정 편집 날짜/시간 입력은 이번 사이클에 신규 네이티브 의존성 없이 구현**(v1.4). RN 코어에 date/time 컴포넌트가 없고, 표준 선택지 `@react-native-community/datetimepicker` 는 신규 CocoaPods 의존 + 네이티브 재빌드를 요구하는데 빌드 호스트 디스크 여유(약 1.8 GiB)가 `ios/build`(약 2.8 GB) 재생성에 부족하다. 대안: `YYYY-MM-DD`/`HH:mm` 구조화 텍스트 입력 + 증감 버튼, UI 계층에서 `Clock.timeZone()` 기준 epoch ms(P-16) 변환(순수 함수 `localWallToEpoch`, 권장 위치 `src/core/domain/time.ts`, 포트·시그니처 무변경). AC-01~03 은 네이티브 스피너를 요구하지 않으므로 충족. 디스크 여유 확보 후 동일 UI 계약(`startAt: number`) 뒤에서 `@react-native-community/datetimepicker`(pin `8.x`)로 교체 — 코어/로직/DB 변경 없음(미결정 N-10). 검토한 대안: 네이티브 픽커 즉시 도입(디스크 리스크로 보류), 순수 JS 캘린더 라이브러리(`react-native-calendars` 등 — 신규 의존성·번들 비용 대비 이득 낮음), 커스텀 휠 컴포넌트(구현 비용 과다).

---

## 비기능 요약

`nfr.md` 참조. 핵심 결정:

- 성능: 일정 1만 건 기준 목록/대시보드 쿼리는 인덱스 + 기간 범위 + 페이지네이션(50건)으로 처리. 대시보드 집계는 단일 GROUP BY 쿼리.
- 용량: 개인 사용자 1명, 연 2,000건 증가 가정, 5년 1만 건 규모에서 SQLite 단일 파일로 충분.
- 가용성: 서버 없음 → 앱 로컬 가용성만. 저장소 손상 시 안전 모드 + 마지막 정상 스키마로 복구 시도(E-15-1).
- 관측성: 로컬 구조적 로그(레벨/카테고리/민감정보 마스킹), 알림 예약·발송·복원 이벤트 카운터, 마이그레이션 결과 로그. 원격 수집은 이번 범위 없음(미결정: 크래시 리포팅 도입 여부).
- 기획에 정량 SLO가 없어 응답시간 목표치는 "제안값"으로 표기하고 확정은 미결정으로 둔다.

---

## 미결정 사항

| ID | 내용 | 처리 |
| --- | --- | --- |
| D-01 | 계정 연동 = 자체 동기화 서버 도입 여부 | (c) 가정으로 설계. (a) 확정 시 `logic.md` API 설계에 동기화 API + `nfr.md`에 서버 SLO 추가 필요 |
| D-02 | 앱 → 기본 캘린더 쓰기(양방향) | 읽기는 설계 포함, 쓰기는 `CalendarSyncService.pushEnabled` 플래그로 옵션 설계. 확정 시 충돌 해결 UX 상세화 |
| D-03 | 로컬 DB 암호화 범위 | "전체 암호화(SQLCipher) 기본 ON" 제안. 최종 정책 확정 필요(성능·백업 영향) |
| D-04 | 우선순위 단계 수 | 3단계(HIGH/NORMAL/LOW)로 설계 |
| D-05 | 반복 일정 범위 | 단순 반복(NONE/DAILY/WEEKLY/MONTHLY/YEARLY + 종료일 또는 횟수) |
| N-1 | 성능 정량 SLO, 알림 허용 오차 수치 | 기획에 없음 → 제안값만, 확정 대기 |
| N-2 | 원격 크래시/텔레메트리 도입 | 프라이버시 정책 필요, 이번 범위 보류 |
| N-3 | 삭제 Undo 보관 시간(OI-4) | `logic.md`에 "세션 내 + 5분" 제안, 확정 대기 |
| N-8 | RN 앱 셸의 온디바이스(Android/iOS 빌드·실행) 검증 | 현 파이프라인 환경에 RN 툴체인·SDK 없음 → 플랫폼 비의존 셸 로직·어댑터 계약만 검증, 네이티브 빌드·워치 연동은 별도 모바일 CI/개발기에서 후속. 산출물에 미검증 범위 명시 |
| N-9 | RN New Architecture(Fabric/TurboModules) 활성 여부 | RN 0.74 기준. 셸 구조는 New Arch 호환 라이브러리로 선정했으나 활성 플래그는 온디바이스 검증 시 확정 |
| N-10 | (1) 일정 편집 날짜/시각 **네이티브 픽커** 도입(`@react-native-community/datetimepicker` 8.x) — 빌드 호스트 디스크 여유 확보 후, 동일 UI 계약 뒤 교체 (2) **반복 일정 개별 회차 편집**("이 일정만/이후 모두", P-02) — 코어 `ScheduleService.update` 확장 필요, 이번 사이클 범위 밖 | 이번 사이클은 텍스트 입력 + 단순 반복(생성 경로)으로 진행 |
| D-03 | SQLCipher 기본 활성 → op-sqlite 어댑터의 `PRAGMA key` 경로 | 셸은 빌드 플래그로 토글 가능하게 설계, 최종 정책은 D-03 확정 대기 |
