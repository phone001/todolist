# 비기능 요구사항 설계 — 일정관리 앱 "오늘뭐해"

| 항목 | 값 |
| --- | --- |
| 문서 종류 | 비기능 요구사항 설계 (NFR) |
| 버전 | v1.7 |
| 상태 | 작성 완료 |
| 근거 | `document/planner/plan.md` v1.4 6절/NFR-01~12, `document/architect/overview.md` v1.9, `document/architect/database.md` v1.2, `document/architect/logic.md` v1.9 |

## 변경 이력

| 버전 | 일자 | 변경 내용 |
| --- | --- | --- |
| v1.7 | 2026-09-08 | 설계 델타(overview v1.9 / logic v1.9, plan v1.4 — F-19 애플워치 워치 타깃, NFR-10 승격). **NFR-10 상태 "후속 가정"→"이번 릴리스 착수"** 반영, **NFR-12(워치 동기화 베스트-에포트) 신규** 검증 항목화. **신규 §14 "워치 동기화 (F-19 / NFR-10 / NFR-12)"** — 페이로드 크기 상한(오늘 200건 + 다음 1건, 절단 메트릭), 폴링 없음(`updateApplicationContext` 코알레싱), 베스트-에포트 격리(연결 실패가 폰 저해 안 함), 오프라인 조회·보류 큐, 워치 배터리/성능/이식성. §3 확장성·§8 이식성에 워치 착수 반영. §5.2 메트릭에 `watch.snapshot.sent`·`watch.snapshot.truncated`·`watch.toggle.received/applied/rejected/lww.phoneWins` 추가. §9 검증표에 V-36~V-40 추가. §11.2 후속에 watchOS 앱 타깃 빌드·WCSession 실왕복. §12 미결정에 D-09/D-10/D-11·N-11·N-12. 성능·용량·가용성·보안 목표(1~7장) 무변경 — 신규 정량 요구 없음 |
| v1.6 | 2026-09-07 | 설계 델타(overview v1.8 / logic v1.8, plan v1.3 재설계분 정식화 — F-06/F-10/F-18). §1.2 페이지네이션에 설계 상수(`DASHBOARD_PAGE_SIZE=100`/`CALENDAR_MONTH_PAGE_SIZE=200`+월당 10페이지 상한/`SEARCH_PAGE_SIZE=50`) 명시. §5.2 메트릭에 `reminder.globalDisable.cancelled`·`calendar.month.truncated` 추가. §7 접근성에 SwipeableRow 제스처 대체 경로(`accessibilityActions`). §9 검증표에 V-31~V-35 추가(유형 rename/유일성·기본 유형 보호 / 전역 알림 게이트·off 일괄 취소·on 무회귀 / 페이지네이션 cursor 루프 / 표시 계층 Clock 포트 정적 점검 / 대시보드 2-소스). §12 미결정에 D-07·D-08(설계값 확정, 게이트 형식상 OPEN). 성능·용량·가용성·보안 목표(1~8장) 무변경 — 신규 정량 요구 없음 |
| v1.5 | 2026-09-07 | 설계 델타(overview v1.7 / logic v1.7, F-17 브랜드 오리 로딩 인디케이터). **신규 §13 "로딩 애니메이션 성능 (F-17 / NFR-11)"** — 프레임 목표(60fps, 하한 50fps), 저사양·절전 강등 트리거 수치(rAF 평균 28ms / 연속 5프레임 50ms + Reduce Motion), 리소스 해제 규칙(P-31), 렌더 비용 예산. §9 검증표에 V-27~V-30 추가. §12 미결정에 D-06(설계값 확정, 게이트 형식상 OPEN) 추가. 성능·용량·가용성·보안 목표(1~8장) 무변경 |
| v1.0 | 2026-09-04 | 최초 작성. 기획 NFR 초안을 기술 목표·설계·검증 관점으로 구체화 |
| v1.1 | 2026-09-04 | §11 "클라이언트 셸 검증 관점(빌드 불가 환경 대응)" 추가. §9 검증표에 셸 항목 V-19~V-24 추가. §10 미결정에 N-8/N-9 추가. 성능·용량·보안 목표(1~8장)는 무변경 |
| v1.2 | 2026-09-04 | Bug Fix 동반 개정(overview/logic v1.2). 검증 환경에 Xcode 26.2 + CocoaPods 도입 → §11.2에서 **iOS `pod install`+`xcodebuild` 빌드·시뮬레이터 설치·실행·op-sqlite DB 왕복**을 §11.1 정식 검증으로 이동. Android Gradle·워치·온디바이스 알림 정확도만 §11.2 유지. N-8을 "iOS 검증됨 / Android·워치 후속"으로 축소. 성능·용량·보안 목표 무변경 |
| v1.4 | 2026-09-07 | 설계 델타(overview v1.6 / logic v1.6, N-10 해소 — DateTimePicker 도입). §7 국제화의 일정 편집 날짜/시각 입력 설명 교체(텍스트 → `DateTimePickerModal` OS 네이티브 UI, 로캘 자동 반영). §9 V-26 비고 업데이트(`localWallToEpoch` 저장 경로 불사용 명시, 표시 초기값·단위 테스트 존속). §12 N-10 (1) 해소 기록. 성능·용량·가용성·보안 목표 무변경 |
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
- 페이지네이션: 모든 목록/검색은 keyset(cursor = `(start_at, id)`), OFFSET 미사용. 화면별 페이지 크기 설계 상수(logic §16.3.5): `DASHBOARD_PAGE_SIZE=100`(오늘 목록, cursor 루프로 당일 전건), `CALENDAR_MONTH_PAGE_SIZE=200`(월 그리드, cursor 루프 + 월당 최대 10페이지=2000행 안전 상한 후 `calendar.month.truncated` 메트릭), `SEARCH_PAGE_SIZE=50`(검색, `onEndReached` 추가 로드). 재설계 코드의 하드코딩 200/500 단일 페이지를 대체 — 대량 데이터 조용한 누락 방지.
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
- **워치 확장 (F-19, v1.7 — 착수)**: RN 은 watchOS UI 를 렌더하지 않고 `src/core` 순수 TS 도 watchOS 확장에서 실행되지 않는다 → 워치 앱은 네이티브 WatchKit/SwiftUI 로 축소 읽기 모델(오늘 목록·완료 토글·LWW·보류 큐)을 재구현하고, **페이로드 스키마·시각 표현(epoch ms + IANA tz)·상태 규칙**만 폰과 공유한다("코드 공유"가 아닌 "계약 공유"). 폰 측 재사용: `src/core/watchSync/`(순수 스냅샷 빌더 + LWW 조정) + `WatchSyncService` + `WatchSyncGateway` 포트 ↔ iOS `WatchConnectivityGateway` 어댑터. 확장 여지: Android Wear OS 는 동일 `WatchSyncGateway` 포트에 Wear Data Layer 어댑터를 붙이는 형태로 후속 가능(OI-11).
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
| `reminder.globalDisable.cancelled` (전역 알림 off 전환 시 일괄 취소 건수) | F-18 / P-32 / D-07 동작 관찰 |
| `calendar.month.truncated` (월 조회가 10페이지 안전 상한에 도달) | 대량 데이터 조회 관찰 (logic §16.3.5) |
| `watch.snapshot.sent` (건수 · 페이로드 바이트; 제목 미기록) / `watch.snapshot.sent.fail` / `watch.snapshot.truncated` (오늘 200건 초과 절단) | F-19 폰→워치 전송 관찰 (logic §17.2/§17.3) |
| `watch.toggle.received` / `.applied` / `.rejected`(NOT_FOUND) / `.malformed` / `.lww.phoneWins` | F-19 워치→폰 완료 토글 역전파 관찰 (logic §17.4/§17.6) |
| `watch.session.activated` / `.unreachable` | F-19 채널 상태 (NFR-12 격리 관찰) |
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
| 스크린리더 | 주요 액션에 접근성 레이블 | 컴포넌트 규약. **SwipeableRow(logic §16.10)**: 팬 제스처의 대체 경로 필수 — 행 `accessibilityActions=[{name:'delete'},{name:'edit'}]` + `onAccessibilityAction`, 또는 상세 화면 삭제 버튼으로 스와이프 없이 삭제 가능 |
| 국제화 | 최소 한국어. 날짜/시간/요일은 로캘 포맷 | `Intl` + tz 변환(P-16), 저장은 epoch ms. **일정 편집 날짜/시각 입력**: v1.6(N-10 해소)부터 `@react-native-community/datetimepicker` 8.6.0 OS 네이티브 UI 사용 — iOS/Android 모두 단말 로캘을 자동 반영(한국어 기기에서 한국어 달력/시각 포맷 표시). **표시**(목록·대시보드)는 기존 로캘 포맷 유지. 저장은 epoch ms(UTC) 불변 |

