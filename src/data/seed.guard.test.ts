import { describe, expect, it } from 'vitest';
import { validateRecord } from '@/lib/dedup';
import { enrichAll } from '@/lib/enrich';
import { seedPosts } from './seed';

/**
 * COR-7: data-guard демо-корпуса. Ломается при случайной порче seed_posts.json
 * (ручные правки, чистки, миграции формата).
 */
describe('демо-корпус (seed_posts.json)', () => {
  it('canary: ровно 289 записей', () => {
    expect(seedPosts).toHaveLength(289);
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

  it('провенанс (P-5): прямых url в демо нет — пермалинки при сборе не верифицировались', () => {
    // директива data-provenance-rule: непроверенное не хранится; источник ищется по цитате (links.ts)
    const withUrl = seedPosts.filter((p) => (p.url || '').trim());
    expect(withUrl.map((p) => p.url)).toEqual([]);
  });

  it('имена авторов чистые: без суффиксов сборщика «(EN)»/«(N)»; язык оригинала — в поле lang', () => {
    const suffixed = seedPosts.filter((p) => /\((?:EN|\d+)\)\s*$/.test(p.author || ''));
    expect(suffixed.map((p) => p.author)).toEqual([]);
    // 113 EN-оригиналов зафиксированы полем lang при чистке пометок из имён
    expect(seedPosts.filter((p) => p.lang === 'EN')).toHaveLength(113);
  });

  it('enrichAll обрабатывает корпус без исключений и без личных аннотаций', () => {
    const posts = enrichAll(seedPosts);
    expect(posts).toHaveLength(289);
    // страж деперсонализации: аннотации сборщика не должны вернуться в корпус
    const leaks = posts.filter((p) => /Алексе[яюем]\b|Черненко|СПбГСК|HH_for/i.test(p.text));
    expect(leaks.map((p) => p.author)).toEqual([]);
  });
});
