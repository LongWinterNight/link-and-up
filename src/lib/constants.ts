import type { ClusterDef, ClusterId, Formula } from '@/types';

export const LS_KEY = 'lidb_state_v4';
export const SCHEMA_VERSION = 3;

/** Имя продукта (placeholder — меняется одной строкой). */
export const PRODUCT_NAME = 'Link-and-Up';
export const PRODUCT_TAGLINE = 'Аналитика и планирование контента LinkedIn';
/** Автор «своих постов» по умолчанию (петля обучения). Позже — из настроек. */
export const OWN_AUTHOR = 'Ваш пост';
/** Цель каденса публикаций в неделю по умолчанию. */
export const CADENCE_GOAL = 5;

export const CLUSTERS: [ClusterId, string][] = [
  ['spec', 'Spec-driven / Claude Code'],
  ['prompt', 'Промпт-фреймворки и контент'],
  ['agents', 'AI-агенты 2026 / build-in-public'],
  ['jobs', 'Работа / собеседования / отказы'],
  ['solo', 'Solopreneur / инди / MVP'],
  ['bubble', 'AI-пузырь / скепсис / этика'],
  ['enable', 'Enablement-кейсы с цифрами'],
  ['industry', 'Отрасли'],
  ['life', 'Жизнь / карьера'],
  ['other', 'Другое'],
];

export const CLUSTER_LABEL: Record<string, string> = Object.fromEntries(CLUSTERS);

/**
 * NICHE-1: дефолтный реестр кластеров = встроенная AI-ниша. keywords пусты — назначение
 * builtin-кластеров делает эвристика clusterOf; пользовательские кластеры работают по keywords.
 */
export const DEFAULT_CLUSTER_DEFS: ClusterDef[] = CLUSTERS.map(([id, label]) => ({
  id,
  label,
  keywords: [],
  builtin: true,
}));

export const FORMULAS: Formula[] = [
  {
    id: 'pak',
    cluster: 'enable',
    title: 'Данные + вывод',
    body: 'Данные без вывода проваливаются. «Проанализировал X → вот выводы» даёт кратно больше охвата, чем сырая выгрузка.',
  },
  {
    id: 'hook',
    cluster: 'prompt',
    title: 'Хук решает',
    body: 'Pattern-breaking первая строка ↑3.2× дочитываний; white space ↑2.7× dwell time. Первые 30–60 минут критичны для алгоритма.',
  },
  {
    id: 'reaction',
    cluster: 'prompt',
    title: 'Тип реакции > количества',
    body: 'Insightful и комментарий весят больше лайка. Провоцируйте осмысленный отклик, а не «палец вверх».',
  },
  {
    id: 'rif',
    cluster: 'spec',
    title: 'RIF + 8-частная структура',
    body: 'Role + Instructions + Format. Восьмичастная структура поста: хук → контекст → конфликт → инсайт → доказательство → урок → обобщение → CTA.',
  },
  {
    id: 'fail',
    cluster: 'jobs',
    title: 'Провал → система выводов',
    body: 'Честные дневники отказов и ошибок собирают 40–170 комментариев. Уязвимость + вывод, не нытьё.',
  },
  {
    id: 'arch',
    cluster: 'spec',
    title: 'Экспертиза > инструмент',
    body: 'Домен-экспертиза и контекст важнее модели и «магии AI». Позиция специалиста, а не «промптера».',
  },
  {
    id: 'meta',
    cluster: 'enable',
    title: 'Польза + честность + конкретика',
    body: 'Прикладная польза + честный опыт + конкретные цифры и примеры, без мотивационного шума.',
  },
];

export const ANTIPATTERNS: string[] = [
  'Заявлять «первый / уникальный / лучший» без доказательства.',
  'Мотивационный шум сжигает доверие аудитории.',
  'Данные без вывода — читатель не понимает, зачем это ему.',
  'Переполированный AI-тон убивает человечность текста.',
];

export const STATUS: [string, string][] = [
  ['draft', 'Черновик'],
  ['inwork', 'В работе'],
  ['published', 'Опубликовано'],
];
export const STATUS_LABEL: Record<string, string> = Object.fromEntries(STATUS);

export const CHANNELS = ['LinkedIn', 'Telegram', 'Блог', 'Другое'];

/** Палитра графиков (colorblind-aware, из handoff). */
export const CHART_PALETTE = [
  'var(--accent)',
  'var(--positive)',
  'var(--warning)',
  'var(--critical)',
  'var(--text-accent)',
  '#a97bff',
  '#37c2c8',
  '#e28b57',
  '#6b8cff',
  '#c8a24a',
];
