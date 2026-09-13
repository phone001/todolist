# 데이터베이스 설계 — 일정관리 앱 "오늘뭐해"

| 항목 | 값 |
| --- | --- |
| 문서 종류 | 데이터베이스 설계 (Database) |
| 버전 | v1.8 |
| 상태 | 작성 완료 (스키마 변경 — 마이그레이션 002/003 신규) |
| 근거 | `document/planner/plan.md` v1.9, `document/architect/overview.md` v1.16 |
| DB 엔진 | SQLite 3 (op-sqlite, 선택적 SQLCipher) |

## 변경 이력

| 버전 | 일자 | 변경 내용 |
| --- | --- | --- |
| v1.8 | 2026-09-12 | plan v1.9 — F-24 반복 일정 / F-06 기본 유형 4종 시딩 스키마 영향 검토. **최초로 실제 스키마 변경 발생**(v1.1~v1.7 은 전부 무변경 검토였음). (1) **마이그레이션 002(DML)** — `category` 테이블에 "공부"/"취미"/"업무" 3종을 `WHERE NOT EXISTS`(대소문자·앞뒤공백 무시 비교)로 idempotent 시딩, 색상은 `CATEGORY_COLOR_PALETTE[0..2]`(`#00897B`/`#00ACC1`/`#039BE5`) 고정 배정 — `IS_SYSTEM=0`(D-27(a), 보호 대상 아님). 신규 설치자·기존 사용자 모두 버전 기반 마이그레이션 러너로 동일 적용(E-06-8). (2) **마이그레이션 003(DDL)** — `schedule` 테이블에 `recurrence_reminder_offsets TEXT NULL` 컬럼 추가(`ALTER TABLE … ADD COLUMN`). F-24 반복 마스터 행이 사전 알림 오프셋 템플릿(JSON 배열)을 보관해, 향후 회차 실체화 시 각 회차의 `REMINDER` 행을 재구성하는 데 쓰인다. 마스터 행 자체는 `REMINDER` 행을 갖지 않는다(알림 노출면 확대 방지 — logic §13.9 유사 원칙 재사용). (3) **반복 회차 표시 필터** — `RECURRENCE_RULE`/`RECURRENCE_END_AT`/`RECURRENCE_COUNT`/`RECURRENCE_PARENT_ID` 컬럼은 v1.0(마이그레이션 001)부터 이미 존재했으나 조회 경로에 결선되지 않았던 것을 이번에 결선: `ScheduleRepository.findInRange`/`findForDashboard`/`search` 가 `recurrence_rule IS NULL` 조건을 추가해 마스터 행(반복 규칙 보유, `recurrence_rule` NOT NULL)을 표시 결과에서 제외한다(§14). 신규 인덱스는 불필요(§14 근거). §3.2 SCHEDULE 표에 `RECURRENCE_REMINDER_OFFSETS` 행 추가. §4/§8 갱신. §14 "F-24/F-06 v1.9 스키마 변경 및 마이그레이션" 신설. **F-10(완료 시 하단 이동)·F-25(완료된 일정 숨기기)·F-26(캘린더 프리필)은 스키마 무영향**(F-25 는 기존 `app_setting` EAV 테이블에 신규 키만 추가 — 마이그레이션 불요) |
| v1.7 | 2026-09-11 | plan v1.8 — F-06 유형 색상 자동 배정 / F-07 우선순위 색상 매핑 / F-10 대시보드 리스트 우선순위·유형 표시 / F-08 사전 알림 프리셋 선택 스키마 영향 검토 — **DDL·인덱스·트리거·시드 무변경**. §13 "F-06/F-07/F-08/F-10 v1.8 색상·표시 개정 스키마 영향 검토" 추가. 사유: (1) 유형 색상 자동 배정(P-59)은 이미 존재하는 `CATEGORY.COLOR TEXT NOT NULL DEFAULT '#8E8E93'`(3.1) 컬럼에 다양한 값을 저장할 뿐 — 컬럼·제약·인덱스 변경 없음, 배정 로직은 애플리케이션 계층 순수 함수(`logic.md` §5.1), (2) 기존에 고정 회색으로 이미 저장된 카테고리 행에 대한 **소급 UPDATE(백필)는 수행하지 않는다**(설계 결정, `logic.md` §5.1 — 마이그레이션 번호 부여 대상 아님), (3) 우선순위 색상 매핑(P-60)은 `SCHEDULE.PRIORITY`(기존 CHECK 제약 `HIGH/NORMAL/LOW`, 3.2)를 코드 상수로 매핑할 뿐 스키마 변경 없음, (4) 대시보드 리스트 우선순위·유형 표시(P-61)는 이미 조회되는 `SCHEDULE.PRIORITY`/`SCHEDULE.CATEGORY_ID`(+ `CATEGORY.COLOR`/`NAME` 조인 없는 별도 `CategoryService.list()` 조회)를 화면에서 렌더할 뿐 신규 쿼리·인덱스 없음, 삭제된 유형 참조(E-10-7)는 F-06 E-06-2 가 이미 트랜잭션 내에서 재지정한 `CATEGORY_ID` 를 그대로 사용, (5) 사전 알림 프리셋 선택(P-62)은 `REMINDER.OFFSET_MINUTES INTEGER`(기존 컬럼, 3.3)에 프리셋 5값(5/10/30/60/1440) 중 사용자가 고른 값을 그대로 저장 — 컬럼·제약(오프셋 개수 상한은 앱 계층 `VALIDATION_REMINDER_LIMIT`, 기존)·인덱스 변경 없음. 결론: 마이그레이션 번호 부여 없음 |
| v1.6 | 2026-09-10 | 설계 델타(overview v1.14 / logic v1.14 / nfr v1.12 — F-19 watchOS 네이티브 앱 타깃 `TodayWhatWatch` 구현 착수: Xcode 타깃·SwiftUI UI·`WCSessionDelegate`·워치 로컬 영속). **공유 SQLite 스키마 영향 없음 — DDL·인덱스·트리거·시드 무변경, `database.md` v1.5 내용 전부 유효.** §10 말미에 "v1.6 구현 착수 확인" 문단 추가. 사유: 이번 델타는 (1) `ios/` Xcode 프로젝트에 watchOS 앱 타깃 추가, (2) `ios/TodayWhatWatch/**` Swift 소스(UI·WCSession·LWW 재구현), (3) 워치 앱 컨테이너의 JSON 파일 2개(마지막 스냅샷·보류 큐) — 전부 **공유 SQLite 밖**. 폰 측은 이미 구현된 `src/core/watchSync/**` + `WatchSyncService` + `WatchConnectivityGateway` 를 그대로 사용(§10 검토 시점과 동일). LWW 는 여전히 `SCHEDULE.UPDATED_AT` 근사(N-12), dedup 원장은 `APP_SETTING` `watch.appliedOps` k/v. 새 테이블·컬럼·인덱스·`APP_SETTING` 키·마이그레이션 번호 없음 |
| v1.5 | 2026-09-10 | plan v1.7 세 번째 탭 "검색"→"통계" 교체 + 통계 화면(F-23) 스키마 영향 검토 — **DDL·인덱스·트리거·시드 무변경**. §12 "F-23 통계 화면 스키마 영향 검토" 추가. 사유: (1) 상단 카드(총/완료 건수, 전체 기간 누적 — D-21(a)/P-55)는 기존 `ScheduleService.findInRange(0, Number.MAX_SAFE_INTEGER, …)` cursor 루프 전건 스캔으로 충족 — `IDX_SCHEDULE_START`(부분 인덱스, `deleted_at IS NULL`)가 스캔 지원, 삭제분 자동 제외, (2) 하단 그래프(선택 연도 1개 × 1~12월 × 유형별 건수 — D-23(a)/P-56)는 `ScheduleService.findInRange(yearStartTs, yearEndTs, …)` `start_at` 연 범위 스캔(CalendarScreen 월 조회와 동형) + **인메모리** 월·유형 집계(순수 `statisticsViewModel.ts` + 코어 공개 `localWallToEpoch`) — 새 집계 컬럼·뷰·인덱스·GROUP BY 쿼리 없음, (3) 선택 연도는 `StatisticsScreen` 로컬 React state — 영구 저장 금지, `APP_SETTING` 키 미추가, (4) F-11 진입점 이전(검색 탭 → 캘린더 헤더, D-20(a))은 네비게이션 배선 변경 — `SCHEDULE_FTS`·검색 쿼리 무관, (5) 삭제 유형 집계(E-23-5)는 E-06-2 의 기존 `SCHEDULE.CATEGORY_ID` 재지정(트랜잭션 내 UPDATE) 결과를 그대로 반영 — 뷰모델이 현재 `category_id` 만 사용. 결론: 마이그레이션 번호 부여 없음 |
| v1.4 | 2026-09-09 | plan v1.6 대시보드 개선 **재확정 방향**(F-20 컴팩트 / **F-21 진행률 한 줄**(개수 카드 폐기) / **F-22 접이식 검색**(상시 입력창 폐기)) 스키마 영향 재검토 — **DDL·인덱스·트리거·시드 무변경**. §11 갱신. 추가 검토: (1) **진행률 한 줄**(F-21)도 `DashboardService.getSummary(referenceDate)` 의 `total`/`done` 재사용 — progress bar 채움은 UI 계산(완료율 P-07), 새 집계 컬럼·뷰 없음, (2) **`searchExpanded`**(F-22 접이식 펼침/접힘, P-53)는 `DashboardScreen` 로컬 React state — 영구 저장 금지, `APP_SETTING` 키 미추가, (3) **미래 날짜 진행률 표시**(P-52, D-19)는 `isFutureDate(referenceDate, todayStart)` 순수 표시 조건 — `getSummary` 호출·인자·결과 무변경, (4) **접힘 시 검색어 초기화**(D-18)는 화면 state 조작만. 결론 유지: 마이그레이션 번호 부여 없음 |
| v1.3 | 2026-09-09 | plan v1.5 대시보드 개선(F-20 날짜 탐색 / F-21 개수 카드 / F-22 날짜별 인라인 검색) 스키마 영향 검토 — **DDL·인덱스·트리거·시드 무변경**. §11 "F-20/F-21/F-22 대시보드 개선 스키마 영향 검토" 추가. 사유: (1) 기준 날짜(`referenceDate`)·인라인 검색어는 `DashboardScreen` 로컬 React state — 영구 저장 안 함(P-45/P-50), `APP_SETTING` 키 미추가, (2) 요약·개수 카드는 기존 `DashboardService.getSummary(dateTs)` 를 `referenceDate` 인자로 재사용(집계 규칙·쿼리 무변경, P-47), (3) 기준 날짜 목록은 기존 `ScheduleService.findInRange(dayStart, dayEnd, …)` 재사용 — `IDX_SCHEDULE_START` 가 임의-일 범위 쿼리 지원(D-13 무제한 이동 포함), (4) 인라인 검색은 이미 로드된 행 배열의 표시 계층 순수 필터 — FTS·신규 쿼리 없음(SCHEDULE_FTS 무관) |
| v1.2 | 2026-09-08 | plan v1.4 F-19(애플워치 워치 타깃 착수) 스키마 영향 검토 — **DDL·인덱스·트리거·시드 무변경**. §10 "F-19 워치 타깃 스키마 영향 검토" 추가. 사유: (1) LWW(E-19-3/P-38)는 기존 `SCHEDULE.UPDATED_AT` + 워치 스냅샷 `baseUpdatedAt` 비교로 충족, (2) 워치 완료 토글 op 중복 적용 방지 원장은 `APP_SETTING` k/v(`watch.appliedOps`)로 충족, (3) 워치 로컬 스냅샷·보류 큐는 **공유 SQLite 가 아니라 워치 앱 컨테이너 파일**, (4) 폰 측 outbound 상태 영속화 불필요(스냅샷은 온디맨드 파생) |
| v1.1 | 2026-09-07 | plan v1.3 재설계분(F-06 유형 관리 정식화 / F-18 전역 알림 토글·새 일정 기본값 / F-10 상호작용형 대시보드) 스키마 영향 검토 — **DDL·인덱스·트리거·시드 무변경**. §9 "v1.3 재설계분 스키마 영향 검토" 추가. 사유: 필요 기능이 기존 스키마로 충족(아래 §9) |
| v1.0 | 2026-09-04 | 신규 스키마 최초 설계 |

