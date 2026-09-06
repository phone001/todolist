/**
 * op-sqlite 저장소 어댑터 6종 (네이티브 바인딩).
 * 설계 근거: document/architect/logic.md v1.1 §16.5, database.md v1.0 §3~4, nfr §1.2 (keyset).
 * 코어 포트(`src/core/ports/repositories.ts`)를 그대로 구현한다.
 *
 * 환경 제약: `@op-engineering/op-sqlite` 의존 → 현재 파이프라인 미실행(정적 리뷰). 온디바이스 검증.
 *
 * SQL 규칙(logic 13.3):
 *  - 모든 SQL 문은 이 파일 상단에 **정적 상수**로 선언한다. 런타임 문자열 조립·동적 식별자 금지.
 *  - 값은 전부 named 바인딩(`:x`). 선택 조건은 `(:x IS NULL OR col = :x)` 로 정적화하고 미사용 시 null 을 바인딩한다.
 */
import type { DB } from '@op-engineering/op-sqlite';
import type {
  AccountRepository,
  CalendarLinkRepository,
  CategoryRepository,
  NewCalendarLink,
  NewCategory,
  NewSchedule,
  ReminderRepository,
  ScheduleRepository,
  SettingRepository,
} from '../../../core/ports/repositories.ts';
import type {
  AccountLink,
  CalendarLink,
  Category,
  Page,
  Reminder,
  Schedule,
  ScheduleFilter,
  ScheduleSort,
} from '../../../core/domain/types.ts';
import type { ReminderDraft } from '../../../core/domain/reminders.ts';
import type { SearchMode } from '../../../core/domain/search.ts';
import { escapeLike, toFtsMatchExpression } from '../../../core/domain/search.ts';
import { decodeCursor, encodeCursor } from './cursor.ts';
import { mapSqliteError } from '../errors.ts';

type Row = Record<string, unknown>;

async function all(db: DB, sql: string, params: Row): Promise<Row[]> {
  try {
    const res = await db.execute(sql, params as never);
    // op-sqlite 9.x: QueryResult.rows 는 평면 배열(6.x 의 rows._array 접근자 제거, overview v1.2 §매핑 각주).
    return (res.rows ?? []) as Row[];
  } catch (err) {
    throw mapSqliteError(err, 'read');
  }
}
async function run(db: DB, sql: string, params: Row): Promise<{ insertId?: number; rowsAffected: number }> {
  try {
    const res = await db.execute(sql, params as never);
    return { insertId: res.insertId, rowsAffected: res.rowsAffected ?? 0 };
  } catch (err) {
    throw mapSqliteError(err, 'write');
  }
}

const bit = (v: boolean) => (v ? 1 : 0);
const toBool = (v: unknown) => v === 1 || v === true;
const orNull = (v: unknown) => (v === null || v === undefined ? null : Number(v));

