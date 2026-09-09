# 검증 결과 — 일정관리 앱 "오늘뭐해"

| 항목 | 값 |
| --- | --- |
| 문서 종류 | 검증 결과 (기능 테스트 + 코드 리뷰 + 보안 점검) |
| 버전 | v1.9 |
| 대상 | (v1.0) `src/core/**` · (v1.1~1.2) `src/app/**` · (v1.5) op-sqlite 6.2.11→9.3.0 상향 + iOS 온디바이스 빌드/실행 검증 · (v1.6) ScheduleEditor 진입점 추가 (F-01/F-03, AC-15, E-10-1) · (v1.7) 애플워치 워치 타깃 추가 (F-19, AC-23·AC-47~AC-56) |
| 근거 | `document/planner/plan.md` v1.4, `document/architect/{overview,logic,nfr}.md` (overview/logic v1.9, nfr v1.7), `database.md` v1.2 |
| 작성 주체 | Tester |
| 일자 | 2026-09-08 |

## 변경 이력

| 버전 | 변경 |
| --- | --- |
| v1.0 | 코어 계층 검증 — PASS (81 tests) |
| v1.1 | RN 앱 셸 + 네이티브 어댑터 검증 — **FAIL** (SHELL-001 High: op-sqlite `exec()` 다중문 분할이 트리거 DDL 파손) |
| v1.2 | SHELL-001 수정 재검증 — PASS (113 tests) |
| v1.3 | Bug Fix: op-sqlite 버전 핀 6.3.0→6.2.11(ETARGET) 재검증 — PASS (113 tests) |
| v1.4 | Feature: android/ios 네이티브 프로젝트 생성 — PASS (113 tests) |
| v1.5 | Bug Fix: op-sqlite iOS 네이티브 빌드 실패(cpp/types.h) — op-sqlite 6.2.11→9.3.0. **부분 성공**: iOS 빌드/설치/실행/DB open/스키마 마이그레이션(FTS5)까지 온디바이스 검증 PASS, 그러나 대시보드 렌더는 선재 셸 결함(RENDER-003, 저장소 named-object 파라미터 ↔ op-sqlite `execute` 배열 전용)으로 **미도달 → 별도 후속 필요**. npm test 115/115 |
| v1.6 | Feature: ScheduleEditor 진입점 추가(F-01/F-03, AC-15, E-10-1) — PASS. 코드 리뷰 Critical/High 0. 보안 미해결 취약점 0. npm test 129/129(회귀 없음). Low 지적 1건(NAV-001: ScheduleDetailScreen 이중 navigation 참조, 비차단). |
| v1.7 | Feature: 애플워치 워치 타깃 추가(F-19, AC-23·AC-47~AC-56) — **PASS**. `node --test` 195/195(회귀 0, 신규 watchSync 30건). 코드 리뷰 Critical/High 0. 보안 미해결 취약점 0(§13.9 STRIDE 통과 — 수신 op 비신뢰 입력 검증·`findById` 재조회·dedup 원장·`toggleDone` 한정·페이로드 비밀정보 미전송·워치 로컬 파일 `.completeFileProtection`). 지적 3건(WATCH-01 Medium: `package-lock.json`에 `react-native-watch-connectivity` 미반영 — `npm ci` 파손, 비차단·머지 전 수정 / WATCH-02 Low: `applyIncomingToggle`의 `toggleDone`/repo 예외 미격리 / WATCH-03 Low: 어댑터 `activate()` 비-iOS에서 throw). 어댑터·watchOS 스캐폴드 온디바이스 검증은 N-11 후속(범위 밖). |
| v1.9 | N-11: WATCH-08/09/10 수정 재검증(Dev iteration 3) — **PASS**. `node --test` 207/207(회귀 0, 신규 `watchMessage.test.ts` 12건). `tsc` src 신규 오류 0(사전 5건 허용). `src/core/**` 이번 사이클 무수정(`watchSyncService.ts` 미수정 확인). **WATCH-08 종결**: `WatchToggleOp.watchChangedAt`/`baseUpdatedAt` 이 Swift `Int` 로 전송(`WatchClock.nowEpochMillis()` 반올림), 비정수는 워치 `JSONDecoder`(Int) 및 폰 `parseToggleOp`(`Number.isInteger`) 양쪽에서 거부 — 큐 진입조차 불가. **WATCH-09 종결**: 신규 순수 모듈 `src/app/adapters/watch/watchMessage.ts`(RN/node 미import)의 `parseToggleOp` 가 서비스 `isValidToggleOp` 와 동일 정수 규칙 적용 — 어댑터 경계에서 차단, 서비스 조용한 폐기 제거. **WATCH-10 종결**: `classifyInboundMessage` 4분기(toggle/requestSnapshot/malformedToggle/ignore), `watch.toggle.malformed` 은 `type:'toggle'` 실패 시에만 계측, `requestSnapshot` → 캐시 `lastSnapshot` 즉시 reply + `composeNative` 가 `setSnapshotRequestHandler(()=>pushSnapshot())` 배선, 워치 `manualRefresh()` 는 도달 가능화 시점에도 실행. AC-23/AC-48/AC-49/AC-50/R-19-2 충족(실경로 통합 테스트 + Dev 라이브 증거 정합). 보안 미해결 취약점 0(§13.9 재확인 — 인바운드 파서가 비-토글 쓰기 시도를 `sendMessage`/`transferUserInfo` 양경로에서 전부 차단, `requestSnapshot` reply 는 직전 push 페이로드와 동일 — 신규 노출 없음, V-40 유지). 신규 지적 WATCH-11(Low, 비차단: `loadLocal()` `?? []` 가 손상된 보류 큐 파일을 재기록 없이 흡수). 이관 유지: WATCH-04(Architect — 컴플리케이션 App Group, AC-56 partial), WATCH-05·ENV-01·N-11-COV. |
| v1.8 | N-11: F-19 네이티브 통합 + 라이브 왕복 검증(Dev iteration 1+2) — **FAIL**. `node --test` 195/195(회귀 0), `tsc` src 신규 오류 0(사전 5건 허용). 코드 리뷰: **WATCH-08 High** — watchOS `WatchToggleOp.make` 가 `watchChangedAt = Date().timeIntervalSince1970 * 1000`(비정수 Double)을 전송하나 `WatchSyncService.isValidToggleOp` 는 `Number.isInteger` 를 요구(설계 §17.4/§13.9) → 실제 워치 발신 토글 op 이 전부 `malformed` 로 거부(`ack REJECTED`) → R-19-2/AC-23/AC-48/AC-50 실기기 파손. node 195건은 `emitIncoming` 에 정수값을 직접 주입해 이 경로를 못 짚음. Dev iteration-2 "라이브 토글 APPLY 관찰" 증거는 커밋된 코드와 모순(재현 불가). 부수: WATCH-09 Medium(어댑터 `parseToggleOp` `Number.isFinite` ↔ 서비스 `Number.isInteger` 이중검증 불일치), WATCH-10 Medium(폰 어댑터에 워치 `requestSnapshot`(수동 새로고침, §17.2 sendMessage 경로/§17.1(d)) 핸들러 없음 → 무동작 + 허위 `watch.toggle.malformed`). 보안 미해결 취약점 0(§13.9 재확인 — 수신 op 단일 경로 검증→`findById`→dedup→`toggleDone` 한정, `sendMessage`/`transferUserInfo` 양경로 동일, 페이로드 V-40 유지, 워치 파일 `.completeFileProtection`). 이월: WATCH-04 Medium(컴플리케이션 App Group 미설정 → 상시 "—", 설계 §17.8 미명세 — Architect 확인), WATCH-05 Low(워치 AppIcon 에셋 없음 — 빌드 경고), ENV-01 Low(비ASCII 경로에서 Metro `/status` 500 — CLI 버그, 오프라인 번들 우회), N-11-COV Low(LWW tie/REJECT/200절단은 node 테스트로 커버, 라이브 미실행 — 설계상 허용). |

---

# v1.7 — Feature: 애플워치 워치 타깃 추가 (F-19, AC-23·AC-47~AC-56, P-36~P-44, NFR-10·NFR-12)

| 항목 | 값 |
| --- | --- |
| 일자 | 2026-09-08 |
| 대상 | 신규 순수: `src/core/watchSync/{types,snapshot,reconcile}.ts` · 신규 서비스: `src/core/services/watchSyncService.ts` · additive: `src/core/{domain/errors.ts,ports/gateways.ts,infra/fakes/fakes.ts,app.ts}` · iOS 어댑터(정적): `src/app/adapters/watch/WatchConnectivityGateway.native.ts` · watchOS 스캐폴드(정적): `ios/TodayWhatWatch/**` · 테스트: `tests/watchSync/**` · `package.json` |
| 근거 | `plan.md` v1.4 (F-19, §5.14 P-36~P-44, E-19-1~E-19-7, AC-23·AC-47~AC-56), `logic.md` v1.9 (§0.1/§0.2/§13.9/§17.1~§17.10), `database.md` v1.2 (§10), `nfr.md` v1.7 (§14, V-36~V-40) |

```text
status: PASS
summary: >
  F-19 폰 측 워치 동기화(순수 페이로드 빌더 + LWW + WatchSyncService 조정자 + 포트/어댑터 계약 +
  watchOS 스캐폴드)를 기능 테스트 · 코드 리뷰 · 보안 점검으로 검증했다.
  - 기능: node --experimental-strip-types --test "tests/**/*.test.ts" → 195 pass / 0 fail.
    신규 watchSync 30건(snapshot 11 · reconcile 5 · watchSyncService 10 · appWiring 4) 전부 유효
    단언 포함(공허 단언 없음). 회귀 0.
  - 설계 준수: logic §17.3 페이로드(오늘+다음 1건 · 10필드 최소화 · 200건 절단+truncated ·
    epoch ms+IANA tz 원본 · 삭제 유형→시스템"기타" · summary는 절단 전 전체 기준 = DashboardSummary 일치),
    §17.4 applyIncomingToggle(입력검증→dedup 원장 ring-50→findById 재조회→resolveToggleLWW→
    ScheduleService.toggleDone "만" 호출→원장 기록→ack→pushSnapshot), §17.6 LWW(UPDATED_AT vs
    baseUpdatedAt, tie=폰 우선, soft-deleted→REJECT), §17.7(ReminderScheduler/알림 경로 무접촉 —
    정적 grep 0), NFR-12(게이트웨이 전송/활성화/ack 실패 격리·무예외) 모두 구현·테스트로 확인.
  - 계층: src/core/watchSync/** 및 watchSyncService.ts 는 react-native / node:* 미의존 순수 TS.
    src/core 가 src/app 미import. 어댑터만 react-native-watch-connectivity 의존.
  - 후방 호환: watchSync 미주입 시 NoopWatchSyncGateway — buildApp 기존 호출부·demo 무영향(V-19 확인).
  - 보안(§13.9 / STRIDE): 워치 수신 op 를 신뢰 경계 밖 입력으로 취급 — UUID/정수/boolean/유한수 검증 +
    scheduleId findById 재조회(워치가 보낸 상태 불신) + opId dedup 원장 + toggleDone 한정으로
    Broken Access Control 표면 제거(테스트 V-37/P-43: isDone/doneAt 외 무변경 확인).
    페이로드에 토큰/계정/메모/알림/이력 미포함(V-40). 워치 로컬 스냅샷·보류 큐 파일
    .completeFileProtection. 비밀정보 하드코딩 0. 잠금 해제 분실 워치 제목 열람은 §13.9 잔여 위험으로 문서화됨.
  - 무변경 회귀: DB DDL/인덱스/트리거/시드, ScheduleService/DashboardService/ReminderScheduler/
    CategoryService 로직, 기존 셸 화면, bindings.ts SCREEN_BINDINGS 무변경. F-19 구현은
    작업 트리 선행 재설계분(screens/*, bindings.ts, react-native-svg)에 미접촉.
  판정: 핵심 요구사항·정상/실패 흐름 통과, Critical/High 결함 0, 미해결 보안 취약점 0 → PASS.
  WATCH-01(Medium)은 머지 전 lock 파일 동기화 필요. 온디바이스 왕복은 N-11 후속.
tests:
  total: 195
  passed: 195
  failed: 0
issues:
  - id: WATCH-01
    severity: Medium
    category: CODE_REVIEW
    cause: IMPLEMENTATION_ERROR
    location: package.json / package-lock.json
    scenario: >
      package.json dependencies 에 react-native-watch-connectivity@1.1.0 을 추가했으나
      package-lock.json 에 해당 패키지가 없다(root deps·packages 양쪽 모두 누락).
      package.json ↔ lock 불일치로 `npm ci` 가 실패한다.
    expected: package-lock.json 이 새 의존성을 포함해 두 파일이 동기화됨(`npm ci` 성공)
    actual: lock 미갱신 — `npm ci` 파손, 재현 가능한 설치 불가
    note: >
      이 파이프라인 검증(node:test 순수 로직 + core tsc)은 이 의존성을 사용하지 않고,
      어댑터는 N-11 정적 리뷰 대상이라 현재 파이프라인은 비차단. 단, RN 빌드/CI 전에 반드시 수정.
  - id: WATCH-02
    severity: Low
    category: CODE_REVIEW
    cause: IMPLEMENTATION_ERROR
    location: src/core/services/watchSyncService.ts applyIncomingToggle
    scenario: >
      메서드 주석·설계 §17.4 는 "어떤 경로에서도 throw 하지 않는다(NFR-12)" 를 명시하나,
      scheduleService.toggleDone / schedules.findById / settings.get·set 예외는 개별 격리되지 않아
      reject 시 applyIncomingToggle 가 reject 한다. 부트스트랩 배선(activate)의 .catch 로 크래시는
      막히지만 계약(무예외)과 어긋난다. DB 실패는 폰 토글에서도 동일 발생하므로 실질 위험은 낮음.
    expected: 모든 경로에서 예외를 삼키고 로깅(스냅샷/ack 격리와 동일)
    actual: 저장소/서비스 계층 예외가 전파 가능
  - id: WATCH-03
    severity: Low
    category: CODE_REVIEW
    cause: IMPLEMENTATION_ERROR
    location: src/app/adapters/watch/WatchConnectivityGateway.native.ts activate()
    scenario: >
      logic §17.2 는 "Android 는 isSupported()=false, 모든 메서드 no-op(GATEWAY_WATCH_UNAVAILABLE
      없이 조용히 skip)" 를 명시하나 activate() 는 비-iOS 에서 AppError(GATEWAY_WATCH_UNAVAILABLE) 를
      throw 한다. WatchSyncService.activate() 가 isSupported() 가드 + try/catch 로 감싸 실질 영향은
      없으나(다른 메서드 sendSnapshot/ack 는 조용히 return), 설계 문구와 불일치.
    expected: 비지원 플랫폼에서 activate() 도 조용히 no-op
    actual: throw 후 상위에서 catch·로깅
  - id: WATCH-NOTE-1
    severity: Low
    category: CODE_REVIEW
    cause: TEST_ERROR
    location: ios/TodayWhatWatch/WatchModels.swift WatchLww.resolve
    scenario: >
      Swift 낙관 LWW 헬퍼가 "폰 측 reconcile.ts 와 1:1 대응" 이라 주석하나 폰의 첫 가드
      (deletedAt != null → REJECT_NOT_FOUND)에 대응하는 분기가 없다. WatchScheduleItem 에
      삭제 표현 필드가 없어 실무상 무해하며, 스캐폴드는 온디바이스 검증(N-11) 대상.
    expected: 주석을 정확히 하거나 대응 분기 명시
    actual: 가드 1개 누락 — 현재 데이터 모델에서는 도달 불가
relatedRequirement: F-19, AC-23, AC-47~AC-56, E-19-1~E-19-7, P-36~P-44, NFR-10, NFR-12
relatedDesign: logic.md v1.9 §0.1/§0.2/§13.9/§17.1~§17.10, nfr.md v1.7 §14 V-36~V-40, database.md v1.2 §10
environment: >
  Node v22.11, `node --experimental-strip-types --test`. 워치 시뮬레이터/기기 없음 —
  WCSession 실왕복·오프라인 flush·컴플리케이션 타임라인은 N-11 후속(범위 밖, 정적 매핑만 수행).
```