> 모델명·속성명은 UPPER_SNAKE_CASE. 실제 컬럼 식별자는 DDL에서 소문자 스네이크로 매핑(아래 DDL 참조). 본 문서는 논리 모델 표기에 UPPER_SNAKE_CASE를 사용한다.

---

## 1. 변경 목적

신규 앱의 로컬 영속 저장소를 정의한다. 대상: 일정, 카테고리, 알림 예약, 앱 설정, 캘린더 매핑, 계정 연동 상태, 검색 인덱스, 스키마 버전.

- 신규 대상: `SCHEDULE`, `CATEGORY`, `REMINDER`, `APP_SETTING`, `CALENDAR_LINK`, `ACCOUNT_LINK`, `SCHEDULE_FTS`, `SCHEMA_MIGRATION`(= `PRAGMA user_version` 보조 로그)
- 변경/삭제 대상: 없음(신규)

---

## 2. 엔티티 관계

```text
CATEGORY 1 ──< SCHEDULE >── 0..1 CALENDAR_LINK
                  │
                  └──< REMINDER

APP_SETTING   (독립 key/value)
ACCOUNT_LINK  (0..1 행, 계정 연동 상태)
SCHEDULE_FTS  (SCHEDULE의 external-content FTS5 미러)
```

- `SCHEDULE.CATEGORY_ID` → `CATEGORY.ID` (FK, ON DELETE SET DEFAULT 대체: 앱 로직에서 "기타"로 재지정 — 아래 3.1 참조)
- `REMINDER.SCHEDULE_ID` → `SCHEDULE.ID` (FK, ON DELETE CASCADE)
- `CALENDAR_LINK.SCHEDULE_ID` → `SCHEDULE.ID` (FK, ON DELETE CASCADE, UNIQUE)

---

## 3. 테이블 정의

### 3.1 CATEGORY (F-06)

| 속성 | 타입 | PK | NULL | 기본값 | 제약 | 설명 |
| --- | --- | --- | --- | --- | --- | --- |
| ID | INTEGER | Y | N | (rowid) | AUTOINCREMENT | 카테고리 식별자 |
| NAME | TEXT | | N | | UNIQUE, length 1..30 (앱 검증) | 표시명 (예: 업무/공부/취미/기타) |
| COLOR | TEXT | | N | '#8E8E93' | `#RRGGBB` 형식 (앱 검증) | 유형 색상 |
| ICON | TEXT | | Y | NULL | | 아이콘 키 |
| IS_SYSTEM | INTEGER | | N | 0 | 0/1 | 1이면 삭제 불가("기타") |
| SORT_ORDER | INTEGER | | N | 0 | | 표시 순서 |
| CREATED_AT | INTEGER | | N | | epoch ms | |
| UPDATED_AT | INTEGER | | N | | epoch ms | |

- **변경 이유**: F-06 유형 지정/필터, E-06-1 기본 유형("기타"), E-06-2 사용 중 유형 삭제 시 이동.
- 시드로 `IS_SYSTEM=1, NAME='기타'` 1행 삽입. 사용 중 카테고리 삭제 시 앱이 트랜잭션 내에서 `SCHEDULE.CATEGORY_ID`를 "기타" ID로 UPDATE 후 카테고리 DELETE.

### 3.2 SCHEDULE (F-01~F-07, F-15)

| 속성 | 타입 | PK | NULL | 기본값 | 제약 | 설명 |
| --- | --- | --- | --- | --- | --- | --- |
| ID | INTEGER | Y | N | (rowid) | AUTOINCREMENT | 일정 식별자 |
| TITLE | TEXT | | N | | length 1..200 (앱 검증) | 제목 (민감정보) |
| MEMO | TEXT | | Y | NULL | length 0..5000 (앱 검증) | 메모 (민감정보) |
| CATEGORY_ID | INTEGER | | N | | FK → CATEGORY.ID | 유형 |
| PRIORITY | TEXT | | N | 'NORMAL' | CHECK IN ('HIGH','NORMAL','LOW') | 우선순위 (D-04=3단계) |
| START_AT | INTEGER | | N | | epoch ms (UTC) | 시작 시각 |
| END_AT | INTEGER | | Y | NULL | CHECK (END_AT IS NULL OR END_AT >= START_AT) | 종료 시각 |
| TIME_ZONE | TEXT | | N | | IANA TZ (예: 'Asia/Seoul') | 생성 시 로컬 TZ (P-16) |
| IS_ALL_DAY | INTEGER | | N | 0 | 0/1 | 종일 일정 |
| IS_DONE | INTEGER | | N | 0 | 0/1 | 완료 여부 (P-04) |
| DONE_AT | INTEGER | | Y | NULL | epoch ms | 완료 시각 (P-04) |
| RECURRENCE_RULE | TEXT | | Y | NULL | CHECK IN (NULL,'DAILY','WEEKLY','MONTHLY','YEARLY') | 단순 반복 (D-05) |
| RECURRENCE_END_AT | INTEGER | | Y | NULL | epoch ms | 반복 종료일 |
| RECURRENCE_COUNT | INTEGER | | Y | NULL | > 0 | 반복 횟수(종료일과 택1) |
| RECURRENCE_PARENT_ID | INTEGER | | Y | NULL | FK → SCHEDULE.ID | 반복 회차의 원본(P-02). **v1.8부터 실사용**: 회차 행에서 마스터 행을 가리킴. 마스터 행 자체는 NULL |
| RECURRENCE_REMINDER_OFFSETS | TEXT | | Y | NULL | JSON 배열(예: `'[10,60]'`) (앱 검증) | **v1.8 신규(마이그레이션 003, F-24)**. 마스터 행(`RECURRENCE_RULE` NOT NULL)에만 채움 — 사전 알림 오프셋 템플릿. 회차 실체화 시 각 회차의 `REMINDER` 행 재구성에 사용. 그 외 모든 행(회차·비반복 일정)은 NULL |
| SOURCE | TEXT | | N | 'LOCAL' | CHECK IN ('LOCAL','CALENDAR') | 생성 출처 (F-14, P-08) |
| NOTIFY_AT_START | INTEGER | | N | 1 | 0/1 | 정시 알림 on/off (F-09) |
| CREATED_AT | INTEGER | | N | | epoch ms | |
| UPDATED_AT | INTEGER | | N | | epoch ms | 낙관적 갱신·동기화 병합 기준 |
| DELETED_AT | INTEGER | | Y | NULL | epoch ms | soft delete(삭제 Undo, OI-4/N-3) |

