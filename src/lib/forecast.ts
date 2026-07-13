import type {
  BacktestResult,
  Calibration,
  ForecastResult,
  ForecastStep,
  Idea,
  Post,
} from '@/types';
import { CLUSTER_LABEL } from './constants';
import { clamp, median, nf, quantile } from './stats';

/** FCST-2: именованные факторы формата — общие для дефолтных и эмпирических множителей. */
export interface FactorMultipliers {
  hook: number;
  personal: number;
  numbers: number;
  cta: number;
  ru: number;
}

export const DEFAULT_MULTIPLIERS: FactorMultipliers = { hook: 1.4, personal: 1.25, numbers: 1.2, cta: 1.15, ru: 1.1 };

/** Бинарные признаки поста (для множителей и их эмпирической оценки). */
export function postFactors(p: Post): Record<keyof FactorMultipliers, boolean> {
  const first = (p.text || '').split('\n')[0].toLowerCase();
  return {
    hook: p.tags.hook_type === 'вопрос' || /[?]/.test(first) || /^как|^почему|миф|на самом деле/.test(first),
    personal: p.tags.flags.includes('personal_story') || p.tags.hook_type === 'личная история',
    numbers: p.tags.flags.includes('has_numbers'),
    cta: p.tags.cta_type === 'вопрос в конце',
    ru: p.lang === 'RU',
  };
}

/** Множители формата поста — зеркалят множители идеи (для бэктеста). */
function postMultipliers(p: Post, mult: FactorMultipliers = DEFAULT_MULTIPLIERS): number {
  const f = postFactors(p);
  let m = 1;
  if (f.hook) m *= mult.hook;
  if (f.personal) m *= mult.personal;
  if (f.numbers) m *= mult.numbers;
  if (f.cta) m *= mult.cta;
  if (f.ru) m *= mult.ru;
  return m;
}

/**
 * FCST-2: эмпирические множители из корпуса пользователя. Для каждого фактора —
 * медиана комментариев «с фактором» / медиана «без», клип [0.7–1.6]; при малой стороне
 * (<20 постов) фактор остаётся дефолтным. Требует ≥100 постов с метриками, иначе null.
 * Никаких скрытых весов: каждый множитель объясним и показывается с n.
 */
export const EMPIRICAL_MIN_POSTS = 100;
export const EMPIRICAL_MIN_SIDE = 20;

export interface EmpiricalFactor {
  value: number;
  nWith: number;
  nWithout: number;
  /** true, если сторона мала и взят дефолт. */
  fallback: boolean;
}

export function empiricalMultipliers(posts: Post[]): { multipliers: FactorMultipliers; details: Record<keyof FactorMultipliers, EmpiricalFactor> } | null {
  const metric = posts.filter((p) => p.has_metrics && p.comments > 0);
  if (metric.length < EMPIRICAL_MIN_POSTS) return null;
  const keys = Object.keys(DEFAULT_MULTIPLIERS) as (keyof FactorMultipliers)[];
  const multipliers = { ...DEFAULT_MULTIPLIERS };
  const details = {} as Record<keyof FactorMultipliers, EmpiricalFactor>;
  for (const k of keys) {
    const withF: number[] = [];
    const withoutF: number[] = [];
    for (const p of metric) (postFactors(p)[k] ? withF : withoutF).push(p.comments);
    if (withF.length < EMPIRICAL_MIN_SIDE || withoutF.length < EMPIRICAL_MIN_SIDE) {
      details[k] = { value: DEFAULT_MULTIPLIERS[k], nWith: withF.length, nWithout: withoutF.length, fallback: true };
      continue;
    }
    const v = clamp(median(withF) / Math.max(1, median(withoutF)), 0.7, 1.6);
    multipliers[k] = Math.round(v * 100) / 100;
    details[k] = { value: multipliers[k], nWith: withF.length, nWithout: withoutF.length, fallback: false };
  }
  return { multipliers, details };
}

