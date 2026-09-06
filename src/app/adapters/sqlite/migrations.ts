/**
 * 스키마 마이그레이션 정의 (순수 데이터).
 * 설계 근거: document/architect/database.md v1.0 §6 (DDL 001_init), §7 (초기 데이터).
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

export const MIGRATIONS: readonly Migration[] = [
  { version: 1, name: '001_init', up: INIT_UP },
] as const;

/** 최신 스키마 버전 (부트스트랩이 user_version 과 비교). */
export const TARGET_SCHEMA_VERSION = MIGRATIONS[MIGRATIONS.length - 1].version;
