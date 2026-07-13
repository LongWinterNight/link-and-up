/**
 * SCALE-1 (Б10): key-value слой поверх IndexedDB для persist-состояния.
 * Зачем: квота localStorage ~5МБ — замер показал 15.5МБ на 20K постов (молчаливая потеря данных);
 * IndexedDB даёт гигабайты И structured clone вместо JSON.stringify (быстрее flush).
 * Фолбэк на localStorage там, где IndexedDB недоступен (jsdom-тесты, экзотические среды).
 * Слой намеренно узкий (get/set/del) — под будущий облачный синк меняется только он.
 */

const DB_NAME = 'link-and-up';
const STORE = 'kv';

export function idbAvailable(): boolean {
  return typeof indexedDB !== 'undefined';
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

export async function kvGet<T>(key: string): Promise<T | undefined> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(key);
    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror = () => reject(req.error);
  });
}

export async function kvSet(key: string, value: unknown): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function kvDel(key: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Чтение persist-значения с тремя уровнями устойчивости:
 * 1) IndexedDB → 2) legacy localStorage (прозрачная миграция: скопировать в IDB, удалить из LS)
 * → 3) авто-снапшот `<key>.bak` (восстановление после порчи основного ключа).
 * После успешного чтения обновляет .bak (М33: снапшот на старте сессии).
 */
export async function kvReadWithMigration<T>(key: string, ls: Storage | null): Promise<T | null> {
  if (!idbAvailable()) {
    const s = ls?.getItem(key);
    return s ? (JSON.parse(s) as T) : null;
  }
  let value: T | null = (await kvGet<T>(key)) ?? null;
  if (value == null && ls) {
    const legacy = ls.getItem(key);
    if (legacy) {
      value = JSON.parse(legacy) as T;
      void kvSet(key, value)
        .then(() => ls.removeItem(key))
        .catch(() => {});
    }
  }
  if (value == null) {
    const bak = (await kvGet<T>(key + '.bak')) ?? null;
    if (bak != null) value = bak;
  }
  if (value != null) void kvSet(key + '.bak', value).catch(() => {});
  return value;
}