---

## 8. 이식성 (NFR-01, NFR-10)

- 코어 도메인/서비스: React Native API 비의존 순수 TS → Node(Jest)·모바일에서 동일 실행.
- 플랫폼 분기는 어댑터에 격리(`*.ios.ts` / `*.android.ts` 또는 런타임 분기).
- **모바일 ↔ 워치(F-19, v1.7)**: watchOS 는 런타임 제약으로 `src/core` 코드를 링크하지 않는다. 이식성은 **계약 수준**으로 달성 — 페이로드 스키마(logic §17.3), 시각 표현(epoch ms + IANA tz, P-39), 상태 표시 규칙(§7.6)을 폰(TS)과 워치(Swift)가 공유하고, 폰 측 `src/core/watchSync/**` 순수 모듈이 스냅샷 파생·LWW 조정의 단일 출처다(NFR-10). 워치 앱은 이 계약을 Swift 로 재구현한다.

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
| V-26 | `localWallToEpoch` 함수가 tz·DST 경계에서 정확 | 순수 함수 단위 테스트(tz 고정) — 함수 존속(표시 초기값 역방향 변환·단위 테스트 유지용). v1.6부터 저장 경로는 DateTimePicker `Date.getTime()` 직접 사용(불사용 명시) | P-16, logic §16.3.1 |
| V-27 | 로딩 인디케이터 표시 FSM: 지연 200ms 내 종료 시 미표시(AC-32), 표시 후 성공은 최소 600ms 유지(AC-31), 에러 종료는 즉시 제거(AC-38), 10s 초과 시 `showTimeoutHint` | `loadingIndicatorMachine.ts` 순수 함수 단위 테스트(합성 타임스탬프 주입) | AC-31/32/38, P-24/26/28, logic §16.9.3 |
| V-28 | 활동 순환 목록: 기본 4활동 순서·loop, `sequence` 길이 3~5 clamp, Search 변형은 `search` 첫 활동 | `duck/activities.ts` 순수 함수 단위 테스트 | AC-30, P-23, logic §16.9.4 |
| V-29 | 저사양·절전 강등: 합성 프레임 간격(평균 > 28ms 또는 연속 5프레임 > 50ms) 주입 시 `degraded=true`→`mode='static'`; Reduce Motion true → `mode='static'` | 프레임 샘플러 판정 함수 단위 테스트 + `AccessibilityInfo` 목 | AC-33, E-17-5, P-29, logic §16.9.6, nfr §13 |
| V-30 | 폴백 체인·리소스 해제: SVG 렌더 예외 주입 시 `SvgErrorBoundary`→`logo.png`→스피너로 강등하며 무크래시; `loading=false`/언마운트 시 `Animated.loop().stop()`·타이머·rAF 해제 | 정적 리뷰 + 에러 경계 단위 테스트(가능 범위) | AC-34, P-31, E-17-2, logic §16.9.5/§16.9.9 |
| V-31 | 유형 관리 계약: `create`/`rename` 이 빈 이름→`VALIDATION_CATEGORY_NAME_REQUIRED`, 정규화(트림+대소문자 무시) 중복→`VALIDATION_CATEGORY_NAME_DUPLICATE`, 기본 유형 rename→`POLICY_SYSTEM_CATEGORY_RENAME`; rename 후 그 유형 참조 일정의 표시 라벨 갱신(참조 ID 유지) | `CategoryService` 단위 테스트(인메모리 저장소) | AC-39/40/41, E-06-3~5, P-34, logic §5.1 |
| V-32 | 전역 알림 게이트: `notif.enabled=false` 동안 `syncOnce()` 가 OS 예약 생성 안 함 + 기존 SCHEDULED 를 `CANCELLED`; `applyGlobalNotificationsToggle(false)` 가 활성 reminder 전부 OS 취소·`CANCELLED`; `true` 전환은 무회귀(기존 CANCELLED 재예약 안 함), 이후 `update`→`replaceForSchedule`→sync 로만 재예약 | `ReminderScheduler` 단위 테스트(`NotificationGateway` 스파이 + `SettingService` 목) | AC-42, P-32, D-07, F-08 E-08-5, logic §6 |
| V-33 | 목록 페이지네이션: Dashboard/Calendar 가 `nextCursor` 를 소진할 때까지 append(하드코딩 단일 페이지 아님), Calendar 월당 10페이지 상한 시 `calendar.month.truncated`; Search `onEndReached` 다음 cursor 페이지 append | 화면 로직 단위 테스트(서비스 목, 합성 다중 페이지) | nfr §1.2, T-05, logic §16.3.5 |
| V-34 | 표시 계층 Clock 포트: 화면 `.tsx`·훅에 `Date.now()`/무인자 `new Date()` 직접 호출 없음(어댑터·`SystemClock`·포맷 유틸 제외); `todayRange` 등이 `clock.startOfLocalDay(clock.now(), tz)` 사용 | 정적 grep + 리뷰 + `Clock` 목으로 자정 경계 테스트(V-3 확장) | P-16/P-17, T-04, logic §16.11 |
| V-35 | 대시보드 2-소스: 요약 표시요소(완료율·유형별 분포·다음 예정)는 `DashboardService.getSummary` 결과, 오늘 목록 행은 `ScheduleService.findInRange`; 인라인 토글/삭제 후 `dashboard` 무효화로 요약 갱신; 브랜드(logo/tagline)·요약·목록 공존 | 화면 로직 단위 테스트(서비스 목) + 정적 리뷰 | AC-25/44/45/46, P-07/P-35, T-01/T-02, logic §7/§16.3.3 |
| V-36 | 워치 페이로드 빌더: `buildWatchSnapshot` 이 오늘(로컬 자정 P-17) 목록 + 다음 예정 1건만 포함, 시각은 epoch ms + `timeZone`(IANA) 원본, 삭제된 유형→"기타"(E-19-4), 200건 초과 시 절단 + `truncated=true`; 메모·이력·알림·토큰 미포함(P-40) | `src/core/watchSync/snapshot.ts` 순수 함수 단위 테스트(인메모리 저장소 + `FixedClock`) | AC-47/53, P-39/P-40, E-19-4/E-19-6, logic §17.3 |
| V-37 | 워치 완료 토글 역전파: `applyIncomingToggle` 이 (a) 잘못된 op(비정수 scheduleId·비-boolean done) 거부, (b) `opId` 중복 시 재적용 없이 ack, (c) 없는/삭제된 일정 `NOT_FOUND`, (d) 정상 op → `ScheduleService.toggleDone` 만 호출(생성/수정/삭제 경로 없음), (e) 처리 후 `pushSnapshot` | `WatchSyncService` 단위 테스트(`ScheduleService` 목 + `WatchSyncGateway` 스파이 + 인메모리 `APP_SETTING`) | AC-23/48, P-43, E-19-2, logic §17.4, §13.9 |
| V-38 | 워치 LWW: `resolveToggleLWW` — `schedule.updatedAt <= op.baseUpdatedAt` → APPLY; 폰이 이후 변경 & `op.watchChangedAt > schedule.updatedAt` → APPLY, 아니면 SKIP_PHONE_WINS; soft-deleted → REJECT_NOT_FOUND; 동시(같은 ms) → 폰 우선(결정적) | `src/core/watchSync/reconcile.ts` 순수 함수 단위 테스트(합성 타임스탬프) | AC-50, E-19-3, P-38, logic §17.6 |
| V-39 | 워치 채널 격리(NFR-12): `WatchSyncGateway` 전송/활성화 실패를 주입해도 폰 흐름(create/update/toggleDone/대시보드)이 정상 완료; Android 어댑터는 `isSupported()=false` 로 모든 메서드 no-op | `WatchSyncService`·부트스트랩 배선 단위 테스트(게이트웨이 목이 throw) | NFR-12, plan §3.2, logic §17.2 |
| V-40 | 전역 알림 게이트 ↔ 워치 무관: 워치 스냅샷 페이로드에 REMINDER 필드 없음, 워치 동기화가 `ReminderScheduler`/`syncOnce()` 를 호출하지 않음(정적 grep + 리뷰); 전역 알림 off 상태에서 워치 관련 코드가 알림을 생성하지 않음 | 정적 grep + 리뷰 + 스냅샷 스키마 점검 | AC-52, P-41, E-19-7, logic §17.7 |

