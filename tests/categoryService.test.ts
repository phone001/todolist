import test from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../src/core/app.ts';
import { FixedClock } from '../src/core/domain/clock.ts';

const NOW = Date.UTC(2026, 8, 4, 9, 0, 0);
const at = (h: number) => Date.UTC(2026, 8, 4, 10 + h, 0, 0);

test('V-17 / E-06-2: 사용 중인 카테고리 삭제 시 소속 일정이 "기타"로 재지정된다', async () => {
  const clock = new FixedClock(NOW, 'UTC');
  const app = buildApp({ clock });
  const fallbackId = await app.db.categories.find((c) => c.isSystem).id;
  const hobby = (await app.categories.create('취미')).id;

  const s1 = await app.schedules.create({ title: 'h1', startAt: at(1), categoryId: hobby, notifyAtStart: false });
  const s2 = await app.schedules.create({ title: 'h2', startAt: at(2), categoryId: hobby, notifyAtStart: false });

  const result = await app.categories.remove(hobby);
  assert.equal(result.reassigned, 2);

  assert.equal((await app.db.schedules.find((s) => s.id === s1.id)).categoryId, fallbackId);
  assert.equal((await app.db.schedules.find((s) => s.id === s2.id)).categoryId, fallbackId);
  assert.equal(await app.db.categories.some((c) => c.id === hobby), false);
});

test('E-06-2: 시스템 기본 카테고리는 삭제 불가', async () => {
  const app = buildApp({ clock: new FixedClock(NOW, 'UTC') });
  const systemId = await app.db.categories.find((c) => c.isSystem).id;
  await assert.rejects(
    () => app.categories.remove(systemId),
    (err: unknown) => (err as { code?: string }).code === 'POLICY_SYSTEM_CATEGORY_DELETE',
  );
});

test('트랜잭션 롤백: 삭제 단계 실패 시 재지정도 취소된다', async () => {
  const app = buildApp({ clock: new FixedClock(NOW, 'UTC') });
  const hobby = (await app.categories.create('취미')).id;
  const s1 = await app.schedules.create({ title: 'h1', startAt: at(1), categoryId: hobby, notifyAtStart: false });

  // categories.remove 를 강제로 실패시킨다.
  const original = app.db.categories;
  const brokenRepo = app.categories as unknown as {
    d: { categories: { remove: (id: number) => Promise<void> } };
  };
  const realRemove = brokenRepo.d.categories.remove.bind(brokenRepo.d.categories);
  brokenRepo.d.categories.remove = async () => {
    throw new Error('boom');
  };

  await assert.rejects(() => app.categories.remove(hobby), /boom/);

  brokenRepo.d.categories.remove = realRemove;
  void original;

  // 재지정이 롤백되어 여전히 hobby 카테고리를 가리켜야 한다.
  assert.equal((await app.db.schedules.find((s) => s.id === s1.id)).categoryId, hobby);
});

test('E-06-1: categoryId 미지정 시 "기타"로 저장', async () => {
  const app = buildApp({ clock: new FixedClock(NOW, 'UTC') });
  const systemId = await app.db.categories.find((c) => c.isSystem).id;
  const { id } = await app.schedules.create({ title: 'no-cat', startAt: at(1), notifyAtStart: false });
  assert.equal((await app.db.schedules.find((s) => s.id === id)).categoryId, systemId);
});
