import type { Post } from '@/types';

/**
 * Поисковый fallback для источника поста: пермалинки демо-корпуса реконструированы при сборе
 * и часто не открываются (usecase владельца, 2026-07-13). Точная цитата первых слов текста
 * находит пост поиском в один клик — работает и когда прямой URL протух.
 */
export function buildPostSearchUrl(post: Pick<Post, 'text' | 'url'>): string {
  const snippet = (post.text || '')
    .replace(/["«»]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .slice(0, 10)
    .join(' ');
  const isLinkedIn = /linkedin\.com/i.test(post.url || '') || !post.url;
  const q = '"' + snippet + '"' + (isLinkedIn ? ' site:linkedin.com' : '');
  return 'https://www.google.com/search?q=' + encodeURIComponent(q);
}
