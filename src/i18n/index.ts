import { ru, type DictKey } from './ru';

export type Locale = 'ru' | 'en';
export type { DictKey };

/** Реестр словарей. ru — в бандле (дефолт), en — ленивый чанк (FE-2-дисциплина). */
const dicts: Partial<Record<Locale, Record<DictKey, string>>> = { ru };

export async function ensureLocale(l: Locale): Promise<void> {
  if (dicts[l]) return;
  if (l === 'en') dicts.en = (await import('./en')).en;
}

export function isLocaleLoaded(l: Locale): boolean {
  return !!dicts[l];
}

/** Перевод по ключу. Недостающее в локали падает на ru; неизвестный ключ возвращается как есть. */
export function tr(locale: Locale, key: DictKey): string {
  return dicts[locale]?.[key] ?? ru[key] ?? key;
}

/** Автоопределение на первом запуске (persist перекрывает). */
export function detectLocale(): Locale {
  if (typeof navigator !== 'undefined' && /^en/i.test(navigator.language || '')) return 'en';
  return 'ru';
}

export function intlLocale(l: Locale): string {
  return l === 'en' ? 'en-US' : 'ru-RU';
}
