# 검증 결과 — 일정관리 앱 "오늘뭐해"

| 항목 | 값 |
| --- | --- |
| 문서 종류 | 검증 결과 (기능 테스트 + 코드 리뷰 + 보안 점검) |
| 버전 | v1.6 |
| 대상 | (v1.0) `src/core/**` · (v1.1~1.2) `src/app/**` · (v1.5) op-sqlite 6.2.11→9.3.0 상향 + iOS 온디바이스 빌드/실행 검증 · (v1.6) ScheduleEditor 진입점 추가 (F-01/F-03, AC-15, E-10-1) |
| 근거 | `document/planner/plan.md` v1.1, `document/architect/{overview,logic,nfr}.md` v1.5, `database.md` v1.0 |
| 작성 주체 | Tester |
| 일자 | 2026-09-06 |

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

---

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