export interface MultiplierSelection {
  chosen: 'default' | 'empirical';
  multipliers: FactorMultipliers;
  defaultMape: number | null;
  empiricalMape: number | null;
  empirical: ReturnType<typeof empiricalMultipliers>;
}

const selectionCache = new WeakMap<readonly Post[], MultiplierSelection>();

/**
 * FCST-2: автовыбор набора множителей — leave-one-out бэктест гоняется на обоих,
 * применяется тот, что честно точнее НА ЭТОМ корпусе. Кэш по ссылке на posts.
 */
export function selectMultipliers(posts: Post[]): MultiplierSelection {
  const cached = selectionCache.get(posts);
  if (cached) return cached;
  const emp = empiricalMultipliers(posts);
  const defaultMape = backtest(posts, DEFAULT_MULTIPLIERS).mape;
  let result: MultiplierSelection = { chosen: 'default', multipliers: DEFAULT_MULTIPLIERS, defaultMape, empiricalMape: null, empirical: emp };
  if (emp) {
    const empiricalMape = backtest(posts, emp.multipliers).mape;
    if (empiricalMape != null && (defaultMape == null || empiricalMape < defaultMape)) {
      result = { chosen: 'empirical', multipliers: emp.multipliers, defaultMape, empiricalMape, empirical: emp };
    } else {
      result = { ...result, empiricalMape };
    }
  }
  selectionCache.set(posts, result);
  return result;
}

/**
 * Прогноз вовлечения идеи — прозрачная эвристика с пошаговым разложением.
 * ВСЕ числа — ОЦЕНКА, не факт. Показывать разложение и посты-основания.
 */
