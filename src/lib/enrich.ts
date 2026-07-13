import type { ClusterId, CtaType, Emotion, FormatFlag, HookType, Lang, Post, RawPost, Structure, Tags } from '@/types';

/** Извлечь число подписчиков из headline. */
export function parseFollowers(headline?: string): number | null {
  if (!headline) return null;
  const m = headline.match(/([\d][\d\s.,]*)\s*(тыс|k|к|млн|m|mln)?\s*(?:подписчик|followers|подписок)/i);
  if (!m) return null;
  const u = (m[2] || '').toLowerCase();
  // С единицей (тыс/млн/k): точка/запятая = десятичный разделитель, убираем только пробелы.
  // Без единицы: число — полный счётчик («12 400»), точки/запятые = разделители тысяч.
  let n = u ? parseFloat(m[1].replace(/\s/g, '').replace(',', '.')) : parseFloat(m[1].replace(/[\s.,]/g, ''));
  if (u === 'тыс' || u === 'k' || u === 'к') n *= 1000;
  if (u === 'млн' || u === 'm' || u === 'mln') n *= 1_000_000;
  return n > 0 ? Math.round(n) : null;
}

/** Определить мета-кластер по строке (query + text). Первое совпадение по ключевым словам. */
export function clusterOf(str: string): ClusterId {
  const t = (str || '').toLowerCase();
  const has = (...w: string[]) => w.some((x) => t.includes(x));
  if (
    has(
      'spec-driven',
      'claude code',
      'context engineering',
      'контекст-инженер',
      'спецификац',
      'обсидиан',
      'obsidian',
      'mcp',
    )
  )
    return 'spec';
  if (has('промпт', 'prompt', 'фреймворк', 'rif', 'карусел', 'контент-план', 'хук', 'сторител')) return 'prompt';
  if (has('агент', 'agent', 'build-in-public', 'билд-ин', 'автоном')) return 'agents';
  if (has('собеседован', 'отказ', 'ваканс', 'резюме', 'оффер', 'поиск работ', 'фриланс', 'interview', 'reject'))
    return 'jobs';
  if (has('solopreneur', 'инди', 'indie', 'mvp', 'соло', 'запуск продукт', 'пет-проект')) return 'solo';
  if (has('пузыр', 'bubble', 'скепс', 'этик', 'хайп', 'переоцен', 'пугают')) return 'bubble';
  if (has('внедрил', 'обучил', 'кейс', 'roi', 'сэконом', 'издержк', 'эффективн', 'enablement', 'автоматизир'))
    return 'enable';
  if (has('строй', 'bim', 'юрист', 'финанс', 'дизайн', 'поддержк', 'логист', 'hr', 'медицин', 'отрасл', 'erp'))
    return 'industry';
  if (has('выгоран', 'зарплат', 'нетворк', 'релокац', 'декрет', '40+', 'карьер', 'burnout')) return 'life';
  return 'other';
}

