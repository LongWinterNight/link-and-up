import { describe, expect, it } from 'vitest';
import type { Post } from '@/types';
import { backtest } from './forecast';
import { clusterStats, filterPosts, kpis } from './derive';
import { DEFAULT_FILTERS } from '@/store';

/**
 * SCALE-7 (Б9): perf-фикстура 20K как регресс-гейт. Пороги в разы выше локальных замеров
 * (бэктест 20K ≈ 40мс) — ловим возврат O(n²)-фризов (был 11.3с), а не дрожание CI-машин.
 */

const CLUSTERS_POOL = ['spec', 'prompt', 'agents', 'jobs', 'solo', 'enable', 'other'];
const HOOKS = ['вопрос', 'цифра-статистика', 'личная история', 'обещание пользы'] as const;

function synthPosts(n: number): Post[] {
  const out: Post[] = [];
  for (let i = 0; i < n; i++) {
    const comments = i % 7 === 0 ? 0 : (i % 97) + 1;
    const followers = i % 3 === 0 ? 5000 + (i % 9000) : null;
    out.push({
      id: 'perf-' + i,
      author: 'Автор ' + (i % 500),
      headline: followers ? followers + ' подписчиков' : '',
      text: 'Синтетический пост №' + i + ' про spec driven и данные с цифрами ' + (i % 100),
      query: 'tavily:perf',
      collected_at: '2026-0' + ((i % 6) + 1) + '-15',
      lang: i % 4 === 0 ? 'EN' : 'RU',
      reactions: comments * 3,
      comments,
      reposts: 0,
      url: '',
      followers,
      rate: followers && comments ? comments / followers : null,
      has_metrics: comments > 0,
      is_own: false,
      meta_cluster: CLUSTERS_POOL[i % CLUSTERS_POOL.length],
      tags: {
        hook_type: HOOKS[i % HOOKS.length],
        structure: 'конспект',
        cta_type: 'без CTA',
        emotion: 'нейтрально',
        flags: i % 2 ? ['has_numbers'] : [],
        formatText: '',
      },
    } as unknown as Post);
  }
  return out;
}

describe('SCALE-7: перф-гейт на 20K постов', () => {
  const posts = synthPosts(20_000);

  it('backtest 20K < 2с (регресс O(n²) давал 11.3с)', () => {
    const t0 = performance.now();
    const bt = backtest(posts);
    const ms = performance.now() - t0;
    expect(bt.mape).not.toBeNull();
    expect(ms).toBeLessThan(2000);
  });

  it('агрегаты (kpis + clusterStats) и фильтрация 20K < 1с', () => {
    const t0 = performance.now();
    kpis(posts);
    clusterStats(posts);
    const list = filterPosts(posts, 'spec', { ...DEFAULT_FILTERS });
    const ms = performance.now() - t0;
    expect(list.length).toBeGreaterThan(0);
    expect(ms).toBeLessThan(1000);
  });
});
