import { describe, expect, it } from 'vitest';
import { generateDraft } from './draft';
import { redactIdea, exportObsidian } from './exports';
import { DEFAULT_RULES } from './guardrails';
import type { Idea, Rule } from '@/types';

const mk = (over: Partial<Idea>): Idea => ({
  id: 'x', title: '', hook: '', cluster: 'spec', formula: 'arch', source: '',
  channel: 'LinkedIn', status: 'draft', date: '', refPostId: '', predicted: 0, actual: null, ...over,
});

const ndaRule: Rule = { id: 'nda', label: 'NDA-термин', pattern: 'секретныйклиент', severity: 'hard', message: 'Запрещённый термин', enabled: true };

describe('generateDraft — мост идея→черновик', () => {
  it('собирает каркас по формуле, не заблокирован для чистой идеи', () => {
    const d = generateDraft(mk({ title: 'ERP за неделю', hook: 'Не вайбкодинг.', formula: 'arch' }));
    expect(d.blocked).toBe(false);
    expect(d.text).toContain('Не вайбкодинг.');
    expect(d.text).toContain('Гардрейлы');
  });
  it('блокирует при hard-нарушении пользовательского правила', () => {
    const d = generateDraft(mk({ title: 'Кейс СекретныйКлиент' }), [...DEFAULT_RULES, ndaRule]);
    expect(d.blocked).toBe(true);
    expect(d.text).toContain('БЛОКИРУЮЩИЕ');
  });
});

describe('redactIdea — редакция по гардрейлам', () => {
  it('скрывает идею с hard-нарушением', () => {
    const r = redactIdea(mk({ title: 'Кейс СекретныйКлиент' }), [...DEFAULT_RULES, ndaRule]);
    expect(r.redacted).toBe(true);
    expect(r.note).toBe('redacted');
    expect(r.title).toContain('скрыто');
  });
  it('чистую идею не трогает', () => {
    const r = redactIdea(mk({ title: 'Разбор подхода spec-driven' }));
    expect(r.redacted).toBe(false);
    expect(r.title).toContain('spec-driven');
  });
});

describe('exportObsidian', () => {
  it('содержит формулы и идеи, помечает скрытые', () => {
    const md = exportObsidian([mk({ title: 'Кейс СекретныйКлиент' })], [...DEFAULT_RULES, ndaRule]);
    expect(md).toContain('# Формулы победителей');
    expect(md).toContain('# Идеи постов');
    expect(md).toContain('скрыто (гардрейлы)');
  });
});
