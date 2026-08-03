import { SCHEMA_VERSION } from './constants';
import type { PersistedSlice } from '@/store';

export interface BackupLabels {
  notJson: string;
  notOurs: string;
  badSchema: (found: number, current: number) => string;
  corrupt: string;
}

/**
 * М32 (Б10): бэкап/восстановление всего состояния одним JSON.
 * Страховка данных: localStorage/IndexedDB хрупки к очистке браузера — явный файл у пользователя
 * надёжнее любого автоснапшота. Формат — конверт с версией схемы.
 */
export interface BackupFile {
  app: 'link-and-up';
  schema: number;
  exportedAt: string;
  state: PersistedSlice;
}

export function exportStateJson(state: PersistedSlice): string {
  const file: BackupFile = {
    app: 'link-and-up',
    schema: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    state,
  };
  return JSON.stringify(file, null, 2);
}

/** Валидация и разбор бэкапа. Бросает Error с человеческим сообщением. */
export function parseBackup(text: string, labels?: BackupLabels): BackupFile {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error(labels?.notJson || 'Файл не является корректным JSON');
  }
  const f = raw as Partial<BackupFile>;
  if (f?.app !== 'link-and-up') throw new Error(labels?.notOurs || 'Это не бэкап Link-and-Up (нет маркера app)');
  if (typeof f.schema !== 'number' || f.schema < 1 || f.schema > SCHEMA_VERSION) {
    throw new Error(
      labels?.badSchema(f.schema!, SCHEMA_VERSION) ||
        `Версия схемы бэкапа (${f.schema}) новее текущей (${SCHEMA_VERSION}) или некорректна`,
    );
  }
  const s = f.state as PersistedSlice | undefined;
  if (!s || !Array.isArray(s.posts) || !Array.isArray(s.ideas) || !Array.isArray(s.rules)) {
    throw new Error(labels?.corrupt || 'Бэкап повреждён: отсутствуют обязательные поля состояния');
  }
  return f as BackupFile;
}
