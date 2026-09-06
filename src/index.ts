/**
 * 스모크 데모 — "오늘뭐해" 코어 계층을 인메모리 어댑터로 조립해 핵심 흐름을 실행한다.
 * 실제 앱(React Native)은 같은 서비스에 SQLite/Notifee/AppAuth 어댑터를 주입한다.
 * 실행: `npm run demo`
 */
import { buildApp } from './core/app.ts';
import { FixedClock } from './core/domain/clock.ts';

async function main(): Promise<void> {
  // 2026-09-04 09:00:00 UTC 기준.
  const clock = new FixedClock(Date.UTC(2026, 8, 4, 9, 0, 0), 'UTC');
  const app = buildApp({ clock });

  const categories = await app.categories.list();
  const workId =
    (await app.categories.create('업무', '#0A84FF', 'briefcase')).id;

  const { id } = await app.schedules.create({
    title: '스프린트 회고',
    memo: '지난 스프린트 KPT',
    categoryId: workId,
    priority: 'HIGH',
    startAt: Date.UTC(2026, 8, 4, 15, 0, 0),
    reminderOffsets: [10, 60, 1440],
    notifyAtStart: true,
  });

  await app.schedules.create({
    title: '점심 약속',
    startAt: Date.UTC(2026, 8, 4, 3, 30, 0), // 이미 지난 시각 → 알림 SKIPPED
    reminderOffsets: [15],
  });

  await app.schedules.toggleDone(id, true);

  const summary = await app.dashboard.getSummary();
  const found = await app.search.search({ query: '회고' });

  const output = {
    seededCategories: categories.map((c) => c.name),
    createdScheduleId: id,
    dashboard: {
      total: summary.total,
      done: summary.done,
      notDone: summary.notDone,
      completionRate: summary.completionRate,
      nextScheduleId: summary.nextScheduleId,
    },
    osScheduledNotifications: app.notifications.activeRequests().map((r) => ({
      at: new Date(r.at).toISOString(),
      title: r.title,
      body: r.body,
    })),
    searchHits: found.items.map((s) => s.title),
  };

  console.log(JSON.stringify(output, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