- **변경 이유**: 일정의 모든 필수 속성(F-01), 완료(F-05/P-04~06), 유형(F-06), 우선순위(F-07), 반복(D-05/P-01~03, v1.8 확정 F-24/P-63), 캘린더 출처(F-14/P-08), 시간대(P-16), soft delete(E-04-2).
- `RECURRENCE_END_AT`와 `RECURRENCE_COUNT`는 동시 non-null 금지(앱 검증). `RECURRENCE_RULE IS NULL`이면 나머지 recurrence 컬럼(`RECURRENCE_END_AT`/`RECURRENCE_COUNT`/`RECURRENCE_REMINDER_OFFSETS`)도 NULL(앱 검증) — 단, `RECURRENCE_PARENT_ID`는 회차 행에서 NOT NULL이면서 `RECURRENCE_RULE IS NULL`인 조합이 정상(회차는 반복하지 않음, 마스터만 가리킴).
- **v1.8(F-24) 마스터/회차 구분**: `RECURRENCE_RULE IS NOT NULL AND RECURRENCE_PARENT_ID IS NULL` = 마스터 행(반복 규칙 보유, 목록·대시보드·캘린더·검색 표시 대상 **아님**). `RECURRENCE_PARENT_ID IS NOT NULL` = 회차 행(개별 표시·완료·알림 대상, `RECURRENCE_RULE`은 항상 NULL). 둘 다 NULL이면 일반(비반복) 일정. `ScheduleRepository.findInRange`/`findForDashboard`/`search`는 `RECURRENCE_RULE IS NULL` 조건으로 마스터 행을 결과에서 제외한다(§14).

### 3.3 REMINDER (F-08, F-09, P-09, P-10)

| 속성 | 타입 | PK | NULL | 기본값 | 제약 | 설명 |
| --- | --- | --- | --- | --- | --- | --- |
| ID | INTEGER | Y | N | (rowid) | AUTOINCREMENT | |
| SCHEDULE_ID | INTEGER | | N | | FK → SCHEDULE.ID ON DELETE CASCADE | 대상 일정 |
| OFFSET_MINUTES | INTEGER | | N | | >= 0, 앱에서 상한/개수 검증 | 시작 전 분 단위 오프셋(0 = 정시) |
| KIND | TEXT | | N | 'PRE' | CHECK IN ('PRE','START') | 사전/정시 구분 |
| TRIGGER_AT | INTEGER | | N | | epoch ms | START_AT - OFFSET_MINUTES*60000 (파생, 저장으로 조회 최적화) |
| OS_REQUEST_ID | TEXT | | Y | NULL | | OS 알림 예약 식별자(취소·재예약용) |
| STATE | TEXT | | N | 'PENDING' | CHECK IN ('PENDING','SCHEDULED','FIRED','SKIPPED','CANCELLED') | 예약 상태 |
| LAST_SYNCED_AT | INTEGER | | Y | NULL | epoch ms | ReminderScheduler.sync 최종 시각 |
| CREATED_AT | INTEGER | | N | | epoch ms | |
| UPDATED_AT | INTEGER | | N | | epoch ms | |

- **변경 이유**: 오프셋당 1행(P-10 최대 5개는 앱 검증). `TRIGGER_AT` 저장으로 "다가오는 알림" 쿼리 인덱스화. `OS_REQUEST_ID`/`STATE`로 수정 시 재예약(F-03/AC-09), 삭제 시 정리(AC-10), 재부팅 복원(AC-08).
- UNIQUE(`SCHEDULE_ID`,`KIND`,`OFFSET_MINUTES`) — 동일 오프셋 중복 방지.

### 3.4 APP_SETTING (F-13, P-10-1, 설정 전반)

| 속성 | 타입 | PK | NULL | 기본값 | 설명 |
| --- | --- | --- | --- | --- | --- |
| KEY | TEXT | Y | N | | 설정 키 (예: `theme.mode`, `theme.accent`, `notif.showTitle`, `calendar.pushEnabled`, `search.minCharsWarn`) |
| VALUE | TEXT | | N | | JSON 직렬화 값 |
| UPDATED_AT | INTEGER | | N | | epoch ms |

- **변경 이유**: 테마(F-13)·알림 제목 노출 토글(P-10-1)·캘린더 쓰기 옵션(D-02) 등 단순 키/값. 재실행 유지(AC-17).

### 3.5 CALENDAR_LINK (F-14, P-08)

| 속성 | 타입 | PK | NULL | 기본값 | 제약 | 설명 |
| --- | --- | --- | --- | --- | --- | --- |
| ID | INTEGER | Y | N | | AUTOINCREMENT | |
| SCHEDULE_ID | INTEGER | | N | | FK → SCHEDULE.ID ON DELETE CASCADE, UNIQUE | 앱 일정 |
| EXTERNAL_CALENDAR_ID | TEXT | | N | | | OS 캘린더 ID |
| EXTERNAL_EVENT_ID | TEXT | | N | | UNIQUE(EXTERNAL_CALENDAR_ID, EXTERNAL_EVENT_ID) | OS 이벤트 ID |
| EXTERNAL_UPDATED_AT | INTEGER | | Y | NULL | epoch ms | 외부 최종 수정(충돌 비교) |
| SYNC_STATE | TEXT | | N | 'LINKED' | CHECK IN ('LINKED','EXTERNAL_DELETED','CONFLICT') | 병합 상태 |
| LAST_SYNCED_AT | INTEGER | | N | | epoch ms | |

- **변경 이유**: P-08 동일성 판정(외부 ID 매핑 우선), P-08-1 외부 삭제 표시, P-08-2 충돌.

### 3.6 ACCOUNT_LINK (F-12, D-01)

| 속성 | 타입 | PK | NULL | 기본값 | 제약 | 설명 |
| --- | --- | --- | --- | --- | --- | --- |
| ID | INTEGER | Y | N | | CHECK (ID = 1) | 단일 행 |
| PROVIDER | TEXT | | Y | NULL | | IdP 식별자 |
| SUBJECT | TEXT | | Y | NULL | | 계정 subject(sub) |
| DISPLAY_NAME | TEXT | | Y | NULL | | 표시명 |
| LINKED_AT | INTEGER | | Y | NULL | epoch ms | 연동 시각 |
| TOKEN_REF | TEXT | | Y | NULL | | Keychain 항목 참조 키(**토큰 값 자체는 저장 금지**) |
| STATE | TEXT | | N | 'NONE' | CHECK IN ('NONE','LINKED','EXPIRED') | 연동 상태 (E-12-2) |

- **변경 이유**: F-12 연동/해제, E-12-2 만료. 토큰은 DB가 아닌 OS 보안 저장소(보안 설계 참조).

### 3.7 SCHEDULE_FTS (F-11)

- SQLite FTS5 가상 테이블, `content='schedule'`(external content), 인덱스 컬럼: `TITLE`, `MEMO`, `CATEGORY_NAME`(트리거로 채움).
- 토크나이저: `unicode61 remove_diacritics 2`.
- 2자 미만/토큰화 실패 질의는 앱이 `LIKE '%q%'` 폴백(P-11, 결과 상한 50).
- **변경 이유**: 제목/메모/유형명 검색(P-12), 구버전 trigram 2자 제약 회피.

### 3.8 SCHEMA_MIGRATION (NFR-06, AC-24)

| 속성 | 타입 | PK | 설명 |
| --- | --- | --- | --- |
| VERSION | INTEGER | Y | 적용된 마이그레이션 번호 (= 최종값이 `PRAGMA user_version`) |
| APPLIED_AT | INTEGER | | epoch ms |
| CHECKSUM | TEXT | | 적용 SQL 해시(무결성 로그) |

---

## 4. 인덱스

| 인덱스 | 대상 | 목적 |
| --- | --- | --- |
| IDX_SCHEDULE_START | SCHEDULE(START_AT) WHERE DELETED_AT IS NULL | 기간 조회(일/주/월), 대시보드 |
| IDX_SCHEDULE_DONE_START | SCHEDULE(IS_DONE, START_AT) WHERE DELETED_AT IS NULL | 대시보드 완료/미완료 집계(F-10) |
| IDX_SCHEDULE_CATEGORY | SCHEDULE(CATEGORY_ID) WHERE DELETED_AT IS NULL | 유형 필터(AC-11) |
| IDX_SCHEDULE_PRIORITY | SCHEDULE(PRIORITY, START_AT) WHERE DELETED_AT IS NULL | 우선순위 정렬(AC-12) |
| IDX_SCHEDULE_SOURCE | SCHEDULE(SOURCE) | 캘린더 동기화 스캔 |
| IDX_SCHEDULE_RECUR_PARENT | SCHEDULE(RECURRENCE_PARENT_ID) | 반복 회차 조회(P-02). **v1.8부터 실사용**: `listOccurrenceStartTimes(masterId)`(회차 실체화 gap 탐지, soft-deleted 포함)·"이후 모두" 삭제 대상 조회 |
| IDX_REMINDER_TRIGGER_STATE | REMINDER(STATE, TRIGGER_AT) | 다가오는 알림 예약/복원(AC-08) |
| IDX_REMINDER_SCHEDULE | REMINDER(SCHEDULE_ID) | 일정별 알림 정리(AC-10) |
| IDX_CALLINK_EXTERNAL | CALENDAR_LINK(EXTERNAL_CALENDAR_ID, EXTERNAL_EVENT_ID) UNIQUE | 중복 판정(P-08) |

