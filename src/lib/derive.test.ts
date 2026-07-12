import { describe, expect, it } from 'vitest';
import { filterPosts } from './derive';
import { enrich } from './enrich';
import { DEFAULT_FILTERS, type Filters } from '@/store';
import type { Post } from '@/types';

/** Q-2: golden-set фильтров Explorer. Пост с контролируемыми полями. */
type Over = Omit<Partial<Post>, 'tags'> & { author: string; text: string; tags?: Partial<Post['tags']> };
function mk(over: Over): Post {
  const p = enrich({
    author: over.author,
    text: over.text,
    reactions: over.reactions ?? 0,
    comments: over.comments ?? 0,
    headline: over.headline ?? '',
    collected_at: over.collected_at ?? '',
    query: over.query ?? '',
  });
  return { ...p, ...over, tags: { ...p.tags, ...(over.tags || {}) } } as Post;
}

const A = mk({
  author: 'Анна', text: 'alpha текст про спеку', comments: 50, reactions: 10,
  headline: '10 000 подписчиков', collected_at: '2026-07-01',
  meta_cluster: 'spec', lang: 'RU',
  tags: { hook_type: 'вопрос', structure: 'конспект', cta_type: 'без CTA', emotion: 'нейтрально', flags: [] },
});
const B = mk({
  author: 'Bob (EN)', text: 'beta english post', comments: 5, reactions: 3,
  collected_at: '2026-07-05',
  meta_cluster: 'jobs', lang: 'EN',
  tags: { hook_type: 'личная история', structure: 'сюжетная арка', cta_type: 'без CTA', emotion: 'уязвимость', flags: [] },
});
const C = mk({
  author: 'Ирина', text: 'gamma без метрик', comments: 0, reactions: 0,
  collected_at: '2026-07-10',
  meta_cluster: 'spec', lang: 'RU',
  tags: { hook_type: 'обещание пользы', structure: 'манифест', cta_type: 'без CTA', emotion: 'нейтрально', flags: [] },
});
const POSTS = [A, B, C];

const f = (patch: Partial<Filters> = {}): Filters => ({ ...DEFAULT_FILTERS, ...patch });
const ids = (out: Post[]) => out.map((p) => p.author);

describe('filterPosts — golden-set', () => {
  it('поиск по тексту/автору/углу', () => {
    expect(ids(filterPosts(POSTS, 'beta', f()))).toEqual(['Bob (EN)']);
    expect(ids(filterPosts(POSTS, 'ирина', f()))).toEqual(['Ирина']);
    expect(filterPosts(POSTS, 'нет-такого', f())).toHaveLength(0);
  });

  it('фильтр по кластеру', () => {
    expect(ids(filterPosts(POSTS, '', f({ cluster: 'spec' })))).toEqual(['Анна', 'Ирина']);
  });

  it('фильтр по языку', () => {
    expect(ids(filterPosts(POSTS, '', f({ lang: 'EN' })))).toEqual(['Bob (EN)']);
  });

  it('фильтр по метрикам: yes / no', () => {
    expect(ids(filterPosts(POSTS, '', f({ metrics: 'yes' })))).toEqual(['Анна', 'Bob (EN)']);
    expect(ids(filterPosts(POSTS, '', f({ metrics: 'no' })))).toEqual(['Ирина']);
  });

  it('фильтр по хуку и структуре', () => {
    expect(ids(filterPosts(POSTS, '', f({ hook: 'вопрос' })))).toEqual(['Анна']);
    expect(ids(filterPosts(POSTS, '', f({ structure: 'сюжетная арка' })))).toEqual(['Bob (EN)']);
  });

  it('minC / maxC по комментариям', () => {
    expect(ids(filterPosts(POSTS, '', f({ minC: '10' })))).toEqual(['Анна']);
    expect(ids(filterPosts(POSTS, '', f({ maxC: '10' })))).toEqual(['Bob (EN)', 'Ирина']);
  });

  it('minER исключает посты с неизвестным ER (rate=null), а не пропускает их', () => {
    // A: rate = 50/10000 = 0.5%; B и C — rate null
    expect(ids(filterPosts(POSTS, '', f({ minER: '0.4' })))).toEqual(['Анна']);
    expect(filterPosts(POSTS, '', f({ minER: '0.6' }))).toHaveLength(0);
  });

  it('диапазон дат сбора', () => {
    expect(ids(filterPosts(POSTS, '', f({ dateFrom: '2026-07-04' })))).toEqual(['Bob (EN)', 'Ирина']);
    expect(ids(filterPosts(POSTS, '', f({ dateTo: '2026-07-04' })))).toEqual(['Анна']);
  });

  it('сортировки: comments / reactions / rate / date', () => {
    expect(ids(filterPosts(POSTS, '', f({ sort: 'comments' })))).toEqual(['Анна', 'Bob (EN)', 'Ирина']);
    expect(ids(filterPosts(POSTS, '', f({ sort: 'reactions' })))).toEqual(['Анна', 'Bob (EN)', 'Ирина']);
    // rate: null уходит в конец (как -1)
    expect(ids(filterPosts(POSTS, '', f({ sort: 'rate' })))[0]).toBe('Анна');
    expect(ids(filterPosts(POSTS, '', f({ sort: 'date' })))).toEqual(['Ирина', 'Bob (EN)', 'Анна']);
  });

  it('пустая строка в числовом фильтре = фильтр выключен', () => {
    expect(filterPosts(POSTS, '', f({ minC: '', maxC: '', minER: '' }))).toHaveLength(3);
  });
});
