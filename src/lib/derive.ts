import type { ClusterId, Post } from '@/types';
import { CLUSTERS } from './constants';
import { median } from './stats';
import type { Filters } from '@/store';

/** Угол сбора без префикса tavily:/own: */
export function angleOf(query: string): string {
  return (query || '').replace(/^(tavily|own):/, '').trim() || '—';
}

export interface Kpis {
  total: number;
  withMetrics: number;
  withMetricsPct: number;
  angles: number;
  ru: number;
  en: number;
  medComments: number | null;
  maxComments: number | null;
  medRatePct: number | null;
}

/** Ключевые метрики. 0=неизвестно НЕ попадает в средние (учитываем только has_metrics). */
export function kpis(posts: Post[]): Kpis {
  const metric = posts.filter((p) => p.has_metrics);
  const comments = metric.map((p) => p.comments);
  const rates = metric.filter((p) => p.rate != null).map((p) => (p.rate as number) * 100);
  const angles = new Set(posts.map((p) => angleOf(p.query)));
  return {
    total: posts.length,
    withMetrics: metric.length,
    withMetricsPct: posts.length ? Math.round((metric.length / posts.length) * 100) : 0,
    angles: angles.size,
    ru: posts.filter((p) => p.lang === 'RU').length,
    en: posts.filter((p) => p.lang === 'EN').length,
    medComments: comments.length ? median(comments) : null,
    maxComments: comments.length ? Math.max(...comments) : null,
    medRatePct: rates.length ? Math.round(median(rates) * 100) / 100 : null,
  };
}

export interface ClusterStat {
  id: ClusterId;
  label: string;
  count: number;
  metricCount: number;
  medComments: number | null;
  maxComments: number | null;
}

export function clusterStats(posts: Post[]): ClusterStat[] {
  return CLUSTERS.map(([id, label]) => {
    const inCluster = posts.filter((p) => p.meta_cluster === id);
    const metric = inCluster.filter((p) => p.has_metrics);
    const comments = metric.map((p) => p.comments);
    return {
      id,
      label,
      count: inCluster.length,
      metricCount: metric.length,
      medComments: comments.length ? median(comments) : null,
      maxComments: comments.length ? Math.max(...comments) : null,
    };
  }).sort((a, b) => b.count - a.count);
}

export function topByComments(posts: Post[], n = 15): Post[] {
  return posts.filter((p) => p.has_metrics).sort((a, b) => b.comments - a.comments).slice(0, n);
}

export function topByRate(posts: Post[], n = 15): Post[] {
  return posts.filter((p) => p.rate != null).sort((a, b) => (b.rate as number) - (a.rate as number)).slice(0, n);
}

/** Динамика сбора по месяцам (YYYY-MM). */
export function collectionByMonth(posts: Post[]): { label: string; value: number }[] {
  const m = new Map<string, number>();
  for (const p of posts) {
    const key = (p.collected_at || '').slice(0, 7) || '—';
    m.set(key, (m.get(key) || 0) + 1);
  }
  return [...m.entries()].filter(([k]) => k !== '—').sort((a, b) => a[0].localeCompare(b[0])).map(([label, value]) => ({ label, value }));
}

export interface DataQuality {
  metricsPct: number;
  followersPct: number;
  ratePct: number;
  clusteredPct: number;
}

export function dataQuality(posts: Post[]): DataQuality {
  const n = posts.length || 1;
  return {
    metricsPct: Math.round((posts.filter((p) => p.has_metrics).length / n) * 100),
    followersPct: Math.round((posts.filter((p) => p.followers != null).length / n) * 100),
    ratePct: Math.round((posts.filter((p) => p.rate != null).length / n) * 100),
    clusteredPct: Math.round((posts.filter((p) => p.meta_cluster !== 'other').length / n) * 100),
  };
}