- 측정값(V-1~V-24) 중 기능 정확성 항목은 PASS 필수. 성능 [제안] 수치(1장)와 온디바이스 항목(§11)은 관찰/후속.
- V-27~V-30 중 순수 로직(FSM·활동 목록·강등 판정)은 `node:test` 로 PASS 필수. SVG/`Animated` 실제 렌더·프레임 측정은 온디바이스 후속(§11.2).
- V-31~V-35(v1.6): 코어 서비스 로직(V-31 유형 계약·V-32 알림 게이트)과 화면 로직 단위 테스트(V-33 페이지네이션·V-35 대시보드 2-소스)는 `node:test` 로 PASS 필수. V-34(Clock 포트)는 정적 grep + 리뷰로 PASS 필수.
- V-36~V-40(v1.7, F-19): 순수 로직(V-36 스냅샷 빌더·V-38 LWW)과 서비스 로직(V-37 역전파·V-39 격리)은 `node:test` 로 PASS 필수. V-40(알림 무관)은 정적 grep + 리뷰로 PASS 필수. watchOS 앱(Swift) 빌드·WCSession 실왕복·컴플리케이션 타임라인은 워치 기기 있는 후속 환경(§11.2, N-11) — FAIL/BLOCKED 아닌 "환경 외 후속 검증"으로 분리 기록.

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
| **watchOS 앱 타깃(F-19)**: `xcodebuild -scheme TodayWhatWatch` 빌드, 워치 시뮬레이터/기기 설치·실행, `WCSession` 실왕복(applicationContext/transferUserInfo/sendMessage), 오프라인 보류 큐 flush, LWW 실동작, (D-10 시) 컴플리케이션 타임라인 갱신 | 페어드 iPhone + Apple Watch(또는 시뮬레이터 쌍) |

