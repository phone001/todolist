# 데이터베이스 설계 — 일정관리 앱 "오늘뭐해"

| 항목 | 값 |
| --- | --- |
| 문서 종류 | 데이터베이스 설계 (Database) |
| 버전 | v1.0 |
| 상태 | 작성 완료 |
| 근거 | `document/planner/plan.md` v1.0, `document/architect/overview.md` v1.0 |
| DB 엔진 | SQLite 3 (op-sqlite, 선택적 SQLCipher) |

## 변경 이력

| 버전 | 일자 | 변경 내용 |
| --- | --- | --- |
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