export function forecast(
  idea: Idea | null,
  posts: Post[],
  calibration: number,
  mults: FactorMultipliers = DEFAULT_MULTIPLIERS,
): ForecastResult | null {
  if (!idea) return null;
  const clusterPosts = posts.filter((p) => p.has_metrics && p.meta_cluster === idea.cluster);
  const pool = clusterPosts.length >= 3 ? clusterPosts : posts.filter((p) => p.has_metrics);
  const refPost = idea.refPostId
    ? posts.find((p) => p.id === idea.refPostId && p.has_metrics) || null
    : null;
  // COR-3: пост-референс годится как база только если у него ИЗВЕСТНЫ комментарии (comments>0).
  // comments===0 = «неизвестно» (0 ≠ ноль), иначе база=0 обнулила бы весь прогноз молча.
  const baseFromRef = !!refPost && refPost.comments > 0;
  const poolComments = pool.map((p) => p.comments).filter((c) => c > 0);
  const med = median(poolComments) || 8;
  const base = baseFromRef ? refPost!.comments : med;
  // COR-2: если нет ни валидного референса, ни постов с метриками — базу взять неоткуда (med=8 — заглушка).
  const lowData = !baseFromRef && poolComments.length === 0;
  const txt = ((idea.title || '') + ' ' + (idea.hook || '')).toLowerCase();
  const first = (idea.hook || '').split('\n')[0];

  const steps: ForecastStep[] = [];
  let running = base;
  steps.push({
    label: baseFromRef
      ? 'База: пост-референс «' + refPost!.author + '»'
      : lowData
        ? 'База: нет данных (заглушка)'
        : 'База: медиана кластера «' + (CLUSTER_LABEL[idea.cluster] || idea.cluster) + '»',
    factor: '',
    running: Math.round(running),
  });
  const apply = (cond: boolean, label: string, f: number) => {
    if (cond) {
      running *= f;
      steps.push({ label, factor: '×' + f, running: Math.round(running) });
    }
  };
  apply(/[?]/.test(first) || /^как|^почему|миф|на самом деле/.test(first.toLowerCase()), 'Сильный хук', mults.hook);
  const personal = /\bя\b|\bмой\b|\bмоя\b|честно|признаюсь/.test(txt);
  apply(personal, 'Личная история', mults.personal);
  apply(/\d/.test(txt), 'Есть цифры', mults.numbers);
  apply(/[?]\s*$/.test((idea.hook || '').trim()), 'Вопрос-CTA', mults.cta);
  apply(idea.channel === 'LinkedIn' || idea.channel === 'Telegram', 'RU-рынок', mults.ru);
  const cal = calibration || 1;
  running *= cal;
  steps.push({ label: 'Калибровка по фактам', factor: '×' + cal.toFixed(2), running: Math.round(running) });
  const expected = Math.round(running);
  const mult = expected / (base * cal || 1);

  // доверительный интервал из межквартильного разброса кластера
  const sortedC = pool.map((p) => p.comments).sort((a, b) => a - b);
  const q25 = quantile(sortedC, 0.25);
  const q75 = quantile(sortedC, 0.75);
  const medc = median(sortedC) || 1;
  let low: number;
  let high: number;
  let bandNote: string;
  if (pool.length >= 5 && medc > 0) {
    low = Math.round(expected * (q25 / medc));
    high = Math.round(expected * (q75 / medc));
    bandNote =
      'Диапазон = межквартильный разброс кластера (' +
      pool.length +
      ' постов): 25-й перцентиль ' +
      nf(q25) +
      ', 75-й ' +
      nf(q75) +
      ' комм.';
  } else {
    low = Math.round(expected * 0.5);
    high = Math.round(expected * 1.8);
    bandNote = 'Мало данных в кластере (' + pool.length + ' постов) — диапазон ориентировочный (±).';
  }
  if (low > expected) low = expected;
  if (high < expected) high = expected;

  // прогноз ER (те же множители, калибровка комментов не переносится)
  const erPool = pool.filter((p) => p.rate != null).map((p) => (p.rate as number) * 100);
  let er = null;
  if (erPool.length >= 3) {
    const erMed = median(erPool);
    const erExp = erMed * mult;
    const sortedE = [...erPool].sort((a, b) => a - b);
    const e25 = quantile(sortedE, 0.25);
    const e75 = quantile(sortedE, 0.75);
    const eMed = median(sortedE) || 1;
    er = { expected: erExp, low: erExp * (e25 / eMed), high: erExp * (e75 / eMed), n: erPool.length };
  }

  let evidence = [...pool].sort((a, b) => b.comments - a.comments).slice(0, 3);
  if (refPost) evidence = [refPost, ...evidence.filter((p) => p.id !== refPost.id)].slice(0, 3);
  const clName = CLUSTER_LABEL[idea.cluster] || idea.cluster;
  const explain = baseFromRef
    ? 'База = комментарии поста-референса «' +
      refPost!.author +
      '» (' +
      nf(refPost!.comments) +
      ') из кластера «' +
      clName +
      '».'
    : lowData
      ? 'Нет постов с метриками для основы прогноза — число ориентировочное. Добавьте свои посты с фактами или референс.'
      : 'База = медиана комментариев по кластеру «' +
        clName +
        '» (' +
        poolComments.length +
        ' постов с метриками) = ' +
        Math.round(med) +
        '.';

  return {
    base: Math.round(base),
    expected,
    low,
    high,
    bandNote,
    steps,
    mult,
    er,
    explain,
    evidence,
    refPost,
    poolSize: pool.length,
    lowData,
  };
}

/**
 * COR-8: калибровка становится множителем только от CALIBRATION_MIN_FACTS фактов.
 * Один-два факта — статистический шум; коэффициент показываем, но не применяем.
 */
export const CALIBRATION_MIN_FACTS = 3;
export function effectiveCalibration(cal: number, factCount: number): number {
  return factCount >= CALIBRATION_MIN_FACTS ? cal || 1 : 1;
}

