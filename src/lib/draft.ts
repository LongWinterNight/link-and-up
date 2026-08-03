import type { Idea, Rule } from '@/types';
import { CLUSTER_LABEL, FORMULAS } from './constants';
import { validateIdea } from './guardrails';

/**
 * Мост идея→черновик. Собирает КАРКАС поста по формуле-эталону из полей идеи.
 * Это НЕ готовый текст и НЕ выдуманные факты — это структура-подсказка, которую автор
 * наполняет реальными деталями. Цифры — только проверяемые, с источником (см. напоминание).
 */

export interface DraftLabels {
  header: string;
  noTitle: string;
  formulaNote: (formula: string) => string;
  cluster: string;
  source: string;
  channel: string;
  guardrailsNote: string;
  blocked: string;
  warnings: string;
  hardTag: string;
}

interface DraftBlueprint {
  parts: { title: string; guide: string }[];
}

const FORMULA_BLUEPRINT: Record<string, DraftBlueprint> = {
  arch: {
    parts: [
      { title: 'Хук (контртезис)', guide: 'Начни с ломающего шаблон утверждения: «Это не вайбкодинг».' },
      { title: 'Контекст', guide: 'Что за задача и почему её считали «долгой/сложной».' },
      { title: 'Что сделал', guide: 'Спека → архитектура → генерация. Подчеркни: решения твои, код с AI.' },
      { title: 'Доказательство', guide: 'Конкретика процесса. Цифры — только проверенные (см. напоминание).' },
      { title: 'Урок', guide: 'Интеграция > модель, домен-экспертиза > технарство, контекст > промпты.' },
      { title: 'CTA', guide: 'Вопрос аудитории про их подход к AI-разработке.' },
    ],
  },
  fail: {
    parts: [
      { title: 'Хук (уязвимость + цифра)', guide: 'Честно назови масштаб: «Меня отклонили N раз».' },
      { title: 'Контекст', guide: 'Что происходило, без нытья — как данные.' },
      { title: 'Что сделал', guide: 'Разобрал каждый отказ как сигнал, искал паттерн.' },
      { title: 'Вывод/система', guide: '2–4 паттерна, которые вытащил. Это ядро поста.' },
      { title: 'Урок', guide: 'Провал → система выводов, а не «просто не сдавайся».' },
      { title: 'CTA', guide: 'Вопрос: у кого похожий опыт / что помогло вам.' },
    ],
  },
  meta: {
    parts: [
      { title: 'Хук (польза)', guide: 'Обещание конкретной пользы для НЕ-ИТ бизнеса.' },
      { title: 'Контекст', guide: 'Чья боль и почему она дорогая.' },
      { title: 'Что сделал', guide: 'Внедрение/обучение AI под реальный процесс.' },
      { title: 'Доказательство', guide: 'Механика ценности. Цифры — только проверенные.' },
      { title: 'Прямой разговор', guide: 'Честно про деньги/рынок, без мотивационного шума.' },
      { title: 'CTA', guide: 'Вопрос про их процессы, которые просятся под автоматизацию.' },
    ],
  },
  pak: {
    parts: [
      { title: 'Хук (данные+вывод)', guide: '«Проанализировал X → вот выводы» (не сырые цифры).' },
      { title: 'Контекст', guide: 'Откуда данные (напр. свой разбор корпуса / отраслевой отчёт).' },
      { title: 'Выводы', guide: '3–5 неочевидных выводов — это ценность поста.' },
      { title: 'Доказательство', guide: 'Одна показательная цифра/пример.' },
      { title: 'Применение', guide: 'Что читателю с этим делать.' },
      { title: 'CTA', guide: 'Вопрос: совпадает ли с их опытом.' },
    ],
  },
  hook: {
    parts: [
      { title: 'Хук', guide: 'Первая строка ломает шаблон — под неё пишется всё.' },
      { title: 'Раскрытие', guide: '1–2 строки, короткие абзацы (white space).' },
      { title: 'Тело', guide: 'Суть, читаемая за 15 секунд.' },
      { title: 'Инсайт', guide: 'Одна мысль, ради которой стоит дочитать.' },
      { title: 'CTA', guide: 'Вопрос, провоцирующий осмысленный комментарий.' },
    ],
  },
  rif: {
    parts: [
      { title: 'Хук', guide: 'Обещание метода/фреймворка.' },
      { title: 'Role', guide: 'Кем становится AI (эксперт в теме).' },
      { title: 'Instructions', guide: 'Пошаговый процесс.' },
      { title: 'Format', guide: 'Точная структура вывода.' },
      { title: 'Пример', guide: 'Короткая демонстрация «до/после».' },
      { title: 'CTA', guide: '«Сохрани» / вопрос про их промпт-практики.' },
    ],
  },
  reaction: {
    parts: [
      { title: 'Хук', guide: 'Тезис, вызывающий осмысленную реакцию (не лайк).' },
      { title: 'Контекст', guide: 'Почему это важно сейчас.' },
      { title: 'Позиция', guide: 'Чёткое мнение, за которое зацепятся.' },
      { title: 'Нюанс', guide: 'Оговорка, показывающая глубину.' },
      { title: 'CTA', guide: 'Вопрос «а как у вас» — двигает комментарии.' },
    ],
  },
};

