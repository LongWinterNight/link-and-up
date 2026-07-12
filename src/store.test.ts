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
    const json = JSON.stringify([{ author: 'Игорь Ветров', text: 'Спека до кода экономит часы отладки', reactions: 10, comments: 5 }]);
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
  });

  it('saveReal не падает на пустом корпусе (forecast=null)', () => {
    useStore.setState({ ideas: [seedIdea()], posts: [] });
    expect(() => S().saveReal('idea-test', { reactions: 5, comments: 3, leads: 0, interviews: 0, date: '' })).not.toThrow();
    expect(S().ideas[0].status).toBe('published');
  });
});

describe('store: reset возвращает демо-корпус', () => {
  it('reset наполняет posts и ставит isDemo=true', () => {
    useStore.setState({ posts: [], isDemo: false });
    S().reset();
    expect(S().posts.length).toBeGreaterThan(0);
    expect(S().isDemo).toBe(true);
  });
});
