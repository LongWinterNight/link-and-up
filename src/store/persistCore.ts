import type { PersistStorage, StorageValue } from 'zustand/middleware';
import { idbAvailable, kvDel, kvReadWithMigration, kvSet } from '@/lib/kv';
import type { PersistedSlice, State } from './types';

/** Единственное место, знающее состав persisted-среза (persist partialize + бэкап М32). */
export function toPersistedSlice(s: State): PersistedSlice {
  return {
    version: s.version,
    posts: s.posts,
    ideas: s.ideas,
    theme: s.theme,
    locale: s.locale,
    calibration: s.calibration,
    calibrationCount: s.calibrationCount,
    isDemo: s.isDemo,
    onboarded: s.onboarded,
    readOnly: s.readOnly,
    auditLog: s.auditLog,
    rules: s.rules,
    ownAuthor: s.ownAuthor,
    cadenceGoal: s.cadenceGoal,
    presets: s.presets,
  };
}

/** Ошибки записи показываются пользователю; обработчик инжектится из index (иначе цикл с useStore). */
let onStorageError: (msg: string) => void = () => {};
export function setStorageErrorHandler(fn: (msg: string) => void) {
  onStorageError = fn;
}

const rawLS = typeof window !== 'undefined' ? window.localStorage : null;
let pendingWrite: { name: string; value: StorageValue<PersistedSlice> } | null = null;
let writeTimer: ReturnType<typeof setTimeout> | undefined;

/**
 * SCALE-8 + SCALE-1: отложенная запись (300мс) поверх IndexedDB — без сериализации на каждое
 * действие (111мс на 20K) и без квоты ~5МБ (замер: 15.5МБ). Фолбэк LS для сред без IDB.
 */
const flushPersist = () => {
  if (!pendingWrite) return;
  const { name, value } = pendingWrite;
  pendingWrite = null;
  if (idbAvailable()) {
    void kvSet(name, value).catch(() => {
      onStorageError('Не удалось сохранить данные — экспортируйте бэкап из настроек.');
    });
    return;
  }
  try {
    rawLS?.setItem(name, JSON.stringify(value));
  } catch {
    onStorageError('Хранилище браузера переполнено — данные не сохраняются. Экспортируйте корпус.');
  }
};

/**
 * Гейт записи до конца гидратации: эффекты (локаль/тема) дёргают set() ДО того, как асинхронная
 * IDB-гидратация вернёт сохранённое состояние — без гейта persist записал бы дефолтный снапшот
 * поверх данных пользователя (race пойман live-проверкой миграции).
 */
let persistWritable = false;
export const markPersistWritable = () => {
  persistWritable = true;
};

export const debouncedStorage: PersistStorage<PersistedSlice> = {
  // SCALE-1: чтение с миграцией из legacy-localStorage и восстановлением из .bak-снапшота
  getItem: (name) => kvReadWithMigration<StorageValue<PersistedSlice>>(name, rawLS),
  setItem: (name, value) => {
    if (!persistWritable) return; // пре-гидратационный снапшот = дефолты, писать нельзя
    pendingWrite = { name, value };
    clearTimeout(writeTimer);
    writeTimer = setTimeout(flushPersist, 300);
  },
  removeItem: (name) => {
    clearTimeout(writeTimer);
    pendingWrite = null;
    rawLS?.removeItem(name);
    if (idbAvailable()) {
      void kvDel(name).catch(() => {});
      void kvDel(name + '.bak').catch(() => {});
    }
  },
};

if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', flushPersist);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushPersist();
  });
}
