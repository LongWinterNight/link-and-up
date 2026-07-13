import { describe, expect, it } from 'vitest';
import { DEFAULT_MULTIPLIERS, forecast, forecastWithHook } from './forecast';
import { enrich } from './enrich';
import type { Idea, Post } from '@/types';

const mkPost = (id: string, comments: number): Post => ({
  ...enrich({
    author: 'a' + id,
    text: 'пост про spec driven разработку и claude code номер ' + id,
    reactions: comments * 3,
    comments,
    query: 'tavily:claude code spec driven',
  }),
  id,
});

const idea: Idea = {
  id: 'i1',
  title: 'Идея',
  hook: 'Обычная первая строка без приёмов',
  cluster: 'spec',
  formula: 'arch',
  source: '',
  channel: 'LinkedIn',
  status: 'draft',
  date: '',
  refPostId: '',
  predicted: 0,
  actual: null,
};

const posts = [10, 20, 30, 40, 50].map((c, i) => mkPost('p' + i, c));

describe('forecastWithHook — сравнение вариантов (Б7/P-2)', () => {
  it('вариант с сильным хуком ранжируется выше слабого; вариант = текущему хуку даёт тот же результат', () => {
    const base = forecast(idea, posts, 1, DEFAULT_MULTIPLIERS)!;
    const same = forecastWithHook(idea, idea.hook, posts, 1, DEFAULT_MULTIPLIERS)!;
    expect(same.expected).toBe(base.expected);
    expect(same.low).toBe(base.low);

    const strong = forecastWithHook(idea, 'Почему 90% постов умирают за час?', posts, 1, DEFAULT_MULTIPLIERS)!;
    expect(strong.expected).toBeGreaterThan(base.expected);
  });

  it('пустой вариант не ломает прогноз и не выигрывает у осмысленного', () => {
    const empty = forecastWithHook(idea, '', posts, 1, DEFAULT_MULTIPLIERS)!;
    expect(empty.expected).toBeGreaterThan(0);
    const strong = forecastWithHook(idea, 'Почему 90% постов умирают за час?', posts, 1, DEFAULT_MULTIPLIERS)!;
    expect(strong.expected).toBeGreaterThanOrEqual(empty.expected);
  });

  it('исходная идея не мутирует; null-идея → null', () => {
    const before = idea.hook;
    forecastWithHook(idea, 'Другой хук?', posts, 1);
    expect(idea.hook).toBe(before);
    expect(forecastWithHook(null, 'х', posts, 1)).toBeNull();
  });

  it('lowData: без метрик оба варианта честно помечены', () => {
    const noMetrics = posts.map((p) => ({ ...p, has_metrics: false, comments: 0 }));
    const a = forecastWithHook(idea, 'Вариант А?', noMetrics, 1)!;
    expect(a.lowData).toBe(true);
  });
});
