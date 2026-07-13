import { describe, expect, it, beforeEach } from 'vitest';
import { useStore, DEFAULT_FILTERS } from './store';
import { CLUSTERS } from './lib/constants';
import type { ClusterId, Idea } from './types';

const S = () => useStore.getState();

function seedIdea(): Idea {
  return {
    id: 'idea-test',
    title: 'Тестовая идея',
    hook: 'Разбираю подход к спецификации',
    cluster: CLUSTERS[0][0] as ClusterId,
    formula: 'pak',
    source: 'наблюдение',
    channel: 'LinkedIn',
    status: 'draft',
    date: '',
    refPostId: '',
    predicted: 0,
    actual: null,
  };
}

beforeEach(() => {
  // чистый baseline, не трогаем правила/тему
  useStore.setState({
    posts: [],
    ideas: [],
    isDemo: true,
    onboarded: true,
    importOpen: false,
    importPreview: null,
    search: '',
    filters: { ...DEFAULT_FILTERS },
    presets: [],
    calibration: 1,
    calibrationCount: 0,
    readOnly: false,
  });
});

describe('store: онбординг', () => {
  it("completeOnboarding('fresh') обнуляет корпус и открывает импорт", () => {
    useStore.setState({ onboarded: false, isDemo: true });
    S().completeOnboarding('fresh');
    expect(S().posts).toHaveLength(0);
    expect(S().ideas).toHaveLength(0);
    expect(S().isDemo).toBe(false);
    expect(S().onboarded).toBe(true);
    expect(S().importOpen).toBe(true);
  });

  it("completeOnboarding('demo') оставляет корпус, помечает onboarded", () => {
    S().ingestJson(JSON.stringify([{ author: 'A', text: 'демо-пост про спецификацию и код' }]));
    const before = S().posts.length;
    useStore.setState({ onboarded: false });
    S().completeOnboarding('demo');
    expect(S().onboarded).toBe(true);
    expect(S().posts.length).toBe(before);
  });
});

describe('store: пресеты фильтров', () => {
  it('save/apply/delete', () => {
    useStore.setState({ search: 'rag', filters: { ...DEFAULT_FILTERS, lang: 'EN', hook: 'вопрос' } });
    S().savePreset('EN-вопросы');
    expect(S().presets).toHaveLength(1);
    expect(S().presets[0]).toMatchObject({ name: 'EN-вопросы', search: 'rag' });

    // изменили состояние — применение возвращает сохранённое
    useStore.setState({ search: 'другое', filters: { ...DEFAULT_FILTERS } });
    S().applyPreset('EN-вопросы');
    expect(S().search).toBe('rag');
    expect(S().filters.lang).toBe('EN');
    expect(S().filters.hook).toBe('вопрос');

    S().deletePreset('EN-вопросы');
    expect(S().presets).toHaveLength(0);
  });

  it('перезапись пресета с тем же именем не плодит дубли', () => {
    useStore.setState({ search: 'v1' });
    S().savePreset('P');
    useStore.setState({ search: 'v2' });
    S().savePreset('P');
    expect(S().presets).toHaveLength(1);
    expect(S().presets[0].search).toBe('v2');
  });

  it('пустое имя пресета — не сохраняется', () => {
    S().savePreset('   ');
    expect(S().presets).toHaveLength(0);
  });
});

describe('store: импорт', () => {
  it('previewImport + commitImport добавляют пост и снимают флаг демо', () => {
    const json = JSON.stringify([
      { author: 'Игорь Ветров', text: 'Спека до кода экономит часы отладки', reactions: 10, comments: 5 },
    ]);
    S().previewImport(json);
    expect(S().importPreview?.added).toBe(1);
    S().commitImport();
    expect(S().posts).toHaveLength(1);
    expect(S().isDemo).toBe(false);
    expect(S().importOpen).toBe(false);
  });

  it('previewImport на мусоре бросает исключение (ловит вызывающий)', () => {
    expect(() => S().previewImport('не json')).toThrow();
  });
});

describe('store: петля фактов (saveReal)', () => {
  it('публикует идею, добавляет свой пост и пересчитывает калибровку', () => {
    useStore.setState({ ideas: [seedIdea()] });
    S().saveReal('idea-test', { reactions: 80, comments: 40, leads: 2, interviews: 0, date: '2026-07-10' });
    const idea = S().ideas.find((i) => i.id === 'idea-test')!;
    expect(idea.status).toBe('published');
    expect(idea.actual).toMatchObject({ comments: 40 });
    const own = S().posts.filter((p) => p.is_own);
    expect(own).toHaveLength(1);
    expect(own[0].comments).toBe(40);
    expect(typeof S().calibration).toBe('number');
    // COR-8: один факт зафиксирован, но множитель ещё не активен
    expect(S().calibrationCount).toBe(1);
  });

  it('saveReal не падает на пустом корпусе (forecast=null)', () => {
    useStore.setState({ ideas: [seedIdea()], posts: [] });
    expect(() =>
      S().saveReal('idea-test', { reactions: 5, comments: 3, leads: 0, interviews: 0, date: '' }),
    ).not.toThrow();
    expect(S().ideas[0].status).toBe('published');
  });
});

