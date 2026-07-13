/* SCALE-1: тесты IndexedDB-слоя на fake-indexeddb (в jsdom IndexedDB нет). */
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { idbAvailable, kvDel, kvGet, kvReadWithMigration, kvSet } from './kv';

const KEY = 'test-key';

beforeEach(async () => {
  await kvDel(KEY);
  await kvDel(KEY + '.bak');
  localStorage.removeItem(KEY);
});

describe('kv (IndexedDB)', () => {
  it('idbAvailable с fake-indexeddb', () => {
    expect(idbAvailable()).toBe(true);
  });

  it('set/get roundtrip со structured clone (объект, не строка)', async () => {
    const value = { state: { posts: [{ id: 1, text: 'привет' }] }, version: 2 };
    await kvSet(KEY, value);
    const got = await kvGet<typeof value>(KEY);
    expect(got).toEqual(value);
    expect(got).not.toBe(value); // клон, не ссылка
  });

  it('миграция из legacy localStorage: значение читается и переезжает в IDB', async () => {
    const legacy = { state: { posts: [], theme: 'dark' }, version: 2 };
    localStorage.setItem(KEY, JSON.stringify(legacy));
    const got = await kvReadWithMigration<typeof legacy>(KEY, localStorage);
    expect(got).toEqual(legacy);
    // мигрировало в IDB и ушло из LS (миграция — фоновая, дождёмся тика)
    await new Promise((r) => setTimeout(r, 20));
    expect(await kvGet(KEY)).toEqual(legacy);
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it('восстановление из .bak, когда основной ключ утерян', async () => {
    const snapshot = { state: { posts: [{ id: 'x' }] }, version: 2 };
    await kvSet(KEY + '.bak', snapshot);
    const got = await kvReadWithMigration<typeof snapshot>(KEY, localStorage);
    expect(got).toEqual(snapshot);
  });

  it('успешное чтение обновляет .bak-снапшот (М33)', async () => {
    const value = { state: { n: 1 }, version: 2 };
    await kvSet(KEY, value);
    await kvReadWithMigration(KEY, localStorage);
    await new Promise((r) => setTimeout(r, 20));
    expect(await kvGet(KEY + '.bak')).toEqual(value);
  });

  it('kvDel удаляет', async () => {
    await kvSet(KEY, 1);
    await kvDel(KEY);
    expect(await kvGet(KEY)).toBeUndefined();
  });
});