/** Калибровка + точность по опубликованным своим идеям с фактами. */
export function recalcCalibration(ideas: Idea[], currentCal: number): Calibration {
  const pub = ideas.filter(
    (i) => i.status === 'published' && i.actual && i.predicted > 0 && Number(i.actual.comments) > 0,
  );
  if (!pub.length) return { calibration: currentCal || 1, accuracy: null, count: 0 };
  const ratios = pub.map((i) => Number(i.actual!.comments) / i.predicted);
  const cal = ratios.reduce((a, b) => a + b, 0) / ratios.length;
  const mape =
    pub.map((i) => Math.abs(Number(i.actual!.comments) - i.predicted) / Number(i.actual!.comments)).reduce(
      (a, b) => a + b,
      0,
    ) / pub.length;
  return {
    calibration: clamp(cal, 0.3, 3),
    accuracy: Math.max(0, Math.round((1 - mape) * 100)),
    count: pub.length,
  };
}

/**
 * Честный бэктест leave-one-out по корпусу: для каждого поста с метриками предсказываем
 * комментарии по медиане его кластера (без него самого) × множители формата, сравниваем с фактом.
 * Метрики: MAPE, медианная абс. ошибка, доля прогнозов в пределах 2× от факта (order-of-magnitude).
 * Это измеряет, насколько «медиана кластера × формат» вообще отслеживает реальность.
 */
/** Первый индекс, где sorted[i] >= v (для поиска позиции своего значения). */
function lowerBound(sorted: number[], v: number): number {
  let lo = 0;
  let hi = sorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (sorted[mid] < v) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** Медиана отсортированного массива с пропуском элемента на позиции skip (leave-one-out без копий). */
function medianExcluding(sorted: number[], skip: number): number {
  const L = sorted.length - 1;
  if (L <= 0) return 0;
  const at = (k: number) => sorted[k < skip ? k : k + 1];
  const m = Math.floor(L / 2);
  return L % 2 ? at(m) : (at(m - 1) + at(m)) / 2;
}

export function backtest(posts: Post[], mult: FactorMultipliers = DEFAULT_MULTIPLIERS): BacktestResult {
  const metric = posts.filter((p) => p.has_metrics && p.comments > 0);
  if (metric.length < 8) {
    return {
      n: metric.length,
      mape: null,
      medianAbsErr: null,
      within2x: null,
      note: 'Мало постов с метриками (' + metric.length + ') — бэктест недостоверен.',
    };
  }
  // SCALE-2: O(n log n) вместо O(n²) — на 20K постов старая версия вешала вкладку на ~11 секунд.
  // Комментарии предгруппированы по кластеру и отсортированы; leave-one-out — через medianExcluding.
  const byCluster = new Map<string, number[]>();
  for (const p of metric) {
    const arr = byCluster.get(p.meta_cluster);
    if (arr) arr.push(p.comments);
    else byCluster.set(p.meta_cluster, [p.comments]);
  }
  for (const arr of byCluster.values()) arr.sort((a, b) => a - b);
  const all = metric.map((p) => p.comments).sort((a, b) => a - b);

  const apes: number[] = [];
  const absErrs: number[] = [];
  let within = 0;
  for (const p of metric) {
    const clusterArr = byCluster.get(p.meta_cluster)!;
    const pool = clusterArr.length - 1 >= 3 ? clusterArr : all;
    const base = medianExcluding(pool, lowerBound(pool, p.comments)) || 8;
    const pred = Math.max(1, Math.round(base * postMultipliers(p, mult)));
    const actual = p.comments;
    apes.push(Math.abs(actual - pred) / actual);
    absErrs.push(Math.abs(actual - pred));
    if (pred >= actual / 2 && pred <= actual * 2) within++;
  }
  const mape = apes.reduce((a, b) => a + b, 0) / apes.length;
  return {
    n: metric.length,
    mape: Math.round(mape * 100) / 100,
    medianAbsErr: Math.round(median(absErrs)),
    within2x: Math.round((within / metric.length) * 100),
    note:
      'Leave-one-out по ' +
      metric.length +
      ' постам с метриками. «В пределах 2×» — доля прогнозов того же порядка, что факт.',
  };
}

export { postMultipliers };