function toSchedule(r: Row): Schedule {
  return {
    id: Number(r.id),
    title: String(r.title),
    memo: (r.memo as string | null) ?? null,
    categoryId: Number(r.category_id),
    priority: r.priority as Schedule['priority'],
    startAt: Number(r.start_at),
    endAt: orNull(r.end_at),
    timeZone: String(r.time_zone),
    isAllDay: toBool(r.is_all_day),
    isDone: toBool(r.is_done),
    doneAt: orNull(r.done_at),
    recurrenceRule: (r.recurrence_rule as Schedule['recurrenceRule']) ?? null,
    recurrenceEndAt: orNull(r.recurrence_end_at),
    recurrenceCount: orNull(r.recurrence_count),
    recurrenceParentId: orNull(r.recurrence_parent_id),
    source: r.source as Schedule['source'],
    notifyAtStart: toBool(r.notify_at_start),
    createdAt: Number(r.created_at),
    updatedAt: Number(r.updated_at),
    deletedAt: orNull(r.deleted_at),
  };
}
function toReminder(r: Row): Reminder {
  return {
    id: Number(r.id),
    scheduleId: Number(r.schedule_id),
    offsetMinutes: Number(r.offset_minutes),
    kind: r.kind as Reminder['kind'],
    triggerAt: Number(r.trigger_at),
    osRequestId: (r.os_request_id as string | null) ?? null,
    state: r.state as Reminder['state'],
    lastSyncedAt: orNull(r.last_synced_at),
    createdAt: Number(r.created_at),
    updatedAt: Number(r.updated_at),
  };
}
function toCategory(r: Row): Category {
  return {
    id: Number(r.id),
    name: String(r.name),
    color: String(r.color),
    icon: (r.icon as string | null) ?? null,
    isSystem: toBool(r.is_system),
    sortOrder: Number(r.sort_order),
    createdAt: Number(r.created_at),
    updatedAt: Number(r.updated_at),
  };
}
function toCalendarLink(r: Row): CalendarLink {
  return {
    id: Number(r.id),
    scheduleId: Number(r.schedule_id),
    externalCalendarId: String(r.external_calendar_id),
    externalEventId: String(r.external_event_id),
    externalUpdatedAt: orNull(r.external_updated_at),
    syncState: r.sync_state as CalendarLink['syncState'],
    lastSyncedAt: Number(r.last_synced_at),
  };
}

/** filter 를 정적 쿼리용 named 파라미터로 펼친다(미지정은 null). */
function filterParams(filter?: ScheduleFilter): Row {
  return {
    fCategoryId: filter?.categoryId ?? null,
    fPriority: filter?.priority ?? null,
    fIsDone: filter?.isDone === undefined ? null : bit(filter.isDone),
  };
}

// ---------------- 정적 SQL 상수 ----------------