## AC / 예외 정적 매핑 (F-19)

| 항목 | 구현/검증 지점 | 결과 |
| --- | --- | --- |
| AC-23 / AC-48 워치 토글 → 폰 집계 반영 | `applyIncomingToggle` → `ScheduleService.toggleDone` → `pushSnapshot`; 테스트 V-37(isDone/doneAt 반영 + 스냅샷 재전송) | PASS |
| AC-47 오늘 목록(시각순·최소 상세·헤더 카운트) | `buildWatchSnapshot.today` 정렬·10필드·`summary`; 테스트 V-36 | PASS |
| AC-49 오프라인 조회 + 보류 큐 | `WatchSyncStore`(pendingOps·isStale·flushPendingQueue) — 정적 리뷰 | 정적 OK / 온디바이스 N-11 |
| AC-50 오프라인 충돌 LWW | `resolveToggleLWW`; 테스트 V-38(APPLY/SKIP_PHONE_WINS/tie/soft-deleted) | PASS |
| AC-51 워치 비범위 동작 차단 | `ContentView`/`DetailView` 조회 전용 — 생성/편집/삭제 진입점 부재 — 정적 리뷰 | 정적 OK |
| AC-52 알림 예약 주체 = 폰 | watchSync 코드에 reminder/notification/syncOnce 참조 0(grep), 스냅샷 스키마 REMINDER 필드 0; V-40 | PASS |
| AC-53 페이로드 범위(오늘 + 다음 1건) | `buildWatchSnapshot` 시그니처·매핑; 테스트 V-36 | PASS |
| AC-54 빈 상태(추가 버튼 없음) | `ContentView` "오늘 일정이 없습니다" — 정적 리뷰 | 정적 OK |
| AC-55 Wear OS 제외 | `NoopWatchSyncGateway`(isSupported=false), Wear 모듈 미생성 | PASS |
| AC-56 컴플리케이션(D-10 조건부) | `TodayWhatWatchComplication.swift` — 1종("남은 일정 수"), 로컬 `summary.notDone` 소스 — 정적 리뷰 | 정적 OK |
| E-19-1 폰 연결 불가 | `WatchSyncStore.isStale` + `ContentView` opacity/"최신 아님" | 정적 OK |
| E-19-2 폰 앱 미설정 | `WatchSyncStore.needsPhoneSetup` + 설정 안내 뷰 | 정적 OK |
| E-19-3 충돌 | `resolveToggleLWW`; V-38 | PASS |
| E-19-4 참조 유형 삭제됨 | `buildWatchSnapshot` categoryLabel/Color 폴백; V-36 | PASS |
| E-19-5 오늘 0건 | `buildWatchSnapshot` today=[] + 워치 빈 상태 | PASS(빌더) / 정적(뷰) |
| E-19-6 대상 과다 | 200건 절단 + truncated + `metric('watch.snapshot.truncated')`; V-36 | PASS |
| E-19-7 워치 알림 | §17.7 — 워치 무예약, iOS 미러링, 전역 off 시 없음(추가 코드 0) | PASS(정적) |

# v1.6 — Feature: ScheduleEditor 진입점 추가 (F-01/F-03, AC-15, E-10-1)

| 항목 | 값 |
| --- | --- |
| 일자 | 2026-09-06 |
| 대상 | `src/app/screens/DashboardScreen.tsx`, `src/app/screens/CalendarScreen.tsx`, `src/app/screens/ScheduleDetailScreen.tsx` |
| 근거 | `plan.md` v1.1 (F-01, F-03, AC-15, E-10-1, 7.2), `logic.md` v1.5 §16.2/§16.3 |

```text
status: PASS
summary: >
  DashboardScreen 헤더「+」·빈 상태「일정 추가」, CalendarScreen 헤더「+」→ ScheduleEditor(신규),
  ScheduleDetailScreen 헤더「편집」→ ScheduleEditor(scheduleId 전달, 수정) 진입점 구현을
  기능 테스트(정적 분석) · 코드 리뷰 · 보안 점검으로 검증했다.
  핵심 요구사항(AC-15, E-10-1, F-03) 모두 설계(logic §16.2)와 일치하여 기능 충족.
  파라미터 타입 안전성(RootStackParamList) 확인. 코드 리뷰 Critical/High 0.
  보안 점검 미해결 취약점 0. npm test 129/129 — 회귀 없음.
  Low 지적 1건(NAV-001, 비차단).
tests:
  total: 129
  passed: 129
  failed: 0
  note: "코어 81 + 셸 48. 화면 단위 RN 테스트는 환경 제약으로 정적 분석으로 대체."
```

## 1. 검증 범위

| 범위 | 항목 |
| --- | --- |
| Direct Scope | DashboardScreen 헤더「+」/ 빈 상태「일정 추가」, CalendarScreen 헤더「+」, ScheduleDetailScreen 헤더「편집」|
| Related Scope | ScheduleEditorScreen 파라미터 수신(신규/수정 모드 분기), RootNavigator 라우트 등록 |
| Out of Scope | ScheduleEditorScreen 폼 기능(기존 구현), 코어 서비스, DB 스키마 |

## 2. 요구사항 ↔ 구현 매핑

| 요구사항 | 구현 위치 | 판정 |
| --- | --- | --- |
| AC-15: 금일 일정 0건 시 「오늘 일정이 없습니다」+ 일정 추가 진입점 | `DashboardScreen` `!snap \|\| snap.empty` 분기 내 Pressable | PASS |
| E-10-1: 빈 상태 UI 정상 표시 | `snap === null` 초기 상태도 빈 상태로 처리 | PASS |
| F-03: 일정 수정 진입(scheduleId 전달) | `navigate(STACK_ROUTES.ScheduleEditor, { scheduleId })` — `scheduleId: number` 타입 보장 | PASS |
| logic §16.2: Dashboard `headerRight`「+」→ `navigate('ScheduleEditor', {})` | `useLayoutEffect` + `navigation.setOptions({ headerRight })` | PASS |
| logic §16.2: Calendar `headerRight`「+」→ `navigate('ScheduleEditor', {})` | 동일 패턴 | PASS |
| logic §16.2: ScheduleDetail `headerRight`「편집」→ `navigate('ScheduleEditor', { scheduleId })` | `useLayoutEffect` deps `[nav, scheduleId]` ✓ | PASS |
| logic §16.2: 진입점은 서비스를 호출하지 않는다 | 3개 진입점 모두 순수 navigate 호출만 | PASS |
| 회귀: 기존 DashboardScreen 로고·태그라인·집계 표시 | 변경 없음, npm test 129/129 | PASS |

## 3. 코드 리뷰

| 항목 | 결과 |
| --- | --- |
| 계층 분리 | 진입점 화면은 서비스 호출 없이 네비게이션만 수행. UI 계층에 비즈니스 로직 없음 ✓ |
| 설계 준수 | `STACK_ROUTES` 상수 사용(하드코딩 문자열 없음). `RootStackParamList` 타입 파라미터 적용 ✓ |
| `useLayoutEffect` deps | DashboardScreen/CalendarScreen: `[navigation]`, ScheduleDetailScreen: `[nav, scheduleId]` — 올바름 ✓ |
| 범위 | 설계에서 요구한 진입점만 추가. 요구사항 외 기능 없음 ✓ |

### 지적 사항

| id | severity | category | cause | location | scenario | expected | actual |
| --- | --- | --- | --- | --- | --- | --- | --- |
| NAV-001 | Low | CODE_REVIEW | IMPLEMENTATION_ERROR | `src/app/screens/ScheduleDetailScreen.tsx` L23, L41 | ScheduleDetailScreen이 props로 받은 `navigation`(goBack 전용)과 `useNavigation()` 훅의 `nav`를 동시에 사용. 동일 navigation 객체의 이중 참조 | `useNavigation()` 훅만 사용하거나 props로만 받아 일관성 유지 | props `navigation`은 삭제(goBack), 훅 `nav`는 편집 헤더(navigate) 분리 사용 |

NAV-001은 기능적으로는 정상 동작하며(같은 객체를 다른 참조로 접근) 다음 단계 진행을 차단하지 않는다.

## 4. 보안 점검 (STRIDE/OWASP)

| 위협 | 점검 결과 |
| --- | --- |
| Tampering — 위조 scheduleId | ScheduleDetailScreen은 RootNavigator에서 `findById` 재조회 후 이동 경로를 통해 도달(기존 v1.2 검증). 편집 진입 시 `scheduleId`는 이미 검증된 정수 ✓ |
| Injection | 진입점은 사용자 입력을 직접 처리하지 않음. `scheduleId: number` 타입 전달 ✓ |
| 에셋/XSS | 이번 변경에 에셋·WebView 없음. 변경 없음 ✓ |

미해결 보안 취약점: 없음.

## 5. 회귀 검증

| 항목 | 결과 |
| --- | --- |
| `npm test` | 129 pass / 0 fail (기존 129 베이스라인 유지) |
| DashboardScreen 로고·태그라인·집계 표시 | 변경 없음 — 빈 상태 분기만 Pressable 추가 |
| CalendarScreen 목록·무한 스크롤·완료 토글 | 헤더 버튼 추가만, 기존 로직 무변경 |
| ScheduleDetailScreen 완료 토글·삭제 | 헤더 버튼 추가만, 기존 로직 무변경 |
| RootNavigator 라우트 등록 | ScheduleEditor 이미 등록되어 있음, 변경 없음 |

## 6. 판정

**PASS** — AC-15, E-10-1, F-03 핵심 요구사항 충족. logic §16.2 설계와 구현 일치. 코드 리뷰 Critical/High 0. 보안 미해결 취약점 0. npm test 129/129.
NAV-001(Low)은 후속 개선 권장(비차단).

---

# v1.5 — Bug Fix: op-sqlite iOS 네이티브 빌드 실패 + 온디바이스 실행 검증

| 항목 | 값 |
| --- | --- |
| status | **FAIL** (op-sqlite 빌드 목표 = PASS / 대시보드 렌더 기준 = 미도달) |
| 환경 | macOS, Xcode 26.2 (clang 17C52), CocoaPods 1.16.2, iPhone 17 Pro 시뮬레이터 (iOS 26.3, booted), Metro 8081, RN 0.74.5, newArchEnabled=false |
| tests | node:test 115 / 115 pass (기존 113 + RENDER-002 회귀 2) |

## 1. 원 증상 / 재현

`npx react-native run-ios` → `xcodebuild` → `** BUILD FAILED **`. 핵심 에러:
`node_modules/@op-engineering/op-sqlite/cpp/types.h:34:24: error: no member named 'vector' in namespace 'std'`
(`SmartHostObject.cpp` 등 CompileC 실패). 앱 미설치.

## 2. 근본 원인

`package.json` 이 `@op-engineering/op-sqlite`를 `6.2.11`로 핀. 6.2.x `cpp/types.h`는 `<memory>/<string>/<variant>`만
include 하고 L34에서 `std::vector<JSVariant>` 사용 → Xcode 26.2 clang(전이 include 불허)에서 하드 에러.
op-sqlite는 9.x 라인에서 `cpp/types.h`에 `#include <vector>` 추가로 수정(검증: 9.0.0/9.3.0/10.1.0/11.2.5 존재, 6.2.11 부재).