---

## 5. 데이터 정합성 / 마이그레이션 고려사항

- `PRAGMA foreign_keys = ON` 매 연결 시 설정.
- `PRAGMA journal_mode = WAL`(읽기/쓰기 동시성), `PRAGMA synchronous = NORMAL`.
- 쓰기 유스케이스는 단일 트랜잭션(BEGIN IMMEDIATE): 일정+알림 동시 저장, 카테고리 삭제+재지정, 캘린더 병합.
- **마이그레이션 러너**: 앱 시작 시 `PRAGMA user_version` 확인 → `migrations/NNN_*.sql`를 순서대로 적용 → 각 성공마다 `user_version` 증가 + `SCHEMA_MIGRATION` 로그. 실패 시 롤백 후 안전 모드(E-15-1): 읽기 전용 진입 + 사용자 안내. 다운그레이드는 미지원(경고 후 차단).
- 시각 컬럼은 전부 epoch ms 정수(로캘·서머타임 안전). 표시 변환은 앱 계층.
- soft delete(`DELETED_AT`) 행은 Undo 만료(N-3, 제안: 세션 종료 또는 5분) 후 백그라운드 물리 삭제 잡이 정리. FTS/알림은 soft delete 시점에 이미 제거.
- 암호화(SQLCipher) 선택 시: 최초 실행에서 32바이트 키 생성 → Keychain 저장 → `PRAGMA key`. 키 유실 시 복구 불가(백업 정책은 D-03에 종속).

---

## 6. DDL (마이그레이션 001 — 초기 스키마)

```sql
-- migrations/001_init.sql
PRAGMA foreign_keys = ON;

CREATE TABLE category (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  name         TEXT    NOT NULL UNIQUE,
  color        TEXT    NOT NULL DEFAULT '#8E8E93',
  icon         TEXT,
  is_system    INTEGER NOT NULL DEFAULT 0 CHECK (is_system IN (0,1)),
  sort_order   INTEGER NOT NULL DEFAULT 0,
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL
);

CREATE TABLE schedule (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  title                 TEXT    NOT NULL,
  memo                  TEXT,
  category_id           INTEGER NOT NULL REFERENCES category(id),
  priority              TEXT    NOT NULL DEFAULT 'NORMAL' CHECK (priority IN ('HIGH','NORMAL','LOW')),
  start_at              INTEGER NOT NULL,
  end_at                INTEGER CHECK (end_at IS NULL OR end_at >= start_at),
  time_zone             TEXT    NOT NULL,
  is_all_day            INTEGER NOT NULL DEFAULT 0 CHECK (is_all_day IN (0,1)),
  is_done               INTEGER NOT NULL DEFAULT 0 CHECK (is_done IN (0,1)),
  done_at               INTEGER,
  recurrence_rule       TEXT    CHECK (recurrence_rule IS NULL OR recurrence_rule IN ('DAILY','WEEKLY','MONTHLY','YEARLY')),
  recurrence_end_at     INTEGER,
  recurrence_count      INTEGER CHECK (recurrence_count IS NULL OR recurrence_count > 0),
  recurrence_parent_id  INTEGER REFERENCES schedule(id),
  source                TEXT    NOT NULL DEFAULT 'LOCAL' CHECK (source IN ('LOCAL','CALENDAR')),
  notify_at_start       INTEGER NOT NULL DEFAULT 1 CHECK (notify_at_start IN (0,1)),
  created_at            INTEGER NOT NULL,
  updated_at            INTEGER NOT NULL,
  deleted_at            INTEGER
);

CREATE TABLE reminder (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  schedule_id    INTEGER NOT NULL REFERENCES schedule(id) ON DELETE CASCADE,
  offset_minutes INTEGER NOT NULL CHECK (offset_minutes >= 0),
  kind           TEXT    NOT NULL DEFAULT 'PRE' CHECK (kind IN ('PRE','START')),
  trigger_at     INTEGER NOT NULL,
  os_request_id  TEXT,
  state          TEXT    NOT NULL DEFAULT 'PENDING' CHECK (state IN ('PENDING','SCHEDULED','FIRED','SKIPPED','CANCELLED')),
  last_synced_at INTEGER,
  created_at     INTEGER NOT NULL,
  updated_at     INTEGER NOT NULL,
  UNIQUE (schedule_id, kind, offset_minutes)
);

CREATE TABLE app_setting (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE calendar_link (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  schedule_id          INTEGER NOT NULL UNIQUE REFERENCES schedule(id) ON DELETE CASCADE,
  external_calendar_id TEXT    NOT NULL,
  external_event_id    TEXT    NOT NULL,
  external_updated_at  INTEGER,
  sync_state           TEXT    NOT NULL DEFAULT 'LINKED' CHECK (sync_state IN ('LINKED','EXTERNAL_DELETED','CONFLICT')),
  last_synced_at       INTEGER NOT NULL,
  UNIQUE (external_calendar_id, external_event_id)
);

CREATE TABLE account_link (
  id           INTEGER PRIMARY KEY CHECK (id = 1),
  provider     TEXT,
  subject      TEXT,
  display_name TEXT,
  linked_at    INTEGER,
  token_ref    TEXT,
  state        TEXT NOT NULL DEFAULT 'NONE' CHECK (state IN ('NONE','LINKED','EXPIRED'))
);

CREATE TABLE schema_migration (
  version    INTEGER PRIMARY KEY,
  applied_at INTEGER NOT NULL,
  checksum   TEXT
);

CREATE INDEX idx_schedule_start        ON schedule(start_at)              WHERE deleted_at IS NULL;
CREATE INDEX idx_schedule_done_start   ON schedule(is_done, start_at)     WHERE deleted_at IS NULL;
CREATE INDEX idx_schedule_category     ON schedule(category_id)           WHERE deleted_at IS NULL;
CREATE INDEX idx_schedule_priority     ON schedule(priority, start_at)    WHERE deleted_at IS NULL;
CREATE INDEX idx_schedule_source       ON schedule(source);
CREATE INDEX idx_schedule_recur_parent ON schedule(recurrence_parent_id);
CREATE INDEX idx_reminder_trigger_state ON reminder(state, trigger_at);
CREATE INDEX idx_reminder_schedule     ON reminder(schedule_id);

-- FTS5 external content + 동기화 트리거
CREATE VIRTUAL TABLE schedule_fts USING fts5(
  title, memo, category_name,
  content='schedule', content_rowid='id',
  tokenize='unicode61 remove_diacritics 2'
);

CREATE TRIGGER schedule_ai AFTER INSERT ON schedule BEGIN
  INSERT INTO schedule_fts(rowid, title, memo, category_name)
  VALUES (new.id, new.title, coalesce(new.memo,''),
          (SELECT name FROM category WHERE id = new.category_id));
END;
CREATE TRIGGER schedule_ad AFTER DELETE ON schedule BEGIN
  INSERT INTO schedule_fts(schedule_fts, rowid, title, memo, category_name)
  VALUES ('delete', old.id, old.title, coalesce(old.memo,''), '');
END;
CREATE TRIGGER schedule_au AFTER UPDATE ON schedule BEGIN
  INSERT INTO schedule_fts(schedule_fts, rowid, title, memo, category_name)
  VALUES ('delete', old.id, old.title, coalesce(old.memo,''), '');
  INSERT INTO schedule_fts(rowid, title, memo, category_name)
  VALUES (new.id, new.title, coalesce(new.memo,''),
          (SELECT name FROM category WHERE id = new.category_id));
END;
```

---

## 7. 초기 데이터 (DML — 3건 이내)

```sql
-- 시스템 기본 카테고리 (E-06-1)
INSERT INTO category (name, color, icon, is_system, sort_order, created_at, updated_at)
VALUES ('기타', '#8E8E93', 'dots', 1, 100, 1756944000000, 1756944000000);

-- 기본 설정
INSERT INTO app_setting (key, value, updated_at)
VALUES ('theme.mode', '"system"', 1756944000000);

INSERT INTO app_setting (key, value, updated_at)
VALUES ('notif.showTitle', 'true', 1756944000000);
```

---

## 8. 논리 모델 ↔ DDL 매핑

| 논리(UPPER_SNAKE_CASE) | 물리 테이블/컬럼 |
| --- | --- |
| CATEGORY / SCHEDULE / REMINDER / APP_SETTING / CALENDAR_LINK / ACCOUNT_LINK / SCHEDULE_FTS / SCHEMA_MIGRATION | category / schedule / reminder / app_setting / calendar_link / account_link / schedule_fts / schema_migration |
| SCHEDULE.CATEGORY_ID, START_AT, IS_DONE, DONE_AT … | schedule.category_id, start_at, is_done, done_at … |
| SCHEDULE.RECURRENCE_REMINDER_OFFSETS (v1.8, 마이그레이션 003) | schedule.recurrence_reminder_offsets |

---

## 9. v1.3 재설계분 스키마 영향 검토 (스키마 무변경) — v1.1

