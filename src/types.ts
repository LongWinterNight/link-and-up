// Доменные типы дашборда. Схема поста = исходная (из датасета) + обогащённые поля.

/**
 * NICHE-1: id кластера — строка. Встроенные id AI-ниши ('spec'…'other') остаются валидными
 * значениями; пользовательские/авто-кластеры добавляют свои id через реестр ClusterDef в сторе.
 */
export type ClusterId = string;

/** Кластер тем: builtin — из дефолтной AI-ниши (правила в clusterOf), остальные — по keywords. */
export interface ClusterDef {
  id: string;
  label: string;
  /** Ключевые слова для назначения постов (assignCluster); у builtin пусто — работает clusterOf. */
  keywords: string[];
  builtin?: boolean;
}

export type Lang = 'RU' | 'EN';

export type HookType =
  'вопрос' | 'цифра-статистика' | 'провокация/контртезис' | 'личная история' | 'обещание пользы' | 'пугающий факт';

export type Structure =
  'нумерованный список' | 'сюжетная арка' | 'кейс с цифрами' | 'конспект' | 'карусель' | 'пошаговый гайд' | 'манифест';

export type CtaType = 'вопрос в конце' | 'лид-магнит-в-комменты' | 'сохрани' | 'без CTA';

export type Emotion = 'уязвимость' | 'юмор' | 'амбиция' | 'тревога' | 'вдохновение' | 'нейтрально';

export type FormatFlag = 'has_numbers' | 'personal_story' | 'contrarian' | 'list_format' | 'save_bait';

export interface Tags {
  hook_type: HookType;
  structure: Structure;
  cta_type: CtaType;
  emotion: Emotion;
  flags: FormatFlag[];
  formatText: string;
}

/** Сырая запись поста — как приходит из датасета/импорта. */
export interface RawPost {
  /** Язык оригинала, зафиксированный при сборе (иначе — эвристика по тексту). */
  lang?: Lang;
  query?: string;
  author?: string;
  headline?: string;
  age?: string;
  reactions?: number | string;
  comments?: number | string;
  reposts?: number | string;
  text?: string;
  url?: string;
  collected_at?: string;
  is_own?: boolean;
  id?: string;
}

/** Обогащённый пост — после enrich(). */
export interface Post {
  query: string;
  author: string;
  headline: string;
  age: string;
  reactions: number;
  comments: number;
  reposts: number;
  text: string;
  url: string;
  collected_at: string;
  // обогащённые
  id: string;
  followers: number | null;
  has_metrics: boolean;
  lang: Lang;
  /** engagement rate = comments/followers, только при has_metrics && followers */
  rate: number | null;
  meta_cluster: ClusterId;
  tags: Tags;
  tags_edited?: boolean;
  is_own: boolean;
  leads?: number;
  interviews?: number;
}

export type IdeaStatus = 'draft' | 'inwork' | 'published';

export interface IdeaActual {
  reactions: number;
  comments: number;
  leads: number;
  interviews: number;
  date: string;
}

export interface Idea {
  id: string;
  title: string;
  hook: string;
  cluster: ClusterId;
  formula: string;
  /** Источник/угол идеи — свободный текст (кейс, данные, наблюдение). */
  source: string;
  channel: string;
  status: IdeaStatus;
  date: string;
  refPostId: string;
  predicted: number;
  actual: IdeaActual | null;
  /** Б7 (P-2): до 3 альтернативных хуков для сравнения; отсутствие поля = нет вариантов. */
  variants?: string[];
}

export interface Formula {
  id: string;
  cluster: ClusterId;
  title: string;
  body: string;
}

/** Одна ступень разложения прогноза «как получено число». */
export interface ForecastStep {
  label: string;
  factor: string;
  running: number;
}

export interface ErForecast {
  expected: number;
  low: number;
  high: number;
  n: number;
}

export interface ForecastResult {
  base: number;
  expected: number;
  low: number;
  high: number;
  bandNote: string;
  steps: ForecastStep[];
  mult: number;
  er: ErForecast | null;
  explain: string;
  evidence: Post[];
  refPost: Post | null;
  poolSize: number;
  /** true, если прогноз не на чём основывать (нет постов с метриками и нет валидного референса) —
   * число ориентировочное, показывать как «недостаточно данных», а не как оценку. */
  lowData: boolean;
}

export interface Calibration {
  calibration: number;
  accuracy: number | null;
  count: number;
}

/** Результат бэктеста leave-one-out по корпусу (честность прогноза). */
export interface BacktestResult {
  n: number;
  mape: number | null;
  medianAbsErr: number | null;
  within2x: number | null;
  note: string;
}

/** Нарушение гардрейла. hard = блокирует публикацию/экспорт. */
export interface GuardrailFlag {
  severity: 'hard' | 'soft';
  message: string;
  ruleId: string;
}

/** Правило гардрейлов (brand-safety). Конфигурируется пользователем. */
export interface Rule {
  /** Б3: идентификатор нишевого пакета, из которого пришло правило (undefined = своё/дефолтное). */
  pack?: string;
  id: string;
  label: string;
  /** источник регулярного выражения (i, u флаги применяются автоматически) */
  pattern: string;
  severity: 'hard' | 'soft';
  message: string;
  enabled: boolean;
  builtin?: boolean;
}