- Tester는 11.2 항목을 FAIL/BLOCKED이 아니라 `test-result.md`에 "환경 외 후속 검증 대기"로 분리 기록한다. §11.1 항목(iOS 빌드·실행 포함)의 결함은 정식 Issue로 처리한다.

---

## 12. 미결정 사항 (NFR 관점)

| ID | 내용 |
| --- | --- |
| N-1 | 성능 정량 SLO / 알림 허용 오차 수치 확정 |
| N-2 | 원격 크래시/텔레메트리 도입 및 옵트인 정책 |
| N-7 | 사용자 백업/내보내기(JSON) 이번 범위 포함 여부 |
| N-8 | RN 앱 셸 온디바이스 검증 — iOS 빌드·시뮬레이터 실행은 v1.2에서 정식 검증됨. Android Gradle 빌드·실기기 알림 정확도는 환경 외 후속 |
| N-9 | RN New Architecture(Fabric/TurboModules) 활성 여부 |
| D-09 | 워치 갱신 트리거 조합 (F-19) — (b) 채택(plan v1.4). `updateApplicationContext` + 도달 시 `sendMessage`(logic §17.2). 주기 폴링 미도입(OI-13). 게이트 형식상 OPEN, 비차단 |
| D-10 | 워치 컴플리케이션 이번 범위 포함 (F-19) — "1종 포함" 가정으로 조건부 설계(logic §17.8). 미결 시 확장 제외·AC-56 검증 제외. 산출물 범위 영향 → 착수 초기 이해관계자 확인 권장. 비차단 |
| D-11 | 워치 역전파 지연/실패 노출 수준 (F-19) — (b) "동기화 대기" 배지 채택(plan v1.4, logic §17.5). 폰 배지 미도입. 비차단 |
| N-11 | watchOS 앱 타깃 온디바이스 검증 (F-19) — 워치 시뮬레이터/기기 부재. `src/core/watchSync/**` + `WatchSyncService` + `WatchConnectivityGateway` 계약만 `npm test`/`typecheck`. WCSession 실왕복·컴플리케이션은 §11.2 후속 |
| N-12 | 워치 LWW 정밀도 (F-19) — `SCHEDULE.UPDATED_AT` 기반 근사(스키마 무변경). 완료 무관 폰 편집이 워치 토글보다 나중일 때 워치 토글 드롭 가능(residual, logic §17.6). 필드 수준 정밀 LWW(전용 컬럼)는 후속 |
| D-03 | DB 암호화(SQLCipher) 기본 활성 여부 — 성능/백업 영향 |
| N-10 | **(1) 해소(v1.6)** — `@react-native-community/datetimepicker` 8.6.0 도입, logic §16.3.1/overview 기술 스택 표 갱신. (2) 반복 회차 편집(P-02)은 별도 후속 사이클 |
| D-06 | 오리 로딩 인디케이터 세부 정책 5건 — v1.7에서 설계값 확정(§13, overview "D-06 설계 확정값" 표, logic §16.9). 기술/UX 튜닝 결정이며 기획이 Architect 위임 → 가정값=설계값. 게이트는 형식상 OPEN 유지(이해관계자 추인 대기), 비차단 |
| D-07 | 전역 알림 off 전환 시 기존 예약 처리 — (a) 즉시 전체 취소 채택(plan v1.3). `applyGlobalNotificationsToggle(false)` 일괄 취소, on 복귀 무회귀(logic §6). 게이트 형식상 OPEN(이해관계자 추인 대기), 비차단 |
| D-08 | 유형 속성 편집 범위 — "이름만" 채택(plan v1.3). 색상·아이콘 시스템 자동 배정, DB 스키마 무변경(database.md §9). 게이트 형식상 OPEN, 비차단 |