/** Разобрать пост в структурные теги формата (по тексту и блоку «Формат:»). */
export function tagPost(p: RawPost): Tags {
  const text = p.text || '';
  const t = text.toLowerCase();
  const fmtIdx = text.search(/формат\s*:/i);
  const formatText =
    fmtIdx >= 0
      ? text
          .slice(fmtIdx)
          .replace(/^формат\s*:/i, '')
          .trim()
      : '';
  const body = fmtIdx >= 0 ? text.slice(0, fmtIdx).trim() : text;
  const ft = formatText.toLowerCase();
  const hasNum = /\d/.test(body);
  const first = body.split('\n')[0].toLowerCase();

  let hook: HookType = 'обещание пользы';
  if (/[?]/.test(first) || /^как |^почему|^что если|^зачем/.test(first)) hook = 'вопрос';
  else if (/^\d|\d+\s*%|\d+\s*(из|раз)/.test(first) || ft.includes('цифр') || ft.includes('статист'))
    hook = 'цифра-статистика';
  else if (ft.includes('провок') || ft.includes('контртез') || /на самом деле|миф|заблужден|перестань/.test(first))
    hook = 'провокация/контртезис';
  else if (ft.includes('истор') || /^я |^мой |^когда я|год назад/.test(first)) hook = 'личная история';
  else if (/потеря|риск|опасн|умрёт|конец|поздно/.test(first)) hook = 'пугающий факт';

  let structure: Structure = 'конспект';
  if (ft.includes('карусел')) structure = 'карусель';
  else if (ft.includes('манифест')) structure = 'манифест';
  else if (ft.includes('пошагов') || ft.includes('гайд') || ft.includes('шаг') || ft.includes('how-to'))
    structure = 'пошаговый гайд';
  else if (/список|нумерован/.test(ft) || /\n\s*\d[).]/.test(body)) structure = 'нумерованный список';
  else if (ft.includes('кейс') && hasNum) structure = 'кейс с цифрами';
  else if (ft.includes('истор') || ft.includes('сюжет') || ft.includes('story') || hook === 'личная история')
    structure = 'сюжетная арка';

  let cta: CtaType = 'без CTA';
  if (/[?]\s*$/.test(body.trim()) || ft.includes('вопрос в конце')) cta = 'вопрос в конце';
  else if (/в коммент|пишите|ссылк[аи] в коммент|лид-магнит/.test(t)) cta = 'лид-магнит-в-комменты';
  else if (/сохрани|забери|закладк/.test(t)) cta = 'сохрани';

  let emotion: Emotion = 'нейтрально';
  if (/выгоран|страшно|тревог|боюсь|провал/.test(t)) emotion = 'тревога';
  else if (/смешно|ирони|шутк|:\)/.test(t)) emotion = 'юмор';
  else if (/мечта|цель|амбиц|достичь/.test(t)) emotion = 'амбиция';
  else if (/честно|признаюсь|стыдно|уязвим/.test(t)) emotion = 'уязвимость';
  else if (/вдохнов|верь|получится/.test(t)) emotion = 'вдохновение';

  const flags: FormatFlag[] = [];
  if (hasNum) flags.push('has_numbers');
  if (hook === 'личная история' || emotion === 'уязвимость') flags.push('personal_story');
  if (hook === 'провокация/контртезис') flags.push('contrarian');
  if (structure === 'нумерованный список' || structure === 'карусель') flags.push('list_format');
  if (cta === 'сохрани') flags.push('save_bait');

  return { hook_type: hook, structure, cta_type: cta, emotion, flags, formatText };
}

/**
 * Определить язык поста. `(EN)` в авторе → EN.
 * COR-6: иначе смотрим первые 80 БУКВ после вычистки URL (не первые 60 символов) —
 * RU-пост, начинающийся со ссылки или латинского бренда, больше не считается EN.
 */
export function detectLang(p: RawPost): Lang {
  if (/\(EN\)/i.test(p.author || '')) return 'EN';
  const stripped = (p.text || '').replace(/https?:\/\/\S+|www\.\S+/gi, ' ');
  const letters = (stripped.match(/\p{L}/gu) || []).slice(0, 80).join('');
  if (!letters) return 'RU';
  return /[а-яё]/i.test(letters) ? 'RU' : 'EN';
}

/** М48: url с опасной схемой (javascript:/data:/vbscript:/file:) отбрасывается при импорте. */
export function sanitizeUrl(u?: string): string {
  const s = (u || '').trim();
  if (!s) return '';
  if (/^(javascript|data|vbscript|file)\s*:/i.test(s)) return '';
  return s;
}

/** Обогатить сырой пост: метрики, подписчики, язык, ER, кластер, теги. */
export function enrich(p: RawPost): Post {
  const followers = parseFollowers(p.headline);
  const reactions = Number(p.reactions) || 0;
  const comments = Number(p.comments) || 0;
  // 0 = МЕТРИКА НЕИЗВЕСТНА (не ноль): has_metrics отражает наличие данных
  const has_metrics = reactions > 0 || comments > 0;
  const lang = detectLang(p);
  // ER = comments/followers. Если comments === 0 — комментарии НЕИЗВЕСТНЫ (0 ≠ ноль),
  // значит ER неизвестен → null (иначе ложный 0 занижал бы медианный ER и топы).
  const rate = comments > 0 && followers ? comments / followers : null;
  const tags = tagPost(p);
  return {
    query: p.query || '',
    author: p.author || '',
    headline: p.headline || '',
    age: p.age || '',
    reactions,
    comments,
    reposts: Number(p.reposts) || 0,
    text: p.text || '',
    url: sanitizeUrl(p.url),
    collected_at: p.collected_at || '',
    id: p.id || (p.author || '') + '|' + (p.text || '').slice(0, 80),
    followers,
    has_metrics,
    lang,
    rate,
    meta_cluster: clusterOf((p.query || '') + ' ' + (p.text || '')),
    tags,
    is_own: !!p.is_own,
  };
}

export function enrichAll(arr: RawPost[]): Post[] {
  return arr.map(enrich);
}
