# 데이터베이스 설계 — 일정관리 앱 "오늘뭐해"

| 항목 | 값 |
| --- | --- |
| 문서 종류 | 데이터베이스 설계 (Database) |
| 버전 | v1.2 |
| 상태 | 작성 완료 (스키마 무변경) |
| 근거 | `document/planner/plan.md` v1.4, `document/architect/overview.md` v1.9 |
| DB 엔진 | SQLite 3 (op-sqlite, 선택적 SQLCipher) |

## 변경 이력

| 버전 | 일자 | 변경 내용 |
| --- | --- | --- |
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
| RECURRENCE_PARENT_ID | INTEGER | | Y | NULL | FK → SCHEDULE.ID | 반복 회차의 원본(P-02) |
| SOURCE | TEXT | | N | 'LOCAL' | CHECK IN ('LOCAL','CALENDAR') | 생성 출처 (F-14, P-08) |
| NOTIFY_AT_START | INTEGER | | N | 1 | 0/1 | 정시 알림 on/off (F-09) |
| CREATED_AT | INTEGER | | N | | epoch ms | |
| UPDATED_AT | INTEGER | | N | | epoch ms | 낙관적 갱신·동기화 병합 기준 |
| DELETED_AT | INTEGER | | Y | NULL | epoch ms | soft delete(삭제 Undo, OI-4/N-3) |

- **변경 이유**: 일정의 모든 필수 속성(F-01), 완료(F-05/P-04~06), 유형(F-06), 우선순위(F-07), 반복(D-05/P-01~03), 캘린더 출처(F-14/P-08), 시간대(P-16), soft delete(E-04-2).
- `RECURRENCE_END_AT`와 `RECURRENCE_COUNT`는 동시 non-null 금지(앱 검증). `RECURRENCE_RULE IS NULL`이면 나머지 recurrence 컬럼도 NULL(앱 검증).

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
| IDX_SCHEDULE_RECUR_PARENT | SCHEDULE(RECURRENCE_PARENT_ID) | 반복 회차 조회(P-02) |
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