---

## 13. 로딩 애니메이션 성능 (F-17 / NFR-11) — v1.5

브랜드 오리 로딩 인디케이터(logic §16.9)의 비기능 목표를 구체화한다. 기획에 정량 SLO 가 없어 아래 수치는 **[제안]** 이며 Tester 는 임시 기준으로만 사용한다(미달을 Critical/High 로 올리지 않음).

### 13.1 프레임·응답성 목표

| 항목 | 목표 [제안] | 달성 설계 |
| --- | --- | --- |
| 애니메이션 프레임레이트 | 60fps, 인디케이터 표시 중 허용 하한 50fps | `Animated` + `useNativeDriver: true` 로 opacity·transform(translateY/rotate/scale)만 UI 스레드 구동. JS 브리지 프레임당 왕복 0 |
| 인디케이터 표시로 인한 상호작용 지연 | < 16ms 추가 (헤더·네비 컨트롤 조작성 유지) | 인라인 인디케이터는 콘텐츠 영역만 점유, 화면 나머지 UI 는 리렌더 없음. `React.memo` 로 활동 전환이 부모 리렌더를 유발하지 않음 |
| 표시/숨김 전환 | 활동 크로스페이드 300ms, 급격한 점프 없음(R-17-3) | 인접 두 장면 opacity 보간 겹침 |
| 렌더 비용 예산 | 장면당 SVG 노드 < 30개, 동시 마운트 장면 ≤ 2(전환 중) | `duck/DuckScene.tsx` 도형 수 제한. 래스터 디코드·비디오·Lottie JSON 파싱 없음 |
| 메모리 | 인디케이터 인스턴스 1개/화면(E-17-8), 언마운트 시 즉시 회수 | §13.3 리소스 해제 |