## 3. 적용한 수정 (in-scope: op-sqlite)

| 파일 | 변경 |
| --- | --- |
| `package.json` | `@op-engineering/op-sqlite` `6.2.11` → `9.3.0` (RN 0.74 peer `>0.73.0` 충족, podspec `fabric_enabled=RCT_NEW_ARCH_ENABLED=='1'` → 구아키텍처 지원, 헤더 정합) |
| `package.json` | `"op-sqlite": { "fts5": true }` 추가 — 스키마(`schedule_fts` FTS5 가상테이블, database.md §291)가 FTS5 요구. op-sqlite는 6.x/9.x 모두 FTS5 opt-in(`SQLITE_ENABLE_FTS5=1`). 미설정 시 마이그레이션 001에서 `no such module: fts5`로 실패 |
| `src/app/adapters/sqlite/OpSqliteDb.native.ts` | `getUserVersion`: `res.rows._array?.[0]` → `res.rows?.[0]` (9.x JS 래퍼가 `QueryResult.rows`를 평면 배열로 반환, `_array` 접근자 제거). `openDatabase`: `open()` options에서 값이 있을 때만 `location`/`encryptionKey` 키 포함 — 9.x 네이티브 `open()`은 존재하는 키를 무조건 `asString()` → `{location: undefined}`도 `"Value is undefined, expected a String"` 예외 |
| `src/app/adapters/sqlite/SqliteRepositories.native.ts` | `all()`: `res.rows._array ?? []` → `res.rows ?? []` (동일 사유) |

## 4. 함께 고친 선재 RN 셸 결함 (op-sqlite 무관, 최초 온디바이스 실행에서 표면화)

| ID | severity | 파일 | 내용 / 수정 |
| --- | --- | --- | --- |
| RENDER-001 | High | `App.tsx` | `NATIVE_CONFIG.encryptDb=true` → `loadOrCreateDbKey()`의 `globalThis.crypto.getRandomValues` 가 RN Hermes에 미정의(폴리필 부재) → 부트스트랩 throw → 앱 미렌더. **수정**: `encryptDb=false` (op-sqlite Pod이 vanilla SQLite = SQLCipher 미컴파일이라 `encryptionKey` 무시됨 + D-03 미결정 → 미암호화 상태를 정직하게 반영) |
| RENDER-002 | Medium | `src/app/bootstrap/bootstrapSequence.ts` | `bootstrap()`이 `openDatabase()`/`getUserVersion()`/`loadSettings()` throw를 try/catch 안 함 → unhandled rejection + 무한 스피너(E-15-1 안전모드 미진입). **수정**: 사전 단계 예외를 safe-mode로 수렴 + 실패 phase를 `migration.error`에 기록. 회귀 테스트 2건 추가(`tests/app/bootstrap.test.ts`) |
| RENDER-004 | Medium | `src/app/bootstrap/composeNative.native.ts` | `loadSettings`가 `services.settings.getAll()` 호출 — `SettingService`에 없는 메서드. **수정**: `services.settings.getTheme()` |

## 5. 온디바이스 검증 결과

| 검증 | 결과 |
| --- | --- |
| `npm install` (op-sqlite 9.3.0) | PASS — resolved, `cpp/types.h`에 `#include <vector>` 확인 |
| `cd ios && pod install` | PASS — `Installing op-sqlite 9.3.0 (was 6.2.11)`, `[OP-SQLITE] FTS5 enabled 🔎`, 63 pods |
| `xcodebuild -workspace todaywhat.xcworkspace -scheme todaywhat -configuration Debug -destination id=22A18639-…` | **PASS — `** BUILD SUCCEEDED **`** (op-sqlite Pod 22개 CompileC 통과, `error:` 진단 0; 잔여는 서드파티 deprecation warning) |
| 시뮬레이터 설치 + 실행 (`simctl install`/`launch`) | PASS — 크래시 없음, 프로세스 상주, JS 번들 로드 |
| DB open + PRAGMA(WAL) | PASS — `Library/todaywhat.db` + `-wal`/`-shm` 생성 |
| 스키마 마이그레이션 001 (DDL + FTS5 + 트리거 + seed) | **PASS** — 온디바이스 DB에 `PRAGMA user_version = 1`, 테이블 `category/schedule/reminder/app_setting/calendar_link/account_link/schema_migration/schedule_fts(+shadow 5)` 생성, `category` seed 1행 |
| 대시보드(첫 화면) 렌더 | **FAIL → Safe Mode 화면 표시** (크래시/행 아님). 원인 = RENDER-003 |
| `npm test` 회귀 | PASS — 115 / 115 |
| Android Gradle 빌드 | 미수행(환경 제약, 이번 게이트 아님) |

## 6. 미해결 (별도 후속 필요)

| ID | severity | category | cause | 내용 |
| --- | --- | --- | --- | --- |
| RENDER-003 | High | FUNCTIONAL | DESIGN_CONFLICT | `SqliteRepositories.native.ts`의 6개 저장소가 모든 쿼리를 **named 파라미터 객체**(`:x` + `{x: …}`)로 `db.execute(sql, {…})` 호출. op-sqlite `execute(query, params?: any[])`는 **위치 배열 전용**(내부 `params?.map()`) — 객체 전달 시 `params.map is not a function`. 6.x/9.x 공통. `logic.md §13.3`이 "모든 값은 named 바인딩(:x)"를 명시 → 설계-드라이버 불일치. 수정 범위: 전 SQL `:name`→`?` 위치 바인딩 전환 + 40개 호출부 객체→정렬 배열 + `logic.md §13.3/§16.5` 개정(Architect 경유). 별도 Bug Fix 사이클 권장 |
| SEC-DB01 | Medium | SECURITY | — | op-sqlite Pod이 vanilla SQLite로 빌드(SQLCipher 미컴파일). D-03(DB 암호화 기본 활성) 미결정. 현재 `encryptDb=false`로 미암호화 DB. 실제 이행 시 `package.json "op-sqlite": {"sqlcipher": true}` + pod 재설치 + CSPRNG 소스(`react-native-get-random-values` 등) + Planner/Architect D-03 확정 필요 |

## 7. 판정

**op-sqlite 네이티브 빌드 실패(원 요청): 해소 및 온디바이스 검증 완료.** iOS `** BUILD SUCCEEDED **`,
앱 설치·실행·DB open·스키마 마이그레이션(FTS5 포함)까지 실기 검증. `npm test` 115/115.

**대시보드 렌더(피어 추가 완료 기준): 미도달.** 원인은 op-sqlite와 무관한 선재 셸 결함 RENDER-003
(저장소 파라미터 바인딩 방식 ↔ op-sqlite API 불일치, 40개 호출부 + 설계 개정 수반). 최소 변경 원칙과
버그 수정 범위를 넘어서므로 별도 후속 버그 수정으로 분리한다. 현재 앱은 크래시/행이 아닌
정의된 Safe Mode 화면(E-15-1)에 안착.

# v1.2 — RN 앱 셸 재검증 (SHELL-001 수정 후)

```text
status: PASS
summary: >
  SHELL-001(op-sqlite exec 다중문 분할이 CREATE TRIGGER ... BEGIN ... END 를 파손) 수정 확인.
  트리거 인지 SQL 스플리터(splitSqlStatements) 도입 + 단위 테스트로 001_init DDL 이
  트리거/FTS 를 온전한 단위로 분해됨을 검증. 셸 순수 로직(조립 seam·부트스트랩·딥링크·커서·
  pragma·알림ID·외부데이터 정제·토큰 매핑·오류 매핑·로그 마스킹·바인딩 맵) 기능 테스트 전부 통과.
  코어 회귀 없음(기존 81 + demo 무변경). 코드 리뷰 Critical/High 0. 보안 점검 미해결 취약점 0.
tests:
  total: 113
  passed: 113
  failed: 0
  note: "코어 81 무변경 + 셸 32 (bootstrap 5, composeSeam 4, migrations 2, shellPureLogic 17, sqlSplit 4)"
```

## v1.2 요구사항/설계 ↔ 테스트 매핑 (셸 델타)

| 근거 | 테스트 |
| --- | --- |
| nfr v1.1 V-19 / overview "조립 지점 리팩터" — `buildApp` 후방 호환 | composeSeam "V-19 …", 기존 코어 81 tests 무변경 통과 |
| nfr v1.1 V-19 — `assembleServices(CorePorts)` 로 서비스 조립 | composeSeam "V-19: assembleServices …" |
| nfr v1.1 V-20 / logic §16.4 / E-15-1 / AC-24 — 부트스트랩 단계·SafeMode·sync 격리 | bootstrap "V-20 …" ×4, migrations "V-20 / AC-24 …" |
| nfr v1.1 V-21 / logic §16.2 / 13.3 — 딥링크 스킴 화이트리스트 + payload 정수 검증 | shellPureLogic "V-21 …" ×3 |
| nfr v1.1 V-22 / logic §16.5 — keyset cursor 왕복·손상 커서 방어 | shellPureLogic "V-22: cursor …" ×2 |
| nfr v1.1 V-22 — PRAGMA user_version 정수 강제(주입 방어) | shellPureLogic "V-22: PRAGMA …" |
| nfr v1.1 V-22 — 결정적 알림 ID 멱등 | shellPureLogic "V-22: 결정적 알림 ID …" |
| nfr v1.1 V-22 / logic 13.3 — 외부 캘린더 이벤트 정제(제어문자/길이/필수필드) | shellPureLogic "V-22: 외부 이벤트 …" ×2 |
| nfr v1.1 V-22/V-23 / logic 9·13.2 — OAuth 토큰 매핑·iss/aud 검증·만료 판정 | shellPureLogic "V-22: app-auth 결과 …", "V-23: 불완전 토큰 …", "V-22: 만료 임박 …" |
| nfr v1.1 V-23 / logic §16.5 — 어댑터 오류 → ErrorCode 매핑 | shellPureLogic "V-23: 인증/캘린더/저장소 오류 …" |
| nfr v1.1 V-24 / logic 13.4 — 토큰은 TokenStore 에만, DB 는 tokenRef 만 | composeSeam "V-24: 계정 연동 시 토큰 …" |
| nfr v1.1 V-15 / nfr 5.1 — 로그 마스킹(제목/메모/토큰/이메일), minLevel 컷 | shellPureLogic "V-15 …" ×2 |
| database.md §6~7 — 001_init DDL 이 모든 테이블/트리거/FTS/시드 포함 | migrations "MIGRATIONS: 001_init …" |
| SHELL-001 수정 — 트리거 DDL 이 온전한 단위로 분해 | sqlSplit "splitSqlStatements: CREATE TRIGGER … BEGIN/END 를 한 문장으로 유지" ×3 |
| logic §16.3 — 화면↔서비스 바인딩 맵 무결성 | shellPureLogic "SCREEN_BINDINGS …" |
| logic §16.4 — AppState 복귀 재-sync throttle | shellPureLogic "shouldResumeSync …" |

## v1.2 코드 리뷰

| 항목 | 결과 |
| --- | --- |
| 계층 분리 | 준수. `screens(.tsx)` → `useServices()` → `CoreServices`(포트) → `adapters`(포트 구현). 화면에 비즈니스 로직 없음, 스토어는 결과 스냅샷만 보유 |
| DIP / Interface First | `assembleServices(CorePorts)` 로 모든 외부 의존성을 포트로 주입. 네이티브 어댑터는 `src/core/ports` 인터페이스를 그대로 구현 |
| OCP / 후방 호환 | `buildApp` 시그니처·반환 형태 무변경(기존 12 테스트 통과). 코어 파일은 `app.ts` 외 무변경 |
| 설계 준수 | overview v1.1 "클라이언트 셸 아키텍처" / logic §16 의 모듈 배치·네비게이션 그래프·부트스트랩 순서·포트 매핑과 구현 일치 |
| 범위 | 요구사항 외 기능 추가 없음. RN 스캐폴드는 요청 범위(앱 셸 + 어댑터) |
| SQL 안전성 | SQLite 어댑터 SQL 은 전부 파일 상단 정적 상수 + named 바인딩. 동적 식별자·문자열 조립 없음(기존 정적 점검 "13.3" 통과) |

### 지적 사항

| id | severity | category | location | 내용 / 조치 |
| --- | --- | --- | --- | --- |
| SHELL-002 | Medium | CODE_REVIEW | `src/core/services/scheduleService.ts` | **수정됨** — `ScheduleService.getById(id)` 추가(soft-deleted 는 null). 상세 화면·딥링크가 전체 스캔 대신 단건 조회 사용. 회귀 테스트 composeSeam "V-24 …" 내 assertion + 기존 81 무변경 |
| SHELL-003 | Low | CODE_REVIEW | `src/app/navigation/RootNavigator.tsx` | **수정됨** — SHELL-002 반영으로 `goToScheduleIfExists` 가 `getById` 단건 조회 사용, 미사용 `findOne` 헬퍼 제거 |
| SHELL-004 | Low | CODE_REVIEW | `src/app/bootstrap/composeNative.native.ts` | `ports.uow as unknown as …` 이중 캐스팅. `OpSqliteDb` 가 `UnitOfWork`·`MigrationDb` 를 함께 구현하므로 전용 타입으로 좁히면 캐스팅 제거 가능. 후속(비차단) |
| SHELL-005 | Low | CODE_REVIEW | `App.tsx` | `OAUTH_ISSUER`/`OAUTH_CLIENT_ID` 미주입 시 더미 폴백(`idp.example.com`) 사용. 빌드 환경 주입 강제(폴백 제거 또는 `__DEV__` 한정) 권장 — 실비밀 아님 |
| SHELL-006 | Low | CODE_REVIEW | `package.json` | `main` 을 `src/index.ts` → `index.js` 로 변경(RN 관례). `npm run demo`/`npm test` 는 명시 경로라 영향 없음 — 외부 툴링이 `main` 에 의존하지 않는지만 확인 |