`plan.md` v1.3 이 정식화한 F-06(유형 관리)·F-18(앱 설정)·F-10(상호작용형 대시보드)에 대해 스키마 변경 필요성을 검토한 결과 **DDL·인덱스·트리거·초기 데이터 모두 변경 없음**. 근거:

| 요구 (plan v1.3) | 필요 저장 요소 | 기존 스키마 충족 방식 | 변경 |
| --- | --- | --- | --- |
| F-06 일정→유형 **ID 참조**, 이름변경 시 참조 유지·표시 라벨만 갱신(P-34, AC-39) | 일정이 유형을 식별자로 참조 | `SCHEDULE.CATEGORY_ID INTEGER NOT NULL REFERENCES category(id)` (3.2) — 이미 ID FK. `CATEGORY.NAME` 만 UPDATE 하면 그 유형을 쓰는 모든 일정의 조인 결과가 새 이름. `schedule_au` 트리거가 FTS `category_name` 도 재색인 | 없음 |
| F-06 기본 유형("기타") 보호 — 삭제·이름변경 불가(P-34, E-06-5) | 시스템 유형 플래그 | `CATEGORY.IS_SYSTEM INTEGER NOT NULL DEFAULT 0` (3.1) + 시드 `IS_SYSTEM=1, NAME='기타'` (7장). 보호는 `CategoryService` 가 `is_system` 확인 후 `POLICY_SYSTEM_CATEGORY_*` (logic §5.1) | 없음 |
| F-06 유형 이름 유일성 — 트림 + 대소문자 무시(P-34, E-06-4) | 이름 중복 방지 | `CATEGORY.NAME TEXT NOT NULL UNIQUE` (3.1) = 바이너리 유일성 백스톱. **정규화 비교(트림 + `toLowerCase`)는 앱 계층**(`CategoryService.create/rename`, logic §5.1)에서 `list()` 대조로 강제. 한국어는 대소문자 개념이 없어 실질 트림 + ASCII 케이스 폴딩 — DB 콜레이션 변경(테이블 재빌드)의 이득이 낮고 NFR-06(마이그레이션 리스크) 대비 불리하므로 앱 계층 강제 채택 | 없음 |
| F-06 사용 중 유형 삭제 → 소속 일정 "기타" 재지정(E-06-2) | 재지정 + 삭제 원자성 | `ScheduleRepository.reassignCategory` UPDATE + `category` DELETE 를 단일 TX (logic §5, 이미 구현·V-17) | 없음 |
| F-18 전역 알림 사용 토글(`notif.enabled`), 새 일정 기본값(`schedule.defaultPriority`, `schedule.defaultCategoryId`) | 키/값 설정 3개 | `APP_SETTING(KEY TEXT PK, VALUE TEXT, UPDATED_AT)` (3.4) — 임의 키 저장. 미저장 키는 앱 fallback(`notif.enabled`→true, 나머지→null). 시드 불요(§7 DML "3건 이내" 유지) | 없음 |
| F-18 전역 알림 off 전환 시 기존 예약 일괄 취소(D-07 (a)) | 취소 상태 표현 | `REMINDER.STATE` CHECK 에 `'CANCELLED'` **이미 포함** (3.3). `applyGlobalNotificationsToggle` 가 OS 취소 후 `state='CANCELLED'` (logic §6). `IDX_REMINDER_TRIGGER_STATE(STATE, TRIGGER_AT)` 로 활성 알림 스캔 | 없음 |
| F-10 상호작용형 대시보드 — 인라인 완료 토글·스와이프 삭제, 요약(완료율·유형별 분포·다음 예정) | 완료 상태·유형별 집계·soft delete | `SCHEDULE.IS_DONE/DONE_AT/DELETED_AT` (3.2) + `IDX_SCHEDULE_DONE_START`·`IDX_SCHEDULE_CATEGORY` (4장). 요약은 `DashboardService.getSummary` 집계 쿼리, 목록은 `findInRange` — 둘 다 기존 인덱스 사용 | 없음 |
| F-10/F-02 페이지네이션 설계값 승격(`DASHBOARD_PAGE_SIZE` 등) | keyset cursor 조회 | `IDX_SCHEDULE_START ON schedule(start_at) WHERE deleted_at IS NULL` (4장) 이 `(start_at, id)` keyset 지원 | 없음 |

**결론**: 마이그레이션 번호 부여 없음. `migrations/001_init.sql` 이 현행 요구를 그대로 지원한다.

---

## 10. F-19 애플워치 워치 타깃 스키마 영향 검토 (공유 스키마 무변경) — v1.2

`plan.md` v1.4 F-19(오늘 목록 조회 + 완료/미완료 토글 중심의 애플워치 축소 클라이언트)에 대해 **공유 SQLite 스키마 변경 필요성**을 검토한 결과 **DDL·인덱스·트리거·초기 데이터 모두 변경 없음**. 근거:

| 요구 (plan v1.4) | 필요 저장 요소 | 기존 스키마 충족 방식 | 변경 |
| --- | --- | --- | --- |
| P-36 폰(SQLite) = 유일 원본, 워치는 독립 저장소 없음(A-2) | — | 워치로 내려보내는 것은 **파생 스냅샷**(logic §17.3). 폰에 워치 전용 테이블 불필요 | 없음 |
| P-40 워치 페이로드 = "오늘 일정 + 다음 예정 1건" | 오늘 범위 조회 + 다음 예정 1건 | `ScheduleRepository.findForDashboard(dayStart, dayEnd)` + `findInRange(now, MAX, {isDone:false}, 'startAt', 1)` — `DashboardService.getSummary` 와 동일 소스. `IDX_SCHEDULE_START`·`IDX_SCHEDULE_DONE_START` 사용 | 없음 |
| P-39 시각 = epoch ms + IANA tz | 시작 시각·생성 시 tz | `SCHEDULE.START_AT`(epoch ms) + `SCHEDULE.TIME_ZONE`(IANA) — 이미 존재. 워치는 표시 시점에만 로컬 변환 | 없음 |
| E-19-3 / P-38 완료 토글 LWW(Last-Write-Wins) | 완료 상태의 마지막 변경 시각 비교 | `SCHEDULE.UPDATED_AT`(epoch ms, 낙관적 갱신 기준 — `toggleDone`/`update` 가 매 변경 시 `clock.now()` 로 갱신) + 워치 op 의 `baseUpdatedAt`(워치가 받은 스냅샷 항목의 `updatedAt`) 비교(logic §17.6). **전용 타임스탬프 컬럼 미추가** — 근사 LWW. 잔여 부정확(완료 무관 편집이 워치 토글보다 나중이면 워치 토글 드롭)은 residual risk(overview N-12, logic §17.6). 필드 수준 정밀 LWW(전용 `DONE_CHANGED_AT`)는 스키마 변경 수반이라 후속 | 없음 |
| E-19-1 / P-38 워치 오프라인 완료 토글 보류 큐 | 대기 중 완료 토글 op | **워치 앱 컨테이너의 로컬 파일**(JSON: `WatchToggleOp[]`) — watchOS 앱 소관, 공유 SQLite 아님. 폰은 `transferUserInfo`(OS 보장 FIFO 큐)로 수신 | 없음 (공유 DB 무관) |
| E-19-1 워치 마지막 스냅샷 오프라인 조회 | 마지막 수신 스냅샷 | **워치 앱 컨테이너의 로컬 파일**(JSON: `WatchSnapshot`) — watchOS 앱 소관. 데이터 보호 클래스 적용(logic §13.9) | 없음 (공유 DB 무관) |
| 워치 완료 토글 op 중복 적용 방지(재전송·앱 재시작) | 최근 처리한 opId 원장 | `APP_SETTING(KEY TEXT PK, VALUE TEXT, UPDATED_AT)` — `watch.appliedOps` = 최근 50 `{opId, ts}` 링버퍼 JSON. 임의 키 저장 가능, 시드 불요(§7 DML "3건 이내" 유지) | 없음 |
| 폰 측 outbound(워치로 보낼) 상태 영속화 | — | 불필요. 스냅샷은 전송 시점에 온디맨드 파생(`buildWatchSnapshot`). `updateApplicationContext` 가 "최신 1건"만 유지하므로 폰이 미전송 큐를 들 필요 없음 | 없음 |
| P-41 워치 알림 독립 예약 금지 | — | 워치 스냅샷에 REMINDER 데이터 미포함(logic §17.7). `REMINDER` 테이블 무관 | 없음 |
| P-44 Android Wear OS 비범위 | — | Wear Data Layer·별도 저장 이번 릴리스 미구현(OI-11) | 없음 |

**결론**: 마이그레이션 번호 부여 없음. F-19 는 `migrations/001_init.sql` + `APP_SETTING` k/v 로 충족한다. 워치 로컬 영속화(스냅샷·보류 큐)는 watchOS 앱의 파일 저장이며 본 문서(공유 SQLite 스키마)의 대상이 아니다 — 형태·보호 규약은 `logic.md` §17.5 / §13.9.