/** Средние комментарии среди постов с метриками, сгруппированные по приёму (hook/structure/cta/emotion). */
export function effectivenessBy(posts: Post[], key: 'hook_type' | 'structure' | 'cta_type' | 'emotion'): { label: string; avg: number; n: number }[] {
  const metric = posts.filter((p) => p.has_metrics);
  const groups = new Map<string, number[]>();
  for (const p of metric) {
    const g = p.tags[key];
    groups.set(g, [...(groups.get(g) || []), p.comments]);
  }
  return [...groups.entries()]
    .map(([label, vals]) => ({ label, avg: Math.round(vals.reduce((a, b) => a + b, 0) / vals.length), n: vals.length }))
    .sort((a, b) => b.avg - a.avg);
}

/** Распределение по значению приёма (для donut). */
export function distributionBy(posts: Post[], key: 'hook_type' | 'structure' | 'cta_type' | 'emotion'): { label: string; value: number }[] {
  const m = new Map<string, number>();
  for (const p of posts) m.set(p.tags[key], (m.get(p.tags[key]) || 0) + 1);
  return [...m.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
}

/** P-6: день публикации по каденсу (вт/чт) — триггер «что публикуем сегодня». */
export function isPostingDay(d = new Date()): boolean {
  const w = d.getDay();
  return w === 2 || w === 4;
}

export interface CorpusFreshness {
  latest: string | null;
  ageDays: number | null;
  stale: boolean;
}

/**
 * D3: метка свежести корпуса. Прогноз обучен на прошлом режиме платформы —
 * чем старше последний сбор, тем меньше доверия паттернам (stale после 90 дней).
 */
export function corpusFreshness(posts: Post[], now = new Date()): CorpusFreshness {
  const dates = posts.map((p) => p.collected_at || '').filter(Boolean).sort();
  if (!dates.length) return { latest: null, ageDays: null, stale: false };
  const latest = dates[dates.length - 1];
  const ms = now.getTime() - new Date(latest + 'T00:00:00').getTime();
  const ageDays = Math.max(0, Math.floor(ms / 86400000));
  return { latest, ageDays, stale: ageDays > 90 };
}

const num = (s: string): number | null => {
  const t = (s || '').trim();
  if (t === '') return null;
  const n = Number(t);
  return isNaN(n) ? null : n;
};

/** Отфильтрованный + отсортированный список для Explorer. Чистая функция (мемоизируется в UI). */
export function filterPosts(posts: Post[], search: string, f: Filters): Post[] {
  const q = search.trim().toLowerCase();
  const minC = num(f.minC);
  const maxC = num(f.maxC);
  const minER = num(f.minER);
  let out = posts.filter((p) => {
    if (q && !(p.author.toLowerCase().includes(q) || p.text.toLowerCase().includes(q) || p.query.toLowerCase().includes(q)))
      return false;
    if (f.cluster !== 'all' && p.meta_cluster !== f.cluster) return false;
    if (f.lang !== 'all' && p.lang !== f.lang) return false;
    if (f.metrics === 'yes' && !p.has_metrics) return false;
    if (f.metrics === 'no' && p.has_metrics) return false;
    if (f.hook !== 'all' && p.tags.hook_type !== f.hook) return false;
    if (f.structure !== 'all' && p.tags.structure !== f.structure) return false;
    if (minC != null && p.comments < minC) return false;
    if (maxC != null && p.comments > maxC) return false;
    if (minER != null && (p.rate == null || p.rate * 100 < minER)) return false;
    if (f.dateFrom && (p.collected_at || '') < f.dateFrom) return false;
    if (f.dateTo && (p.collected_at || '') > f.dateTo) return false;
    return true;
  });
  const sort = f.sort;
  out = [...out].sort((a, b) => {
    if (sort === 'comments') return b.comments - a.comments;
    if (sort === 'reactions') return b.reactions - a.reactions;
    if (sort === 'rate') return (b.rate ?? -1) - (a.rate ?? -1);
    if (sort === 'date') return (b.collected_at || '').localeCompare(a.collected_at || '');
    return 0;
  });
  return out;
}