const SQL = {
  scheduleInsert:
    'INSERT INTO schedule ' +
    '(title,memo,category_id,priority,start_at,end_at,time_zone,is_all_day,is_done,done_at,' +
    'recurrence_rule,recurrence_end_at,recurrence_count,recurrence_parent_id,source,notify_at_start,' +
    'created_at,updated_at,deleted_at) VALUES ' +
    '(:title,:memo,:categoryId,:priority,:startAt,:endAt,:timeZone,:isAllDay,:isDone,:doneAt,' +
    ':recurrenceRule,:recurrenceEndAt,:recurrenceCount,:recurrenceParentId,:source,:notifyAtStart,' +
    ':createdAt,:updatedAt,:deletedAt)',

  // 전체 컬럼 UPDATE — 호출부가 병합된 전체 값을 넘긴다(부분 SET 조립 없음).
  scheduleUpdateAll:
    'UPDATE schedule SET ' +
    'title=:title, memo=:memo, category_id=:categoryId, priority=:priority, start_at=:startAt, end_at=:endAt, ' +
    'time_zone=:timeZone, is_all_day=:isAllDay, is_done=:isDone, done_at=:doneAt, ' +
    'recurrence_rule=:recurrenceRule, recurrence_end_at=:recurrenceEndAt, recurrence_count=:recurrenceCount, ' +
    'recurrence_parent_id=:recurrenceParentId, source=:source, notify_at_start=:notifyAtStart, ' +
    'updated_at=:updatedAt, deleted_at=:deletedAt ' +
    'WHERE id=:id AND (:expectedUpdatedAt IS NULL OR updated_at = :expectedUpdatedAt)',

  scheduleById: 'SELECT * FROM schedule WHERE id = :id',
  scheduleSoftDelete: 'UPDATE schedule SET deleted_at = :at, updated_at = :at WHERE id = :id',
  scheduleRestore: 'UPDATE schedule SET deleted_at = NULL WHERE id = :id',
  scheduleReassignCategory: 'UPDATE schedule SET category_id = :toId WHERE category_id = :fromId',

  scheduleForDashboard:
    'SELECT * FROM schedule ' +
    'WHERE deleted_at IS NULL AND start_at >= :dayStart AND start_at < :dayEnd ' +
    'ORDER BY start_at, id',

  // 선택 조건을 전부 (:x IS NULL OR ...) 로 정적화. 정렬만 2종.
  scheduleInRangeByStart:
    'SELECT * FROM schedule WHERE deleted_at IS NULL ' +
    'AND start_at < :toTs AND coalesce(end_at, start_at) >= :fromTs ' +
    'AND (:fCategoryId IS NULL OR category_id = :fCategoryId) ' +
    'AND (:fPriority IS NULL OR priority = :fPriority) ' +
    'AND (:fIsDone IS NULL OR is_done = :fIsDone) ' +
    'AND (:cursorStartAt IS NULL OR start_at > :cursorStartAt OR (start_at = :cursorStartAt AND id > :cursorId)) ' +
    'ORDER BY start_at, id LIMIT :limit',

  scheduleInRangeByPriority:
    'SELECT * FROM schedule WHERE deleted_at IS NULL ' +
    'AND start_at < :toTs AND coalesce(end_at, start_at) >= :fromTs ' +
    'AND (:fCategoryId IS NULL OR category_id = :fCategoryId) ' +
    'AND (:fPriority IS NULL OR priority = :fPriority) ' +
    'AND (:fIsDone IS NULL OR is_done = :fIsDone) ' +
    'AND (:cursorStartAt IS NULL OR start_at > :cursorStartAt OR (start_at = :cursorStartAt AND id > :cursorId)) ' +
    "ORDER BY CASE priority WHEN 'HIGH' THEN 0 WHEN 'NORMAL' THEN 1 ELSE 2 END, start_at, id LIMIT :limit",

  searchFts:
    'SELECT s.* FROM schedule_fts f JOIN schedule s ON s.id = f.rowid ' +
    'WHERE schedule_fts MATCH :match AND s.deleted_at IS NULL ' +
    'AND (:fCategoryId IS NULL OR s.category_id = :fCategoryId) ' +
    'AND (:fPriority IS NULL OR s.priority = :fPriority) ' +
    'AND (:fIsDone IS NULL OR s.is_done = :fIsDone) ' +
    'ORDER BY rank LIMIT :limit',

  searchLike:
    'SELECT s.* FROM schedule s WHERE s.deleted_at IS NULL AND (' +
    "s.title LIKE :like ESCAPE '\\' OR coalesce(s.memo,'') LIKE :like ESCAPE '\\' " +
    "OR EXISTS (SELECT 1 FROM category c WHERE c.id = s.category_id AND c.name LIKE :like ESCAPE '\\')" +
    ') AND (:fCategoryId IS NULL OR s.category_id = :fCategoryId) ' +
    'AND (:fPriority IS NULL OR s.priority = :fPriority) ' +
    'AND (:fIsDone IS NULL OR s.is_done = :fIsDone) ' +
    'ORDER BY s.start_at DESC, s.id DESC LIMIT :limit',

  reminderInsert:
    'INSERT INTO reminder (schedule_id, offset_minutes, kind, trigger_at, state, created_at, updated_at) ' +
    "VALUES (:scheduleId,:offset,:kind,:triggerAt,'PENDING',:now,:now)",
  reminderById: 'SELECT * FROM reminder WHERE id = :id',
  reminderBySchedule: 'SELECT * FROM reminder WHERE schedule_id = :scheduleId',
  reminderDue:
    "SELECT * FROM reminder WHERE state IN ('PENDING','SCHEDULED') AND trigger_at <= :limitAt AND (:scheduleId IS NULL OR schedule_id = :scheduleId) ORDER BY trigger_at",
  reminderMarkState:
    'UPDATE reminder SET state = :state, updated_at = :updatedAt, ' +
    'os_request_id = CASE WHEN :setOs = 1 THEN :osRequestId ELSE os_request_id END, ' +
    'last_synced_at = CASE WHEN :setSync = 1 THEN :lastSyncedAt ELSE last_synced_at END ' +
    'WHERE id = :id',
  reminderDeleteBySchedule: 'DELETE FROM reminder WHERE schedule_id = :scheduleId',
  reminderResetScheduled:
    "UPDATE reminder SET state = 'PENDING', os_request_id = NULL, updated_at = :now " +
    "WHERE state = 'SCHEDULED' AND trigger_at > :now",

  categoryList: 'SELECT * FROM category ORDER BY sort_order, id',
  categoryById: 'SELECT * FROM category WHERE id = :id',
  categoryByName: 'SELECT * FROM category WHERE name = :name',
  categoryInsert:
    'INSERT INTO category (name,color,icon,is_system,sort_order,created_at,updated_at) ' +
    'VALUES (:name,:color,:icon,:isSystem,:sortOrder,:createdAt,:updatedAt)',
  categoryRename: 'UPDATE category SET name = :name, updated_at = :now WHERE id = :id',
  categoryDelete: 'DELETE FROM category WHERE id = :id',
  categorySystemId: 'SELECT id FROM category WHERE is_system = 1 ORDER BY id LIMIT 1',
  categorySystemInsert:
    "INSERT INTO category (name,color,icon,is_system,sort_order,created_at,updated_at) " +
    "VALUES ('기타','#8E8E93','dots',1,100,:now,:now)",

  settingGet: 'SELECT value FROM app_setting WHERE key = :key',
  settingAll: 'SELECT key, value FROM app_setting',
  settingUpsert:
    'INSERT INTO app_setting (key, value, updated_at) VALUES (:key,:value,:now) ' +
    'ON CONFLICT(key) DO UPDATE SET value = :value, updated_at = :now',

  accountGet: 'SELECT * FROM account_link WHERE id = 1',
  accountUpsert:
    'INSERT INTO account_link (id, provider, subject, display_name, linked_at, token_ref, state) ' +
    'VALUES (1,:provider,:subject,:displayName,:linkedAt,:tokenRef,:state) ' +
    'ON CONFLICT(id) DO UPDATE SET provider=:provider, subject=:subject, display_name=:displayName, ' +
    'linked_at=:linkedAt, token_ref=:tokenRef, state=:state',

  linkByExternal:
    'SELECT * FROM calendar_link WHERE external_calendar_id = :cid AND external_event_id = :eid',
  linkBySchedule: 'SELECT * FROM calendar_link WHERE schedule_id = :scheduleId',
  linkList: 'SELECT * FROM calendar_link',
  linkInsert:
    'INSERT INTO calendar_link ' +
    '(schedule_id, external_calendar_id, external_event_id, external_updated_at, sync_state, last_synced_at) ' +
    'VALUES (:scheduleId,:cid,:eid,:extUpdated,:syncState,:lastSynced)',
  // 전체 컬럼 UPDATE — 호출부가 병합값을 넘긴다.
  linkUpdateAll:
    'UPDATE calendar_link SET external_calendar_id=:cid, external_event_id=:eid, ' +
    'external_updated_at=:extUpdated, sync_state=:syncState, last_synced_at=:lastSynced WHERE id=:id',
} as const;