**v1.6 구현 착수 확인 (overview v1.14 / logic v1.14 / nfr v1.12)**: watchOS 네이티브 앱 타깃 `TodayWhatWatch` 를 실제로 추가·구현하는 이번 델타에서도 위 표의 결론은 그대로다. 워치 앱은 `src/core` 를 링크하지 않고 폰이 보낸 `WatchSnapshot`(JSON)만 소비하며, 워치 로컬의 마지막 스냅샷 파일 1개 + 보류 큐 파일 1개(둘 다 `FileProtectionType.complete`, `logic.md` §13.9)로 오프라인 조회·완료 토글을 지속한다. 폰 측 저장 경로(`SCHEDULE`·`APP_SETTING watch.appliedOps`)는 `WatchSyncService.applyIncomingToggle` 이 이미 사용 중인 것과 동일 — 새 스키마 요소·마이그레이션 없음.

---

## 11. F-20 / F-21 / F-22 대시보드 개선 스키마 영향 검토 (스키마 무변경) — v1.3 / v1.4 재확정 방향

`plan.md` v1.6 의 대시보드("오늘" 탭) 개선 재확정 방향 — F-20(좌/우 화살표 날짜 네비게이션 + "오늘로" 복귀, 시각적으로 작게), F-21(기준 날짜 **진행률 한 줄**: "M / N 완료" 텍스트 + progress bar 1개; 미래 날짜는 총 개수만), F-22(**접이식** 검색 아이콘 토글 → 기준 날짜 목록 내 제목·메모 필터) — 에 대해 로컬 저장소 변경 필요성을 재검토한 결과 **DDL·인덱스·트리거·초기 데이터 모두 변경 없음**. 근거:

| 요구 (plan v1.6) | 필요 저장/조회 요소 | 기존 스키마 충족 방식 | 변경 |
| --- | --- | --- | --- |
| P-45 대시보드 "기준 날짜" 상태 (기본 오늘, ±1일 이동, 영구 저장 금지) | — | `DashboardScreen` 로컬 React state(`referenceDate`: 로컬 자정 epoch ms). `APP_SETTING`·파일·Zustand 어디에도 쓰지 않음(logic §16.3.7). 재마운트 시 순수 `startOfLocalDay(clock.now(), tz)` (`Clock` 포트 = now/timeZone만, DASH-01 정정) | 없음 |
| P-50 접이식 검색어 생명주기 (영구 저장 금지, 특정 시점 초기화) | — | `DashboardScreen` 로컬 state(`inlineQuery`: string) | 없음 |
| P-53 접이식 검색 펼침/접힘 상태 (기본 접힘, 영구 저장 금지) | — | `DashboardScreen` 로컬 state(`searchExpanded`: boolean, 기본 false). `APP_SETTING` 키 미추가. 탭 이탈·재시작 시 `false` 리셋(logic §16.3.7) | 없음 |
| P-47 진행률 한 줄 지표 (기준 날짜 총 일정 수 / 완료 일정 수, 기존 F-10 요약과 동일 집계 규칙) | 기준 날짜 범위 집계 | 기존 `DashboardService.getSummary(dateTs)` 를 `dateTs = referenceDate` 로 호출 — 내부 `startOfLocalDay(dateTs)` / `findForDashboard(dayStart, dayEnd)`. `IDX_SCHEDULE_DONE_START`·`IDX_SCHEDULE_START` 재사용. progress bar 채움 비율(`done/total`)은 UI 계산(완료율 P-07). **새 집계 컬럼·뷰·쿼리 없음** | 없음 |
| P-52 / D-19 미래 기준 날짜 진행률 한 줄 = 총 개수만 (progress bar·완료 수 숨김) | — | `isFutureDate(referenceDate, todayStart)`(`referenceDate > todayStart`) 순수 표시 조건. `getSummary` 호출·인자·결과 무변경 — 화면이 표시만 분기 | 없음 |
| F-20 임의 날짜(과거·미래, D-13 무제한)의 요약·목록 조회 | 임의 하루 범위 스캔 | `ScheduleService.findInRange(dayStart, dayEnd, undefined, 'startAt', DASHBOARD_PAGE_SIZE, cursor)` — CalendarScreen 월 범위 조회와 동형. `IDX_SCHEDULE_START`(`start_at` 오름차순, soft-deleted 제외 부분 인덱스)가 keyset cursor + 범위 조건 지원 | 없음 |
| P-46 자정 경과 시 기준 날짜 롤오버 분기 | 현재 로컬 자정 | 순수 `startOfLocalDay(clock.now(), tz)`. 화면이 이전 `todayStart` 대비 판별(logic §16.3.7). 저장 요소 없음 | 없음 |
| P-48 / F-22 접이식 검색 (기준 날짜 목록 내 제목·메모, 대소문자·공백 무시, D-15) | 이미 로드된 행의 부분 문자열 매칭 | **표시 계층 순수 필터** — `items.filter(x => norm(x.title).includes(q) \|\| norm(x.memo??'').includes(q))`. SQL·`SCHEDULE_FTS`·`SearchService` 미경유. `SCHEDULE.TITLE`/`SCHEDULE.MEMO` 는 이미 조회된 행에 포함 | 없음 |
| P-49 / D-16 접이식 검색이 진행률 한 줄·요약에 미반영 | — | 진행률 한 줄·요약은 `getSummary(referenceDate)` 결과 그대로(검색어 무관). 필터는 목록 렌더에만 | 없음 |
| D-18 접이식 검색창 접힘 시 검색어 초기화 + 필터 해제 | — | `toggleSearch()` 가 `searchExpanded=false` 시 `setInlineQuery('')` — 화면 state 조작만(E-22-6) | 없음 |
| P-51 접이식 검색(F-22) ↔ 전역 검색(F-11) 독립 | — | 접이식 = 화면 로컬 state, 전역 = `search` Zustand 슬라이스 + `SCHEDULE_FTS`. 공유 저장 요소 없음 | 없음 |
| OI-19 과거/미래 기준일에서 FAB 추가 시 시작 일시 프리필 | 네비게이션 파라미터 | `routes.ts` `ScheduleEditor { presetDate?: number }` (라우트 타입, DB 아님). `SCHEDULE.START_AT` 저장 형식 무변경 | 없음 |

**결론**: 마이그레이션 번호 부여 없음. F-20/F-21/F-22(v1.6 재확정 방향 포함)는 `migrations/001_init.sql` 스키마와 기존 `IDX_SCHEDULE_START` / `IDX_SCHEDULE_DONE_START` 인덱스로 충족한다. 기준 날짜·검색어·`searchExpanded` 는 영속 데이터가 아니다(화면 로컬 state, P-45/P-50/P-53). 신규 `APP_SETTING` 키도 없다. 진행률 한 줄·미래 날짜 분기는 기존 `getSummary` 결과의 UI 표현일 뿐이다.

---

## 12. F-23 통계 화면 스키마 영향 검토 (스키마 무변경) — v1.5

`plan.md` v1.7 의 세 번째 탭 "검색" → "통계" 교체 + 통계 화면(F-23) — 상단 총/완료 건수 카드 2장(전체 기간 누적, 삭제분 제외 — D-21(a)/P-55) + 하단 선택 연도의 유형별 월별 건수 그래프(x축 1~12월, 월 버킷 = `start_at` 로컬 달 — D-23(a)/P-56) — 에 대해 로컬 저장소 변경 필요성을 검토한 결과 **DDL·인덱스·트리거·초기 데이터 모두 변경 없음**. 집계는 `src/app/screens/statisticsViewModel.ts` 순수 함수가 기존 조회 결과를 **인메모리**로 수행한다(`logic.md` §7.2 / §16.3.8). 근거:

