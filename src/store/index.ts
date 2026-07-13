import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DEFAULT_CLUSTER_DEFS, LS_KEY, SCHEMA_VERSION } from '@/lib/constants';
import { activeWorkspace, storageKeyFor } from '@/lib/workspaces';
import { enrich } from '@/lib/enrich';
import { recalcCalibration } from '@/lib/forecast';
import { createUiSlice } from './uiSlice';
import { createPostsSlice } from './postsSlice';
import { createIdeasSlice } from './ideasSlice';
import { createSettingsSlice } from './settingsSlice';
import { debouncedStorage, markPersistWritable, setStorageErrorHandler, toPersistedSlice } from './persistCore';
import type { State } from './types';

/**
 * Б10: стор собран из слайсов (ui / posts / ideas / settings) — расслоение под
 * воркспейсы (Б5) и облачный синк (G-1): storage-слой заменяется в persistCore,
 * не трогая слайсы. Публичный API не изменился.
 */
// Б5: ключ хранилища зависит от активного воркспейса (реестр — синхронный LS, читается до гидратации)
const wsStorageKey =
  typeof window !== 'undefined' ? storageKeyFor(LS_KEY, activeWorkspace(window.localStorage)) : LS_KEY;

export const useStore = create<State>()(
  persist(
    (...a) => ({
      version: SCHEMA_VERSION,
      ...createUiSlice(...a),
      ...createPostsSlice(...a),
      ...createIdeasSlice(...a),
      ...createSettingsSlice(...a),
    }),
    {
      name: wsStorageKey,
      version: SCHEMA_VERSION,
      storage: debouncedStorage,
      partialize: toPersistedSlice,
      migrate: (persisted: unknown, fromVersion) => {
        const s = persisted as Partial<State> | undefined;
        if (!s) return s as unknown as State;
        // v1 → v2: гарантировать обогащённые поля на постах
        if (fromVersion < 2 && Array.isArray(s.posts)) {
          s.posts = s.posts.map((p) => enrich(p));
        }
        // v2 → v3 (NICHE-1): реестр кластеров — встроенная AI-ниша по умолчанию
        if (fromVersion < 3 && !Array.isArray(s.clusters)) {
          s.clusters = DEFAULT_CLUSTER_DEFS.map((c) => ({ ...c }));
        }
        return s as State;
      },
    },
  ),
);

// ошибки записи хранилища — пользователю тостом (инжект, чтобы persistCore не зависел от стора)
setStorageErrorHandler((msg) => useStore.getState().flash(msg));

// запись persist открывается только после гидратации (race пойман live-проверкой миграции)
useStore.persist.onFinishHydration(markPersistWritable);
if (useStore.persist.hasHydrated()) markPersistWritable();

/** Пересчитать калибровку из текущих идей (вызывать после сохранения фактов). */
export function refreshCalibration() {
  const { ideas, calibration } = useStore.getState();
  const c = recalcCalibration(ideas, calibration);
  useStore.setState({ calibration: c.calibration });
  return c;
}

export * from './types';
export { toPersistedSlice, markPersistWritable } from './persistCore';
