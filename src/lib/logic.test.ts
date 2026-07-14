import { describe, expect, it } from 'vitest';
import { clusterOf, detectLang, enrich, parseFollowers, tagPost } from './enrich';
import { analyzeIngest, analyzeIngestChunked, diceSim, dedupKey, MAX_IMPORT_RECORDS } from './dedup';
import {
  backtest,
  effectiveCalibration,
  empiricalMultipliers,
  forecast,
  postMultipliers,
  recalcCalibration,
  selectMultipliers,
} from './forecast';
import { median } from './stats';
import {
  validateIdea,
  validateContent,
  validatePattern,
  hasHardFlag,
  DEFAULT_RULES,
  MAX_PATTERN_LENGTH,
} from './guardrails';
import { redactHard } from './guardrails';
import { csvCell, exportAuditCsv, exportIdeasCsv, exportPostsCsv, redactIdea } from './exports';
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

describe('detectLang: поле lang приоритетнее эвристик', () => {
  it('lang из данных сбора уважается; без него работает пометка и текст', () => {
    expect(detectLang({ author: 'Иван', text: 'Getting laid off... Русская аннотация дальше.', lang: 'EN' })).toBe(
      'EN',
    );
    expect(detectLang({ author: 'Ann', text: 'Pure english text about hiring and growth' })).toBe('EN');
    expect(detectLang({ author: 'Иван', text: 'Чисто русский текст про найм' })).toBe('RU');
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
  it('COR-6: RU-пост, начинающийся с URL или латинского бренда, — RU', () => {
    expect(
      detectLang({
        author: 'Пётр',
        text: 'https://example.com/very/long/path?q=1 Разбираю кейс автоматизации на реальном проекте',
      }),
    ).toBe('RU');
    expect(
      detectLang({
        author: 'Оля',
        text: 'ChatGPT Turbo benchmark показал неожиданный результат на русскоязычных задачах',
      }),
    ).toBe('RU');
  });
  it('COR-6: пустой текст — RU по умолчанию, EN-пост с поздней RU-аннотацией — EN', () => {
    expect(detectLang({ author: 'X', text: '' })).toBe('RU');
    expect(
      detectLang({
        author: 'Kate',
        text: 'I shipped an automation that applies to jobs better than most humans and here is what happened next. Формат: список.',
      }),
    ).toBe('EN');
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
  it('М48: url с опасной схемой отбрасывается, обычный сохраняется', () => {
    expect(enrich({ author: 'X', text: 't', url: 'javascript:alert(1)' }).url).toBe('');
    expect(enrich({ author: 'X', text: 't', url: ' DATA:text/html,x' }).url).toBe('');
    expect(enrich({ author: 'X', text: 't', url: 'linkedin.com/posts/abc' }).url).toBe('linkedin.com/posts/abc');
    expect(enrich({ author: 'X', text: 't', url: 'https://example.com' }).url).toBe('https://example.com');
  });
  it('COR-1: reactions>0, comments=0 => has_metrics=true, но rate=null (комментарии неизвестны)', () => {
    const p = enrich({ author: 'X', text: 'text', reactions: 40, comments: 0, headline: '5 000 подписчиков' });
    expect(p.has_metrics).toBe(true);
    expect(p.rate).toBeNull();
  });
});

describe('dedup / ingest', () => {
  const base: Post[] = [
    enrich({
      author: 'Игорь Ветров',
      text: 'Спека до кода — и Claude Code перестал фантазировать полностью совсем',
      reactions: 10,
      comments: 5,
    }),
  ];
  it('diceSim = 1 для идентичных строк', () => {
    expect(diceSim('привет мир', 'привет мир')).toBe(1);
  });
  it('точный дубль по dedupKey не добавляется', () => {
    const dup: RawPost = {
      author: 'Игорь Ветров',
      text: 'Спека до кода — и Claude Code перестал фантазировать полностью совсем',
    };
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
    id: 'i',
    title: 'Как собрать ERP',
    hook: 'Как я собрал ERP за неделю?',
    cluster: 'spec',
    formula: 'arch',
    source: 'Кейс',
    channel: 'LinkedIn',
    status: 'draft',
    date: '',
    refPostId: '',
    predicted: 0,
    actual: null,
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
    const ref = enrich({
      query: 'spec',
      author: 'Ref',
      headline: '10 000 подписчиков',
      reactions: 50,
      comments: 0,
      text: 'реф',
    });
    const pool: Post[] = [ref, ...posts];
    const fc = forecast({ ...idea, refPostId: ref.id }, pool, 1);
    expect(fc!.lowData).toBe(false);
    expect(fc!.base).toBe(50); // медиана 40/50/60, а не 0 от референса
  });
});

describe('FCST-2: эмпирические множители из корпуса', () => {
  // 120 постов: у всех RU, у половины — цифры в тексте; комментарии НЕ зависят от факторов (все = 50)
  const mkCorpus = () =>
    Array.from({ length: 120 }, (_, i) => {
      const withNumbers = i % 2 === 0;
      return enrich({
        author: 'Автор ' + i,
        text: withNumbers
          ? 'пост про рост выручки 37 процентов делюсь опытом'
          : 'пост про рост выручки делюсь опытом коротко',
        reactions: 5,
        comments: 50,
      });
    });

  it('меньше 100 метрик → null (честный отказ)', () => {
    expect(empiricalMultipliers(mkCorpus().slice(0, 60))).toBeNull();
  });

  it('фактор без эффекта получает ×1.0; малая сторона — дефолт с пометкой fallback', () => {
    const emp = empiricalMultipliers(mkCorpus())!;
    expect(emp.multipliers.numbers).toBe(1); // 50/50 — эффекта нет
    expect(emp.details.ru.fallback).toBe(true); // все RU — стороны «без» нет
    expect(emp.multipliers.ru).toBe(1.1); // дефолт сохранён
  });

  it('selectMultipliers выбирает эмпирические, когда они точнее на бэктесте', () => {
    const posts = mkCorpus();
    const sel = selectMultipliers(posts);
    expect(sel.chosen).toBe('empirical'); // дефолтный ×1.2 за цифры здесь только вредит
    expect(sel.empiricalMape).not.toBeNull();
    expect(sel.empiricalMape!).toBeLessThan(sel.defaultMape!);
    // кэш по ссылке
    expect(selectMultipliers(posts)).toBe(sel);
  });

  it('клип сверху: аномальный фактор не даёт множитель больше 1.6', () => {
    // цифры «дают» ×4 — эмпирика обязана обрезаться до 1.6
    const posts = Array.from({ length: 120 }, (_, i) => {
      const withNumbers = i % 2 === 0;
      return enrich({
        author: 'А' + i,
        text: withNumbers ? 'кейс с цифрой 42 внутри текста поста' : 'кейс без чисел внутри текста поста',
        reactions: 5,
        comments: withNumbers ? 200 : 50,
      });
    });
    const emp = empiricalMultipliers(posts)!;
    expect(emp.multipliers.numbers).toBe(1.6);
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
      {
        id: '1',
        title: '',
        hook: '',
        cluster: 'spec',
        formula: 'arch',
        source: '',
        channel: 'LinkedIn',
        status: 'published',
        date: '',
        refPostId: '',
        predicted: 50,
        actual: { reactions: 0, comments: 100, leads: 0, interviews: 0, date: '' },
      },
    ];
    const c = recalcCalibration(ideas, 1);
    expect(c.calibration).toBeCloseTo(2, 5);
    expect(c.count).toBe(1);
  });
  it('Q-3: экстремальный факт клипуется к 3, mape>1 даёт accuracy=0', () => {
    const mkIdea = (predicted: number, comments: number): Idea => ({
      id: 'x',
      title: '',
      hook: '',
      cluster: 'spec',
      formula: 'arch',
      source: '',
      channel: 'LinkedIn',
      status: 'published',
      date: '',
      refPostId: '',
      predicted,
      actual: { reactions: 0, comments, leads: 0, interviews: 0, date: '' },
    });
    const clipped = recalcCalibration([mkIdea(10, 100)], 1); // ratio 10 → клип 3
    expect(clipped.calibration).toBe(3);
    const bad = recalcCalibration([mkIdea(100, 10)], 1); // |10-100|/10 = 9 → mape>1 → accuracy 0
    expect(bad.accuracy).toBe(0);
  });
  it('COR-8: effectiveCalibration активна только от 3 фактов', () => {
    expect(effectiveCalibration(2, 0)).toBe(1);
    expect(effectiveCalibration(2, 2)).toBe(1);
    expect(effectiveCalibration(2, 3)).toBe(2);
    expect(effectiveCalibration(0, 5)).toBe(1); // защита от нуля
  });
});

describe('backtest leave-one-out', () => {
  const mkPosts = (n: number): Post[] =>
    Array.from({ length: n }, (_, i) =>
      enrich({
        query: 'spec',
        author: 'A' + i,
        headline: '10 000 подписчиков',
        reactions: 10,
        comments: 30 + i,
        text: 'пост номер ' + i,
      }),
    );
  it('недостоверен при <8 постах', () => {
    const r = backtest([]);
    expect(r.mape).toBeNull();
    expect(r.note).toContain('недостоверен');
  });
  it('Q-3: граница достоверности — 7 недостоверен, ровно 8 считается', () => {
    const r7 = backtest(mkPosts(7));
    expect(r7.n).toBe(7);
    expect(r7.mape).toBeNull();
    const r8 = backtest(mkPosts(8));
    expect(r8.n).toBe(8);
    expect(r8.mape).not.toBeNull();
    expect(r8.within2x).not.toBeNull();
  });
  it('Q-3: один пост — недостоверен, не падает', () => {
    const r1 = backtest(mkPosts(1));
    expect(r1.n).toBe(1);
    expect(r1.mape).toBeNull();
  });
  it('SCALE-2: O(n log n)-бэктест эквивалентен brute-force O(n²) на разнородном корпусе', () => {
    let seed = 7;
    const rnd = () => (seed = (seed * 48271) % 2147483647) / 2147483647;
    const posts: Post[] = Array.from({ length: 60 }, (_, i) => {
      const p = enrich({
        author: 'A' + i,
        headline: '10 000 подписчиков',
        reactions: 5,
        comments: 1 + Math.floor(Math.exp(rnd() * 4)),
        text: 'пост номер ' + i,
      });
      p.meta_cluster = (['spec', 'jobs', 'other'] as Post['meta_cluster'][])[i % 3];
      return p;
    });
    // brute-force копия исходного алгоритма
    const metric = posts.filter((p) => p.has_metrics && p.comments > 0);
    const apes: number[] = [];
    const abss: number[] = [];
    let w = 0;
    for (const p of metric) {
      const same = metric.filter((o) => o.id !== p.id && o.meta_cluster === p.meta_cluster);
      const pool = same.length >= 3 ? same : metric.filter((o) => o.id !== p.id);
      const base = median(pool.map((o) => o.comments)) || 8;
      const pred = Math.max(1, Math.round(base * postMultipliers(p)));
      apes.push(Math.abs(p.comments - pred) / p.comments);
      abss.push(Math.abs(p.comments - pred));
      if (pred >= p.comments / 2 && pred <= p.comments * 2) w++;
    }
    const r = backtest(posts);
    expect(r.mape).toBe(Math.round((apes.reduce((a, b) => a + b, 0) / apes.length) * 100) / 100);
    expect(r.medianAbsErr).toBe(Math.round(median(abss)));
    expect(r.within2x).toBe(Math.round((w / metric.length) * 100));
  });
  it('считает метрики при достаточном корпусе', () => {
    const posts: Post[] = Array.from({ length: 12 }, (_, i) =>
      enrich({
        query: 'spec',
        author: 'A' + i,
        headline: '10 000 подписчиков',
        reactions: 10,
        comments: 30 + i,
        text: 'пост номер ' + i,
      }),
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
    const rules: Rule[] = [
      ...DEFAULT_RULES,
      {
        id: 'nda',
        label: 'NDA-термин',
        pattern: 'секретныйклиент',
        severity: 'hard',
        message: 'Запрещённый термин',
        enabled: true,
      },
    ];
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

describe('SEC-2: validatePattern — защита от ReDoS', () => {
  it('нормальные паттерны проходят, включая все дефолтные правила', () => {
    expect(validatePattern('запрещённыйтермин')).toBeNull();
    expect(validatePattern('гаранти\\w*|100\\s?%')).toBeNull();
    for (const r of DEFAULT_RULES) expect(validatePattern(r.pattern)).toBeNull();
  });
  it('вложенные квантификаторы отклоняются', () => {
    expect(validatePattern('(a+)+')).toContain('ReDoS');
    expect(validatePattern('(\\w*)*x')).toContain('ReDoS');
    expect(validatePattern('(слово{2,})+')).toContain('ReDoS');
  });
  it('слишком длинный и битый паттерны отклоняются', () => {
    expect(validatePattern('a'.repeat(MAX_PATTERN_LENGTH + 1))).toContain('длиннее');
    expect(validatePattern('(')).toContain('Некорректное');
    expect(validatePattern('  ')).toBe('Пустой паттерн');
  });
});

describe('SEC-3: редакция hard-терминов в экспортах', () => {
  const nda: Rule = {
    id: 'nda',
    label: 'NDA',
    pattern: 'секретныйклиент',
    severity: 'hard',
    message: 'NDA',
    enabled: true,
  };
  const rules: Rule[] = [...DEFAULT_RULES, nda];

  it('redactHard маскирует термин, включая ё-вариант, и не трогает чистый текст', () => {
    expect(redactHard('кейс СекретныйКлиент вырос', rules)).toBe('кейс [удалено: NDA] вырос');
    expect(redactHard('обычный текст', rules)).toBe('обычный текст');
  });

  it('термин в headline не попадает в CSV, в тексте — не попадает в JSON', async () => {
    const p = enrich({
      author: 'A',
      headline: 'CMO у СекретныйКлиент',
      text: 'внедрили у СекретныйКлиент за месяц',
      reactions: 1,
      comments: 1,
    });
    const csv = exportPostsCsv([p], rules);
    expect(csv).not.toContain('СекретныйКлиент');
    expect(csv).toContain('[удалено: NDA]');
    const { exportPostsJson } = await import('./exports');
    const json = exportPostsJson([p], rules);
    expect(json).not.toContain('СекретныйКлиент');
    expect(json).toContain('[удалено: NDA]');
  });

  it('термин в idea.source прячет идею целиком (redactIdea учитывает source)', () => {
    const idea: Idea = {
      id: 'x',
      title: 'Чистый заголовок',
      hook: '',
      cluster: 'spec',
      formula: 'arch',
      source: 'кейс СекретныйКлиент',
      channel: 'LinkedIn',
      status: 'draft',
      date: '',
      refPostId: '',
      predicted: 0,
      actual: null,
    };
    expect(redactIdea(idea, rules).redacted).toBe(true);
    const csv = exportIdeasCsv([idea], [], rules);
    expect(csv).not.toContain('СекретныйКлиент');
  });
});

describe('SEC-4: лимиты импорта', () => {
  it('входной массив капится MAX_IMPORT_RECORDS с объяснением', () => {
    const incoming = Array.from({ length: MAX_IMPORT_RECORDS + 5 }, (_, i) => ({
      author: 'A' + i,
      text: 'уникальный текст номер ' + i + ' про инженерию',
    }));
    const r = analyzeIngest([], incoming);
    expect(r.added).toBe(MAX_IMPORT_RECORDS);
    expect(r.reasons.some((x) => x.includes('ограничен'))).toBe(true);
  });

  it('SCALE-9: chunked-вариант даёт результат, идентичный синхронному, и умеет отменяться', async () => {
    const existing = [
      enrich({
        author: 'Игорь Ветров',
        text: 'Спека до кода — и Claude Code перестал фантазировать полностью совсем',
        reactions: 1,
        comments: 1,
      }),
    ];
    const incoming = Array.from({ length: 230 }, (_, i) => ({
      author: 'A' + (i % 40),
      text: 'уникальный текст номер ' + i + ' про инженерию и контекст',
    }));
    const sync = analyzeIngest(existing, incoming);
    const progress: number[] = [];
    const chunked = await analyzeIngestChunked(existing, incoming, {
      chunkSize: 50,
      onProgress: (p) => progress.push(p.processed),
    });
    expect(chunked).toEqual(sync);
    expect(progress).toEqual([50, 100, 150, 200, 230]);

    const signal = { cancelled: false };
    const partial = await analyzeIngestChunked(existing, incoming, {
      chunkSize: 50,
      signal,
      onProgress: () => {
        signal.cancelled = true;
      }, // отмена после первого чанка
    });
    // отмена: обработан ровно один чанк (50), тогда как полный прогон обработал все 230
    expect(partial.added + partial.dupes + partial.rejected).toBe(50);
    expect(sync.added + sync.dupes + sync.rejected).toBe(230);
  });

  it('бакетизация по автору не сломала near-dup детекцию', () => {
    const base = [
      enrich({
        author: 'Игорь Ветров',
        text: 'Спека до кода — и Claude Code перестал фантазировать полностью совсем',
        reactions: 1,
        comments: 1,
      }),
    ];
    const near = { author: 'Игорь Ветров', text: 'Спека до кода — и Claude Code перестал фантазировать почти совсем' };
    const r = analyzeIngest(base, [near]);
    expect(r.nearDupes).toBe(1);
    // другой автор с тем же текстом — НЕ near-dup (бакет другой)
    const other = analyzeIngest(base, [{ author: 'Другой Автор', text: near.text }]);
    expect(other.added).toBe(1);
  });
});

describe('OBS-1: экспорт журнала', () => {
  it('CSV с заголовком, событиями и защитой от формул', () => {
    const csv = exportAuditCsv([
      { t: '2026-07-12T10:00:00Z', msg: 'Импорт: добавлено 5 постов' },
      { t: '2026-07-12T11:00:00Z', msg: '=HYPERLINK("evil")' },
    ]);
    expect(csv).toContain('Время (ISO)');
    expect(csv).toContain('Импорт: добавлено 5 постов');
    expect(csv).toContain("'=HYPERLINK");
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
