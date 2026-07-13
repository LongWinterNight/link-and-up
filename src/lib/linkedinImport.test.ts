import { describe, expect, it } from 'vitest';
import { parseCsv, parseLinkedInShares } from './linkedinImport';

describe('parseCsv (RFC4180)', () => {
  it('кавычки, "" внутри кавычек, запятые и переносы строк в ячейках, CRLF', () => {
    const csv = 'a,b,c\r\n"x, y","he said ""hi""","line1\nline2"\r\nplain,,last';
    expect(parseCsv(csv)).toEqual([
      ['a', 'b', 'c'],
      ['x, y', 'he said "hi"', 'line1\nline2'],
      ['plain', '', 'last'],
    ]);
  });
  it('BOM и пустые строки отбрасываются', () => {
    expect(parseCsv('﻿a,b\n\n1,2\n')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });
});

describe('parseLinkedInShares (Б4)', () => {
  const HEADER = 'Date,ShareLink,ShareCommentary,SharedUrl,MediaUrl,Visibility';

  it('маппит строки в RawPost: is_own, реальный пермалинк из архива, метрики = неизвестно', () => {
    const csv =
      HEADER +
      '\n2026-05-12 10:30:11,https://www.linkedin.com/feed/update/urn:li:share:123/,"Мой пост про спеку, до кода",,,MEMBER_NETWORK' +
      '\n2026-05-14 09:00:00,https://www.linkedin.com/feed/update/urn:li:share:124/,,,,MEMBER_NETWORK';
    const r = parseLinkedInShares(csv, 'Я Автор');
    expect(r.total).toBe(2);
    expect(r.skipped).toBe(1); // репост без текста
    expect(r.raws).toHaveLength(1);
    expect(r.raws[0]).toMatchObject({
      author: 'Я Автор',
      text: 'Мой пост про спеку, до кода',
      url: 'https://www.linkedin.com/feed/update/urn:li:share:123/',
      collected_at: '2026-05-12',
      is_own: true,
      reactions: 0,
      comments: 0,
    });
  });

  it('чужой файл без нужных колонок — человеческая ошибка', () => {
    expect(() => parseLinkedInShares('foo,bar\n1,2', 'Я')).toThrow('Shares.csv');
  });
});
