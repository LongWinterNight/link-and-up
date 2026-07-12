import { describe, expect, it } from 'vitest';
import { clusterOf, detectLang, enrich, parseFollowers, tagPost } from './enrich';
import { analyzeIngest, diceSim, dedupKey } from './dedup';
import { backtest, forecast, recalcCalibration } from './forecast';
import { validateIdea, validateContent, hasHardFlag, DEFAULT_RULES } from './guardrails';
import { csvCell } from './exports';
import type { Rule } from '@/types';
import type { Idea, Post, RawPost } from '@/types';

describe('parseFollowers', () => {
  it('парсит тысячи и миллионы в разных форматах', () => {
    expect(parseFollowers('AI Engineer · 12 400 подписчиков')).toBe(12400);
    expect(parseFollowers('Prompt Engineer · 45 000 followers')).toBe(45000);
    expect(parseFollowers('Solo · 500 тыс подписчиков')).toBe(500000);
    expect(parseFollowers('Creator · 1.2 млн подписчиков')).toBe(1200000);
    expect(parseFollowers('Ghostwriter · 60k followers')).toBe(60000);
  });
  it('возвращает null без числа подписчиков', () => {
    expect(parseFollowers('AI Product Engineer')).toBeNull();
    expect(parseFollowers('')).toBeNull();
    expect(parseFollowers(undefined)).toBeNull();
  });
});

describe('clusterOf', () => {
  it('маршрутизирует по ключевым словам', () => {
    expect(clusterOf('tavily:claude code spec driven')).toBe('spec');
    expect(clusterOf('tavily:prompt framework RIF')).toBe('prompt');
    expect(clusterOf('build-in-public агент')).toBe('agents');
    expect(clusterOf('дневник отказов собеседования')).toBe('jobs');
    expect(clusterOf('solopreneur mvp')).toBe('solo');
    expect(clusterOf('ai пузырь скепсис')).toBe('bubble');
    expect(clusterOf('внедрил roi кейс')).toBe('enable');
    expect(clusterOf('bim стройка erp')).toBe('industry');
    expect(clusterOf('выгорание карьера')).toBe('life');
    expect(clusterOf('нечто непонятное')).toBe('other');
  });
});

describe('detectLang', () => {
  it('EN по маркеру (EN) или латинице без кириллицы', () => {
    expect(detectLang({ author: 'Denis (EN)', text: 'Привет' })).toBe('EN');
    expect(detectLang({ author: 'John', text: 'This is an english post about hooks' })).toBe('EN');
    expect(detectLang({ author: 'Мария', text: 'Контекст важнее промпта' })).toBe('RU');
  });
});

describe('tagPost', () => {
  it('вопросный хук + вопрос-CTA', () => {
    const t = tagPost({ text: 'Как собрать ERP за неделю?\nФормат: кейс с цифрами, вопрос в конце.' });
    expect(t.hook_type).toBe('вопрос');
  });
  it('личная история + флаг personal_story', () => {
    const t = tagPost({
      text: 'Я потерял работу и перезапустился.\nФормат: личная история, уязвимость.',
    });
    expect(t.hook_type).toBe('личная история');
    expect(t.flags).toContain('personal_story');
  });
  it('нумерованный список даёт list_format', () => {
    const t = tagPost({ text: 'Три правила.\n1) раз\n2) два\nФормат: нумерованный список.' });
    expect(t.structure).toBe('нумерованный список');
    expect(t.flags).toContain('list_format');
  });
  it('извлекает formatText из блока Формат', () => {
    const t = tagPost({ text: 'Тело поста.\nФормат: манифест, контртезис.' });
    expect(t.formatText).toContain('манифест');
    expect(t.structure).toBe('манифест');
  });
});

describe('enrich — достоверность метрик', () => {
  const raw: RawPost = {
    query: 'tavily:claude code',
    author: 'Игорь Ветров',
    headline: 'AI Engineer · 12 400 подписчиков',
    reactions: 210,
    comments: 64,
    text: 'Спека до кода.\nФормат: контртезис, кейс с цифрами.',
  };
  it('has_metrics=true при ненулевых, считает ER от подписчиков', () => {
    const p = enrich(raw);
    expect(p.has_metrics).toBe(true);
    expect(p.followers).toBe(12400);
    expect(p.rate).toBeCloseTo(64 / 12400, 6);
    expect(p.meta_cluster).toBe('spec');
  });
  it('0 метрик => has_metrics=false, rate=null (0 = неизвестно, не ноль)', () => {
    const p = enrich({ author: 'X', text: 'text', reactions: 0, comments: 0, headline: '5 000 подписчиков' });
    expect(p.has_metrics).toBe(false);
    expect(p.rate).toBeNull();
  });
  it('нет подписчиков => rate=null даже при метриках', () => {
    const p = enrich({ author: 'X', text: 'text', reactions: 10, comments: 5, headline: 'Без числа' });
    expect(p.rate).toBeNull();
  });
  it('COR-1: reactions>0, comments=0 => has_metrics=true, но rate=null (комментарии неизвестны)', () => {
    const p = enrich({ author: 'X', text: 'text', reactions: 40, comments: 0, headline: '5 000 подписчиков' });
    expect(p.has_metrics).toBe(true);
    expect(p.rate).toBeNull();
  });
});