describe('store: undo удаления идеи (М12)', () => {
  it('delIdea сохраняет снапшот, restoreLastIdea возвращает идею', () => {
    useStore.setState({ ideas: [seedIdea()] });
    S().delIdea('idea-test');
    expect(S().ideas).toHaveLength(0);
    expect(S().lastDeletedIdea?.id).toBe('idea-test');
    S().restoreLastIdea();
    expect(S().ideas).toHaveLength(1);
    expect(S().lastDeletedIdea).toBeNull();
  });
});

describe('store: выбор ниши (NICHE-2)', () => {
  it('setNiche(fintech) сохраняет нишу и автоподключает пакет; ниша без пакета — только сигнал', async () => {
    const { DEFAULT_RULES } = await import('./lib/guardrails');
    useStore.setState({ rules: DEFAULT_RULES.map((r) => ({ ...r })), niche: '' });
    S().setNiche('fintech');
    expect(S().niche).toBe('fintech');
    expect(S().rules.some((r) => r.pack === 'fintech')).toBe(true);

    S().setNiche('health');
    expect(S().niche).toBe('health');
    // пакет финтеха не отключается сам — правила пользователь снимает явно
    expect(S().rules.some((r) => r.pack === 'fintech')).toBe(true);
    expect(S().auditLog[0].msg).toContain('health');
  });
});

describe('store: нишевый пакет правил (Б3, финтех)', () => {
  it('toggleNichePack подключает и отключает правила пакета; hard-правило реально блокирует', async () => {
    const { validateIdea, hasHardFlag, DEFAULT_RULES } = await import('./lib/guardrails');
    useStore.setState({ rules: DEFAULT_RULES.map((r) => ({ ...r })) });
    const base = S().rules.length;

    S().toggleNichePack('fintech');
    expect(S().rules.length).toBeGreaterThan(base);
    const idea = { title: 'Гарантированный доход 20% в месяц', hook: '' };
    expect(hasHardFlag(validateIdea(idea, S().rules))).toBe(true);

    S().toggleNichePack('fintech');
    expect(S().rules.length).toBe(base);
    expect(hasHardFlag(validateIdea(idea, S().rules))).toBe(false);
  });

  it('все паттерны пакета проходят validatePattern (SEC-2)', async () => {
    const { validatePattern } = await import('./lib/guardrails');
    const { FINTECH_PACK } = await import('./lib/nichePacks');
    for (const r of FINTECH_PACK.rules) expect(validatePattern(r.pattern)).toBeNull();
  });
});

describe('store: бэкап/восстановление (М32)', () => {
  it('roundtrip: export → parse → applyBackup восстанавливает состояние', async () => {
    const { toPersistedSlice } = await import('./store');
    const { exportStateJson, parseBackup } = await import('./lib/backup');
    S().ingestJson(JSON.stringify([{ author: 'Бэкап Автор', text: 'пост для проверки бэкапа и восстановления' }]));
    useStore.setState({ ideas: [seedIdea()], cadenceGoal: 7 });
    const json = exportStateJson(toPersistedSlice(useStore.getState()));

    // «потеряли» всё
    useStore.setState({ posts: [], ideas: [], cadenceGoal: 5 });
    expect(S().posts).toHaveLength(0);

    const backup = parseBackup(json);
    S().applyBackup(backup.state);
    expect(S().posts).toHaveLength(1);
    expect(S().posts[0].author).toBe('Бэкап Автор');
    expect(S().ideas).toHaveLength(1);
    expect(S().cadenceGoal).toBe(7);
  });

  it('parseBackup отклоняет чужой/битый файл с человеческим сообщением', async () => {
    const { parseBackup } = await import('./lib/backup');
    expect(() => parseBackup('не json')).toThrow('JSON');
    expect(() => parseBackup('{"app":"other"}')).toThrow('не бэкап');
    expect(() => parseBackup('{"app":"link-and-up","schema":1}')).toThrow('Версия схемы');
  });
});

describe('store: reset возвращает демо-корпус', () => {
  it('reset наполняет posts и ставит isDemo=true (FE-2: сид грузится динамическим чанком)', async () => {
    useStore.setState({ posts: [], isDemo: false });
    await S().reset();
    expect(S().posts.length).toBe(289);
    expect(S().isDemo).toBe(true);
  });
});
