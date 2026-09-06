# 비기능 요구사항 설계 — 일정관리 앱 "오늘뭐해"

| 항목 | 값 |
| --- | --- |
| 문서 종류 | 비기능 요구사항 설계 (NFR) |
| 버전 | v1.3 |
| 상태 | 작성 완료 |
| 근거 | `document/planner/plan.md` v1.0 6절/NFR-01~10, `document/architect/overview.md` v1.4, `document/architect/database.md` v1.0, `document/architect/logic.md` v1.4 |

## 변경 이력

| 버전 | 일자 | 변경 내용 |
| --- | --- | --- |
| v1.0 | 2026-09-04 | 최초 작성. 기획 NFR 초안을 기술 목표·설계·검증 관점으로 구체화 |
| v1.1 | 2026-09-04 | §11 "클라이언트 셸 검증 관점(빌드 불가 환경 대응)" 추가. §9 검증표에 셸 항목 V-19~V-24 추가. §10 미결정에 N-8/N-9 추가. 성능·용량·보안 목표(1~8장)는 무변경 |
| v1.2 | 2026-09-04 | Bug Fix 동반 개정(overview/logic v1.2). 검증 환경에 Xcode 26.2 + CocoaPods 도입 → §11.2에서 **iOS `pod install`+`xcodebuild` 빌드·시뮬레이터 설치·실행·op-sqlite DB 왕복**을 §11.1 정식 검증으로 이동. Android Gradle·워치·온디바이스 알림 정확도만 §11.2 유지. N-8을 "iOS 검증됨 / Android·워치 후속"으로 축소. 성능·용량·보안 목표 무변경 |
| v1.3 | 2026-09-04 | 설계 델타(overview v1.4 / logic v1.4, "일정 추가/수정 화면 연결"). §7 국제화에 일정 편집 날짜/시각 **입력** 형식 주석(이번 사이클 고정 `YYYY-MM-DD`/`HH:mm` 텍스트, 표시는 로캘 유지). §9 검증 관점에 V-25(편집 폼 검증 매핑·무효화)·V-26(로컬 벽시계→epoch 변환) 추가. §12 미결정에 N-10(네이티브 date 픽커 후속) 추가. 성능·용량·가용성·보안 목표 무변경 |

> 기획서에 정량 SLA/SLO가 없다. 아래 수치 중 **[제안]** 표시는 Architect 제안값이며 확정은 미결정(overview N-1). Tester는 [제안]값을 임시 기준으로 사용하되 미달을 Critical/High로 올리지 않는다(품질 관찰 항목).

---

## 1. 성능 (NFR-04, NFR-05)

### 1.1 목표 (기준 부하: 일정 10,000건, 단말 중급 기기)

| 시나리오 | 목표 [제안] | 달성 설계 |
| --- | --- | --- |
| 대시보드 초기 집계 표시 | < 150ms (쿼리) / < 400ms (첫 렌더) | `idx_schedule_done_start` 부분 인덱스 + 단일 GROUP BY, 당일 범위 스캔만 |
| 일/주/월 목록 조회 (1페이지 50건) | < 100ms 쿼리 | `idx_schedule_start` 범위 + `LIMIT 50` + cursor 페이지네이션 |
| 검색 (FTS, 2자 이상) | < 150ms | FTS5 external content, `ORDER BY rank`, `LIMIT 50` |
| 검색 (LIKE 폴백, 1자) | < 250ms | `LIMIT 50` 상한, 결과 제한 안내(P-11) |
| 일정 저장(+알림 5건 예약) | < 200ms DB TX / OS 예약은 비동기 | 단일 트랜잭션, OS 예약은 `ReminderScheduler.sync` 백그라운드 |
| 앱 콜드 스타트 → 대시보드 | < 1.5s (마이그레이션 없을 때) | 부트스트랩 순서 최적화, `sync()`는 렌더 후 비동기 |
| 알림 발송 정확도 | 설정 시각 기준 오차 [제안] ±60s 이내 (OS 제약 명시) | Notifee `TimestampTrigger`, `AlarmManager.setExactAndAllowWhileIdle`(Android, 권한 시) / iOS `UNCalendarNotificationTrigger` |