const FORMULA_BLUEPRINT_EN: Record<string, DraftBlueprint> = {
  arch: {
    parts: [
      { title: 'Hook (contrarian)', guide: 'Open with a pattern-breaking statement: "This is not vibe coding."' },
      { title: 'Context', guide: 'What was the task and why was it considered "long/complex".' },
      { title: 'What I did', guide: 'Spec → architecture → generation. Emphasize: decisions are yours, code with AI.' },
      { title: 'Proof', guide: 'Specifics of the process. Numbers — only verified (see reminder).' },
      { title: 'Lesson', guide: 'Integration > model, domain expertise > tech-savvy, context > prompts.' },
      { title: 'CTA', guide: 'Question to the audience about their approach to AI development.' },
    ],
  },
  fail: {
    parts: [
      { title: 'Hook (vulnerability + number)', guide: 'Honestly state the scale: "I was rejected N times."' },
      { title: 'Context', guide: 'What happened, no whining — just data.' },
      { title: 'What I did', guide: 'Analyzed each rejection as a signal, looked for patterns.' },
      { title: 'Insight/system', guide: '2–4 patterns you extracted. This is the core of the post.' },
      { title: 'Lesson', guide: 'Failure → a system of conclusions, not "just don\'t give up."' },
      { title: 'CTA', guide: 'Question: who has similar experience / what helped you.' },
    ],
  },
  meta: {
    parts: [
      { title: 'Hook (benefit)', guide: 'Promise of specific benefit for NON-IT business.' },
      { title: 'Context', guide: "Whose pain and why it's expensive." },
      { title: 'What I did', guide: 'AI implementation/training for a real process.' },
      { title: 'Proof', guide: 'Mechanics of value. Numbers — only verified.' },
      { title: 'Straight talk', guide: 'Honest about money/market, without motivational noise.' },
      { title: 'CTA', guide: 'Question about their processes that beg for automation.' },
    ],
  },
  pak: {
    parts: [
      { title: 'Hook (data + insight)', guide: '"Analyzed X → here are the conclusions" (not raw numbers).' },
      { title: 'Context', guide: 'Where the data comes from (e.g. your own corpus analysis / industry report).' },
      { title: 'Conclusions', guide: "3–5 non-obvious conclusions — this is the post's value." },
      { title: 'Proof', guide: 'One representative number/example.' },
      { title: 'Application', guide: 'What the reader should do with this.' },
      { title: 'CTA', guide: 'Question: does this match your experience.' },
    ],
  },
  hook: {
    parts: [
      { title: 'Hook', guide: 'First line breaks the pattern — everything is written to support it.' },
      { title: 'Reveal', guide: '1–2 lines, short paragraphs (white space).' },
      { title: 'Body', guide: 'The essence, readable in 15 seconds.' },
      { title: 'Insight', guide: 'One thought worth reading to the end for.' },
      { title: 'CTA', guide: 'A question that provokes a thoughtful comment.' },
    ],
  },
  rif: {
    parts: [
      { title: 'Hook', guide: 'Promise of a method/framework.' },
      { title: 'Role', guide: 'Who AI becomes (expert in the topic).' },
      { title: 'Instructions', guide: 'Step-by-step process.' },
      { title: 'Format', guide: 'Exact output structure.' },
      { title: 'Example', guide: 'A short "before/after" demo.' },
      { title: 'CTA', guide: '"Save" / question about their prompt practices.' },
    ],
  },
  reaction: {
    parts: [
      { title: 'Hook', guide: 'A thesis that provokes a thoughtful reaction (not just a like).' },
      { title: 'Context', guide: 'Why this matters now.' },
      { title: 'Position', guide: 'A clear opinion people can latch onto.' },
      { title: 'Nuance', guide: 'A caveat that shows depth.' },
      { title: 'CTA', guide: 'A "how about you" question — drives comments.' },
    ],
  },
};

