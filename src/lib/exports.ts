import type { Idea, Post, Rule } from '@/types';
import { CLUSTER_LABEL, FORMULAS, SCHEMA_VERSION, STATUS_LABEL } from './constants';
import { validateContent, hasHardFlag, redactHard } from './guardrails';

export interface ExportLabels {
  col: {
    author: string;
    headline: string;
    lang: string;
    cluster: string;
    hook: string;
    structure: string;
    cta: string;
    emotion: string;
    flags: string;
    reactions: string;
    comments: string;
    reposts: string;
    followers: string;
    er: string;
    metrics: string;
    own: string;
    date: string;
    url: string;
    angle: string;
    yes: string;
    no: string;
  };
  idea: {
    title: string;
    hook: string;
    cluster: string;
    formula: string;
    source: string;
    channel: string;
    status: string;
    date: string;
    ref: string;
    forecast: string;
    actual: string;
    redaction: string;
  };
  audit: {
    time: string;
    event: string;
  };
  redacted: {
    title: string;
    hook: string;
  };
}

// ---------- JSON ----------
export function exportPostsJson(posts: Post[], rules?: Rule[]): string {
  const out = posts.map((p) => ({
    query: p.query,
    author: redactHard(p.author, rules),
    headline: redactHard(p.headline, rules),
    age: p.age,
    reactions: p.reactions,
    comments: p.comments,
    reposts: p.reposts,
    text: redactHard(p.text, rules),
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
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  s = s.replace(/"/g, '""');
  return /[",\n;]/.test(s) ? '"' + s + '"' : s;
}

export function exportPostsCsv(
  posts: Post[],
  rules?: Rule[],
  clusterName?: (id: string) => string,
  labels?: ExportLabels,
): string {
  const c = labels?.col;
  const head = c
    ? [
        c.author,
        c.headline,
        c.lang,
        c.cluster,
        c.hook,
        c.structure,
        c.cta,
        c.emotion,
        c.flags,
        c.reactions,
        c.comments,
        c.reposts,
        c.followers,
        c.er,
        c.metrics,
        c.own,
        c.date,
        c.url,
        c.angle,
      ]
    : [
        'Автор',
        'Заголовок',
        'Язык',
        'Кластер',
        'Хук',
        'Структура',
        'CTA',
        'Эмоция',
        'Приёмы',
        'Реакции',
        'Комментарии',
        'Репосты',
        'Подписчики',
        'ER,%',
        'Есть метрики',
        'Свой',
        'Дата сбора',
        'URL',
        'Угол',
      ];
  const yes = c?.yes || 'да';
  const no = c?.no || 'нет';
  const rows = posts.map((p) =>
    [
      redactHard(p.author, rules),
      redactHard(p.headline, rules),
      p.lang,
      clusterName ? clusterName(p.meta_cluster) : CLUSTER_LABEL[p.meta_cluster] || p.meta_cluster,
      p.tags.hook_type,
      p.tags.structure,
      p.tags.cta_type,
      p.tags.emotion,
      p.tags.flags.join('|'),
      p.has_metrics ? p.reactions : '',
      p.has_metrics ? p.comments : '',
      p.reposts,
      p.followers == null ? '' : p.followers,
      p.rate == null ? '' : (p.rate * 100).toFixed(3),
      p.has_metrics ? yes : no,
      p.is_own ? yes : no,
      p.collected_at,
      p.url,
      p.query,
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

export function redactIdea(idea: Idea, rules?: Rule[], labels?: ExportLabels): RedactedIdea {
  const flags = validateContent((idea.title || '') + ' ' + (idea.hook || '') + ' ' + (idea.source || ''), rules);
  if (hasHardFlag(flags)) {
    return {
      title: labels?.redacted.title || '[скрыто: блокирующие гардрейлы]',
      hook:
        (labels?.redacted.hook || 'Идея содержит блокирующие нарушения гардрейлов и не выгружается. Исправьте: ') +
        flags
          .filter((f) => f.severity === 'hard')
          .map((f) => f.message)
          .join('; '),
      redacted: true,
      note: 'redacted',
    };
  }
  return { title: idea.title, hook: idea.hook, redacted: false, note: '' };
}

export function exportIdeasCsv(
  ideas: Idea[],
  posts: Post[],
  rules?: Rule[],
  clusterName?: (id: string) => string,
  labels?: ExportLabels,
): string {
  const i = labels?.idea;
  const head = i
    ? [
        i.title,
        i.hook,
        i.cluster,
        i.formula,
        i.source,
        i.channel,
        i.status,
        i.date,
        i.ref,
        i.forecast,
        i.actual,
        i.redaction,
      ]
    : [
        'Заголовок',
        'Хук',
        'Кластер',
        'Формула',
        'Источник',
        'Канал',
        'Статус',
        'Плановая дата',
        'Референс',
        'Прогноз',
        'Факт-комменты',
        'Редакция',
      ];
  const rows = ideas.map((idea) => {
    const r = redactIdea(idea, rules, labels);
    const rp = idea.refPostId ? posts.find((p) => p.id === idea.refPostId) : null;
    return [
      r.title,
      r.hook,
      clusterName ? clusterName(idea.cluster) : CLUSTER_LABEL[idea.cluster] || idea.cluster,
      FORMULAS.find((f) => f.id === idea.formula)?.title || idea.formula,
      r.redacted ? '' : redactHard(idea.source, rules),
      idea.channel,
      STATUS_LABEL[idea.status] || idea.status,
      idea.date,
      rp?.author || '',
      idea.predicted || '',
      idea.actual ? idea.actual.comments : '',
      r.note,
    ]
      .map(csvCell)
      .join(',');
  });
  return '﻿' + head.join(',') + '\n' + rows.join('\n');
}

// ---------- Markdown (Obsidian и любой markdown-vault) ----------
export function exportObsidian(ideas: Idea[], rules?: Rule[], clusterName?: (id: string) => string): string {
  let md = '# Формулы победителей\n\n';
  for (const f of FORMULAS) {
    md += '## ' + f.title + '\n' + f.body + '\n\nКластер: [[' + (CLUSTER_LABEL[f.cluster] || f.cluster) + ']]\n\n';
  }
  md += '# Идеи постов\n\n';
  for (const i of ideas) {
    const r = redactIdea(i, rules);
    md += '## ' + (r.title || 'Без названия') + '\n';
    md += '- Хук: ' + (r.hook || '') + '\n';
    md += '- Кластер: [[' + (clusterName ? clusterName(i.cluster) : CLUSTER_LABEL[i.cluster] || i.cluster) + ']]\n';
    md += '- Формула: [[' + (FORMULAS.find((f) => f.id === i.formula)?.title || i.formula) + ']]\n';
    md += '- Источник: ' + (r.redacted ? '—' : redactHard(i.source, rules) || '—') + '\n';
    md += '- Канал: ' + i.channel + ' · Статус: ' + (STATUS_LABEL[i.status] || i.status);
    if (r.redacted) md += ' · ⚠️ скрыто (гардрейлы)';
    md += '\n\n';
  }
  return md;
}

// ---------- OBS-1: журнал действий ----------
export function exportAuditCsv(log: { t: string; msg: string }[], labels?: ExportLabels): string {
  const head = labels ? [labels.audit.time, labels.audit.event] : ['Время (ISO)', 'Событие'];
  const rows = log.map((e) => [e.t, e.msg].map(csvCell).join(','));
  return '﻿' + head.join(',') + '\n' + rows.join('\n');
}