- **OS 제약 명시**: Android Doze / 앱 대기 모드, iOS 저전력/시스템 스케줄러로 인해 정시 발송이 지연될 수 있다. 정확 알람 권한(Android 12+ `SCHEDULE_EXACT_ALARM`) 미허용 시 오차가 커질 수 있음 → 사용자 안내.

### 1.2 성능 설계 수단

- 인덱스: database.md 4장(부분 인덱스로 soft-deleted 제외).
- 페이지네이션: 모든 목록/검색은 keyset(cursor = `(start_at, id)`), OFFSET 미사용.
- 반복 일정: 저장은 규칙 1행, 조회 시 범위 내 발생만 `RecurrenceExpander`로 계산(최대 확장 수 상한 [제안] 366).
- 대시보드/목록은 store 캐시 + 변경 시 무효화(전체 재조회 아님).
- OS 알림 동시 예약 상한 대비 `horizonDays=60`만 실제 예약, 나머지는 지연 예약(logic 6장).
- FTS 인덱스는 트리거로 증분 갱신(재색인 배치 불필요).

---

## 2. 용량 / 규모 가정 (NFR-04)

| 항목 | 가정 |
| --- | --- |
| 사용자 | 단말당 1명 (다중 사용자 없음) |
| 일정 증가율 | 연 ~2,000건, 5년 ~10,000건 |
| 단일 일정 저장 크기 | 평균 ~0.5KB (제목+메모 포함), 10,000건 ≈ 5MB + 인덱스/FTS ≈ 총 15~25MB |
| 알림 행 | 일정당 평균 2건, ~20,000행 |
| 캘린더 링크 | 연동 사용자 기준 수천 행 |
| 동시성 | 단일 프로세스. 워치 동기화 시 짧은 쓰기 경합 → WAL + `BEGIN IMMEDIATE` |

- SQLite 단일 파일로 위 규모는 여유. 샤딩/파티셔닝 불필요.

---

## 3. 확장성 (NFR-10)

- **수평 확장 지점 없음**(로컬 앱). 서버가 없으므로 스케일아웃 대상 아님.
- **코드 확장성**: 도메인/서비스 계층이 포트 인터페이스에 의존(DIP) → 저장소 드라이버·알림·캘린더·인증 어댑터 교체가 국소 변경.
- **워치 확장**: 코어 도메인 계층을 공유 패키지로 분리(`src/core`)하여 모바일/워치 타깃이 재사용. 워치는 읽기+완료토글 중심의 축소 어댑터만 구현.
- **D-01=(a) 전환 대비**: `ScheduleRepository` 뒤에 원격 동기화 데코레이터를 추가하는 형태로 확장 가능(기존 서비스 무변경). 이때 `nfr.md`에 서버 SLO 절 신설 필요.

---

## 4. 가용성 / 장애 대응 (NFR-03, NFR-06)

| 항목 | 설계 |
| --- | --- |
| 오프라인 | 계정/캘린더 동기화를 제외한 전 기능 네트워크 불필요(NFR-03, AC-22). 외부 호출은 전부 격리 + 실패 시 로컬 유지 |
| 저장소 손상 | 부트스트랩에서 `PRAGMA integrity_check` 실패 또는 마이그레이션 실패 → **안전 모드**(읽기 전용 UI + 안내 + 내보내기 시도), 파괴적 자동 복구 안 함(E-15-1) |
| 마이그레이션 실패 | 해당 스텝 롤백, `user_version` 유지, `STORAGE_MIGRATION_FAILED` 로그, 다음 실행 재시도 |
| 알림 유실 | 콜드 스타트/부팅 시 `ReminderScheduler.sync()` 전체 재조정으로 자가 치유(P-09, AC-08) |
| 외부 API 장애 | OAuth/캘린더 Timeout(logic 9장) + 사용자 재시도. 앱 흐름 차단 없음 |
| 데이터 백업 | 사용자 주도 내보내기/가져오기(JSON) [제안] — 이번 범위 포함 여부 미결정(OI 후속). OS 자동 백업은 보안상 DB 제외(logic 13.4) |
| 크래시 복구 | 상태를 매 상호작용마다 영속화하므로 재시작 시 최신 상태 복원 |