## v1.2 보안 점검 (STRIDE / OWASP)

| 위협 | 점검 결과 |
| --- | --- |
| Tampering — 위조 딥링크/알림 payload | 스킴 화이트리스트(`todaywhat://`)만, payload 는 정수 `scheduleId` 만, 수신 시 저장소 재조회 후 이동(shellPureLogic V-21). `AndroidManifest` intent-filter 스킴 1개·`android:exported` 명시, iOS `CFBundleURLSchemes` 1개 |
| Injection — SQL/FTS/LIKE | SQLite 어댑터 정적 SQL 상수 + named 바인딩. FTS `toFtsMatchExpression` phrase 이스케이프, LIKE `escapeLike` + `ESCAPE '\'`(코어 V-11 재사용). 정적 점검 "13.3" 통과 |
| Cryptographic Failures / Info Disclosure | 토큰은 `KeychainTokenStore`(`WHEN_UNLOCKED_THIS_DEVICE_ONLY`)에만. `account_link` 레코드에 access/refresh 토큰 부재(composeSeam V-24). `MaskingLogger` 가 title/memo/token/email/query 를 길이·해시로 치환(shellPureLogic V-15) |
| 비밀정보 하드코딩 | JS 번들에 `client_secret` 없음(PKCE public client). `client_id`/discovery URL 은 빌드 주입(App.tsx 폴백은 더미) |
| Data Integrity — 외부 캘린더 | `sanitizeExternalEvent` 로 필수필드 검증 + 제어문자 제거 + title≤200/notes≤5000(shellPureLogic V-22) |
| Security Misconfiguration | Android `usesCleartextTraffic="false"`, `allowBackup="false"`; iOS ATS 예외 없음, DB 파일 보호 클래스 안내. 의존성 major 고정(overview 스택 표) |
| Logging/Monitoring | 어댑터·부트스트랩 로깅은 `MaskingLogger` 경유, 릴리스 기본 레벨 `warn` |

미해결 보안 취약점: 없음.
잔여 위험(설계에 기명시): 루팅/탈옥 단말, D-03(DB 암호화) 최종 미확정, 인증서 핀닝(N-5). 정책 결정 사항으로 구현 결함 아님.

## v1.2 환경 제약 (검증 범위 분리 — overview N-8, nfr v1.1 §11.2)

| 구분 | 항목 | 상태 |
| --- | --- | --- |
| 정식 검증 | 셸 순수 로직 + 어댑터 계약(위 매핑) | PASS (셸 테스트 32건) |
| 정식 검증 | 코어 회귀(81) + `npm run demo` | PASS, 무변경 |
| 정적 리뷰만 | `.native.ts` 어댑터 본문, `.tsx` 화면, `RootNavigator`, `AndroidManifest.xml`/`Info.plist`, metro/babel 설정 | 리뷰 완료, 차단 결함 없음(SHELL-001 수정됨) |
| 환경 외 후속 | `android/`·`ios/` Gradle·Pod 빌드, Metro 번들, 온디바이스 알림 정확도, 워치 연동, `npm run typecheck`(tsc 미설치) | 미실행 — 모바일 CI/개발기에서 수행 (BLOCKED 아님: 이번 요청의 검증 가능 산출물은 통과) |

## v1.2 판정

**PASS** — Critical/High 0(SHELL-001 수정 확인 + 회귀 테스트 4건), 미해결 취약점 0, 코어 회귀 없음(81 무변경, `npm test` 113/113, `npm run demo` OK).
SHELL-002(Medium)·SHELL-003(Low) 수정 완료. SHELL-004~006(Low)은 후속 개선 권장(비차단).

---

# v1.0 — 코어 계층 검증 (참고, 유지)

| 항목 | 값 |
| --- | --- |
| 대상 | `src/core/**`, `src/index.ts`, `tests/**` |

---

```text
status: PASS
summary: >
  코어 도메인/서비스 계층에 대해 기능 테스트 81건 전부 통과(2회 반복, 결정적).
  기획 AC-01~AC-24 중 코어에서 검증 가능한 항목과 nfr.md V-1~V-18 검증 관점을
  테스트로 연결했다. 코드 리뷰에서 계층 분리/SOLID/설계 준수 위반 없음(Critical/High 0).
  보안 점검에서 주입·민감정보 노출·비밀정보 하드코딩·접근제어 우회 없음(미해결 취약점 0).
  RN 네이티브 어댑터(SQLite/Notifee/AppAuth/Keychain/Calendar)는 포트 인터페이스로만
  정의되어 있고 이 환경에서 빌드 불가하나, 설계상 교체 지점이 명확하고 코어 로직이
  어댑터와 분리되어 있어 다음 단계 진행을 차단하지 않는다.
tests:
  total: 81
  passed: 81
  failed: 0
levels:
  unit: validation / time / recurrence / reminders / search 유틸
  integration: buildApp(인메모리 조립) 기반 ScheduleService·ReminderScheduler·DashboardService·
               SearchService·CategoryService·AuthService·CalendarSyncService 흐름
  contract: MigrationDb 포트에 대한 FakeMigrationDb 계약 테스트(순차 적용/롤백/재시도)
reproducibility: 2회 연속 실행 동일 결과. 시각은 FixedClock 주입으로 고정.
environment:
  runtime: Node.js v23.10 (네이티브 TypeScript 실행 + node:test, 외부 의존성 0)
  commands: "npm test" (81 pass), "npm run demo" (exit 0)
  note: >
    "npm run build"/"npm run typecheck"(tsc)는 이 오프라인 환경에 typescript 미설치이며
    레지스트리 접근이 불가하여 실행되지 않는다(tsc: command not found). 정적 타입 검증은
    보류 상태이며, 동작 검증은 Node 네이티브 실행 + 81개 테스트로 대체했다.
    이는 실행 환경 제약이며 구현 결함이 아니다.
```

## 요구사항 ↔ 테스트 매핑 (발췌)

| 요구사항 / 검증관점 | 테스트 |
| --- | --- |
| AC-01 일정 생성·반영·알림 예약 | scheduleService "AC-01" |
| AC-02/03 필수값·종료<시작 검증, 저장소 무변경 | validation.*, scheduleService "AC-02/AC-03" |
| AC-04 완료 토글 → 대시보드 집계 | scheduleService "AC-04", dashboardService "V-1" |
| AC-05/06 사전·정시 알림 | reminderScheduler "AC-05/AC-06" |
| AC-07 알림 권한 거부 시 일정 저장 + 안내 | reminderScheduler "AC-07", "AC-07 후속" |
| AC-08 재부팅 후 알림 복원 | reminderScheduler "AC-08 / V-7" |
| AC-09 수정 시 이전 예약 취소 + 재예약 | scheduleService "AC-09" |
| AC-10 삭제 시 알림 전부 제거 | scheduleService "AC-10" |
| AC-11/12 유형 필터 / 우선순위 정렬 | scheduleService "AC-11", "AC-12 / V-18" |
| AC-13/14 검색 / 검색+필터 | searchService "AC-13", "AC-14" |
| AC-15/16 대시보드 빈 상태 / 자정 경과 | dashboardService "V-2 / AC-15", "V-3 / AC-16" |
| AC-19 캘린더 중복 병합 + 로컬 필드 보존 | calendarSyncService "AC-19 / P-08" |
| AC-20/21 계정 없이 사용 / 연동 해제 시 데이터 보존 | authService "AC-20", "AC-21 / V-13" |
| AC-24 마이그레이션 순차 적용 | migrationRunner "V-12 / AC-24" |
| P-07 완료율 반올림, 0건 0% | dashboardService "P-07", "V-2" |
| P-10 사전 알림 최대 5 | validation "P-10" |
| P-10-1 알림 제목 마스킹 | reminderScheduler "P-10-1" |
| P-11 2자 미만 LIKE 폴백 + 상한 | searchService "P-11 / V-9" |
| E-01-4/E-08-2 과거 오프셋 SKIPPED | scheduleService "E-01-4", reminderScheduler "V-8" |
| E-06-2 사용 중 카테고리 삭제 → "기타" 재지정 | categoryService "V-17" |
| E-15-1 마이그레이션 실패 롤백 | migrationRunner "E-15-1" |
| logic 13.3 payload 위조 방어 | reminderScheduler "13.3" |
| logic 13.4 / V-14 토큰 DB 미저장 | authService "V-14" |
| nfr 5.1 / V-15 로그 마스킹 | securityLogging "V-15" |
| V-16 keyset 페이지네이션 | scheduleService "V-16" |

## 코드 리뷰

| 항목 | 결과 |
| --- | --- |
| 계층 분리 (domain / ports / services / infra) | 준수. 서비스는 포트에만 의존, 어댑터가 포트를 구현. UI/HTTP 책임 없음 |
| SOLID | DIP(포트 주입), SRP(서비스별 단일 책임), ISP(집중된 포트), OCP(어댑터 교체) 준수 |
| Interface First | 저장소/게이트웨이 포트를 구현체보다 먼저 정의 |
| 설계 준수 | logic.md 1~12 처리 흐름·상태 변화·예외가 구현에 반영. database.md 스키마가 domain/types 및 DDL 문서와 일치 |
| Naming | camelCase / PascalCase(클래스) 일관 |
| 범위 | 요구사항 외 기능 추가 없음. 스캐폴드(`src/index.ts`)는 스모크 데모로 대체 |
| 테스트 커버리지 | 핵심 서비스·도메인 유틸·마이그레이션 러너 커버 |

### 지적 사항 (모두 Low, 비차단)

| id | severity | category | location | 내용 |
| --- | --- | --- | --- | --- |
| REV-001 | Low | CODE_REVIEW | `dashboardService.ts` getSummary | "다음 예정 일정"을 `findInRange` 겹침 기준으로 조회 → 이미 시작했으나 종료 전인 미완료 장기 일정이 "다음"으로 잡힐 수 있음. logic.md 7의 `start_at >= now` 와 미세 차이. 표시 편의값이라 영향 경미 |
| REV-002 | Low | CODE_REVIEW | `categoryService.ts` create | 유형 이름 길이 오류에 `VALIDATION_TITLE_REQUIRED` 코드 재사용 → 전용 코드(`VALIDATION_CATEGORY_NAME`) 권장 |
| REV-003 | Low | CODE_REVIEW | `src/index.ts` | 데모 엔트리의 `console.*` 가 빌드 플래그로 가드되지 않음. 데모 전용 파일이라 허용 가능하나 앱 엔트리로 승격 시 로거로 교체 필요 |
| REV-004 | Low | CODE_REVIEW | 빌드 | 오프라인으로 `tsc` 미실행 → 정적 타입 검증 보류. CI/개발기(typescript 설치 환경)에서 `npm run typecheck` 수행 권장 |

## 보안 점검 (STRIDE / OWASP)

| 위협 | 점검 결과 |
| --- | --- |
| Injection (SQL/FTS/LIKE) | `escapeLike`/`toFtsMatchExpression` 구현·단위 테스트. 인메모리 어댑터는 문자열 SQL 미사용(정적 점검 통과). 악성 입력이 결과를 오염시키지 않음(V-11) |
| Broken Access Control / IDOR | 단일 사용자 로컬 앱, 역할 없음. 알림 payload 는 정수 scheduleId 만, 탭 시 저장소 재조회로 검증(테스트 "13.3") |
| Cryptographic Failures / Info Disclosure | 토큰은 `TokenStore`(Keychain 어댑터)에만, DB 레코드는 `tokenRef` 만(V-14). 알림 제목 마스킹 토글 동작(P-10-1). 로그에 제목/메모 원문 미출력(V-15) |
| 비밀정보 하드코딩 | 소스에 키/토큰 없음. `client_secret` 미사용(PKCE public client) — 설계·구현 일치 |
| Data Integrity (외부 캘린더) | 외부 이벤트 title/notes 를 `sanitizeText` 로 제어문자 제거 + 길이 상한 후 저장(테스트 "외부 이벤트 텍스트는 정제") |
| Auth Failures | 리프레시 실패 시 EXPIRED 강등 + 로컬 모드 유지(E-12-2 테스트). unlink 시 revoke best-effort + 로컬 정리 |
| Logging/Monitoring | auth.*/reminder.*/calendar.sync.* 메트릭·이벤트 기록 확인 |

미해결 보안 취약점: 없음.
잔여 위험(설계 문서에 이미 명시): 루팅/탈옥 단말, D-03(DB 암호화) 최종 미확정, 인증서 핀닝(N-5) 미채택 — 모두 정책 결정 사항이며 이번 구현 범위의 결함 아님.

## 판정

**PASS** — Critical/High 결함 및 미해결 취약점 없음. Low 4건은 후속 개선 권장(비차단).

---

# v1.3 — Bug Fix 재검증: `@op-engineering/op-sqlite` 버전 핀 교정 (6.3.0 → 6.2.11)

