import { describe, expect, it } from 'vitest';
import { corpusFreshness, filterPosts, formulaVariety, isPostingDay, kpis, ownPostsThisWeek, topByComments } from './derive';
import type { Idea } from '@/types';
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

describe('buildPostSearchUrl — поисковый fallback источника', () => {
  it('первые 10 слов в кавычках + site:linkedin.com для linkedin-ссылок и пустых', async () => {
    const { buildPostSearchUrl } = await import('./links');
    const u = buildPostSearchUrl({ text: 'Спека до кода — и «Claude Code» перестал фантазировать полностью совсем навсегда точка', url: 'linkedin.com/posts/x_activity-1' });
    const q = decodeURIComponent(u.split('q=')[1]);
    expect(q).toContain('"Спека до кода — и Claude Code перестал фантазировать');
    expect(q).toContain('site:linkedin.com');
    expect(q).not.toContain('«');
    const u2 = buildPostSearchUrl({ text: 'короткий текст', url: 'https://example.com/a' });
    expect(decodeURIComponent(u2.split('q=')[1])).not.toContain('site:linkedin.com');
  });
});

describe('isPostingDay (P-6)', () => {
  it('вт и чт — дни публикации, остальные — нет', () => {
    expect(isPostingDay(new Date('2026-07-14'))).toBe(true); // вторник
    expect(isPostingDay(new Date('2026-07-16'))).toBe(true); // четверг
    expect(isPostingDay(new Date('2026-07-12'))).toBe(false); // воскресенье
    expect(isPostingDay(new Date('2026-07-13'))).toBe(false); // понедельник
  });
});

describe('SCALE-11: WeakMap-кэш производных', () => {
  it('одна ссылка на posts → тот же объект результата; новая ссылка → пересчёт', () => {
    const a = kpis(POSTS);
    expect(kpis(POSTS)).toBe(a); // идентичность, не equality
    expect(topByComments(POSTS, 12)).toBe(topByComments(POSTS, 12));
    expect(topByComments(POSTS, 5)).not.toBe(topByComments(POSTS, 12)); // разные ключи
    const copy = [...POSTS];
    expect(kpis(copy)).not.toBe(a); // новая ссылка — новая запись кэша
    expect(kpis(copy)).toEqual(a); // но значения те же
  });
});

describe('ownPostsThisWeek', () => {
  it('считает только свои посты текущей недели', () => {
    const now = new Date('2026-07-15T12:00:00'); // среда; неделя с пн 13-го
    const posts = [
      mk({ author: 'Я', text: 'свой на этой неделе', is_own: true, collected_at: '2026-07-14' }),
      mk({ author: 'Я', text: 'свой на прошлой', is_own: true, collected_at: '2026-07-10' }),
      mk({ author: 'Чужой', text: 'не свой на этой неделе', collected_at: '2026-07-14' }),
    ];
    expect(ownPostsThisWeek(posts, now)).toBe(1);
    expect(ownPostsThisWeek([], now)).toBe(0);
  });
});

describe('formulaVariety — индикатор эхо-камеры (М52)', () => {
  const mkIdea = (formula: string, date: string): Idea =>
    ({ id: formula + date, title: 't', hook: '', cluster: 'spec' as Idea['cluster'], formula, source: '', channel: 'LinkedIn', status: 'published', date: '', refPostId: '', predicted: 0, actual: { reactions: 1, comments: 1, leads: 0, interviews: 0, date } });
  const now = new Date('2026-07-13T12:00:00');

  it('молчит при <5 публикаций за 30 дней и при доле <70%', () => {
    expect(formulaVariety([mkIdea('pak', '2026-07-01')], now)).toBeNull();
    const mixed = ['pak', 'pak', 'hook', 'hook', 'arch', 'fail'].map((f, i) => mkIdea(f, '2026-07-0' + (i + 1)));
    expect(formulaVariety(mixed, now)).toBeNull();
  });

  it('предупреждает при ≥70% одной формулы; старые публикации не считаются', () => {
    const mono = ['pak', 'pak', 'pak', 'pak', 'hook'].map((f, i) => mkIdea(f, '2026-07-0' + (i + 1)));
    const old = mkIdea('hook', '2026-01-01'); // вне окна 30 дней
    const w = formulaVariety([...mono, old], now)!;
    expect(w.formula).toBe('pak');
    expect(w.sharePct).toBe(80);
    expect(w.n).toBe(5);
  });
});

describe('corpusFreshness — метка свежести (D3)', () => {
  it('пустой корпус → нет метки, не stale', () => {
    expect(corpusFreshness([])).toEqual({ latest: null, ageDays: null, stale: false });
  });
  it('берёт последнюю дату сбора и считает возраст', () => {
    const now = new Date('2026-07-12T12:00:00');
    const fr = corpusFreshness(POSTS, now); // последний сбор 2026-07-10
    expect(fr.latest).toBe('2026-07-10');
    expect(fr.ageDays).toBe(2);
    expect(fr.stale).toBe(false);
  });
  it('старше 90 дней → stale', () => {
    const now = new Date('2026-11-12T12:00:00');
    expect(corpusFreshness(POSTS, now).stale).toBe(true);
  });
});