- SLA/SLO 수치: 서버가 없어 대외 가용성 약정 대상 아님. 앱 크래시프리율 목표 [제안] 99.5% 세션.

---

## 5. 관측성 (NFR-07 일부)

### 5.1 로깅 정책

- 로컬 구조적 로그(JSON 라인): `{ ts, level, category, event, ...safeFields }`.
- 레벨: `error` / `warn` / `info` / (개발 전용) `debug`. 릴리스 기본 `warn`.
- **마스킹 필수**: 일정 `title`/`memo`, 토큰/키, 계정 이메일, 검색어 원문 → 로그 금지. 대체로 길이/개수/해시 프리픽스만.
- 로그 보존: 링 버퍼(용량 [제안] 2MB 또는 7일), 사용자 문의 시 내보내기.

### 5.2 수집 메트릭 (로컬 카운터)

| 메트릭 | 용도 |
| --- | --- |
| `reminder.scheduled` / `reminder.fired` / `reminder.skipped` / `reminder.schedule.fail` | 알림 신뢰성 관찰 |
| `reminder.restore.count` (부팅/콜드스타트 재예약 수) | P-09 검증 |
| `migration.apply.success` / `.fail` + 소요 ms | AC-24 |
| `db.query.slow` (임계 [제안] 200ms 초과 건수) | 성능 회귀 감지 |
| `calendar.sync.merged` / `.conflict` / `.externalDeleted` | P-08 동작 관찰 |
| `auth.link` / `auth.refresh.fail` / `auth.unlink` | 계정 연동 상태 |
| `safeMode.enter` | 저장소 장애 |

### 5.3 알림(개발/QA 기준)

- 분산 트레이싱: 해당 없음(단일 프로세스, 서버 없음).
- 원격 APM/크래시 리포팅: 이번 범위 없음(overview N-2). 도입 시 프라이버시 고지·옵트인 필요.

---

## 6. 보안·프라이버시 비기능 (NFR-07)

- 상세 위협·대응은 `logic.md` 13장. NFR 관점 목표:
  - 민감정보(제목/메모)는 기본 릴리스에서 저장 시 보호(SQLCipher [제안] ON — D-03 확정 대기).
  - 토큰은 100% OS 보안 저장소에만 존재(코드 리뷰·정적 점검으로 확인 가능).
  - 모든 외부 통신 HTTPS, cleartext 트래픽 0.
  - 로그 마스킹 규칙 위반 0건(Tester 정적 점검 대상).

---

## 7. 접근성 / 국제화 (NFR-08, NFR-09)

| 항목 | 목표 | 설계 |
| --- | --- | --- |
| 글자 크기 | OS 동적 폰트 + 앱 `theme.fontScale` 반영 | 레이아웃은 상대 단위, 최소 터치 타깃 44dp |
| 대비 | WCAG AA [제안] 대비 준수(테마 색상 팔레트 사전 검증) | 강조색 선택 시 대비 경고 |
| 스크린리더 | 주요 액션에 접근성 레이블 | 컴포넌트 규약 |
| 국제화 | 최소 한국어. 날짜/시간/요일은 로캘 포맷 | `Intl` + tz 변환(P-16), 저장은 epoch ms. **일정 편집 날짜/시각 입력**은 이번 사이클 고정 형식(`YYYY-MM-DD`/`HH:mm`) 텍스트 입력(네이티브 로캘 픽커 미도입 — overview N-10), **표시**는 로캘 포맷 유지. 로캘 인지 입력 픽커는 후속 |

---

## 8. 이식성 (NFR-01, NFR-10)

- 코어 도메인/서비스: React Native API 비의존 순수 TS → Node(Jest)·모바일·워치에서 동일 실행.
- 플랫폼 분기는 어댑터에 격리(`*.ios.ts` / `*.android.ts` 또는 런타임 분기).
- 데이터 스키마·시각 표현(epoch ms + IANA tz)을 모바일/워치가 공유.

---

## 9. 검증 관점 (Tester가 측정 가능한 기준)

