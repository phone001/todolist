/**
 * 인메모리 저장소 (테스트 및 데모용 어댑터).
 * 운영 어댑터(op-sqlite)는 같은 포트 계약을 SQLite 로 구현한다 — 서비스 코드는 동일.
 * 설계 근거: document/architect/overview.md "주요 기술 결정" 1, database.md 5(트랜잭션).
 */
import type { AccountLink, Category, Reminder, Schedule, CalendarLink } from '../../domain/types.ts';
import type { UnitOfWork } from '../../ports/repositories.ts';

interface Snapshot {
  schedules: Schedule[];
  reminders: Reminder[];
  categories: Category[];
  calendarLinks: CalendarLink[];
  settings: Map<string, { value: string; updatedAt: number }>;
  account: AccountLink;
  seq: { schedule: number; reminder: number; category: number; calendarLink: number };
}

export const EMPTY_ACCOUNT: AccountLink = {
  provider: null,
  subject: null,
  displayName: null,
  linkedAt: null,
  tokenRef: null,
  state: 'NONE',
};

/**
 * 모든 컬렉션을 보유하고 트랜잭션(스냅샷/롤백)을 제공한다.
 * 규칙: 모든 저장소 메서드는 배열 원소를 "제자리 변경"하지 않고 새 객체로 교체한다.
 *       따라서 배열 얕은 복사만으로 롤백이 성립한다.
 */
export class InMemoryDb implements UnitOfWork {
  schedules: Schedule[] = [];
  reminders: Reminder[] = [];
  categories: Category[] = [];
  calendarLinks: CalendarLink[] = [];
  settings = new Map<string, { value: string; updatedAt: number }>();
  account: AccountLink = { ...EMPTY_ACCOUNT };
  seq = { schedule: 0, reminder: 0, category: 0, calendarLink: 0 };

  private depth = 0;

  async transaction<T>(work: () => Promise<T>): Promise<T> {
    if (this.depth > 0) {
      // 중첩 트랜잭션은 바깥 트랜잭션에 합류한다.
      return work();
    }
    this.depth += 1;
    const snap = this.capture();
    try {
      const result = await work();
      this.depth -= 1;
      return result;
    } catch (err) {
      this.restore(snap);
      this.depth -= 1;
      throw err;
    }
  }

  private capture(): Snapshot {
    return {
      schedules: [...this.schedules],
      reminders: [...this.reminders],
      categories: [...this.categories],
      calendarLinks: [...this.calendarLinks],
      settings: new Map(this.settings),
      account: { ...this.account },
      seq: { ...this.seq },
    };
  }

  private restore(snap: Snapshot): void {
    this.schedules = snap.schedules;
    this.reminders = snap.reminders;
    this.categories = snap.categories;
    this.calendarLinks = snap.calendarLinks;
    this.settings = snap.settings;
    this.account = snap.account;
    this.seq = snap.seq;
  }
}

const NOW_ZERO = 0;

/** database.md 7장의 초기 데이터에 대응하는 시드. */
export function seedDefaults(db: InMemoryDb, now: number = NOW_ZERO): void {
  if (!db.categories.some((c) => c.isSystem)) {
    db.seq.category += 1;
    db.categories.push({
      id: db.seq.category,
      name: '기타',
      color: '#8E8E93',
      icon: 'dots',
      isSystem: true,
      sortOrder: 100,
      createdAt: now,
      updatedAt: now,
    });
  }
  if (!db.settings.has('theme.mode')) {
    db.settings.set('theme.mode', { value: JSON.stringify('system'), updatedAt: now });
  }
  if (!db.settings.has('notif.showTitle')) {
    db.settings.set('notif.showTitle', { value: JSON.stringify(true), updatedAt: now });
  }
}