function scheduleWriteParams(data: NewSchedule): Row {
  return {
    title: data.title,
    memo: data.memo,
    categoryId: data.categoryId,
    priority: data.priority,
    startAt: data.startAt,
    endAt: data.endAt,
    timeZone: data.timeZone,
    isAllDay: bit(data.isAllDay),
    isDone: bit(data.isDone),
    doneAt: data.doneAt,
    recurrenceRule: data.recurrenceRule,
    recurrenceEndAt: data.recurrenceEndAt,
    recurrenceCount: data.recurrenceCount,
    recurrenceParentId: data.recurrenceParentId,
    source: data.source,
    notifyAtStart: bit(data.notifyAtStart),
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
    deletedAt: data.deletedAt,
  };
}

export class SqliteScheduleRepository implements ScheduleRepository {
  constructor(private readonly db: DB) {}

  async insert(data: NewSchedule): Promise<Schedule> {
    const res = await run(this.db, SQL.scheduleInsert, scheduleWriteParams(data));
    const found = await this.findById(Number(res.insertId));
    if (!found) throw mapSqliteError(new Error('insert returned no row'), 'write');
    return found;
  }

  async update(id: number, patch: Partial<NewSchedule>, expectedUpdatedAt?: number): Promise<Schedule> {
    const current = await this.findById(id);
    if (!current) throw mapSqliteError(new Error('NOT_FOUND'), 'write');
    const merged: NewSchedule = { ...current, ...patch } as NewSchedule;
    const res = await run(this.db, SQL.scheduleUpdateAll, {
      ...scheduleWriteParams(merged),
      id,
      expectedUpdatedAt: expectedUpdatedAt ?? null,
    });
    if (res.rowsAffected === 0 && expectedUpdatedAt !== undefined) {
      throw mapSqliteError(new Error('stale write'), 'write');
    }
    const found = await this.findById(id);
    if (!found) throw mapSqliteError(new Error('NOT_FOUND after update'), 'write');
    return found;
  }