| # | 검증 항목 | 방법 | 기준 |
| --- | --- | --- | --- |
| V-1 | 대시보드 집계 정확성 | 시드 데이터로 DashboardService 단위 테스트 | AC-04/07/15 수치 일치 |
| V-2 | 완료율 계산 (0건 → 0%) | 단위 테스트 | P-07, AC-15 |
| V-3 | 날짜 경계(자정) 처리 | `Clock` 목으로 자정 전후 케이스 | AC-16 |
| V-4 | 입력 검증(제목/종료<시작/오프셋>5) | 단위 테스트, 데이터 변경 없음 확인 | AC-02/03, P-10 |
| V-5 | 알림 재예약(수정 시 이전 취소 + 재생성) | `NotificationGateway` 스파이 | AC-09 |
| V-6 | 삭제 시 알림 전부 취소 | 스파이 호출 검증 | AC-10 |
| V-7 | 재부팅 시나리오 재예약 | `sync()` 재호출로 OS 예약 재생성 확인 | AC-08 |
| V-8 | 과거 오프셋 SKIPPED 처리 | 단위 테스트 | E-01-4, E-08-2 |
| V-9 | 검색: 2자↑ FTS / 2자 미만 LIKE 폴백 + 상한 | 인메모리 저장소 테스트 | AC-13, P-11 |
| V-10 | 검색 + 필터 AND 결합 | 단위 테스트 | AC-14 |
| V-11 | SQL/FTS/LIKE 주입 방어 | 악성 입력(`" OR 1=1`, `%`, `NEAR`) 테스트 | logic 13.3, 결과 오염 없음 |
| V-12 | 마이그레이션 러너 순차 적용 + 실패 롤백 | 임시 DB로 통합 테스트 | AC-24, E-15-1 |
| V-13 | 계정 unlink 시 로컬 데이터 보존 | 단위 테스트 | AC-21, P-14 |
| V-14 | 토큰이 DB에 저장되지 않음 | 코드/스키마 정적 점검 | logic 13.4 |
| V-15 | 로그 마스킹(제목/토큰 미출력) | `Logger` 스파이 + 정적 grep | nfr 5.1 |
| V-16 | 목록/검색 페이지네이션 keyset 동작 | 단위 테스트 | nfr 1.2 |
| V-17 | 카테고리 삭제 시 일정 "기타" 재지정 | 트랜잭션 테스트 | E-06-2 |
| V-18 | 우선순위 정렬 순서 | 단위 테스트 | AC-12 |
| V-19 | `buildApp` 옵션 확장 후방 호환 | 기존 12개 스펙 + `npm run demo` 무변경 통과 | overview 영향 범위(REGRESSION) |
| V-20 | `bootstrapSequence` 단계 순서·안전 모드 분기 | 순수 오케스트레이터 단위 테스트(마이그레이션 실패 주입 → SafeMode, 성공 → sync 호출) | logic §16.4, E-15-1, AC-24 |
| V-21 | 딥링크/알림 payload 파서 | `todaywhat://schedule/:id` 파싱, 비정수/타 스킴 거부, `findById` 재조회 경유 | logic §16.2, §13.3 |
| V-22 | 네이티브 어댑터 계약 준수 | 각 어댑터가 `src/core/ports` 인터페이스에 타입 적합(`npm run typecheck`) + Fake 대역과 행위 동치(스파이 테스트) | logic §16.5 |
| V-23 | 어댑터 오류 → `ErrorCodes` 매핑 | 권한 거부/취소/게이트웨이 실패 주입 시 규정 코드 반환 | logic §16.5 표 |
| V-24 | 토큰 미저장·client_secret 부재 정적 점검 | `KeychainTokenStore`만 토큰 보관, DB 스키마/코드 grep | logic §16.7, V-14 확장 |
| V-25 | 일정 편집 폼: 필드별 검증 오류 인라인 매핑(제목 빈값·종료<시작·메모 초과·반복 충돌), 폼 상태 유지, 저장 성공 시 `list`·`dashboard`·`search`·`categories` 무효화 + `goBack` | 화면 로직 단위 테스트(서비스 목) | AC-01~03, logic §16.3.1 |
| V-26 | 로컬 벽시계(`YYYY-MM-DD`/`HH:mm`) → epoch ms 변환이 tz·DST 경계에서 정확 | 순수 함수 단위 테스트(tz 고정) | P-16, logic §16.3.1 |

- 측정값(V-1~V-24) 중 기능 정확성 항목은 PASS 필수. 성능 [제안] 수치(1장)와 온디바이스 항목(§11)은 관찰/후속.