```text
status: PASS
summary: >
  npm install 실패(ETARGET, @op-engineering/op-sqlite@6.3.0 미존재) 수정 검증.
  package.json:23 핀을 레지스트리에 존재하는 최신 6.x인 6.2.11 로 교정. 그 외 무변경.
  - 6.2.11 레지스트리 존재 확인, 6.3.0 은 E404(미발행) 재확인.
  - peerDependencies(react:*, react-native:>0.73.0) 를 react@18.2.0 / react-native@0.74.5 가 충족.
  - node_modules 설치본 = 6.2.11, package-lock.json 핀 = 6.2.11, `npm ls` 트리 정상(ETARGET 없음).
  - 잔존 6.3.0 문자열 없음(package.json/lock/document/src grep; lock 의 camelcase-6.3.0 는 무관 패키지).
  - 어댑터가 사용하는 op-sqlite API 전부 6.2.11 .d.ts 에 존재(정적 계약 확인).
  - 회귀: npm test 113/113, npm run demo exit 0 (기준선 113/113 유지).
  - 보안: op-sqlite@6.2.11 고유 advisory 없음. npm audit 21건(14 moderate/7 high/0 critical)은
    RN CLI·metro·image-size 전이 의존 기존 이슈로 본 수정과 무관, 범위 외.
tests:
  total: 113
  passed: 113
  failed: 0
  demo: "exit 0"
issues: []  # Critical/High 결함 0, 미해결 취약점 0
```

## 확인 항목 상세

| 항목 | 방법 | 결과 |
| --- | --- | --- |
| 6.2.11 존재 | `npm view @op-engineering/op-sqlite@6.2.11 version` | `6.2.11` 반환 (PASS) |
| 6.3.0 미존재 | `npm view ...@6.3.0` | `E404 No match found` (버그 원인 재확인) |
| 6.2.11 이 6.x 최신 | `npm view ... versions` | 6.2.1 → 6.2.11 이후 7.0.1 로 점프 → 6.2.11 이 최신 6.x |
| 설계 정합 | overview.md §기술스택("최신 6.x major 고정"), logic.md §의존성("major 고정") | 6.2.11 이 부합 — DESIGN_CONFLICT 없음 |
| peerDeps 충족 | 설치본 `peerDependencies` = `{react:*, react-native:>0.73.0}` | react@18.2.0, react-native@0.74.5 로 충족 |
| lock/설치본 정합 | `node_modules/.../package.json`.version, `package-lock.json` L2434 | 둘 다 `6.2.11` |
| resolution 성공 | `npm ls @op-engineering/op-sqlite` | `└── @op-engineering/op-sqlite@6.2.11`, 오류·경고 없음 |
| 잔존 스테일 버전 | `grep -rn 6.3.0 package.json package-lock.json document/ src/` | op-sqlite 관련 매치 0 (camelcase-6.3.0 만, 무관) |

## 어댑터 API ↔ 6.2.11 타입 계약 (정적 코드 리뷰)

`node_modules/@op-engineering/op-sqlite/lib/typescript/src/index.d.ts` 대조:

| 어댑터 사용 API | 6.2.11 정의 위치 | 판정 |
| --- | --- | --- |
| `open({ name, location?, encryptionKey? }): DB` | `export declare const open` (L149-153) | 일치 |
| `type DB` | `export type DB` (L86) | 일치 |
| `db.execute(query, params?)` | `execute: (query, params?) => QueryResult` (L92) | 일치 |
| `db.close()` | `close: () => void` (L87) | 일치 |
| `res.rows?._array` | `QueryResult.rows._array: any[]` (L21-23) | 일치 |
| `res.insertId` | `QueryResult.insertId?: number` (L18) | 일치 |
| `res.rowsAffected` | `QueryResult.rowsAffected: number` (L19) | 일치 |

어댑터의 op-sqlite 사용 표면은 6.2.11 에서 전부 유효. 본 버그 수정으로 인한 API 비호환 없음.

## 참고(본 수정과 무관 · 기존 이슈 · 비차단)

- `.native.ts` 는 `db.execute()` 를 `await` 하지만 6.2.11 타입상 `execute` 는 동기(`QueryResult`)다.
  JS 런타임에서 비-thenable await 는 무해하며, 해당 파일은 파이프라인 tsc/test 범위 밖(온디바이스 검증 대상).
  버전 핀과 무관한 기존 사항.
- named 파라미터(`:x`) 바인딩을 객체로 전달(`params as never`) — op-sqlite 런타임 지원 기능이나 타입은 `any[]`.
  기존 사항, 온디바이스 검증 필요.
- `logic.md` L507 은 `db.transaction(tx => …)` 사용을 언급하나 어댑터는 `execute('BEGIN IMMEDIATE'|'COMMIT'|'ROLLBACK')`
  로 자체 구현. 기존 구현 선택으로 이번 수정 범위 아님.
- npm audit 21건(RN CLI/metro/image-size 계열 전이 의존) — 사전 존재, op-sqlite 무관, 범위 외.
- `package-lock.json` 은 untracked(미커밋). 커밋 여부는 사용자 결정 사항이며 본 검증의 FAIL 사유 아님.

## 판정

**PASS** — 버그(ETARGET) 해소 확인. 회귀 없음(113/113). 코드 리뷰 Critical/High 0.
op-sqlite@6.2.11 고유 보안 advisory 없음.

---

# v1.4 — RN 네이티브 셸(N-8) `android/`·`ios/` 골격 + §3/§4 보안 설정 검증

| 항목 | 값 |
| --- | --- |
| 일자 | 2026-09-04 |
| 대상 | `android/**`, `ios/**`(Pods/build 제외), `.gitignore` 네이티브 규칙 |
| 근거 | `NATIVE-SETUP.md` §2/§3/§4/§6, `logic.md` v1.1 §16.5/§16.7/13.4~13.6, `overview.md` v1.1 "빌드 환경 제약"(N-8/N-9), `nfr.md` v1.1 §11.2/§6 |
| 작성 주체 | Tester |

```text
status: PASS
summary: >
  react-native@0.74.5 템플릿에서 android/·ios/ 골격을 생성해 com.todaywhat / todaywhat 으로
  개명하고, 기존 보안 스캐폴드(AndroidManifest.xml · Info.plist)를 병합한 결과를 검증했다.
  NATIVE-SETUP §3/§4 의 모든 항목이 올바른 파일에 독립적으로 확인됨. XML/plist/pbxproj 전부
  well-formed(plutil/xmllint OK). npx react-native config 가 양 플랫폼 + 7개 오토링킹 네이티브
  의존을 throw 없이 해석. xcodebuild -list 정상(todaywhat, Debug/Release, scheme 1). JDK17 로
  Gradle 구성 시 RN Gradle 플러그인 빌드 + notifee/op-sqlite 프로젝트 구성까지 진행하고
  Android SDK 부재로 중단(환경 외 후속, FAIL 아님). 회귀 없음: npm test 113/113,
  npm run demo exit 0, 보호 대상 파일(src/**, tests/**, App.tsx, index.js, app.json, *.cjs,
  package.json, tsconfig*.json, .eslintrc.cjs) 무변경 확인. notifee 부팅 리시버 제거 결정은
  AAR 매니페스트/클래스 대조 결과 정당(P-09 배선 유지). 코드 리뷰 Critical/High 0.
  보안 점검 미해결 취약점 0.
tests:
  total: 113
  passed: 113
  failed: 0
  note: "코어 81 + 셸 32. 네이티브 골격 작업은 JS 테스트 대상 밖 — 정적/구조 검증으로 커버."
```

## 1. 회귀 검증

| 항목 | 결과 |
| --- | --- |
| `npm test` (`node --test`) | 113 pass / 0 fail |
| `npm run demo` | exit 0 (대시보드/알림/검색 출력 정상) |
| 보호 대상 파일 변경 여부 | 무변경 — git 추적 대상(package.json/tsconfig.json/src/index.ts)은 본 작업(13:55~14:03) 이전(≤13:08) mtime, 그 외는 untracked·mtime 11:53~12:07. `npm test`/`demo` 동작으로 교차 확인 |
| git 스테이징 | `android/**`·`ios/**` 미추적(스테이징 0). 저장소에 커밋 이력 없음 → `git show HEAD:` 로 병합 전 스캐폴드 대조는 불가, 병합 결과물을 NATIVE-SETUP/logic 기준으로 직접 검증 |

주: `npm run build`(`tsc`)는 `tests/*.test.ts` 의 `@types/node` 미설치로 **사전 존재** 실패(baseline 동일). 본 작업과 무관, 범위 외. 권위 테스트 경로는 `npm test`.

## 2. NATIVE-SETUP §3/§4 매핑 (Tester 독립 확인)

### Android

| 요구 (NATIVE-SETUP §3/§4) | 위치 | 확인 결과 |
| --- | --- | --- |
| `usesCleartextTraffic="false"` (release) | `app/src/main/AndroidManifest.xml` `<application>` | OK — `false` 명시 |
| debug 만 cleartext 허용 | `app/src/debug/AndroidManifest.xml` | OK — `usesCleartextTraffic="true"` + `tools:replace`, main 은 false 유지(release 병합 안 됨) |
| `allowBackup="false"` + 백업규칙 DB 제외 | main manifest + `res/xml/backup_rules.xml` + `res/xml/data_extraction_rules.xml` | OK — `allowBackup="false"` 및 `fullBackupContent`/`dataExtractionRules` 연결. 두 XML 모두 `todaywhat.db`(+`-wal`/`-shm`/`-journal`) 를 `cloud-backup`·`device-transfer` 에서 exclude (이중 방어) |
| 딥링크 `intent-filter` `todaywhat` 스킴 1개 + `android:exported` 명시 | main manifest `MainActivity` | OK — VIEW intent-filter 1개, `<data android:scheme="todaywhat"/>` 단일, `android:exported="true"`(LAUNCHER 액티비티라 정상), `autoVerify="false"` |
| `POST_NOTIFICATIONS` | main manifest | OK |
| `SCHEDULE_EXACT_ALARM` / `USE_EXACT_ALARM` | main manifest | OK — 둘 다 선언(nfr §1.1). `USE_EXACT_ALARM` 은 Play 정책 제한 권한이나 설계상 필수로 명시됨 |
| `RECEIVE_BOOT_COMPLETED` (P-09) | main manifest | OK |
| `READ_CALENDAR` (WRITE 는 주석) | main manifest | OK — `READ_CALENDAR` 선언, `WRITE_CALENDAR` 는 D-02 확정 시로 주석 처리 |
| notifee 부팅 재예약 배선 | main manifest 주석 + `index.js` + `MainApplication.kt` | OK — §7 참조. 앱측 소유분(권한/ headless onBackgroundEvent / bootstrap self-heal) 유지 |
| `newArchEnabled` 존재 | `android/gradle.properties` | OK — `newArchEnabled=false` + N-9 근거 주석 |
| `manifestPlaceholders appAuthRedirectScheme: 'todaywhat'` | `android/app/build.gradle` `defaultConfig` | OK |

### iOS

| 요구 | 위치 | 확인 결과 |
| --- | --- | --- |
| ATS 예외 키 없음 | `ios/todaywhat/Info.plist` | OK — `NSAppTransportSecurity` = `{ NSAllowsArbitraryLoads = false }` 만, `NSExceptionDomains`/`NSAllowsArbitraryLoadsInWebContent` 등 없음 |
| `CFBundleURLTypes` `todaywhat` 스킴 1개 | Info.plist | OK — URL type 1개, scheme 배열 `["todaywhat"]` 단일 |
| `NSCalendarsUsageDescription` (F-14) | Info.plist | OK (`NSRemindersUsageDescription` 도 추가 — RN calendar-events 가 미리알림 접근 가능, 과선언이나 무해) |
| `NSFileProtectionComplete` entitlement 배선 | `ios/todaywhat/todaywhat.entitlements` + `project.pbxproj` | OK — `com.apple.developer.default-data-protection = NSFileProtectionComplete`, `CODE_SIGN_ENTITLEMENTS = todaywhat/todaywhat.entitlements` 가 Debug·Release 양쪽 XCBuildConfiguration 에 설정. FileReference 는 `todaywhat` 그룹에 등록(합성 UUID `7DFACE11ED0000000000AA01`), plutil OK |
| `UIBackgroundModes` 없음 | Info.plist | OK — 키 부재(iOS 부팅 재예약은 `bootstrapSequence` 6단계) |
| 번들/설정에 `client_secret` 없음 | 저장소 전역 grep | OK — 앱 소스/네이티브 설정에는 "미사용" 주석만. `client_secret` 문자열은 gitignore 된 `ios/Pods/AppAuth/**`(서드파티) 에만 존재 |

## 3. 빌드 구조 검증 (이 환경)

| 명령 | 결과 |
| --- | --- |
| `npx react-native config` | android(`packageName=com.todaywhat`, `sourceDir=android`, `.MainActivity`) + ios(`todaywhat.xcworkspace`) 해석. 오토링킹 네이티브 의존 7개(@notifee/react-native, @op-engineering/op-sqlite, react-native-app-auth, react-native-calendar-events, react-native-keychain, react-native-safe-area-context, react-native-screens) 전부 ios/android platforms 노출. throw 없음 |
| `xcodebuild -list -project ios/todaywhat.xcodeproj` | Targets: `todaywhat`, `todaywhatTests` / Build Configs: `Debug`, `Release` / Schemes: `todaywhat`. well-formed |
| `plutil -lint` Info.plist / entitlements / PrivacyInfo / project.pbxproj | 전부 `OK` |
| `xmllint --noout` 4개 Android XML + xcscheme + xcworkspacedata | 전부 통과 |
| `./gradlew --version` | Gradle 8.6 (wrapper). 정상 |
| `./gradlew :app:tasks` (기본 JDK11) | 실패 — AGP8 은 JDK17 요구. **환경 제약** |
| `./gradlew :app:tasks` (JAVA_HOME=corretto-17) | RN Gradle 플러그인 빌드 + `:notifee_react-native`·`:op-engineering_op-sqlite` 구성까지 진행 후 `SDK location not found`(ANDROID_HOME 부재) 로 중단. **환경 외 후속**(overview "빌드 환경 제약", nfr §11.2) — FAIL 아님 |

