import type { Idea, Post, Rule } from '@/types';
import { CLUSTER_LABEL, FORMULAS, SCHEMA_VERSION, STATUS_LABEL } from './constants';
import { validateIdea, hasHardFlag } from './guardrails';

// ---------- JSON ----------
export function exportPostsJson(posts: Post[]): string {
  const out = posts.map((p) => ({
    query: p.query,
    author: p.author,
    headline: p.headline,
    age: p.age,
    reactions: p.reactions,
    comments: p.comments,
    reposts: p.reposts,
    text: p.text,
    url: p.url,
    collected_at: p.collected_at,
    schema_version: SCHEMA_VERSION,
    is_own: p.is_own,
    tags: p.tags,
    meta_cluster: p.meta_cluster,
    lang: p.lang,
    has_metrics: p.has_metrics,
  }));
  return JSON.stringify(out, null, 2);
}

// ---------- CSV ----------
export function csvCell(v: unknown): string {
  let s = v == null ? '' : String(v);
  // CSV/Excel formula injection: ячейку, начинающуюся с = + - @ Tab CR, префиксуем '
  // (импортированный текст управляется пользователем и мог бы выполниться формулой в Excel/Sheets).
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  s = s.replace(/"/g, '""');
  return /[",\n;]/.test(s) ? '"' + s + '"' : s;
}

export function exportPostsCsv(posts: Post[]): string {
  const head = [
    'Автор', 'Заголовок', 'Язык', 'Кластер', 'Хук', 'Структура', 'CTA', 'Эмоция', 'Приёмы',
    'Реакции', 'Комментарии', 'Репосты', 'Подписчики', 'ER,%', 'Есть метрики', 'Свой', 'Дата сбора', 'URL', 'Угол',
  ];
  const rows = posts.map((p) =>
    [
      p.author, p.headline, p.lang, CLUSTER_LABEL[p.meta_cluster] || p.meta_cluster,
      p.tags.hook_type, p.tags.structure, p.tags.cta_type, p.tags.emotion, p.tags.flags.join('|'),
      p.has_metrics ? p.reactions : '', p.has_metrics ? p.comments : '', p.reposts,
      p.followers == null ? '' : p.followers, p.rate == null ? '' : (p.rate * 100).toFixed(3),
      p.has_metrics ? 'да' : 'нет', p.is_own ? 'да' : 'нет', p.collected_at, p.url, p.query,
    ]
      .map(csvCell)
      .join(','),
  );
  return '﻿' + head.join(',') + '\n' + rows.join('\n');
}

// ---------- редакция экспорта идей по гардрейлам ----------
interface RedactedIdea {
  title: string;
  hook: string;
  redacted: boolean;
  note: string;
}

/** Идея с блокирующими (hard) нарушениями гардрейлов не выгружается наружу. */
export function redactIdea(idea: Idea, rules?: Rule[]): RedactedIdea {
  const flags = validateIdea(idea, rules);
  if (hasHardFlag(flags)) {
    return {
      title: '[скрыто: блокирующие гардрейлы]',
      hook: 'Идея содержит блокирующие нарушения гардрейлов и не выгружается. Исправьте: ' + flags.filter((f) => f.severity === 'hard').map((f) => f.message).join('; '),
      redacted: true,
      note: 'redacted',
    };
  }
  return { title: idea.title, hook: idea.hook, redacted: false, note: '' };
}

export function exportIdeasCsv(ideas: Idea[], posts: Post[], rules?: Rule[]): string {
  const head = ['Заголовок', 'Хук', 'Кластер', 'Формула', 'Источник', 'Канал', 'Статус', 'Плановая дата', 'Референс', 'Прогноз', 'Факт-комменты', 'Редакция'];
  const rows = ideas.map((i) => {
    const r = redactIdea(i, rules);
    const rp = i.refPostId ? posts.find((p) => p.id === i.refPostId) : null;
    return [
      r.title, r.hook, CLUSTER_LABEL[i.cluster] || i.cluster,
      FORMULAS.find((f) => f.id === i.formula)?.title || i.formula,
      i.source, i.channel, STATUS_LABEL[i.status] || i.status, i.date, rp?.author || '',
      i.predicted || '', i.actual ? i.actual.comments : '', r.note,
    ]
      .map(csvCell)
      .join(',');
  });
  return '﻿' + head.join(',') + '\n' + rows.join('\n');
}

// ---------- Markdown (Obsidian и любой markdown-vault) ----------
export function exportObsidian(ideas: Idea[], rules?: Rule[]): string {
  let md = '# Формулы победителей\n\n';
  for (const f of FORMULAS) {
    md += '## ' + f.title + '\n' + f.body + '\n\nКластер: [[' + (CLUSTER_LABEL[f.cluster] || f.cluster) + ']]\n\n';
  }
  md += '# Идеи постов\n\n';
  for (const i of ideas) {
    const r = redactIdea(i, rules);
    md += '## ' + (r.title || 'Без названия') + '\n';
    md += '- Хук: ' + (r.hook || '') + '\n';
    md += '- Кластер: [[' + (CLUSTER_LABEL[i.cluster] || i.cluster) + ']]\n';
    md += '- Формула: [[' + (FORMULAS.find((f) => f.id === i.formula)?.title || i.formula) + ']]\n';
    md += '- Источник: ' + (i.source || '—') + '\n';
    md += '- Канал: ' + i.channel + ' · Статус: ' + (STATUS_LABEL[i.status] || i.status);
    if (r.redacted) md += ' · ⚠️ скрыто (гардрейлы)';
    md += '\n\n';
  }
  return md;
}