describe('dedup / ingest', () => {
  const base: Post[] = [enrich({ author: 'Игорь Ветров', text: 'Спека до кода — и Claude Code перестал фантазировать полностью совсем', reactions: 10, comments: 5 })];
  it('diceSim = 1 для идентичных строк', () => {
    expect(diceSim('привет мир', 'привет мир')).toBe(1);
  });
  it('точный дубль по dedupKey не добавляется', () => {
    const dup: RawPost = { author: 'Игорь Ветров', text: 'Спека до кода — и Claude Code перестал фантазировать полностью совсем' };
    const r = analyzeIngest(base, [dup]);
    expect(r.added).toBe(0);
    expect(r.dupes).toBe(1);
  });
  it('отклоняет запись без author и text', () => {
    const r = analyzeIngest(base, [{ foo: 1 } as unknown]);
    expect(r.rejected).toBe(1);
    expect(r.added).toBe(0);
  });
  it('добавляет валидную новую запись', () => {
    const r = analyzeIngest(base, [{ author: 'Новый Автор', text: 'Совершенно другой текст про дизайн систем' }]);
    expect(r.added).toBe(1);
    expect(r.valid).toHaveLength(1);
  });
  it('dedupKey нормализует ё и регистр', () => {
    expect(dedupKey({ author: 'Пётр', text: 'Ёлка' })).toBe(dedupKey({ author: 'петр', text: 'елка' }));
  });
  it('COR-5: посты из одних эмодзи одного автора не схлопываются в ложный дубль', () => {
    const a: RawPost = { author: 'Эмодзи Автор', text: '🔥🔥🔥', url: 'https://x/1' };
    const b: RawPost = { author: 'Эмодзи Автор', text: '✨✨✨', url: 'https://x/2' };
    expect(dedupKey(a)).not.toBe(dedupKey(b));
    // без url — отличаются по сырому тексту
    expect(dedupKey({ author: 'A', text: '🔥' })).not.toBe(dedupKey({ author: 'A', text: '✨' }));
  });
});

describe('forecast', () => {
  const posts: Post[] = [
    enrich({ query: 'spec', author: 'A', headline: '10 000 подписчиков', reactions: 100, comments: 60, text: 'x' }),
    enrich({ query: 'spec', author: 'B', headline: '10 000 подписчиков', reactions: 100, comments: 40, text: 'y' }),
    enrich({ query: 'spec', author: 'C', headline: '10 000 подписчиков', reactions: 100, comments: 50, text: 'z' }),
  ];
  const idea: Idea = {
    id: 'i', title: 'Как собрать ERP', hook: 'Как я собрал ERP за неделю?', cluster: 'spec',
    formula: 'arch', source: 'Кейс', channel: 'LinkedIn', status: 'draft', date: '',
    refPostId: '', predicted: 0, actual: null,
  };
  it('база = медиана комментариев кластера, множители повышают ожидание', () => {
    const fc = forecast(idea, posts, 1);
    expect(fc).not.toBeNull();
    expect(fc!.base).toBe(50); // медиана 40/50/60
    expect(fc!.expected).toBeGreaterThan(fc!.base); // хук + личная история (я) + RU
    expect(fc!.low).toBeLessThanOrEqual(fc!.expected);
    expect(fc!.high).toBeGreaterThanOrEqual(fc!.expected);
    expect(fc!.steps.length).toBeGreaterThan(1);
  });
  it('null для отсутствующей идеи', () => {
    expect(forecast(null, posts, 1)).toBeNull();
  });
  it('COR-2: пустой корпус → lowData (число — заглушка, не оценка)', () => {
    const fc = forecast(idea, [], 1);
    expect(fc).not.toBeNull();
    expect(fc!.lowData).toBe(true);
  });
  it('COR-3: пост-референс с comments=0 не берётся базой — падает на медиану кластера', () => {
    const ref = enrich({ query: 'spec', author: 'Ref', headline: '10 000 подписчиков', reactions: 50, comments: 0, text: 'реф' });
    const pool: Post[] = [ref, ...posts];
    const fc = forecast({ ...idea, refPostId: ref.id }, pool, 1);
    expect(fc!.lowData).toBe(false);
    expect(fc!.base).toBe(50); // медиана 40/50/60, а не 0 от референса
  });
});

