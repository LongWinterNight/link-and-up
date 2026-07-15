import { describe, expect, it } from 'vitest';
import { validateRecord } from '@/lib/dedup';
import { enrichAll } from '@/lib/enrich';
import { seedPosts } from './seed';

/**
 * COR-7: data-guard демо-корпуса. Ломается при случайной порче seed_posts.json
 * (ручные правки, чистки, миграции формата).
 */
describe('демо-корпус (seed_posts.json)', () => {
  it('canary: ровно 480 записей (289 исходных + 191 верифицированный новый)', () => {
    expect(seedPosts).toHaveLength(480);
  });

  it('каждая запись проходит validateRecord', () => {
    const errs: string[] = [];
    seedPosts.forEach((p, i) => {
      const v = validateRecord(p, i);
      if (!v.ok) errs.push(...v.errs);
    });
    expect(errs).toEqual([]);
  });

  it('метрики — неотрицательные числа, collected_at заполнен', () => {
    for (const p of seedPosts) {
      for (const f of ['reactions', 'comments', 'reposts'] as const) {
        const v = Number(p[f] ?? 0);
        expect(Number.isFinite(v)).toBe(true);
        expect(v).toBeGreaterThanOrEqual(0);
      }
      expect(typeof p.collected_at).toBe('string');
      expect(p.collected_at!.length).toBeGreaterThan(0);
    }
  });

  it('провенанс (P-5 ш.2): url либо пуст, либо реальный пермалинк С датой верификации', () => {
    // директива data-provenance-rule: url хранится только проверенный переходом (verified_at обязателен)
    const bad = seedPosts.filter((p) => {
      const url = (p.url || '').trim();
      if (!url) return false;
      const isPermalink = /linkedin\.com\/posts\/.+activity-\d{19}-[\w-]+/i.test(url);
      return !isPermalink || !(p as { verified_at?: string }).verified_at;
    });
    expect(bad.map((p) => p.author)).toEqual([]);
  });

  it('тексты без authwall-мусора и пометок сборщика', () => {
    const dirty = seedPosts.filter((p) =>
      /Согласиться и присоединиться|Выполните вход|cold-join|session_redirect/i.test(p.text || ''),
    );
    expect(dirty.map((p) => p.author)).toEqual([]);
  });

  it('имена авторов чистые: без суффиксов сборщика «(EN)»/«(N)»; язык оригинала — в поле lang', () => {
    const suffixed = seedPosts.filter((p) => /\((?:EN|\d+)\)\s*$/.test(p.author || ''));
    expect(suffixed.map((p) => p.author)).toEqual([]);
    // ≥113 EN-оригиналов (113 из чистки пометок + EN-посты новых волн сбора)
    expect(seedPosts.filter((p) => p.lang === 'EN').length).toBeGreaterThanOrEqual(113);
  });

  it('enrichAll обрабатывает корпус без исключений и без личных аннотаций', () => {
    const posts = enrichAll(seedPosts);
    expect(posts).toHaveLength(seedPosts.length);
    // страж деперсонализации: аннотации сборщика не должны вернуться в корпус
    const leaks = posts.filter((p) => /Алексе[яюем]\b|Черненко|СПбГСК|HH_for/i.test(p.text));
    expect(leaks.map((p) => p.author)).toEqual([]);
  });
});
