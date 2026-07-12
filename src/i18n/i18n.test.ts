import { describe, expect, it } from 'vitest';
import { ensureLocale, tr, intlLocale } from './index';
import { ru } from './ru';

describe('i18n (FE-3)', () => {
  it('до загрузки словаря en падает на ru (без мигания ключей)', () => {
    // en ещё не загружен в этом тесте-файле — tr обязан вернуть русский текст
    expect(tr('en', 'app.load')).toBe(ru['app.load']);
  });

  it('после ensureLocale(en) возвращает английский перевод', async () => {
    await ensureLocale('en');
    expect(tr('en', 'app.load')).toBe('Import');
    expect(tr('en', 'today.h1')).toBe('What are we publishing today');
    // ru не задет
    expect(tr('ru', 'today.h1')).toBe('Что публикуем сегодня');
  });

  it('en-словарь покрывает все ключи ru (типы это гарантируют, тест — от рассинхрона в рантайме)', async () => {
    await ensureLocale('en');
    const { en } = await import('./en');
    const ruKeys = Object.keys(ru).sort();
    const enKeys = Object.keys(en).sort();
    expect(enKeys).toEqual(ruKeys);
  });

  it('intlLocale маппит локали форматирования', () => {
    expect(intlLocale('ru')).toBe('ru-RU');
    expect(intlLocale('en')).toBe('en-US');
  });
});