### 13.2 저사양·절전 강등 트리거 (P-29, E-17-5, D-06(3))

**신규 의존성 없이** 두 신호로 정적 폴백 강등(`degraded` = 앱 세션 in-memory 플래그, 단방향):

| 신호 | 판정 기준 [제안] | 동작 |
| --- | --- | --- |
| rAF 프레임 저하 | 인디케이터 visible 중 최근 1s 창 평균 프레임 간격 **> 28ms**(≈지속 <36fps) **또는** 연속 **5프레임 > 50ms** | 즉시 `mode='static'`, 세션 동안 유지 |
| OS Reduce Motion | `AccessibilityInfo.isReduceMotionEnabled() === true` (+ `reduceMotionChanged` 구독) | `mode='static'` (E-17-1, AC-33) |

- 배터리 절약 모드는 **직접 감지하지 않는다**(RN 코어 배터리 API 없음). `react-native-device-info` 도입 검토했으나 단일 목적 네이티브 표면 추가 대비 이득 작음 → 폐기. 절전 모드가 프레임을 떨어뜨리면 rAF 휴리스틱이 포착한다.
- 강등 후 세션 내 자동 복구 없음(깜빡임 방지).

### 13.3 리소스 해제 (P-31)

- `loading=false` 또는 언마운트 → `useEffect` cleanup:
  - `Animated.loop(...)` 전부 `.stop()`, `Animated.Value` 참조 해제
  - 지연/최소표시/타임아웃 `setTimeout` 전부 `clearTimeout`
  - rAF 프레임 샘플러 `cancelAnimationFrame`