| 요구 (plan v1.7) | 필요 저장/조회 요소 | 기존 스키마 충족 방식 | 변경 |
| --- | --- | --- | --- |
| P-55 상단 카드 "총 할 일 건수" (전체 기간 누적, 완료·미완료 무관, 삭제분 제외) | 전건 count | `ScheduleService.findInRange(0, Number.MAX_SAFE_INTEGER, undefined, 'startAt', STATISTICS_PAGE_SIZE, cursor)` 를 `nextCursor` 소진까지 루프 → 행 수. `IDX_SCHEDULE_START ON schedule(start_at) WHERE deleted_at IS NULL`(4장) 부분 인덱스가 전건 스캔 + keyset cursor 지원. `deleted_at IS NULL` 조건이 인덱스에 내장되어 삭제분 자동 제외(P-55). **새 count 쿼리·집계 컬럼 없음** | 없음 |
| P-55 상단 카드 "완료된 건수" (완료 상태 P-04) | 완료 count | 위 동일 결과를 뷰모델이 `rows.filter(r => r.isDone).length`. `SCHEDULE.IS_DONE`(기존 컬럼) 재사용. `IDX_SCHEDULE_DONE_START` 도 활용 가능하나 인메모리 필터로 충분 | 없음 |
| P-56 / D-23(a) 하단 그래프 선택 연도의 월별·유형별 건수 (월 버킷 = `start_at`) | 연 범위 스캔 + 월·유형 그룹 | `ScheduleService.findInRange(yearStartTs, yearEndTs, undefined, 'startAt', STATISTICS_PAGE_SIZE, cursor)` 루프 — `yearStartTs`/`yearEndTs` 는 뷰모델이 순수 `localWallToEpoch(year, m, 1, 0, 0, clock.timeZone())`(`src/core/domain/time.ts`, 기존 공개)로 산출. `IDX_SCHEDULE_START` 범위 스캔(CalendarScreen 월 조회와 동형). 월 버킷·`category_id` 그룹은 **인메모리**(`SCHEDULE.CATEGORY_ID` 기존 컬럼). **GROUP BY SQL·집계 뷰·연·월 파생 컬럼 없음** | 없음 |
| P-58 / D-22(a) 반복 일정 카운트 단위 = 개별 인스턴스, 대시보드/캘린더와 동일 | — | 통계는 F-10 대시보드·F-02 캘린더와 **동일한 `ScheduleService.findInRange` 저장 행**을 센다 → 카운트 단위 자동 일치. 현 구현은 범위 조회가 반복 회차를 확장하지 않음(`RECURRENCE_*` 컬럼은 마스터 1행에만) | 없음 |
| P-57 / E-23-5 삭제된 유형에 속했던 일정 → "기타" 집계 | — | F-06 E-06-2 가 이미 트랜잭션 내에서 `SCHEDULE.CATEGORY_ID` 를 system default("기타") id 로 UPDATE 후 유형 DELETE. 뷰모델은 행의 **현재 `category_id`** 만 사용 → "기타" 계열로 합산. 삭제 유형 이름 스냅샷 보존 안 함(OI-25 후속) | 없음 |
| R-23-4 유형 이름변경 → 그래프 계열 라벨 새 이름 | — | 계열 키 = `category_id`(FK 참조 유지), 라벨 = `CATEGORY.NAME` 현재값을 `CategoryService.list()` 로 조회. `CATEGORY.NAME` UPDATE(rename)만으로 반영(DDL 무변경) | 없음 |
| 선택 연도 상태 (기본 올해, 영구 저장 금지) | — | `StatisticsScreen` 로컬 React state(`selectedYear: number`). `APP_SETTING`·파일·Zustand 어디에도 쓰지 않음(`logic.md` §16.3.8). 탭 이탈·재시작 시 올해로 리셋 | 없음 |
| D-20(a) F-11 전역 검색 진입점을 캘린더 헤더로 이전 | — | `SearchScreen`(Tab → Stack 라우트 이동) + `CalendarScreen` 헤더 아이콘 → 네비게이션 배선(`routes.ts`). `SCHEDULE_FTS` 가상 테이블·FTS 트리거·검색 쿼리 무변경(P-54) | 없음 |
| E-23-4 통계 로드/집계 실패 | — | 화면 재시도 UI(E-02-2 준용). 저장 요소 없음 | 없음 |

**인덱스 추가 검토**: 하단 그래프의 월·유형 그룹핑을 SQL 로 옮기면 `(start_at, category_id)` 복합 커버링 인덱스가 행 조회를 줄일 수 있으나, (1) 집계는 인메모리 뷰모델에서 수행하므로 조회는 기존 keyset 경로 그대로이고, (2) 대상 규모가 단일 사용자·연 ~2,000건(§2)·화면 진입 시 1회이며, (3) 인덱스 추가는 모든 `schedule` insert/update 에 쓰기 비용을 더한다. → **추가하지 않는다.** 기존 `IDX_SCHEDULE_START` 로 충분.

**결론**: 마이그레이션 번호 부여 없음. F-23 은 `migrations/001_init.sql` 스키마와 기존 `IDX_SCHEDULE_START` / `IDX_SCHEDULE_DONE_START` 인덱스로 충족한다. 상단 카드·하단 그래프 모두 기존 `ScheduleService.findInRange` + `CategoryService.list()` 결과의 인메모리 집계(순수 뷰모델)이며, 신규 테이블·컬럼·인덱스·트리거·`APP_SETTING` 키가 없다. 선택 연도는 영속 데이터가 아니다.

---

## 13. F-06/F-07/F-08/F-10 v1.8 색상·표시 개정 스키마 영향 검토 (스키마 무변경) — v1.7

`plan.md` v1.8 이 확정한 4개 항목 — (1) 유형(카테고리) 색상 자동 배정(P-59) (2) 우선순위 색상 매핑(P-60) (3) 대시보드 리스트 아이템의 우선순위·유형 표시(P-61) (4) 사전 알림 프리셋 선택(P-62) — 에 대해 로컬 저장소 변경 필요성을 검토한 결과 **DDL·인덱스·트리거·초기 데이터 모두 변경 없음**. 근거:

| 요구 (plan v1.8) | 필요 저장/조회 요소 | 기존 스키마 충족 방식 | 변경 |
| --- | --- | --- | --- |
| P-59 새 유형 추가 시 기존 유형과 구별되는 색상 자동 배정(E-06-7 폴백 포함) | 유형별 색상값 저장 | `CATEGORY.COLOR TEXT NOT NULL DEFAULT '#8E8E93'`(3.1, **기존 컬럼**)에 `CategoryService.create()`(앱 계층 순수 함수 `assignCategoryColor`, `logic.md` §5.1)가 계산한 값을 저장. 컬럼 타입·제약·기본값·인덱스 모두 무변경 — "자동 배정"은 **저장 전 애플리케이션 로직**일 뿐 DB 구조와 무관 | 없음 |
| — 기존에 고정 회색으로 이미 생성된 카테고리의 처리(요청 사항 — 마이그레이션/재배정 필요 여부 판단) | — | **소급 재배정(백필) 없음** — `CategoryService.create()` 는 신규 호출부터만 적용되고, 이미 저장된 행의 `COLOR` 값을 일괄 UPDATE 하는 마이그레이션 스크립트를 추가하지 않는다(설계 결정, `logic.md` §5.1 근거 참조). 스키마·DDL 변경이 없으므로 마이그레이션 번호 부여 대상 자체가 아니다 | 없음 |
| P-60 우선순위 색상 매핑(높음/보통/낮음 = 빨강/오렌지/연두 계열, 정확한 헥스값) | — | `SCHEDULE.PRIORITY TEXT NOT NULL DEFAULT 'NORMAL' CHECK IN ('HIGH','NORMAL','LOW')`(3.2, **기존 컬럼·기존 CHECK 제약**). 색상 매핑은 코드 상수(`PRIORITY_COLORS`, `logic.md` §5.2)이며 DB 에는 저장하지 않는다(파생 표시값) | 없음 |
| P-61 대시보드 리스트 항목에 우선순위·유형 시각 표시 | 이미 조회되는 필드 | 우선순위 점 = `SCHEDULE.PRIORITY`(이미 `ScheduleService.findInRange` 결과에 포함). 유형 배지 = `SCHEDULE.CATEGORY_ID` 로 `CategoryService.list()`(기존 메서드) 결과를 화면에서 조인(인메모리 `Map`) — SQL JOIN·신규 쿼리·신규 인덱스 없음 | 없음 |
| E-10-7 삭제된 유형을 참조하던 항목의 표시 | — | F-06 E-06-2 가 이미 트랜잭션 내에서 `SCHEDULE.CATEGORY_ID` 를 system default("기타") id 로 UPDATE 후 유형 DELETE(3.1/3.2 기존 로직, `database.md` §9). 대시보드는 그 `CATEGORY_ID` 를 그대로 조회하므로 자동으로 "기타"의 라벨/색이 나온다 — 신규 컬럼·플래그 불필요 | 없음 |
| P-62 사전 알림 오프셋 5개 프리셋(5/10/30/60/1440분) 중 다중 선택(0개 이상) | 오프셋 값 저장 | `REMINDER.OFFSET_MINUTES INTEGER NOT NULL`(3.3, **기존 컬럼**, `>= 0` 제약)에 프리셋 값을 그대로 저장 — 프리셋이라는 개념은 UI 레벨 선택지일 뿐 저장 형식은 기존과 동일한 "분 단위 정수". 오프셋 개수 상한(P-10, 최대 5)은 기존 앱 계층 검증(`VALIDATION_REMINDER_LIMIT`)이 그대로 담당 — DB 제약 추가 없음. `UNIQUE(SCHEDULE_ID,KIND,OFFSET_MINUTES)`(3.3) 도 기존 그대로 중복 오프셋 방지 | 없음 |
| E-08-6 0개 선택 시 사전 알림 없이 저장 | — | `REMINDER` 테이블에 해당 일정의 `KIND='PRE'` 행이 0건인 상태 — 기존 `ReminderRepository.replaceForSchedule` 로직이 빈 배열을 받으면 기존 행을 전부 지우고 아무 것도 새로 만들지 않는 것과 동일(기존 동작, 신규 아님) | 없음 |

**결론**: 마이그레이션 번호 부여 없음. 4개 항목 모두 `migrations/001_init.sql` 의 기존 `CATEGORY.COLOR`/`SCHEDULE.PRIORITY`/`SCHEDULE.CATEGORY_ID`/`REMINDER.OFFSET_MINUTES` 컬럼과 기존 제약(CHECK/UNIQUE/DEFAULT)만으로 충족된다. 신규 테이블·컬럼·인덱스·트리거·`APP_SETTING` 키가 없다. 색상 자동 배정·삭제된 유형 재지정 표시는 전부 **애플리케이션(코어 서비스·화면) 계층의 로직**이며 DB 구조 변경을 요구하지 않는다. 기존 카테고리에 대한 소급 색상 재배정은 이번 릴리스에서 하지 않기로 결정했으므로 관련 백필 마이그레이션도 존재하지 않는다.

---

