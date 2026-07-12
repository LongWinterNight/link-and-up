import type { Post, RawPost } from '@/types';
import { enrich } from './enrich';

export function normText(s?: string): string {
  return (s || '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export function normAuthor(a?: string): string {
  return (a || '')
    .toLowerCase()
    .replace(/ё/g, 'е') // консистентно с normText — иначе «Пётр»≠«Петр» ломает дедуп
    .replace(/\(en\)/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, '')
    .trim();
}

export function dedupKey(p: RawPost): string {
  // COR-5: у постов из одних эмодзи/ссылок normText='' — чтобы разные такие посты одного автора
  // не схлопывались в ложный дубль, при пустом normText берём url или сырой текст как отличитель.
  const body = normText(p.text).slice(0, 90);
  const suffix = body || (p.url || '').trim().toLowerCase() || (p.text || '').trim().slice(0, 90);
  return normAuthor(p.author) + '|' + suffix;
}

/** Коэффициент Дайса по биграммам — для near-dup. */
export function diceSim(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;
  const bg = (s: string) => {
    const m = new Map<string, number>();
    for (let i = 0; i < s.length - 1; i++) {
      const g = s.substr(i, 2);
      m.set(g, (m.get(g) || 0) + 1);
    }
    return m;
  };
  const A = bg(a);
  const B = bg(b);
  let inter = 0;
  A.forEach((c, g) => {
    if (B.has(g)) inter += Math.min(c, B.get(g)!);
  });
  return (2 * inter) / (a.length - 1 + (b.length - 1));
}

export interface RecordValidation {
  ok: boolean;
  errs: string[];
}

/** Проверить одну сырую запись импорта. */
export function validateRecord(raw: unknown, idx: number): RecordValidation {
  const errs: string[] = [];
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { ok: false, errs: ['запись #' + (idx + 1) + ': не объект'] };
  }
  const r = raw as RawPost;
  const hasAuthor = typeof r.author === 'string' && r.author.trim().length > 0;
  const hasText = typeof r.text === 'string' && r.text.trim().length > 0;
  if (!hasAuthor && !hasText) errs.push('запись #' + (idx + 1) + ': нет ни author, ни text');
  else {
    if (!hasText) errs.push('запись #' + (idx + 1) + ' (' + (r.author || '?') + '): пустой text');
    if (!hasAuthor) errs.push('запись #' + (idx + 1) + ': пустой author');
  }
  for (const f of ['reactions', 'comments', 'reposts'] as const) {
    const v = r[f];
    if (v != null && v !== '' && isNaN(Number(v)))
      errs.push('запись #' + (idx + 1) + ': поле ' + f + ' не число (' + v + ')');
  }
  return { ok: errs.length === 0, errs };
}

export interface IngestReport {
  total: number;
  added: number;
  dupes: number;
  rejected: number;
  nearDupes: number;
  reasons: string[];
  more: number;
  /** валидные новые сырые записи для последующего мёржа */
  valid: RawPost[];
}

/** SEC-4: лимиты импорта — защита от DoS большим файлом. */
export const MAX_IMPORT_RECORDS = 5000;
export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;

/**
 * Чистый анализ импорта БЕЗ мутации: считает, что будет добавлено/дублей/near-dup/отклонено.
 * near-dup: тот же нормализованный автор + Dice ≥ 0.82 по первым 160 символам.
 * SEC-4: скан near-dup бакетизован по автору (O(n×bucket) вместо O(n×m));
 * входной массив капится MAX_IMPORT_RECORDS.
 */
export function analyzeIngest(existing: Post[], incoming: unknown[]): IngestReport {
  const keys = new Set(existing.map((p) => dedupKey(p)));
  const buckets = new Map<string, string[]>();
  for (const p of existing) {
    const a = normAuthor(p.author);
    const arr = buckets.get(a);
    const body = normText(p.text).slice(0, 160);
    if (arr) arr.push(body);
    else buckets.set(a, [body]);
  }
  let added = 0;
  let dupes = 0;
  let rejected = 0;
  let nearDupes = 0;
  const reasons: string[] = [];
  const valid: RawPost[] = [];

  let capped = incoming;
  if (incoming.length > MAX_IMPORT_RECORDS) {
    capped = incoming.slice(0, MAX_IMPORT_RECORDS);
    reasons.push(
      'импорт ограничен ' + MAX_IMPORT_RECORDS + ' записями за раз (получено ' + incoming.length + ') — остальные загрузите следующим файлом',
    );
  }

  capped.forEach((raw, idx) => {
    const v = validateRecord(raw, idx);
    if (!v.ok) {
      rejected++;
      reasons.push(...v.errs);
      return;
    }
    const rp = raw as RawPost;
    const k = dedupKey(rp);
    if (keys.has(k)) {
      dupes++;
      return;
    }
    const na = normAuthor(rp.author);
    const nb = normText(rp.text).slice(0, 160);
    if ((buckets.get(na) || []).some((body) => diceSim(body, nb) >= 0.82)) {
      nearDupes++;
      dupes++;
      reasons.push('запись #' + (idx + 1) + ' (' + (rp.author || '?') + '): near-dup — будет пропущено');
      return;
    }
    keys.add(k);
    const arr = buckets.get(na);
    if (arr) arr.push(nb);
    else buckets.set(na, [nb]);
    valid.push(rp);
    added++;
  });

  return {
    total: incoming.length,
    added,
    dupes,
    rejected,
    nearDupes,
    reasons: reasons.slice(0, 12),
    more: Math.max(0, reasons.length - 12),
    valid,
  };
}

/** Слить валидные записи в существующий корпус (обогащая каждую). */
export function mergeIngest(existing: Post[], valid: RawPost[]): Post[] {
  return [...existing, ...valid.map(enrich)];
}