const GENERIC: DraftBlueprint = {
  parts: [
    { title: 'Хук', guide: 'Первая строка ломает шаблон.' },
    { title: 'Контекст', guide: 'Кратко: что и почему.' },
    { title: 'Суть', guide: 'Главная мысль/действие.' },
    { title: 'Доказательство', guide: 'Пример или проверенная цифра.' },
    { title: 'CTA', guide: 'Вопрос аудитории.' },
  ],
};

const GENERIC_EN: DraftBlueprint = {
  parts: [
    { title: 'Hook', guide: 'First line breaks the pattern.' },
    { title: 'Context', guide: 'Briefly: what and why.' },
    { title: 'Core', guide: 'Main thought/action.' },
    { title: 'Proof', guide: 'Example or verified number.' },
    { title: 'CTA', guide: 'Question to the audience.' },
  ],
};

export interface DraftResult {
  text: string;
  blocked: boolean;
}

export function generateDraft(
  idea: Idea,
  rules?: Rule[],
  clusterName?: (id: string) => string,
  labels?: DraftLabels,
  locale?: string,
): DraftResult {
  const formula = FORMULAS.find((f) => f.id === idea.formula);
  const bp =
    (locale === 'en' ? FORMULA_BLUEPRINT_EN[idea.formula] : null) ||
    FORMULA_BLUEPRINT[idea.formula] ||
    (locale === 'en' ? GENERIC_EN : GENERIC);
  const flags = validateIdea(idea, rules);
  const blocked = flags.some((f) => f.severity === 'hard');

  const lines: string[] = [];
  if (labels) {
    lines.push('# ' + labels.header + ': ' + (idea.title || labels.noTitle));
    lines.push('');
    lines.push('> ' + labels.formulaNote(formula?.title || idea.formula));
    lines.push(
      '> ' +
        labels.cluster +
        ': ' +
        (clusterName ? clusterName(idea.cluster) : CLUSTER_LABEL[idea.cluster] || idea.cluster) +
        ' · ' +
        labels.source +
        ': ' +
        (idea.source || '—') +
        ' · ' +
        labels.channel +
        ': ' +
        idea.channel,
    );
  } else {
    lines.push('# Черновик: ' + (idea.title || 'Без названия'));
    lines.push('');
    lines.push('> Каркас по формуле «' + (formula?.title || idea.formula) + '». Наполни реальными деталями.');
    lines.push(
      '> Кластер: ' +
        (clusterName ? clusterName(idea.cluster) : CLUSTER_LABEL[idea.cluster] || idea.cluster) +
        ' · Источник: ' +
        (idea.source || '—') +
        ' · Канал: ' +
        idea.channel,
    );
  }
  lines.push('');
  lines.push('---');
  lines.push('');
  bp.parts.forEach((p, i) => {
    lines.push('**' + (i + 1) + '. ' + p.title + '**');
    if (i === 0 && idea.hook) lines.push(idea.hook);
    lines.push('_' + p.guide + '_');
    lines.push('');
  });
  lines.push('---');
  lines.push('');
  if (labels) {
    lines.push(labels.guardrailsNote);
    if (flags.length) {
      lines.push('');
      lines.push(blocked ? labels.blocked : labels.warnings);
      flags.forEach((f) => lines.push('- ' + (f.severity === 'hard' ? labels.hardTag : '') + f.message));
    }
  } else {
    lines.push(
      '⚠️ Гардрейлы: используйте проверяемые факты и конкретные цифры с источником; избегайте абсолютных обещаний и превосходной степени без доказательства; соблюдайте свои brand-safety правила.',
    );
    if (flags.length) {
      lines.push('');
      lines.push(blocked ? '🚫 БЛОКИРУЮЩИЕ нарушения (исправь до публикации):' : '⚠️ Предупреждения:');
      flags.forEach((f) => lines.push('- ' + (f.severity === 'hard' ? '[HARD] ' : '') + f.message));
    }
  }

  return { text: lines.join('\n'), blocked };
}
