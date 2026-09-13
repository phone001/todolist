/**
 * 스키마 마이그레이션 정의 (순수 데이터).
 * 설계 근거: document/architect/database.md v1.0 §6 (DDL 001_init), §7 (초기 데이터),
 *           v1.8 §14.1(마이그레이션 003, F-24)/§14.3(마이그레이션 002, F-06).
 * 코어 `runMigrations(db, MIGRATIONS)` 가 순서대로 적용한다(logic §12, §16.4, AC-24).
 *
 * SQL 은 database.md 의 DDL 을 그대로 옮긴 것이며, 상수로만 존재한다(실 DB 변경 아님).
 */
import type { Migration } from '../../../core/migration/runner.ts';

const INIT_UP = `
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

-- 초기 데이터 (database.md §7)
INSERT INTO category (name, color, icon, is_system, sort_order, created_at, updated_at)
VALUES ('기타', '#8E8E93', 'dots', 1, 100, 1756944000000, 1756944000000);

INSERT INTO app_setting (key, value, updated_at)
VALUES ('theme.mode', '"system"', 1756944000000);

INSERT INTO app_setting (key, value, updated_at)
VALUES ('notif.showTitle', 'true', 1756944000000);
`.trim();

/**
 * F-06 기본 유형 4종 시딩 (database.md v1.8 §14.3, P-65, E-06-8, D-27).
 * "기타"(마이그레이션 001, IS_SYSTEM=1)와 별도로 "공부"/"취미"/"업무"를 IS_SYSTEM=0 으로 추가한다.
 * `WHERE NOT EXISTS(... lower(trim(name)) = lower(X))` 로 대소문자·앞뒤공백 무시 idempotent 시딩 —
 * 이미 동일 이름의 사용자 정의 유형이 있으면 새로 만들지 않는다. 색상은 `CATEGORY_COLOR_PALETTE[0..2]`
 * (`src/core/domain/categoryColor.ts`)를 그대로 하드코딩(마이그레이션은 순수 SQL이라 TS 함수 호출 불가).
 * 신규 설치자·기존 사용자 모두 버전 기반 마이그레이션 러너로 동일하게 적용된다.
 */
const SEED_DEFAULT_CATEGORIES_UP = `
INSERT INTO category (name, color, icon, is_system, sort_order, created_at, updated_at)
SELECT '공부', '#00897B', NULL, 0, 101, (CAST(strftime('%s','now') AS INTEGER) * 1000), (CAST(strftime('%s','now') AS INTEGER) * 1000)
WHERE NOT EXISTS (SELECT 1 FROM category WHERE lower(trim(name)) = lower('공부'));

INSERT INTO category (name, color, icon, is_system, sort_order, created_at, updated_at)
SELECT '취미', '#00ACC1', NULL, 0, 102, (CAST(strftime('%s','now') AS INTEGER) * 1000), (CAST(strftime('%s','now') AS INTEGER) * 1000)
WHERE NOT EXISTS (SELECT 1 FROM category WHERE lower(trim(name)) = lower('취미'));

INSERT INTO category (name, color, icon, is_system, sort_order, created_at, updated_at)
SELECT '업무', '#039BE5', NULL, 0, 103, (CAST(strftime('%s','now') AS INTEGER) * 1000), (CAST(strftime('%s','now') AS INTEGER) * 1000)
WHERE NOT EXISTS (SELECT 1 FROM category WHERE lower(trim(name)) = lower('업무'));
`.trim();

/**
 * F-24 반복 일정 — 사전 알림 오프셋 템플릿 컬럼 (database.md v1.8 §14.1).
 * 반복 마스터 행(`recurrence_rule` NOT NULL, `recurrence_parent_id` NULL)에만 값(JSON 배열 문자열,
 * 예: '[10,60]')을 채운다. 회차 행·비반복 일정은 항상 NULL(앱 검증). 마스터 행은 REMINDER 행을 직접
 * 갖지 않으므로, 회차 실체화(`RecurrenceScheduler`) 시 이 컬럼을 읽어 각 회차의 REMINDER 를 재구성한다.
 */
const ADD_RECURRENCE_REMINDER_OFFSETS_UP = `
ALTER TABLE schedule ADD COLUMN recurrence_reminder_offsets TEXT;
`.trim();

export const MIGRATIONS: readonly Migration[] = [
  { version: 1, name: '001_init', up: INIT_UP },
  { version: 2, name: '002_seed_default_categories', up: SEED_DEFAULT_CATEGORIES_UP },
  { version: 3, name: '003_recurrence_reminder_offsets', up: ADD_RECURRENCE_REMINDER_OFFSETS_UP },
] as const;

/** 최신 스키마 버전 (부트스트랩이 user_version 과 비교). */
export const TARGET_SCHEMA_VERSION = MIGRATIONS[MIGRATIONS.length - 1].version;
