import { describe, expect, it } from 'vitest';
import { assignCluster, buildClusters, tokenize } from './autoCluster';
import { enrich } from './enrich';
import type { Post } from '@/types';

const mk = (id: string, text: string): Post => ({ ...enrich({ author: 'a', text, reactions: 1, comments: 1 }), id });

describe('tokenize', () => {
  it('нижний регистр, ≥3 символов, без стоп-слов и чистых чисел', () => {
    expect(tokenize('Имплантация зубов — это 100 процентов и боль')).toEqual([
      'имплантация',
      'зубов',
      'процентов',
      'боль',
    ]);
    expect(tokenize('The implant costs a lot')).toEqual(['implant', 'costs', 'lot']);
  });
});

describe('buildClusters — динамические кластеры (NICHE-1)', () => {
  // два явных тематических пучка + шум
  const dental = [
    'имплантация зубов циркониевые коронки план лечения имплантация',
    'коронки и имплантация: как выбрать клинику для лечения зубов',
    'страх пациента перед имплантация зубов лечение без боли коронки',
    'план лечения зубов: имплантация коронки этапы и сроки',
  ];
  const hiring = [
    'найм разработчиков: собеседование резюме оффер команда найм',
    'как проводить собеседование и не терять кандидатов резюме оффер',
    'резюме кандидата: красные флаги на собеседование найм команда',
    'оффер после собеседование: переговоры о зарплате найм резюме',
  ];
  const posts = [
    ...dental.map((t, i) => mk('d' + i, t)),
    ...hiring.map((t, i) => mk('h' + i, t)),
    mk('x0', 'случайная заметка о погоде без темы вообще ни о чём'),
  ];

  it('находит тематические пучки и даёт объяснимые имена из топ-слов', () => {
    const { defs, assignments } = buildClusters(posts, { minSize: 3, threshold: 0.1 });
    expect(defs.length).toBeGreaterThanOrEqual(2);
    // все стоматологические — в одном кластере, все найм-посты — в другом
    const dIds = new Set(dental.map((_, i) => assignments.get('d' + i)));
    const hIds = new Set(hiring.map((_, i) => assignments.get('h' + i)));
    expect(dIds.size).toBe(1);
    expect(hIds.size).toBe(1);
    expect([...dIds][0]).not.toBe([...hIds][0]);
    // имя кластера состоит из его ключевых слов
    const dDef = defs.find((d) => d.id === [...dIds][0])!;
    expect(dDef.keywords.length).toBeGreaterThan(0);
    expect(dDef.label.split(' · ').every((w) => dDef.keywords.includes(w))).toBe(true);
  });

  it('посты вне тем уходят в other; каждый пост получает назначение', () => {
    const { assignments } = buildClusters(posts, { minSize: 3, threshold: 0.1 });
    expect(assignments.size).toBe(posts.length);
    expect(assignments.get('x0')).toBe('other');
  });
});

describe('assignCluster — назначение по ключевым словам', () => {
  const defs = [
    { id: 'dent', label: 'стоматология', keywords: ['имплантация', 'коронки', 'зубов'] },
    { id: 'hire', label: 'найм', keywords: ['собеседование', 'резюме', 'оффер'] },
  ];
  it('выбирает кластер с максимумом совпадений; без совпадений — other', () => {
    expect(assignCluster('новая имплантация и коронки для пациента', defs)).toBe('dent');
    expect(assignCluster('прошёл собеседование, обновил резюме', defs)).toBe('hire');
    expect(assignCluster('пост про путешествия', defs)).toBe('other');
  });
});