  async softDelete(id: number, at: number): Promise<void> {
    await run(this.db, SQL.scheduleSoftDelete, { id, at });
  }

  async restore(id: number): Promise<Schedule> {
    await run(this.db, SQL.scheduleRestore, { id });
    const found = await this.findById(id);
    if (!found) throw mapSqliteError(new Error('NOT_FOUND after restore'), 'write');
    return found;
  }

  async findById(id: number): Promise<Schedule | null> {
    const rows = await all(this.db, SQL.scheduleById, { id });
    return rows[0] ? toSchedule(rows[0]) : null;
  }

  async findInRange(
    fromTs: number,
    toTs: number,
    filter?: ScheduleFilter,
    sort: ScheduleSort = 'startAt',
    limit = 50,
    cursor: string | null = null,
  ): Promise<Page<Schedule>> {
    const key = decodeCursor(cursor);
    const params: Row = {
      fromTs,
      toTs,
      limit: limit + 1,
      cursorStartAt: key ? key.startAt : null,
      cursorId: key ? key.id : null,
      ...filterParams(filter),
    };
    const sql = sort === 'priority' ? SQL.scheduleInRangeByPriority : SQL.scheduleInRangeByStart;
    const rows = await all(this.db, sql, params);
    const items = rows.slice(0, limit).map(toSchedule);
    let nextCursor: string | null = null;
    if (rows.length > limit && items.length > 0) {
      const last = items[items.length - 1];
      nextCursor = encodeCursor({ startAt: last.startAt, id: last.id });
    }
    return { items, nextCursor };
  }

  async findForDashboard(dayStart: number, dayEnd: number): Promise<Schedule[]> {
    const rows = await all(this.db, SQL.scheduleForDashboard, { dayStart, dayEnd });
    return rows.map(toSchedule);
  }

  async search(params: {
    query: string;
    mode: Exclude<SearchMode, 'empty'>;
    filter?: ScheduleFilter;
    limit: number;
  }): Promise<{ items: Schedule[]; limited: boolean }> {
    const base: Row = { limit: params.limit, ...filterParams(params.filter) };
    if (params.mode === 'fts') {
      const rows = await all(this.db, SQL.searchFts, { ...base, match: toFtsMatchExpression(params.query) });
      return { items: rows.map(toSchedule), limited: false };
    }
    const rows = await all(this.db, SQL.searchLike, {
      ...base,
      like: `%${escapeLike(params.query.trim())}%`,
    });
    return { items: rows.map(toSchedule), limited: rows.length >= params.limit };
  }

  async reassignCategory(fromCategoryId: number, toCategoryId: number): Promise<number> {
    const res = await run(this.db, SQL.scheduleReassignCategory, { fromId: fromCategoryId, toId: toCategoryId });
    return res.rowsAffected;
  }
}