## 4. notifee 부팅 리시버 제거 결정 검증 (P-09)

`node_modules/@notifee/react-native/android/libs/app/notifee/core/202108261754/core-202108261754.aar` 를 해제해 대조:

- AAR `AndroidManifest.xml` 이 `RECEIVE_BOOT_COMPLETED` 권한과 함께
  `app.notifee.core.RebootBroadcastReceiver`(`exported=false`, `BOOT_COMPLETED`/`QUICKBOOT_POWERON` intent-filter),
  `app.notifee.core.NotificationAlarmReceiver`(동일 intent-filter) 를 **직접 선언** → 매니페스트 병합으로 앱에 자동 포함.
- `classes.jar` 엔트리: `RebootBroadcastReceiver.class`, `NotificationAlarmReceiver.class`, `ReceiverService.class`(서비스) 존재.
  `ReceiverService$BootReceiver` 클래스는 **존재하지 않음**(notifee 패키지 전역 grep 0건).
- 판정: 기존 스캐폴드의 수기 `<receiver android:name="app.notifee.core.ReceiverService$BootReceiver">` 는 실존하지 않는 클래스를 가리켜, 유지 시 부팅 시 `ClassNotFoundException` 위험. **제거가 정당**하며 P-09 배선은 (1) AAR 자동 병합 리시버, (2) `RECEIVE_BOOT_COMPLETED` 권한 유지, (3) `index.js` `notifee.onBackgroundEvent` headless, (4) `bootstrapSequence` `ReminderScheduler.sync()` 자가 치유로 온전. **회귀 아님**.

## 5. 보안 점검 (STRIDE/OWASP · logic 13.x/§16.7)

| 영역 | 결과 |
| --- | --- |
| 전송 암호화 | Android release `usesCleartextTraffic=false`, cleartext 허용은 debug 오버레이(`tools:replace`)로 격리 / iOS ATS 예외 0 — 적합(13.4/13.6) |
| 노출 컴포넌트 | `MainActivity` 만 `exported=true`(런처+커스텀스킴, 정상). 앱 정의 receiver 0. notifee AAR receiver 는 `exported=false`(부팅류) / `AlarmPermissionBroadcastReceiver` 만 `exported=true`(시스템 권한 브로드캐스트 수신용, 라이브러리 설계) — 앱이 추가한 위험 노출 없음 |
| 딥링크 스킴 화이트리스트 | Android `todaywhat` 1개 / iOS `todaywhat` 1개. `App.tsx` `redirectUrl` = `todaywhat://oauthredirect`, Android `appAuthRedirectScheme='todaywhat'` 와 정합. payload 처리(scheduleId 재조회 검증)는 셸 순수 로직(기존 v1.2 검증 범위) |
| 민감정보 백업 제외 | `todaywhat.db`(+WAL/SHM/journal) 를 legacy full-backup + Android12 data-extraction(cloud+D2D) 양쪽 제외 + `allowBackup=false` + iOS `NSFileProtectionComplete` — 다중 방어 적합(13.4) |
| 비밀정보 하드코딩 | `client_secret` 부재(PKCE public client, 13.5). `client_id`/issuer 는 `process.env` 주입, 폴백은 `example.com` 자리표시자. 리포지토리 커밋 비밀 0 |
| 서명 자격증명 | `android/app/build.gradle` 에 debug keystore 비밀번호 `android` 평문 — RN 템플릿 표준(공개된 공용 디버그 키). release 가 debug 서명을 참조하나 "배포 시 교체" 주석 존재. 표준 관행, 취약점 아님(정보성) |
| `.gitignore` 커버리지 | `ios/Pods`·`ios/*.xcworkspace`·`ios/build`·`ios/.xcode.env.local`·`android/.gradle`·`android/.cxx`·`android/build`·`android/app/build`·`android/local.properties`·`*.keystore` 무시하며 `!android/app/debug.keystore` 로 디버그 키스토어는 허용. `ios/Podfile.lock` 은 의도적으로 커밋 허용(정상). 확인 완료 |
| 의존성/설정 | newArch=false(N-9 대기), Hermes on. 알려진 위험 기본값 없음. 사전 존재 `npm audit`(RN CLI/metro 전이) 범위 외 |

미해결 보안 취약점: **없음**.

## 6. 코드 리뷰 지적 (전부 Low / 정보성 — 비차단)

| ID | severity | category | 내용 |
| --- | --- | --- | --- |
| NAT-01 | Low | CODE_REVIEW | `AppDelegate.mm` 에 `application:openURL:options:`(RCTLinkingManager / `RNAppAuthAuthorizationFlowManager` 델리게이트) 미구현 → iOS 딥링크·OAuth redirect 콜백이 아직 JS 로 전달되지 않음. NATIVE-SETUP §3 iOS 목록에는 없고 on-device 통합(N-8) 후속 항목이나, "deep-link/OAuth" 목표에 비추어 추적 필요. 환경 외 후속 목록에 등재 |
| NAT-02 | Low | CODE_REVIEW | `project.pbxproj` `todaywhat` 그룹에 `PrivacyInfo.xcprivacy` FileReference 2개(`13B07FB8…` 고아, `F1DCEE8C…` 만 Resources 빌드) — RN 0.74.5 템플릿 기존 quirk. 빌드 산출 1개뿐이라 "multiple commands produce" 아님. 정리 권장, 빌드 영향 없음 |
| NAT-03 | Low | CODE_REVIEW | `.gitignore` 의 `android/.cxx/` 는 app 모듈이 생성할 수 있는 `android/app/.cxx/` 를 커버하지 않음. 템플릿 기본(`.cxx/`) 대비 경로 한정이 좁음. 빌드 산출물 유출 여지(경미) |
| NAT-04 | Low | CODE_REVIEW | `Info.plist` `NSRemindersUsageDescription` 는 NATIVE-SETUP 미요구 항목(과선언). 미리알림 미사용 시 심사 지적 가능성 — 확인 후 제거 검토 |

## 7. 환경 외 후속 검증 대기 (nfr v1.1 §11.2 / overview N-8·N-9)

- Android Gradle `assembleDebug`/`bundleRelease` (ANDROID_HOME + JDK17 필요) — 이 환경 미수행
- iOS `pod install` 후 `xcodebuild build` / 시뮬레이터 실행 — 이 환경 미수행(Pods 는 개발자 로컬 설치본 존재, gitignore)
- Metro 번들링, 실제 `NativeModules` 왕복(op-sqlite/notifee/app-auth/keychain/calendar-events)
- iOS `AppDelegate` deep-link/OAuth `openURL` 배선 및 실제 redirect 캡처 (NAT-01)
- 온디바이스 알림 정확도/BOOT_COMPLETED 재예약 실동작, `USE_EXACT_ALARM` Play 정책 심사
- New Architecture(`newArchEnabled=true`) 온디바이스 확정 (N-9)
- 워치 타깃 연동 (NFR-10)

## 판정

**PASS** — NATIVE-SETUP §3/§4 전 항목이 올바른 파일에 반영됨(독립 확인). 구조 검증(react-native config / xcodebuild / plutil / xmllint) 전부 통과. notifee 부팅 리시버 제거는 정당(회귀 아님). 회귀 없음(npm test 113/113, demo exit 0, 보호 파일 무변경). 코드 리뷰 Critical/High 0, 보안 미해결 취약점 0. Gradle full build 는 환경 제약으로 미수행 — 환경 외 후속(FAIL/BLOCKED 아님). 지적 4건은 전부 Low/정보성.

---

# v1.8 — N-11: F-19 애플워치 네이티브 통합 + 라이브 왕복 검증 (Developer iteration 1+2)

| 항목 | 값 |
| --- | --- |
| 일자 | 2026-09-08 |
| 대상 | iteration 1: `ios/TodayWhat.xcodeproj/project.pbxproj`(신규 타깃 `TodayWhatWatch`·`TodayWhatWatchComplication`), `ios/TodayWhatWatch/**`, `ios/Podfile.lock`(RNWatch 1.1.0), `package.json`/`package-lock.json`, `src/app/bootstrap/composeNative.native.ts`, `App.tsx`, `src/app/adapters/watch/WatchConnectivityGateway.native.ts` / iteration 2: `WatchConnectivityGateway.native.ts`(WATCH-06 `toPlistSafe`), `ios/TodayWhatWatch/Complication/Info.plist`(WATCH-07) |
| 근거 | `plan.md` v1.4 (F-19, AC-23·AC-47~AC-56, E-19-1~7, R-19-1~4), `logic.md` v1.9 (§0.1/§0.2/§13.9/§17.1~17.10), `nfr.md` v1.7 (§14, V-36~V-40, NFR-12), `database.md` v1.2 |

```text
status: FAIL
summary: >
  F-19 pure-logic 층은 이전 사이클에서 195/195 PASS. 이번 사이클은 네이티브 통합(iOS 프로젝트
  타깃/Pod/부트스트랩 배선/워치 Swift 스캐폴드) + 라이브 왕복 검증이다.
  - 회귀: node --experimental-strip-types --test "tests/**/*.test.ts" → 195 pass / 0 fail.
    tsc -p tsconfig.json --noEmit → src/ 신규 오류 0 (사전 존재 5건: repositories.ts x2 Buffer,
    index.ts x3 console/process — @types/node 미설치, 허용). src/core/** 이번 사이클 무수정 확인
    (watchSync 파일 mtime 11:09~11:15 = 이전 사이클, 통합 파일 13:28~15:38). DB DDL/서비스 로직/
    기존 셸/SCREEN_BINDINGS/알림 경로 무변경 확인.
  - 코드 리뷰: WATCH-08 (High, FUNCTIONAL) 발견 — 아래.
  - 보안 점검(§13.9 STRIDE/OWASP): 미해결 취약점 없음.
  - Developer iteration-2 "라이브 토글 APPLY 관찰" 증거는 커밋 코드와 모순 → 재현 불가로 판단.

tests:
  total: 195
  passed: 195
  failed: 0
  note: >
    회귀 스위트는 PASS. 그러나 워치→폰 토글의 실제 네이티브 값 경로(비정수 epoch ms)를
    스위트가 커버하지 않는다(모든 테스트가 정수 watchChangedAt 을 emitIncoming 으로 직접 주입).

issues:
  - id: WATCH-08
    severity: High
    category: FUNCTIONAL
    cause: IMPLEMENTATION_ERROR
    location: >
      ios/TodayWhatWatch/WatchSyncStore.swift:74 (WatchToggleOp.make(now:) 인자) +
      ios/TodayWhatWatch/WatchModels.swift:60-68 (make) ↔
      src/core/services/watchSyncService.ts:49-54 (isValidToggleOp)
    scenario: >
      Tampering/Integrity 아님 — 정상 페어드 워치의 정상 토글이 폰에서 거부됨.
      워치 ContentView.row 의 완료 버튼 → WatchSyncStore.toggle(itemId:) →
      WatchToggleOp.make(now: Date().timeIntervalSince1970 * 1000). timeIntervalSince1970 은
      ms 미만 정밀도의 Double 이므로 *1000 은 거의 항상 비정수(예: 1725800000123.456).
      op 은 sendMessage/transferUserInfo 로 폰 도달 → 어댑터 parseToggleOp 는 Number.isFinite
      만 확인해 통과 → WatchSyncService.applyIncomingToggle → isValidToggleOp 가
      Number.isInteger(watchChangedAt) 에서 false → metric('watch.toggle.malformed') +
      ack(opId,'REJECTED') + return. DB 미반영, 워치 보류 큐에 op 잔존.
    expected: >
      설계 §17.4 step1 / §13.9: watchChangedAt·baseUpdatedAt 은 정수 epoch ms(P-39).
      정상 op → resolveToggleLWW → APPLY → ScheduleService.toggleDone → 폰 대시보드 집계 반영
      (AC-23/AC-48), 워치 스냅샷 재수렴(R-19-2).
    actual: >
      워치 발신 토글 op 이 전부 malformed 로 거부. AC-23/AC-48/AC-50 및 R-19-2 가 실기기에서 미충족.
      node 195/195 는 정수값 직접 주입이라 이 경로를 검출하지 못함.
    fix: >
      watchOS 측에서 정수로 방출 — WatchToggleOp.make 호출부/내부에서
      (Date().timeIntervalSince1970 * 1000).rounded() → Int, 그리고 필요 시
      applyOptimistic 의 doneAt 도 동일 정규화. 어댑터/서비스 검증 규칙도 설계에 맞춰 일치화(WATCH-09).
    verification_note: >
      라이브 시뮬레이터 왕복으로 직접 재확인은 미수행. 정적 근거는 결정적이며,
      "라이브 관찰" 입증 책임은 Developer 측이었고 커밋 코드와 모순된다.

  - id: WATCH-09
    severity: Medium
    category: CODE_REVIEW
    cause: IMPLEMENTATION_ERROR
    location: >
      src/app/adapters/watch/WatchConnectivityGateway.native.ts:78-81 (parseToggleOp) ↔
      src/core/services/watchSyncService.ts:49-54 (isValidToggleOp)
    scenario: 동일 계약(watchChangedAt/baseUpdatedAt)에 대해 어댑터는 Number.isFinite, 서비스는 Number.isInteger 로 이중검증 규칙이 상이. 방어계층 간 불일치 — 외곽이 통과시킨 값을 내곽이 조용히 폐기(WATCH-08 을 가림).
    expected: 두 계층이 설계(§17.4 정수) 기준으로 일치.
    actual: 규칙 불일치. 정수화(WATCH-08 수정) 후 양쪽을 동일 규칙으로 정렬 필요.

  - id: WATCH-10
    severity: Medium
    category: CODE_REVIEW
    cause: IMPLEMENTATION_ERROR
    location: src/app/adapters/watch/WatchConnectivityGateway.native.ts:118-128 (watchEvents 'message' 핸들러)
    scenario: >
      워치 ContentView.onAppear / .refreshable / manualRefresh() 가
      sendMessage({type:'requestSnapshot'}, replyHandler) 를 보낸다(§17.2 sendMessage 경로 (1),
      §17.1 (d) 수동 새로고침). 폰 어댑터 'message' 핸들러는 parseToggleOp 만 시도 → null →
      metric('watch.toggle.malformed') + reply({ok:false}). 워치 replyHandler 는 ingestContext({ok:false})
      → 디코드 실패 no-op.
    expected: 폰이 requestSnapshot 수신 시 최신 스냅샷을 reply(또는 pushSnapshot) 로 반환(D-09 (b) 즉시 경로).
    actual: >
      수동 새로고침이 무동작 + 매 요청마다 허위 watch.toggle.malformed 메트릭. 워치는 폰 데이터
      변경 시의 updateApplicationContext 및 activation 시 receivedApplicationContext 재독으로만
      갱신되므로 완전 파손은 아니나 명시적 pull 경로가 미구현.

  - id: WATCH-04
    severity: Medium
    category: CODE_REVIEW
    cause: DESIGN_CONFLICT
    location: ios/TodayWhatWatch/Complication/TodayWhatWatchComplication.swift:20-26 (loadNotDone) / project.pbxproj (entitlements 부재)
    scenario: 컴플리케이션 확장은 별도 프로세스/컨테이너. App Group entitlement 없이 워치 앱의 applicationSupportDirectory/watch_snapshot.json 을 읽을 수 없음 → loadNotDone()=nil → 상시 "—". 설계 §17.8 이 App Group id·entitlements 를 미명세.
    expected: AC-56 — 컴플리케이션이 "오늘 남은 일정 수" 표시.
    actual: 상시 "—". 스코프(1종)·탭 동작·타임라인 reload 배선은 정상 → AC-56 partial. 조정자 합의대로 별도 Architect 확인으로 이관(이번 사이클 재작업 트리거 아님, D-10 "포함" 확정 시 선결).

  - id: WATCH-05
    severity: Low
    category: CODE_REVIEW
    cause: IMPLEMENTATION_ERROR
    location: project.pbxproj (TodayWhatWatch 빌드설정 ASSETCATALOG_COMPILER_APPICON_NAME=AppIcon, Resources 페이즈에 에셋 카탈로그 없음)
    scenario: 워치 앱 AppIcon 에셋 미제공 → 빌드 경고. 설치·실행에는 영향 없음.
    expected: 워치 AppIcon 에셋 카탈로그 포함(스토어 제출 전 필수).
    actual: 경고. 후속 항목.

  - id: ENV-01
    severity: Low
    category: FUNCTIONAL
    cause: ENVIRONMENT_ERROR
    location: 저장소 경로 …/심플프로젝트/… (비ASCII) + @react-native-community/cli-server-api
    scenario: Metro dev 서버가 이 경로에서 /status 에 HTTP 500. CLI 버그. 프로덕션 번들 무관.
    expected: Metro /status 200.
    actual: 500. 오프라인 react-native bundle 로 우회 가능. 소스 결함 아님 — 후속/무조치.

  - id: N-11-COV
    severity: Low
    category: FUNCTIONAL
    cause: TEST_ERROR
    location: tests/watchSync/** (라이브 시뮬레이터 미실행)
    scenario: LWW tie→phone-wins, soft-deleted→REJECT, 200건 절단+truncated 는 node 테스트(V-36/37/38)로만 커버, 페어드 시뮬레이터 왕복 미실행.
    expected: nfr §9 note — watchOS 빌드·WCSession 실왕복은 "환경 외 후속 검증"(N-11, §11.2)으로 분리 기록, FAIL/BLOCKED 아님.
    actual: 설계가 허용하는 범위. WATCH-08 과 독립(WATCH-08 은 정적 리뷰로 검출된 계약 위반).
```