- 로딩 종료(성공/실패) 후 무한 loop 잔존 금지. `degraded` 플래그만 세션 유지.

### 13.4 폴백 무크래시 보장 (E-17-2, AC-34)

- `react-native-svg` 렌더 예외 → `SvgErrorBoundary` 포획 → `logo.png`(번들 에셋, P-21) `<Image>` → `onError` 시 `<ActivityIndicator/>`. 어떤 단계도 예외를 상위로 전파하지 않는다.
- Tester 검증: 합성 렌더 실패 주입 시 3단계 강등 + 프로세스 생존(V-30).

---

## 14. 워치 동기화 (F-19 / NFR-10 착수 / NFR-12) — v1.7

애플워치 축소 클라이언트(logic §17)의 비기능 목표. 기획에 정량 SLO 가 없어 수치는 **[제안]** 이며 Tester 는 임시 기준으로만 사용한다(미달을 Critical/High 로 올리지 않음).

### 14.1 NFR-10 상태

- **"후속 가정(A-2)" → "이번 릴리스 착수"** (plan v1.4). 이식성은 코드 공유가 아닌 **계약 공유**로 달성(§8): 페이로드 스키마·`epoch ms + IANA tz`(P-39)·상태 규칙. 폰 측 단일 출처 = `src/core/watchSync/**`.
- Android Wear OS 는 이번 범위 밖(P-44, OI-11) — 동일 `WatchSyncGateway` 포트에 후속 어댑터.