export class SqliteReminderRepository implements ReminderRepository {
  constructor(private readonly db: DB) {}

  async replaceForSchedule(scheduleId: number, drafts: ReminderDraft[], now: number) {
    const removed = await this.deleteForSchedule(scheduleId);
    const created: Reminder[] = [];
    for (const d of drafts) {
      const res = await run(this.db, SQL.reminderInsert, {
        scheduleId,
        offset: d.offsetMinutes,
        kind: d.kind,
        triggerAt: d.triggerAt,
        now,
      });
      const rows = await all(this.db, SQL.reminderById, { id: res.insertId });
      if (rows[0]) created.push(toReminder(rows[0]));
    }
    return { created, removed };
  }

  async findBySchedule(scheduleId: number): Promise<Reminder[]> {
    const rows = await all(this.db, SQL.reminderBySchedule, { scheduleId });
    return rows.map(toReminder);
  }

  async findDue(now: number, horizonMs: number, scheduleId?: number): Promise<Reminder[]> {
    const rows = await all(this.db, SQL.reminderDue, {
      limitAt: now + horizonMs,
      scheduleId: scheduleId ?? null,
    });
    return rows.map(toReminder);
  }

  async markState(id: number, state: Reminder['state'], osRequestId?: string | null, lastSyncedAt?: number | null) {
    await run(this.db, SQL.reminderMarkState, {
      id,
      state,
      updatedAt: Date.now(),
      setOs: osRequestId === undefined ? 0 : 1,
      osRequestId: osRequestId ?? null,
      setSync: lastSyncedAt === undefined ? 0 : 1,
      lastSyncedAt: lastSyncedAt ?? null,
    });
  }

  async deleteForSchedule(scheduleId: number): Promise<Reminder[]> {
    const rows = await all(this.db, SQL.reminderBySchedule, { scheduleId });
    await run(this.db, SQL.reminderDeleteBySchedule, { scheduleId });
    return rows.map(toReminder);
  }

  async resetScheduledToPending(now: number): Promise<number> {
    const res = await run(this.db, SQL.reminderResetScheduled, { now });
    return res.rowsAffected;
  }
}

export class SqliteCategoryRepository implements CategoryRepository {
  constructor(private readonly db: DB) {}

  async list(): Promise<Category[]> {
    return (await all(this.db, SQL.categoryList, {})).map(toCategory);
  }
  async findById(id: number): Promise<Category | null> {
    const rows = await all(this.db, SQL.categoryById, { id });
    return rows[0] ? toCategory(rows[0]) : null;
  }
  async findByName(name: string): Promise<Category | null> {
    const rows = await all(this.db, SQL.categoryByName, { name });
    return rows[0] ? toCategory(rows[0]) : null;
  }
  async insert(data: NewCategory): Promise<Category> {
    const res = await run(this.db, SQL.categoryInsert, {
      name: data.name,
      color: data.color,
      icon: data.icon,
      isSystem: bit(data.isSystem),
      sortOrder: data.sortOrder,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    });
    const found = await this.findById(Number(res.insertId));
    if (!found) throw mapSqliteError(new Error('insert category failed'), 'write');
    return found;
  }
  async rename(id: number, name: string, now: number): Promise<Category> {
    await run(this.db, SQL.categoryRename, { id, name, now });
    const found = await this.findById(id);
    if (!found) throw mapSqliteError(new Error('rename category failed'), 'write');
    return found;
  }
  async remove(id: number): Promise<void> {
    await run(this.db, SQL.categoryDelete, { id });
  }
  async systemDefaultId(): Promise<number> {
    const rows = await all(this.db, SQL.categorySystemId, {});
    if (rows[0]) return Number(rows[0].id);
    const res = await run(this.db, SQL.categorySystemInsert, { now: Date.now() });
    return Number(res.insertId);
  }
}