describe('recalcCalibration', () => {
  it('null accuracy без опубликованных фактов', () => {
    const c = recalcCalibration([], 1);
    expect(c.accuracy).toBeNull();
    expect(c.count).toBe(0);
  });
  it('калибровка = среднее факт/прогноз, клип [0.3..3]', () => {
    const ideas: Idea[] = [
      { id: '1', title: '', hook: '', cluster: 'spec', formula: 'arch', source: '', channel: 'LinkedIn', status: 'published', date: '', refPostId: '', predicted: 50, actual: { reactions: 0, comments: 100, leads: 0, interviews: 0, date: '' } },
    ];
    const c = recalcCalibration(ideas, 1);
    expect(c.calibration).toBeCloseTo(2, 5);
    expect(c.count).toBe(1);
  });
});

describe('backtest leave-one-out', () => {
  it('недостоверен при <8 постах', () => {
    const r = backtest([]);
    expect(r.mape).toBeNull();
    expect(r.note).toContain('недостоверен');
  });
  it('считает метрики при достаточном корпусе', () => {
    const posts: Post[] = Array.from({ length: 12 }, (_, i) =>
      enrich({ query: 'spec', author: 'A' + i, headline: '10 000 подписчиков', reactions: 10, comments: 30 + i, text: 'пост номер ' + i }),
    );
    const r = backtest(posts);
    expect(r.n).toBe(12);
    expect(r.mape).not.toBeNull();
    expect(r.within2x).toBeGreaterThan(0);
  });
});

describe('validateIdea — гардрейлы (generic brand-safety)', () => {
  const mk = (title: string, hook = ''): Pick<Idea, 'title' | 'hook'> => ({ title, hook });
  it('soft: превосходная степень без доказательства', () => {
    const f = validateIdea(mk('Первый в мире AI-инструмент'));
    expect(f.some((x) => x.severity === 'soft' && x.ruleId === 'superlative')).toBe(true);
    expect(hasHardFlag(f)).toBe(false);
  });
  it('soft: абсолютное обещание', () => {
    const f = validateIdea(mk('', 'Гарантирую результат за неделю'));
    expect(f.some((x) => x.ruleId === 'absolute')).toBe(true);
  });
  it('soft: непроверяемая крупная цифра', () => {
    const f = validateIdea(mk('Рынок на $15 млрд'));
    expect(f.some((x) => x.ruleId === 'unverified-big')).toBe(true);
  });
  it('чистая идея — без флагов', () => {
    const f = validateIdea(mk('Как спека до кода ускоряет проект', 'Разбираю подход'));
    expect(f).toHaveLength(0);
  });
  it('пользовательское hard-правило (запрещённый термин) блокирует', () => {
    const rules: Rule[] = [...DEFAULT_RULES, { id: 'nda', label: 'NDA-термин', pattern: 'секретныйклиент', severity: 'hard', message: 'Запрещённый термин', enabled: true }];
    const f = validateIdea(mk('Кейс СекретныйКлиент'), rules);
    expect(hasHardFlag(f)).toBe(true);
  });
  it('COR-4: правило с ё матчит текст с е и наоборот', () => {
    const r1: Rule[] = [{ id: 'yo', label: 't', pattern: 'ключёвое', severity: 'soft', message: 'm', enabled: true }];
    expect(validateContent('это ключевое слово', r1).some((f) => f.ruleId === 'yo')).toBe(true);
    const r2: Rule[] = [{ id: 'yo2', label: 't', pattern: 'елка', severity: 'soft', message: 'm', enabled: true }];
    expect(validateContent('красивая ёлка', r2).some((f) => f.ruleId === 'yo2')).toBe(true);
  });
  it('невалидный regex пользовательского правила игнорируется, не роняя проверку', () => {
    const bad: Rule[] = [{ id: 'bad', label: 't', pattern: '(', severity: 'soft', message: 'm', enabled: true }];
    expect(() => validateContent('любой текст', bad)).not.toThrow();
    expect(validateContent('любой текст', bad)).toHaveLength(0);
  });
});

describe('SEC-1: CSV formula injection нейтрализуется', () => {
  it('ячейки с ведущими = + - @ Tab CR префиксуются апострофом', () => {
    expect(csvCell('=HYPERLINK("http://evil")')).toBe('"\'=HYPERLINK(""http://evil"")"');
    expect(csvCell('+1234')).toBe("'+1234");
    expect(csvCell('-cmd')).toBe("'-cmd");
    expect(csvCell('@SUM(A1)')).toBe("'@SUM(A1)");
    expect(csvCell('\tИнъекция')).toBe("'\tИнъекция");
  });
  it('обычный текст и числа не трогаются', () => {
    expect(csvCell('Алексей')).toBe('Алексей');
    expect(csvCell(12400)).toBe('12400');
    expect(csvCell('12.5%')).toBe('12.5%');
    expect(csvCell('')).toBe('');
  });
});