## 14. F-24 반복 일정 실체화 · F-06 기본 유형 4종 시딩 — 스키마 변경 및 신규 마이그레이션 — v1.8

`plan.md` v1.9 가 확정한 F-24(반복 일정)·F-06 개정(기본 유형 4종 시딩)에 대해 검토한 결과, **이번 버전에서 최초로 실제 스키마 변경(마이그레이션 002/003)이 발생**한다. F-10(완료 시 하단 이동)·F-25(완료된 일정 숨기기)·F-26(캘린더 프리필)은 무영향이며 §14 말미에 근거만 남긴다.

### 14.1 F-24 반복 일정 — DDL 변경 (마이그레이션 003)

`recurrence_rule`/`recurrence_end_at`/`recurrence_count`/`recurrence_parent_id`(전부 `migrations/001_init.sql`부터 존재)는 이번 릴리스에서 최초로 실사용된다(logic.md §18 — 조회 경로 결선 이전에는 죽은 컬럼이었음). 마스터 행(반복 규칙 보유)과 회차 행(개별 표시·완료·알림 대상)을 분리하는 실체화 전략을 위해 사전 알림 오프셋 템플릿을 보관할 컬럼이 하나 더 필요하다 — **마스터 행은 `REMINDER` 행을 직접 갖지 않으므로**(알림 노출면 확대 방지, 마스터는 목록·알림 대상이 아님) 오프셋 목록을 별도로 저장해야 향후 회차 생성 시 재사용할 수 있다.

```sql
-- migrations/003_recurrence_reminder_offsets.sql
ALTER TABLE schedule ADD COLUMN recurrence_reminder_offsets TEXT;
```

- **NULL 규칙**: 마스터 행(`recurrence_rule IS NOT NULL AND recurrence_parent_id IS NULL`)만 non-NULL(JSON 배열 문자열, 예: `'[10,60]'`). 회차 행·비반복 일정은 항상 NULL(앱 검증).
- **인덱스 불필요**: 이 컬럼은 회차 실체화(`RecurrenceScheduler`) 시점에만 읽히며, 조건절에 쓰이지 않는다(오직 값 자체를 읽어 JSON 파싱). 조회 빈도가 매우 낮고(활성 반복 시리즈당 1회/실체화 사이클) 대상 행 수가 마스터 행으로 국한되어 인덱스 없이도 성능 영향이 없다(`nfr.md` §17.1).
- **하위 호환**: `ALTER TABLE … ADD COLUMN` 은 기존 행에 자동으로 NULL을 채우며 기존 쿼리·인덱스·제약에 영향을 주지 않는다.

### 14.2 F-24 반복 일정 — 조회 필터 결선 (DDL 무변경, 조회 로직 변경)

기존 `RECURRENCE_RULE`/`RECURRENCE_PARENT_ID` 컬럼 조합으로 "마스터 행(비표시)"과 "회차 행(표시)"을 구분한다(§3.2 갱신 참조). `ScheduleRepository.findInRange`/`findForDashboard`/`search`(코어 어댑터 SQL)에 `WHERE … AND recurrence_rule IS NULL` 조건을 추가해 마스터 행을 표시 결과에서 제외한다.

- **신규 인덱스 불필요**: 마스터 행은 사용자당 활성 반복 시리즈 수만큼만 존재(§2 용량 가정상 극소수, 통상 수십 건 이하)이므로, 기존 `IDX_SCHEDULE_START`/`IDX_SCHEDULE_DONE_START`(부분 인덱스, `WHERE deleted_at IS NULL`) 로 range 를 좁힌 뒤 추가 조건 `recurrence_rule IS NULL` 을 평가하는 비용은 무시할 수준이다.
- `IDX_SCHEDULE_RECUR_PARENT`(§4, 기존 인덱스, 이번에 최초로 실사용)는 `listOccurrenceStartTimes(masterId)`(회차 실체화 시 gap 탐지 — **soft-deleted 포함 전체 조회**, 삭제된 회차 재생성 방지)와 "이후 모두" 삭제 대상 조회(`findInRange` 확장 필터 `recurrenceParentId`)를 지원한다.
- `ScheduleFilter`(코어 타입, 논리 모델 아님)에 `recurrenceParentId?` 필터 항목 추가는 애플리케이션 계층 타입 변경으로 DDL 과 무관.

### 14.3 F-06 기본 유형 4종 시딩 — DML 변경 (마이그레이션 002)

`알림앱.md` 추가기능 원문("기본 유형추가 : 공부, 취미, 업무")과 plan P-65/E-06-8/D-27(a)에 따라, 신규 설치자와 기존 사용자 모두에게 3종을 추가 시딩한다. 스키마 러너가 버전 기반이므로 신규 설치자는 001→002→003 을 연속 적용하고, 기존 사용자는 다음 실행 시 002→003 만 적용받아 동일한 최종 상태에 도달한다.

```sql
-- migrations/002_seed_default_categories.sql
INSERT INTO category (name, color, icon, is_system, sort_order, created_at, updated_at)
SELECT '공부', '#00897B', NULL, 0, 101, (CAST(strftime('%s','now') AS INTEGER) * 1000), (CAST(strftime('%s','now') AS INTEGER) * 1000)
WHERE NOT EXISTS (SELECT 1 FROM category WHERE lower(trim(name)) = lower('공부'));

INSERT INTO category (name, color, icon, is_system, sort_order, created_at, updated_at)
SELECT '취미', '#00ACC1', NULL, 0, 102, (CAST(strftime('%s','now') AS INTEGER) * 1000), (CAST(strftime('%s','now') AS INTEGER) * 1000)
WHERE NOT EXISTS (SELECT 1 FROM category WHERE lower(trim(name)) = lower('취미'));

INSERT INTO category (name, color, icon, is_system, sort_order, created_at, updated_at)
SELECT '업무', '#039BE5', NULL, 0, 103, (CAST(strftime('%s','now') AS INTEGER) * 1000), (CAST(strftime('%s','now') AS INTEGER) * 1000)
WHERE NOT EXISTS (SELECT 1 FROM category WHERE lower(trim(name)) = lower('업무'));
```

- **색상**: `CATEGORY_COLOR_PALETTE[0..2]`(`logic.md` §5.1 `categoryColor.ts`)를 그대로 하드코딩 — 마이그레이션은 순수 SQL이라 TS 함수를 호출할 수 없으므로, "최초-미사용 탐색" 배정 결과와 동일한 값을 직접 대입해 이후 사용자가 4번째 유형을 추가할 때 `assignCategoryColor`가 자연히 팔레트 인덱스 3부터 이어받는다(색상 충돌 없음).
- **idempotent 존재 확인**: `WHERE NOT EXISTS (… lower(trim(name)) = lower(X))` 로 대소문자·앞뒤공백 무시 비교(E-06-8). 이미 동일 이름의 사용자 정의 유형이 있으면 새로 만들지 않고 기존 유형을 그대로 사용— 단, `category.name` 의 `UNIQUE` 제약 자체는 SQLite 기본 대소문자 구분 비교이며 이는 기존(v1.0)부터의 특성으로 이번 변경 범위가 아니다.
- **`created_at`/`updated_at`**: 마이그레이션 001의 초기 데이터는 고정 리터럴 epoch(설치 시점 고정 베이스라인)를 쓰지만, 002는 실행 시점이 사용자마다 달라지므로(신규 설치 또는 임의 시점 업그레이드) `strftime('%s','now')*1000`(SQLite 내장, 초 정밀도) 로 실제 마이그레이션 적용 시각을 기록한다.
- **실패 격리(P-65)**: 마이그레이션 러너(`runMigrations`, `migration/runner.ts`)는 각 마이그레이션을 독립 트랜잭션으로 실행하고 실패 시 그 마이그레이션만 롤백 후 중단한다 — 002가 실패해도 001(기타 시딩)의 상태는 보존되며, 앱은 "기타"가 항상 보장된 상태로 최초 진입이 막히지 않는다(안전 모드 진입 여부는 §5 기존 정책과 동일).

### 14.4 F-10 / F-25 / F-26 — 스키마 무영향 근거

| 요구 | 근거 |
| --- | --- |
| F-10 완료 시 목록 하단 이동(P-64) | `ScheduleService.findInRange` 결과 배열을 화면 표시 계층에서 재배치(`applyCompletionOrder`, logic §7.4)할 뿐 — 정렬 기준(`start_at`)·조회 조건·인덱스 무변경 |
| F-25 완료된 일정 숨기기(P-66) | 신규 `APP_SETTING` **키**(`dashboard.hideCompleted`)만 추가 — `app_setting` 은 기존부터 자유 키/값 EAV 테이블(§3.4)이라 신규 키 도입에 DDL/마이그레이션이 필요 없다(기존 `theme.mode`/`notif.enabled` 도입 때와 동일 패턴) |
| F-26 캘린더 날짜 프리필(P-67) | 순수 네비게이션 파라미터·시각 결합 계산(앱 계층) — DB 조회·저장 자체가 없음 |

**결론**: 이번 버전(v1.8)의 실제 스키마 변경은 (1) 마이그레이션 002(DML, F-06 시딩) + (2) 마이그레이션 003(DDL, `SCHEDULE.RECURRENCE_REMINDER_OFFSETS` 컬럼 추가, F-24) 2건으로 한정된다. 신규 테이블·인덱스·트리거는 없다.