### 14.2 NFR-12 — 베스트-에포트 동기화 목표

| 항목 | 목표 [제안] | 달성 설계 |
| --- | --- | --- |
| 워치 연결 실패가 폰 기능을 저해하지 않음 | 폰 기능 저하 0 | `WatchSyncGateway` 전송/활성화 예외는 로깅 후 무시(격리). 폰 어떤 서비스도 워치 응답을 대기하지 않음. Android = no-op (V-39) |
| 폰 변경 → 워치 반영 지연 | 수 초 ~ 수십 초(OS 기회적 전달, 목표 아님) | `updateApplicationContext` — 폰이 데이터 변경 후 `pushSnapshot()` 디바운스(500ms). 도달 가능 시 `sendMessage` 즉시 |
| 워치 완료 토글 → 폰 반영 | 도달 시 즉시(ack) / 미도달 시 재연결 후 | `sendMessage`(즉시·ack) → 폴백 `transferUserInfo`(OS 보장 FIFO). 워치 보류 큐는 ack 까지 유지, 유실 0(E-19-1) |
| 오프라인 워치 사용성 | 마지막 스냅샷 조회 + 완료 토글(보류) 100% 동작 | 워치 로컬 스냅샷·보류 큐 파일. "최신 아님"/"동기화 대기" 배지 |
| 충돌 해소 | 결정적(LWW) | `resolveToggleLWW` — `UPDATED_AT` vs `baseUpdatedAt`·`watchChangedAt`, 동시 시 폰 우선(§17.6). 잔여 부정확 N-12 |

### 14.3 페이로드 크기 / 라디오 사용

| 항목 | 목표 [제안] | 설계 |
| --- | --- | --- |
| 스냅샷 페이로드 크기 | < 32KB (`updateApplicationContext` 실무 상한 여유) | 오늘 목록 **최대 200건** + 다음 예정 1건 + 요약 카운트. 항목당 ~120B → ~24KB. 초과 시 절단 + `watch.snapshot.truncated`. 필드 최소화(P-40 — 메모·이력·알림·유형 전체정의 제외) |
| 전송 빈도 | 상시 폴링 없음 | `updateApplicationContext` 는 최신 1건만 유지·자동 병합. 폰 데이터 변경 시에만 push(디바운스). 주기 타이머 없음(OI-13) |
| 워치→폰 op 크기 | < 1KB | `{opId, scheduleId, done, watchChangedAt, baseUpdatedAt}` 스칼라 5개 |

### 14.4 워치 배터리 / 성능 / 이식성

- **워치 앱 렌더**: SwiftUI `List` — 오늘 목록(≤200) 단순 행. 애니메이션 없음(오리 로딩 미사용 — E-17-6, 워치 표준 로딩). 백그라운드 연산 없음.
- **배터리**: 상시 연결·폴링 없음. `WCSession` 전달은 OS 기회적 스케줄에 위임 → 앱이 라디오를 강제 기동하지 않음.
- **저장**: 워치 로컬 스냅샷/보류 큐 JSON 파일 — 수십 KB. 데이터 보호 클래스 적용(logic §13.9).
- **이식성 검증**: `src/core/watchSync/**` 는 `react-native` 미import → `node:test` 로 폰과 무관하게 실행(V-36/V-38). watchOS 앱은 시스템 프레임워크(`WatchConnectivity`/`SwiftUI`/선택 `WidgetKit`)만 사용 — 서드파티 0.

### 14.5 검증 관점

- V-36~V-40(§9). 순수 로직·서비스 로직·정적 점검은 이 파이프라인 PASS 필수.
- watchOS 앱 빌드·WCSession 실왕복·오프라인 flush·컴플리케이션 타임라인은 §11.2 "환경 외 후속 검증"(N-11) — Tester 는 FAIL/BLOCKED 아닌 후속 대기로 분리 기록.