## AC / V / E / R 매핑 (v1.8, N-11)

| 항목 | 결과 | 근거 |
| --- | --- | --- |
| AC-23 / AC-48 워치 완료 토글 → 폰 대시보드 집계 반영 | **미충족(FAIL)** | 경로는 §17.4 대로 구현(applyIncomingToggle → resolveToggleLWW → toggleDone → pushSnapshot)이나 WATCH-08 로 실기기 op 이 전부 REJECTED. node V-37 는 PASS(정수 주입) |
| AC-47 워치 오늘 목록(시각순·최소 상세·헤더 카운트) | 충족 | `buildWatchSnapshot` today startAt 오름차순·필드 최소화, ContentView List + headerRow, DetailView 읽기전용. node V-36 PASS |
| AC-49 오프라인 조회 + 보류 큐 | 부분 | 워치 `isStale`·"최신 아님"·보류 큐 파일·flushPendingQueue·"동기화 대기" 배지 구현. 단 큐 flush 후 폰 적용은 WATCH-08 에 종속 |
| AC-50 오프라인 충돌 LWW | 부분 | `resolveToggleLWW` 순수 로직 정확(node V-38 PASS). 실 op 경로는 WATCH-08 로 차단 |
| AC-51 워치 비범위 동작 차단 | 충족 | ContentView/DetailView 에 생성·수정·삭제·검색·설정·유형 진입점 없음. `setupPrompt`(E-19-2)만. 정적 확인 |
| AC-52 알림 예약 주체 = 폰 | 충족 | 페이로드 스키마에 REMINDER 필드 0(WatchModels/types.ts). 워치 코드가 ReminderScheduler/알림 API 미호출(grep). V-40 |
| AC-53 워치 페이로드 범위(오늘+다음 1건, 과거/검색 미전송) | 충족 | `buildWatchSnapshot` today(≤200)+nextUpcoming 1건. 이력·검색 인덱스·유형 전체정의 미포함. `toPlistSafe` 는 null 키만 제거(추가 없음) |
| AC-54 워치 빈 상태(추가 버튼 없음) | 충족 | `snap.today.isEmpty` → "오늘 일정이 없습니다" 텍스트만 |
| AC-55 Wear OS 제외 | 충족 | Android 어댑터 `isSupported()=false` 전 경로 no-op(node V-39). Wear 모듈 미생성 |
| AC-56 워치 컴플리케이션(D-10 결정 시) | 부분 | 위젯 1종·탭→앱 실행·타임라인 reload 배선 정상. 그러나 WATCH-04(App Group 부재)로 상시 "—". D-10 미확정이면 검증 제외 대상 |
| R-19-1 워치 열면 스냅샷 표시(오프라인 허용) | 충족 | activation 시 `receivedApplicationContext` 재독 + 로컬 파일 로드. `needsPhoneSetup`(E-19-2) |
| R-19-2 워치 토글 → 워치 카운트 즉시 갱신 + 폰 역전파 | **미충족(FAIL)** | 워치 낙관 갱신(`applyOptimistic`)은 동작. 폰 역전파는 WATCH-08 |
| R-19-3 폰 변경 → 다음 갱신에 워치 반영 | 충족(코드상) | App.tsx: `stale.dashboard` false→true 구독 + `AppState 'active'` → 500ms 디바운스 `pushSnapshot()`. 부트스트랩 후 activate + 즉시 push. 리스너/타이머 정리 있음(effect cleanup) |
| R-19-4 epoch ms + IANA tz | 충족 | types.ts/WatchModels.swift 동일 계약, 워치 `timeText` 가 표시 시점에만 TimeZone 변환. (단 op 의 watchChangedAt 정수 계약 위반이 WATCH-08) |
| E-19-1~E-19-7 | 대체로 반영 | E-19-1 "최신 아님"/보류 큐, E-19-2 setupPrompt, E-19-3 LWW, E-19-4 `resolveCategoryDisplay` 폴백("기타"/#8E8E93), E-19-5 빈 상태, E-19-6 200 절단+truncated+metric, E-19-7 알림 분리 — 모두 구현. E-19-3 실효는 WATCH-08 에 종속 |
| V-36 스냅샷 빌더 | PASS | node |
| V-37 역전파 서비스 로직 | PASS(node) / 실경로 FAIL | isValidToggleOp·dedup·NOT_FOUND·toggleDone 한정·pushSnapshot — 정수 주입 테스트는 통과, 실 op 은 WATCH-08 |
| V-38 LWW 순수 | PASS | node |
| V-39 채널 격리(NFR-12) | PASS | sendSnapshot/activate/ack throw 주입해도 폰 흐름 정상, Android no-op. 어댑터도 try/catch 로 격리. node + 정적 |
| V-40 알림 무관 | PASS | 정적 grep — 페이로드 REMINDER 필드 0, 워치 코드 알림 미생성 |

## 보안 점검 (logic §13.9 STRIDE / OWASP) — 미해결 취약점 없음

| 점검 | 결과 |
| --- | --- |
| WCSession 신뢰 경계 · 수신 op = 비신뢰 입력 | 적합 — `applyIncomingToggle` 단일 처리 경로: 형식검증(`isValidToggleOp`: UUID 정규식·`Number.isInteger`>0 scheduleId·엄격 boolean·정수 유한 타임스탬프) → `ScheduleRepository.findById` 재조회(`!schedule || deletedAt!==null` → REJECT) → ring-50 dedup 원장(APP_SETTING `watch.appliedOps`) → LWW → APPLY 시 `ScheduleService.toggleDone(scheduleId, done)` **만** 호출. deps 노출면에 create/update/softDelete/settings/category 경로 없음(P-43). `sendMessage`·`transferUserInfo` 폴백 양경로가 동일 `parseToggleOp`→`toggleCb`→`applyIncomingToggle` 로 수렴 — 검증 우회 없음 |
| 민감정보(V-40) | 적합 — 페이로드 필드: id/title/startAt/timeZone/categoryLabel/categoryColor/isHighPriority/isDone/doneAt/updatedAt + summary 카운트 + nextUpcoming(id/title/startAt/timeZone). 메모·이력·검색·유형 전체정의·계정·토큰·REMINDER 없음. `toPlistSafe` 는 null/undefined 키만 재귀 제거(값 추가 없음, false/0/"" 보존, 빈 배열/객체 보존, 순환 없음). Swift Codable optional(`doneAt`, `nextUpcoming`)은 키 부재 시 nil 디코드 — 계약 무변경 확인 |
| 워치 로컬 파일 데이터 보호 | 적합 — `WatchSyncStore.persistSnapshot`/`persistQueue` 모두 `write(to:options:[.atomic, .completeFileProtection])` |
| 비밀정보 | 적합 — 워치 채널에 키/토큰/자격증명 없음. 하드코딩 없음 |
| 의존성 | 적합 — `react-native-watch-connectivity` 1.1.0 정확 핀(package.json/Podfile.lock RNWatch 1.1.0, React 의존만). 1.x major 고정(§13.6/§13.9 정책). watchOS 앱은 시스템 프레임워크(WatchConnectivity/SwiftUI/WidgetKit)만 |
| 잔여 위험 | 잠금 해제된 분실 워치의 오늘 제목 열람 — §13.9 residual 로 문서화됨(코드 조치 불요). LWW 근사 유실(N-12) 문서화됨 |
| 번들 id 정합 | phone `kr.purpledog.todaywhat` / watch `.watchkitapp` / complication `.watchkitapp.complication`, watch Info.plist `WKCompanionAppBundleIdentifier=kr.purpledog.todaywhat` 일치. phone 타깃 자체 빌드설정 무변경(신규 config 블록만 추가) |

## 판정

**FAIL** — 회귀(195/195)·tsc(src 신규 0)·보안(미해결 0)·계층 규칙(`src/core/watchSync/**` react-native/node 미import, `src/app` 역참조 없음)은 통과하나, **WATCH-08(High, FUNCTIONAL)** 로 워치→폰 완료 토글의 실제 네이티브 경로가 전부 거부되어 AC-23/AC-48/AC-50·R-19-2 가 실기기에서 미충족이다. 이 사이클의 목적이 네이티브 통합 + 라이브 왕복 검증이므로 pure-logic PASS 만으로 통과시킬 수 없다. 반드시 수정: WATCH-08(+WATCH-09 검증 규칙 일치화). WATCH-10 은 함께 수정 권장. 이관(비차단): WATCH-04(Architect 확인), WATCH-05·ENV-01·N-11-COV(후속). 다음 라우팅은 Orchestrator 결정.

---

# v1.9 — N-11: WATCH-08 / WATCH-09 / WATCH-10 수정 재검증 (Developer iteration 3)

| 항목 | 값 |
| --- | --- |
| 일자 | 2026-09-08 |
| 대상(iteration 3) | `ios/TodayWhatWatch/WatchModels.swift`(WATCH-08: `WatchClock`, op 타임스탬프 `Int`), `ios/TodayWhatWatch/WatchSyncStore.swift`(WATCH-08 `WatchClock.nowEpochMillis()`, WATCH-10 도달 가능화 시 `manualRefresh()`), 신규 `src/app/adapters/watch/watchMessage.ts`(WATCH-09/10 순수 파서·분류), `src/app/adapters/watch/WatchConnectivityGateway.native.ts`(분류 사용·`requestSnapshot` reply·`setSnapshotRequestHandler`), `src/app/bootstrap/composeNative.native.ts`(WATCH-10 배선), 신규 `tests/watchSync/watchMessage.test.ts`(12) |
| 근거 | `plan.md` v1.4 (F-19, AC-23·AC-47~AC-56, E-19-1~7, R-19-1~4), `logic.md` v1.9 (§13.9, §17.1~17.10), `nfr.md` v1.7 (§14, V-36~V-40, NFR-12) |

```text
status: PASS
summary: >
  v1.8 FAIL 3건(WATCH-08 High / WATCH-09 Medium / WATCH-10 Medium)이 모두 종결됐다.
  - WATCH-08: 워치 op 의 watchChangedAt/baseUpdatedAt 이 Swift Int 로 인코딩(WatchClock.nowEpochMillis()
    가 .rounded()). 소수부 값은 (a) 워치 JSONDecoder(Int) 에서 디코드 실패 → 보류 큐 진입 불가,
    (b) 폰 parseToggleOp(Number.isInteger) 에서 null. 다른 워치 생성 시각 필드(applyOptimistic
    doneAt = 로컬 전용·정수, baseUpdatedAt = 폰 정수 유래)도 계약 위반 없음.
  - WATCH-09: 신규 순수 모듈 src/app/adapters/watch/watchMessage.ts 의 parseToggleOp 가
    WatchSyncService.isValidToggleOp 와 동일하게 Number.isInteger 를 요구. 어댑터가 서비스가
    조용히 버릴 값을 더는 넘기지 않는다. watchSyncService.ts 무수정. RN/node import 없음.
  - WATCH-10: classifyInboundMessage → toggle | requestSnapshot | malformedToggle | ignore.
    watch.toggle.malformed 계측은 type:'toggle' 실패 시에만. requestSnapshot → 캐시 lastSnapshot
    즉시 reply + snapshotRequestCb() → pushSnapshot(). composeNative.assemble() 이
    setSnapshotRequestHandler(() => services.watchSync.pushSnapshot()) 배선(instanceof 가드).
    워치 manualRefresh() 는 .onAppear/.refreshable + activation·reachability 도달 시점에도 실행.
  - 회귀: node --test 207/207 (신규 watchMessage.test.ts 12건 포함). tsc src 신규 0 (사전 5건 허용).
    src/core/** 무수정. DB DDL / ScheduleService / DashboardService / ReminderScheduler /
    CategoryService / SettingService / 기존 셸 / SCREEN_BINDINGS / 알림 경로 / F-06·F-10·F-16·F-17·F-18
    무변경.
  - 보안(§13.9): 미해결 취약점 없음.
  - 라이브 시뮬레이터 왕복은 이번 재검증에서 직접 미수행(Metro /status 500, ENV-01). 실경로 통합
    테스트 + 정적 대조 + Developer 라이브 증거(정수 op JSON, is_done/done_at/updated_at 한정 델타,
    원장 1건, ack, 큐 클리어, summary 재수렴, requestSnapshot 새로고침, malformed 0건)가 커밋
    코드와 정합 → 플로우 검증 충분.

tests:
  total: 207
  passed: 207
  failed: 0
  new: >
    tests/watchSync/watchMessage.test.ts (12) — 실제 parseToggleOp/classifyInboundMessage 검증:
    정수 op 파싱 / float watchChangedAt·baseUpdatedAt → null / NaN·Infinity → null /
    비-UUID·비정수·비양수 scheduleId·비-boolean done → null / flat 형태 허용 /
    classify 4분기 / 실경로 통합(parseToggleOp(raw) → applyIncomingToggle → APPLIED, malformed 0) /
    음성 통합(float op 은 parse 단계에서 걸러져 서비스 미도달, 상태 불변). 공허한 assertion·비활성
    조건 없음. emitIncoming 우회 아님 — 어댑터가 호출하는 실제 함수 검증.

issues:
  - id: WATCH-11
    severity: Low
    category: CODE_REVIEW
    cause: IMPLEMENTATION_ERROR
    location: ios/TodayWhatWatch/WatchSyncStore.swift:loadLocal() (queueURL 디코드)
    description: >
      watch_pending_ops.json 디코드 실패 시 `(try? JSONDecoder().decode(...)) ?? []` 로 빈 큐를
      취하나 손상된 파일을 즉시 재기록하지 않는다 → 다음 실제 토글(persistQueue) 전까지 손상 파일이
      디스크에 잔존. 영향: 파일 손상이라는 희소 조건에서 미전송 보류 op 이 조용히 유실(재시도 안 됨).
      완화: `.atomic`+`.completeFileProtection` 쓰기라 손상 확률 낮음, best-effort 모델(NFR-12) 범위,
      폰이 SoT 이며 다음 pushSnapshot 이 워치 표시를 재수렴, 스냅샷 파일도 동일 패턴(`try? decode`).
      재작업 트리거 아님 — 후속(디코드 실패 시 `[]` 재기록 또는 경고 로그) 권고.

  - id: WATCH-04
    severity: Medium
    category: CODE_REVIEW
    cause: DESIGN_CONFLICT
    status: 이관(Architect) — 미해결, 이번 사이클 비차단
    description: >
      컴플리케이션 확장이 App Group entitlement 없이 워치 앱의 watch_snapshot.json 을 읽을 수 없어
      상시 "—". 설계 §17.8 이 App Group id·entitlements 미명세. 위젯 스코프(1종)·탭·타임라인 reload
      배선은 정상 → AC-56 = partial. D-10 "포함" 확정 시 선결.

  - id: WATCH-05
    severity: Low
    category: CODE_REVIEW
    cause: IMPLEMENTATION_ERROR
    status: 후속(비차단)
    description: 워치 AppIcon 에셋 카탈로그 미포함 → 빌드 경고. 설치·실행 무영향. 스토어 제출 전 필수.

  - id: ENV-01
    severity: Low
    category: FUNCTIONAL
    cause: ENVIRONMENT_ERROR
    status: 후속(비차단, 소스 결함 아님)
    description: 비ASCII 저장소 경로에서 Metro /status HTTP 500(@react-native-community/cli-server-api 버그). 오프라인 번들 우회. 프로덕션 무관.

  - id: N-11-COV
    severity: Low
    category: FUNCTIONAL
    cause: TEST_ERROR
    status: 후속(설계 허용 범위)
    description: >
      LWW tie→phone-wins, soft-deleted→REJECT, 200건 절단+truncated 는 node 테스트(V-36/37/38)로만
      커버. nfr §9 note — watchOS 빌드·WCSession 실왕복은 "환경 외 후속 검증"(N-11, §11.2), FAIL/BLOCKED 아님.
```

## AC / V / E / R 매핑 (v1.9, N-11 재검증)

| 항목 | v1.8 | v1.9 | 근거 |
| --- | --- | --- | --- |
| AC-23 / AC-48 워치 토글 → 폰 대시보드 집계 반영 | 미충족(FAIL) | **충족** | op 타임스탬프 Int 종단 → parseToggleOp(정수)·isValidToggleOp(정수) 통과 → resolveToggleLWW → toggleDone → dashboard 무효화. `watchMessage.test.ts` 실경로 통합 테스트가 parse→applyIncomingToggle→`isDone=true`/`doneAt`/ack APPLIED/`watch.toggle.applied` 계측 확인, malformed 0. Dev 라이브 델타(is_done/done_at/updated_at 한정, 원장 1건, 큐 클리어) 정합 |
| AC-47 워치 오늘 목록 | 충족 | 충족 | `buildWatchSnapshot` (V-36) |
| AC-49 오프라인 조회 + 보류 큐 flush | 부분 | **충족** | flush 가 이제 폰에 실제 적용됨(WATCH-08). `sessionReachabilityDidChange` 가 flush + `manualRefresh()` 재시도 |
| AC-50 오프라인 충돌 LWW | 부분 | **충족** | `resolveToggleLWW` (V-38) + 실 op 경로가 정수 `baseUpdatedAt`/`watchChangedAt` 로 도달. tie/REJECT 분기는 node 테스트 커버(N-11-COV, 설계 허용) |
| AC-51 워치 비범위 동작 차단 | 충족 | 충족 | 워치 UI 진입점 없음 + 인바운드 파서가 toggle/requestSnapshot 외 쓰기 경로 미생성 |
| AC-52 알림 예약 주체 = 폰 | 충족 | 충족 | 페이로드 REMINDER 필드 0, 워치 알림 API 미호출 (V-40) |
| AC-53 워치 페이로드 범위 | 충족 | 충족 | today(≤200)+nextUpcoming 1건. `requestSnapshot` reply 도 동일 `lastSnapshot` — 신규 필드 없음 |
| AC-54 워치 빈 상태 | 충족 | 충족 | — |
| AC-55 Wear OS 제외 | 충족 | 충족 | Android `isSupported()=false` no-op (V-39) |
| AC-56 워치 컴플리케이션(D-10 시) | 부분 | **부분(변화 없음)** | 위젯 1종·탭·reload 정상, WATCH-04(App Group 부재)로 상시 "—". Architect 이관 |
| R-19-2 워치 카운트 즉시 갱신 + 폰 역전파 | 미충족(FAIL) | **충족** | 워치 `applyOptimistic` 즉시 갱신 + 폰 역전파 동작 |
| R-19-3 폰 변경 → 워치 반영 | 충족(코드상) | 충족 | App.tsx 디바운스 push + `requestSnapshot` 새로고침 경로 추가. Dev "WATCH-10 isolated" 증거(폰 단독 변경 → 워치 재실행 → requestSnapshot → reply 426 + pushSnapshot → 일치) 정합 |
| R-19-4 epoch ms + IANA tz | 충족 | 충족 | 정수 계약 확립(WATCH-08). 표시 시점 TimeZone 변환 |
| E-19-1~E-19-7 | 대체로 반영(E-19-3 실효 종속) | **충족** | E-19-3 LWW 실효 확보. E-19-1 최신아님/보류 큐, E-19-4 폴백, E-19-5 빈 상태, E-19-6 200 절단, E-19-7 알림 분리 |
| V-36 / V-38 / V-39 / V-40 | PASS | PASS | node + 정적 |
| V-37 역전파 서비스 로직 | PASS(node)/실경로 FAIL | **PASS(실경로 포함)** | `watchMessage.test.ts` 실경로 통합 — parse→applyIncomingToggle→APPLIED, 음성(float)은 서비스 미도달·상태 불변 |

## 보안 재점검 (logic §13.9 STRIDE / OWASP) — 미해결 취약점 없음

| 점검 | 결과 |
| --- | --- |
| 인바운드 파서 = 신뢰 경계 (`watchMessage.ts`) | 적합 — `classifyInboundMessage` 는 `toggle`(검증된 op → `applyIncomingToggle` → `ScheduleService.toggleDone` 만) / `requestSnapshot`(→ `pushSnapshot`, 읽기전용 아웃바운드) / `malformedToggle`(계측만) / `ignore`(no-op) 4종만 산출. create/update/delete/settings/category 로 이어지는 분기 없음. `message`(sendMessage)·`user-info`(transferUserInfo) 양경로 모두 `classifyInboundMessage` 사용(user-info 는 `toggle`/`malformedToggle` 만 처리) → 비-토글 쓰기 시도 전면 차단 |
| `requestSnapshot` reply(캐시 `lastSnapshot`) | 적합 — `lastSnapshot` 은 직전 `sendSnapshot` 이 보낸 바로 그 페이로드(`toPlistSafe` 후, line 152). 이미 push 된 것의 상위집합이 될 수 없음(동일). V-40 민감정보 없음(스키마 동일 — memo/reminder/account/token/이력 미포함). 캐시는 프로세스 수명·`dispose()` 시 해제, 최초 push 전에는 `{ok:true}`(데이터 없음). 이후 `snapshotRequestCb()` 가 즉시 최신 push 보정. 단일 사용자·1 페어드 워치 — 다기기 발산 없음 |
| 정수 계약(§13.9) | 적합 — 소수부 op 은 워치 `JSONDecoder`(Int) + 폰 `parseToggleOp`(`Number.isInteger`) 양쪽에서 거부. Tampering/replay 방어(scheduleId 재조회 + opId ring-50 dedup + LWW)는 무변경 유지 |
| 워치 로컬 파일 | 적합 — `persistSnapshot`/`persistQueue` `.atomic`+`.completeFileProtection` 유지 |
| 의존성 | 적합 — `react-native-watch-connectivity` 1.1.0 핀 무변경. `watchMessage.ts` 는 신규 서드파티 0, RN/node import 0 |
| 계층 | 적합 — `watchMessage.ts` 는 `src/app/adapters/watch/`(앱 계층)에서 `core/watchSync/types` 타입만 참조(허용 방향). `composeNative.assemble()` 의 `instanceof` 배선은 조립 지점 한정, 포트 계약 무변경 |

## 판정

**PASS** — v1.8 FAIL 3건(WATCH-08/09/10) 종결 확인. 회귀 207/207(신규 12건은 실제 파싱 경로를 검증, 공허하지 않음), tsc src 신규 0, `src/core/**`·기존 서비스·DDL·셸·알림 경로·F-06/F-10/F-16/F-17/F-18 무변경. AC-23/AC-48/AC-49/AC-50·R-19-2·E-19-3 실효 충족(실경로 통합 테스트 + Developer 라이브 증거 정합). 보안 미해결 취약점 0 — 인바운드 파서가 비-토글 쓰기를 양 전송경로에서 차단, `requestSnapshot` reply 는 신규 노출 없음. 신규 지적 WATCH-11 은 Low·비차단(후속). 잔여 비차단: WATCH-04(Architect 이관, AC-56 partial), WATCH-05·ENV-01·N-11-COV. 라이브 시뮬레이터 왕복은 직접 미수행(ENV-01) — 실경로 테스트·정적 대조로 대체. 다음 라우팅은 Orchestrator 결정.