export class SqliteSettingRepository implements SettingRepository {
  constructor(private readonly db: DB) {}
  async get(key: string): Promise<string | null> {
    const rows = await all(this.db, SQL.settingGet, { key });
    return rows[0] ? String(rows[0].value) : null;
  }
  async set(key: string, jsonValue: string, now: number): Promise<void> {
    await run(this.db, SQL.settingUpsert, { key, value: jsonValue, now });
  }
  async getAll(): Promise<Record<string, string>> {
    const rows = await all(this.db, SQL.settingAll, {});
    const out: Record<string, string> = {};
    for (const r of rows) out[String(r.key)] = String(r.value);
    return out;
  }
}

export class SqliteAccountRepository implements AccountRepository {
  constructor(private readonly db: DB) {}
  async get(): Promise<AccountLink> {
    const rows = await all(this.db, SQL.accountGet, {});
    const r = rows[0];
    if (!r) {
      return { provider: null, subject: null, displayName: null, linkedAt: null, tokenRef: null, state: 'NONE' };
    }
    return {
      provider: (r.provider as string | null) ?? null,
      subject: (r.subject as string | null) ?? null,
      displayName: (r.display_name as string | null) ?? null,
      linkedAt: orNull(r.linked_at),
      tokenRef: (r.token_ref as string | null) ?? null,
      state: r.state as AccountLink['state'],
    };
  }
  async set(value: AccountLink): Promise<void> {
    await run(this.db, SQL.accountUpsert, {
      provider: value.provider,
      subject: value.subject,
      displayName: value.displayName,
      linkedAt: value.linkedAt,
      tokenRef: value.tokenRef,
      state: value.state,
    });
  }
}

export class SqliteCalendarLinkRepository implements CalendarLinkRepository {
  constructor(private readonly db: DB) {}
  async findByExternal(externalCalendarId: string, externalEventId: string): Promise<CalendarLink | null> {
    const rows = await all(this.db, SQL.linkByExternal, { cid: externalCalendarId, eid: externalEventId });
    return rows[0] ? toCalendarLink(rows[0]) : null;
  }
  async findByScheduleId(scheduleId: number): Promise<CalendarLink | null> {
    const rows = await all(this.db, SQL.linkBySchedule, { scheduleId });
    return rows[0] ? toCalendarLink(rows[0]) : null;
  }
  async list(): Promise<CalendarLink[]> {
    return (await all(this.db, SQL.linkList, {})).map(toCalendarLink);
  }
  async insert(data: NewCalendarLink): Promise<CalendarLink> {
    const res = await run(this.db, SQL.linkInsert, {
      scheduleId: data.scheduleId,
      cid: data.externalCalendarId,
      eid: data.externalEventId,
      extUpdated: data.externalUpdatedAt,
      syncState: data.syncState,
      lastSynced: data.lastSyncedAt,
    });
    const rows = await all(this.db, SQL.linkBySchedule, { scheduleId: data.scheduleId });
    void res;
    return toCalendarLink(rows[0]);
  }
  async update(id: number, patch: Partial<NewCalendarLink>): Promise<void> {
    const current = await all(this.db, 'SELECT * FROM calendar_link WHERE id = :id', { id });
    if (!current[0]) return;
    const merged = { ...toCalendarLink(current[0]), ...patch };
    await run(this.db, SQL.linkUpdateAll, {
      id,
      cid: merged.externalCalendarId,
      eid: merged.externalEventId,
      extUpdated: merged.externalUpdatedAt,
      syncState: merged.syncState,
      lastSynced: merged.lastSyncedAt,
    });
  }
}

export function createSqliteRepositories(db: DB) {
  return {
    schedules: new SqliteScheduleRepository(db),
    reminders: new SqliteReminderRepository(db),
    categories: new SqliteCategoryRepository(db),
    settings: new SqliteSettingRepository(db),
    account: new SqliteAccountRepository(db),
    calendarLinks: new SqliteCalendarLinkRepository(db),
  };
}