---

## 11. 클라이언트 셸 검증 관점 (빌드 불가 환경 대응) — v1.1

overview.md "빌드 환경 제약과 파이프라인 검증 전략" 참조. RN 앱 셸은 검증 가능 범위와 후속 범위를 분리한다.

### 11.1 본 파이프라인에서 검증 (Tester 정식 대상)

| 영역 | 방법 | 기준 |
| --- | --- | --- |
| 셸 순수 로직 (조립 seam, 네비 그래프 데이터, 딥링크 파서, 부트스트랩 오케스트레이터, 화면↔서비스 바인딩 맵) | `node:test` 단위 테스트 + `npm run typecheck` | V-19~V-21, 기능 정확성 PASS 필수 |
| 네이티브 어댑터 계약 | 포트 인터페이스 타입 적합 + Fake 대역 행위 동치 + 오류 매핑 | V-22~V-24 |
| 코어 회귀 | 기존 81 assertion + demo 무변경 | V-19, REGRESSION 0 |
| 셸 보안 정적 점검 | grep/리뷰: 토큰 DB 미저장, `client_secret` 부재, WebView 부재, 스킴 화이트리스트, cleartext 차단 설정 | logic §16.7, 위반 0 |
| 린트 | `@react-native/eslint-config` 통과 | 신규 파일 error 0 |
| **iOS 네이티브 빌드 (v1.2~)** | `cd ios && pod install` → `xcodebuild`/`react-native run-ios` | `** BUILD SUCCEEDED **`, op-sqlite Pod 컴파일 성공, 경고는 허용 |
| **iOS 시뮬레이터 실행 (v1.2~)** | 부팅된 시뮬레이터에 앱 설치·실행, 첫 화면(대시보드) 크래시 없이 렌더, `xcrun simctl` 스크린샷 1장 | 크래시 0, 첫 화면 렌더 확인 필수 |

### 11.2 환경 외 후속 검증 (별도 모바일 CI / RN 개발기 / 실기기)

| 영역 | 후속 방법 |
| --- | --- |
| `android/` Gradle 빌드 | Android SDK 있는 CI 러너 / 로컬 |
| New Architecture 활성(N-9) 온디바이스 확정 | RN 개발기 + 디바이스 |
| `NativeModules` 왕복 중 notifee/app-auth/keychain/calendar-events (op-sqlite는 §11.1에서 앱 실행으로 검증) | 디바이스·시뮬레이터 E2E(Detox 등, 후속) |
| 온디바이스 알림 정확도(§1.1 ±60s [제안]), Doze/저전력 영향, `BOOT_COMPLETED` 재예약 실동작 | 디바이스 수동/자동 측정 |
| 워치 타깃(WatchConnectivity / Wear Data Layer) 연동 | 워치 기기 |

- Tester는 11.2 항목을 FAIL/BLOCKED이 아니라 `test-result.md`에 "환경 외 후속 검증 대기"로 분리 기록한다. §11.1 항목(iOS 빌드·실행 포함)의 결함은 정식 Issue로 처리한다.

---

## 12. 미결정 사항 (NFR 관점)

| ID | 내용 |
| --- | --- |
| N-1 | 성능 정량 SLO / 알림 허용 오차 수치 확정 |
| N-2 | 원격 크래시/텔레메트리 도입 및 옵트인 정책 |
| N-7 | 사용자 백업/내보내기(JSON) 이번 범위 포함 여부 |
| N-8 | RN 앱 셸 온디바이스 검증 — iOS 빌드·시뮬레이터 실행은 v1.2에서 정식 검증됨. Android Gradle 빌드·워치 연동·실기기 알림 정확도는 환경 외 후속 |
| N-9 | RN New Architecture(Fabric/TurboModules) 활성 여부 |
| D-03 | DB 암호화(SQLCipher) 기본 활성 여부 — 성능/백업 영향 |
| N-10 | 일정 편집 날짜/시각 네이티브 픽커(`@react-native-community/datetimepicker` 8.x) 도입 — 빌드 호스트 디스크 여유 확보 후. 이번 사이클은 고정 형식 텍스트 입력으로 AC-01~03 충족 |
