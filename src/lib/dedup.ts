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

/**
 * SCALE-10: LSH-префильтр для одноавторных бакетов. Dice ≥ 0.82 ⇒ Жаккар биграмм ≥ ~0.7;
 * k-minhash (k=8) оценивает Жаккар долей совпавших минимумов — непохожие пары (J≈0.1)
 * отсекаются без квадратичного Dice. Порог 4/8 консервативен: recall близок к 1.
 */
const MINHASH_K = 8;
const SEEDS = new Uint32Array(MINHASH_K);
for (let i = 0; i < MINHASH_K; i++) SEEDS[i] = (2654435761 * (i + 1)) >>> 0;

function fnv1a(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function minhashSig(s: string): Uint32Array {
  const sig = new Uint32Array(MINHASH_K).fill(0xffffffff);
  for (let i = 0; i < s.length - 1; i++) {
    const h = fnv1a(s.substr(i, 2));
    for (let k = 0; k < MINHASH_K; k++) {
      const v = (h ^ SEEDS[k]) >>> 0;
      if (v < sig[k]) sig[k] = v;
    }
  }
  return sig;
}

export function sigOverlap(a: Uint32Array, b: Uint32Array): number {
  let n = 0;
  for (let i = 0; i < MINHASH_K; i++) if (a[i] === b[i]) n++;
  return n;
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

/** Внутреннее состояние прогона импорта: общее для синхронного и чанкованного вариантов. */
function createIngestRun(existing: Post[], incoming: unknown[]) {
  const keys = new Set(existing.map((p) => dedupKey(p)));
  // SCALE-10: бакет хранит тело + minhash-сигнатуру для LSH-префильтра
  type Entry = { body: string; sig: Uint32Array };
  const buckets = new Map<string, Entry[]>();
  const pushEntry = (a: string, body: string) => {
    const e = { body, sig: minhashSig(body) };
    const arr = buckets.get(a);
    if (arr) arr.push(e);
    else buckets.set(a, [e]);
  };
  for (const p of existing) {
    pushEntry(normAuthor(p.author), normText(p.text).slice(0, 160));
  }
  const st = { added: 0, dupes: 0, rejected: 0, nearDupes: 0, reasons: [] as string[], valid: [] as RawPost[] };

  let capped = incoming;
  if (incoming.length > MAX_IMPORT_RECORDS) {
    capped = incoming.slice(0, MAX_IMPORT_RECORDS);
    st.reasons.push(
      'импорт ограничен ' +
        MAX_IMPORT_RECORDS +
        ' записями за раз (получено ' +
        incoming.length +
        ') — остальные загрузите следующим файлом',
    );
  }

  const processOne = (raw: unknown, idx: number) => {
    const v = validateRecord(raw, idx);
    if (!v.ok) {
      st.rejected++;
      st.reasons.push(...v.errs);
      return;
    }
    const rp = raw as RawPost;
    const k = dedupKey(rp);
    if (keys.has(k)) {
      st.dupes++;
      return;
    }
    const na = normAuthor(rp.author);
    const nb = normText(rp.text).slice(0, 160);
    const nbSig = minhashSig(nb);
    // SCALE-5: префильтр по длине — при разнице >35% Dice заведомо < 0.82, diceSim не считаем.
    // SCALE-10: затем LSH-префильтр по minhash — Dice остаётся только для похожих кандидатов.
    // Критично для одноавторных бакетов (импорт собственного корпуса: все посты одного автора).
    if (
      (buckets.get(na) || []).some((e) => {
        const min = Math.min(e.body.length, nb.length);
        const max = Math.max(e.body.length, nb.length);
        if (max > 0 && min / max < 0.65) return false;
        if (nb.length >= 24 && e.body.length >= 24 && sigOverlap(e.sig, nbSig) < 4) return false;
        return diceSim(e.body, nb) >= 0.82;
      })
    ) {
      st.nearDupes++;
      st.dupes++;
      st.reasons.push('запись #' + (idx + 1) + ' (' + (rp.author || '?') + '): near-dup — будет пропущено');
      return;
    }
    keys.add(k);
    pushEntry(na, nb);
    st.valid.push(rp);
    st.added++;
  };

  return { capped, st, processOne };
}

/**
 * Чистый анализ импорта БЕЗ мутации: считает, что будет добавлено/дублей/near-dup/отклонено.
 * near-dup: тот же нормализованный автор + Dice ≥ 0.82 по первым 160 символам.
 * SEC-4: скан near-dup бакетизован по автору; входной массив капится MAX_IMPORT_RECORDS.
 */
export function analyzeIngest(existing: Post[], incoming: unknown[]): IngestReport {
  const run = createIngestRun(existing, incoming);
  run.capped.forEach(run.processOne);
  const { added, dupes, rejected, nearDupes, reasons, valid } = run.st;

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

export interface IngestProgress {
  processed: number;
  total: number;
}

/**
 * SCALE-9: чанкованный анализ импорта — порции по chunkSize с уступкой главному потоку
 * (на 20K-корпусе синхронный вариант фризил вкладку до ~5.6с). Прогресс и отмена.
 * Результат идентичен analyzeIngest (общий processOne).
 */
export async function analyzeIngestChunked(
  existing: Post[],
  incoming: unknown[],
  opts?: { chunkSize?: number; onProgress?: (p: IngestProgress) => void; signal?: { cancelled: boolean } },
): Promise<IngestReport> {
  const { chunkSize = 500, onProgress, signal } = opts || {};
  const run = createIngestRun(existing, incoming);
  const total = run.capped.length;
  for (let i = 0; i < total; i += chunkSize) {
    if (signal?.cancelled) break;
    const end = Math.min(i + chunkSize, total);
    for (let j = i; j < end; j++) run.processOne(run.capped[j], j);
    onProgress?.({ processed: end, total });
    await new Promise((r) => setTimeout(r, 0));
  }
  const { added, dupes, rejected, nearDupes, reasons, valid } = run.st;
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
