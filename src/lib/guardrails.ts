import type { GuardrailFlag, Idea, Rule } from '@/types';

/**
 * Гардрейлы (brand-safety) — конфигурируемый движок правил.
 * Заменяет захардкоженные «красные линии» на набор правил, который пользователь может менять.
 * severity 'hard' = блокирует статус «Опубликовано» и экспорт; 'soft' = предупреждение.
 * Дефолты — генеричные, применимы к любому автору. Свои правила (напр. запрещённые термины,
 * имена клиентов под NDA) пользователь добавляет в настройках (Срез 3).
 */
export const DEFAULT_RULES: Rule[] = [
  {
    id: 'superlative',
    label: 'Превосходная степень без доказательства',
    // \b не работает с кириллицей в JS-regex — используем явные окончания без границы слова
    pattern: 'перв(ый|ая|ое|ые)|единствен|лучш(ий|ая|ее|ие)|№\\s?1(\\b|$)|best ever|first ever',
    severity: 'soft',
    message: 'Заявление «первый / лучший / единственный» — приложите доказательство или переформулируйте.',
    enabled: true,
    builtin: true,
  },
  {
    id: 'absolute',
    label: 'Абсолютные обещания',
    pattern: 'гаранти\\w*|100\\s?%|всегда сработает|никогда не подвед|guaranteed',
    severity: 'soft',
    message: 'Абсолютные обещания снижают доверие — смягчите формулировку.',
    enabled: true,
    builtin: true,
  },
  {
    id: 'unverified-big',
    label: 'Непроверяемая крупная цифра',
    pattern: '\\$?\\d{1,3}\\s?(млрд|миллиард|billion|трлн|trillion)',
    severity: 'soft',
    message: 'Крупная цифра без источника читается как puffery — добавьте источник или уберите.',
    enabled: true,
    builtin: true,
  },
  {
    id: 'hype',
    label: 'Хайп / мотивационный шум',
    pattern: 'взорвал интернет|секрет успеха|шокир\\w*|это изменит всё|must[- ]have прямо сейчас',
    severity: 'soft',
    message: 'Хайп-обороты сжигают доверие — дайте конкретику вместо шума.',
    enabled: true,
    builtin: true,
  },
];

/** COR-4: ё→е, чтобы правила и текст матчились независимо от написания (как в dedup.normText). */
const foldYo = (s: string) => s.replace(/ё/g, 'е').replace(/Ё/g, 'Е');

/** Проверить произвольный текст против набора правил. */
export function validateContent(text: string, rules: Rule[] = DEFAULT_RULES): GuardrailFlag[] {
  const t = foldYo((text || '').toLowerCase());
  const flags: GuardrailFlag[] = [];
  for (const r of rules) {
    if (!r.enabled) continue;
    let re: RegExp;
    try {
      re = new RegExp(foldYo(r.pattern), 'iu');
    } catch {
      continue; // некорректный regex пользовательского правила игнорируем
    }
    if (re.test(t)) flags.push({ severity: r.severity, message: r.message, ruleId: r.id });
  }
  return flags;
}

/** Проверить идею (заголовок + хук) против гардрейлов. */
export function validateIdea(idea: Pick<Idea, 'title' | 'hook'>, rules: Rule[] = DEFAULT_RULES): GuardrailFlag[] {
  return validateContent((idea.title || '') + ' ' + (idea.hook || ''), rules);
}

export function hasHardFlag(flags: GuardrailFlag[]): boolean {
  return flags.some((f) => f.severity === 'hard');
}
