import type { RawPost } from '@/types';

/**
 * Б4: импорт официального self-export LinkedIn (Settings → Get a copy of your data → Shares.csv).
 * Это главный канал РЕАЛЬНЫХ проверяемых данных (директива провенанса): тексты и пермалинки —
 * из архива самой платформы. Метрик в экспорте нет — честно остаются «неизвестно» (0=unknown),
 * факты вносятся петлёй обучения. Парсер RFC4180 свой — без зависимостей.
 */

/** Минимальный RFC4180-парсер: кавычки, "" внутри кавычек, переносы строк в ячейках, CRLF. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text; // BOM
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(cell);
      cell = '';
      rows.push(row);
      row = [];
    } else {
      cell += ch;
    }
  }
  if (cell !== '' || row.length) {
    row.push(cell);
    rows.push(row);
  }
  // отбросить полностью пустые строки
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

export interface LinkedInImportResult {
  raws: RawPost[];
  /** пропущено строк без текста (репосты/пустые Commentary) */
  skipped: number;
  total: number;
}

/** Маппинг Shares.csv → RawPost[]. Колонки ищутся по заголовкам (регистронезависимо). */
export function parseLinkedInShares(csvText: string, ownAuthor: string): LinkedInImportResult {
  const rows = parseCsv(csvText);
  if (!rows.length) throw new Error('Файл пуст');
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const col = (name: string) => header.indexOf(name.toLowerCase());
  const iDate = col('date');
  const iLink = col('sharelink');
  const iText = col('sharecommentary');
  if (iText === -1 || iDate === -1) {
    throw new Error('Это не Shares.csv из экспорта LinkedIn: не найдены колонки Date/ShareCommentary');
  }
  const raws: RawPost[] = [];
  let skipped = 0;
  for (const r of rows.slice(1)) {
    const text = (r[iText] || '').trim();
    if (!text) {
      skipped++;
      continue;
    }
    raws.push({
      author: ownAuthor,
      headline: '',
      reactions: 0, // в экспорте LinkedIn метрик нет — 0 = неизвестно
      comments: 0,
      reposts: 0,
      text,
      url: iLink === -1 ? '' : (r[iLink] || '').trim(), // пермалинк из архива платформы — проверяемый источник
      collected_at: (r[iDate] || '').trim().slice(0, 10),
      is_own: true,
    });
  }
  return { raws, skipped, total: rows.length - 1 };
}
