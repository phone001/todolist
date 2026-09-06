import test from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../src/core/app.ts';
import { FixedClock } from '../src/core/domain/clock.ts';

const NOW = Date.UTC(2026, 8, 4, 9, 0, 0);
const at = (h: number) => Date.UTC(2026, 8, 4, 10 + h, 0, 0);

test('AC-18: 외부 캘린더 일정을 앱 뷰에 병합 표시(신규 생성)', async () => {
  const app = buildApp({ clock: new FixedClock(NOW, 'UTC') });
  app.calendarGateway.events.push({
    calendarId: 'cal-1',
    eventId: 'evt-remote-1',
    title: '치과 예약',
    notes: null,
    startAt: at(5),
    endAt: at(6),
    updatedAt: NOW - 1000,
  });

  const res = await app.calendarSync.pull(at(0), at(24));
  assert.equal(res.created, 1);

  const page = await app.schedules.findInRange(at(0), at(24));
  assert.equal(page.items.length, 1);
  assert.equal(page.items[0].source, 'CALENDAR');
});

test('AC-19 / P-08: 동일 제목+시각 로컬 일정과 중복 없이 병합, 로컬 편집 필드 보존', async () => {
  const app = buildApp({ clock: new FixedClock(NOW, 'UTC') });
  const local = await app.schedules.create({
    title: '회의',
    memo: '로컬에서 작성한 안건',
    startAt: at(3),
    priority: 'HIGH',
    notifyAtStart: false,
  });

  app.calendarGateway.events.push({
    calendarId: 'cal-1',
    eventId: 'evt-remote-2',
    title: '회의',
    notes: '외부 캘린더 설명',
    startAt: at(3) + 30_000, // 30초 차이 → 동일성 판정 범위(±60s)
    endAt: null,
    updatedAt: NOW,
  });

  const res = await app.calendarSync.pull(at(0), at(24));
  assert.equal(res.merged, 1);
  assert.equal(res.created, 0);

  const page = await app.schedules.findInRange(at(0), at(24));
  assert.equal(page.items.length, 1, '중복 없이 1건');
  assert.equal(page.items[0].id, local.id);
  assert.equal(page.items[0].memo, '로컬에서 작성한 안건', '로컬 편집 필드 보존');
  assert.equal(page.items[0].priority, 'HIGH');
});

test('P-08-1: 외부에서 사라진 링크는 EXTERNAL_DELETED 로 표시', async () => {
  const app = buildApp({ clock: new FixedClock(NOW, 'UTC') });
  app.calendarGateway.events.push({
    calendarId: 'cal-1',
    eventId: 'evt-x',
    title: '임시',
    notes: null,
    startAt: at(2),
    endAt: null,
    updatedAt: NOW,
  });
  await app.calendarSync.pull(at(0), at(24));

  app.calendarGateway.events = []; // 외부에서 삭제됨
  const res = await app.calendarSync.pull(at(0), at(24));
  assert.equal(res.externalDeleted, 1);
  const links = await app.db.calendarLinks;
  assert.equal(links[0].syncState, 'EXTERNAL_DELETED');
});

test('E-14-1: 캘린더 권한이 없으면 PERMISSION_CALENDAR_DENIED', async () => {
  const app = buildApp({ clock: new FixedClock(NOW, 'UTC') });
  app.calendarGateway.setPermission('denied');
  await assert.rejects(
    () => app.calendarSync.pull(at(0), at(24)),
    (err: unknown) => (err as { code?: string }).code === 'PERMISSION_CALENDAR_DENIED',
  );
});

test('외부 이벤트 텍스트는 정제되어 저장된다(13.3)', async () => {
  const app = buildApp({ clock: new FixedClock(NOW, 'UTC') });
  app.calendarGateway.events.push({
    calendarId: 'cal-1',
    eventId: 'evt-dirty',
    title: '제목\t포함\n제어문자',
    notes: 'x'.repeat(6000),
    startAt: at(7),
    endAt: null,
    updatedAt: NOW,
  });
  await app.calendarSync.pull(at(0), at(24));
  const page = await app.schedules.findInRange(at(0), at(24));
  assert.equal(page.items[0].title, '제목 포함 제어문자');
  assert.ok((page.items[0].memo ?? '').length <= 5000);
});
