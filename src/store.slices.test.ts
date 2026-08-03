import { describe, expect, it, beforeEach, vi } from 'vitest';
import { useStore, DEFAULT_FILTERS } from './store';
import { DEFAULT_RULES } from './lib/guardrails';
import type { ClusterDef, Rule } from './types';

const S = () => useStore.getState();

beforeEach(() => {
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
    rules: DEFAULT_RULES.map((r) => ({ ...r })),
    auditLog: [],
    ownAuthor: '',
    cadenceGoal: 2,
    niche: '',
    settingsOpen: false,
    tab: 'today',
    theme: 'dark',
    viewMode: 'cards',
    selectedPostId: null,
    forecastId: '',
    toast: '',
    confirmMsg: null,
  });
});

// --- settingsSlice ---

describe('settingsSlice: addRule / updateRule / deleteRule / resetRules', () => {
  it('addRule добавляет правило', () => {
    const rule: Rule = {
      id: 'custom-1',
      label: 'Test',
      pattern: 'тест',
      severity: 'soft',
      message: 'm',
      enabled: true,
    };
    const before = S().rules.length;
    S().addRule(rule);
    expect(S().rules).toHaveLength(before + 1);
    expect(S().rules.find((r) => r.id === 'custom-1')).toBeDefined();
  });

  it('updateRule патчит правило', () => {
    S().addRule({ id: 'u1', label: 'L', pattern: 'x', severity: 'soft', message: 'm', enabled: true });
    S().updateRule('u1', { enabled: false, message: 'updated' });
    const r = S().rules.find((r) => r.id === 'u1')!;
    expect(r.enabled).toBe(false);
    expect(r.message).toBe('updated');
  });

  it('deleteRule удаляет правило', () => {
    S().addRule({ id: 'd1', label: 'L', pattern: 'x', severity: 'soft', message: 'm', enabled: true });
    expect(S().rules.some((r) => r.id === 'd1')).toBe(true);
    S().deleteRule('d1');
    expect(S().rules.some((r) => r.id === 'd1')).toBe(false);
  });

  it('resetRules возвращает встроенные', () => {
    S().addRule({ id: 'extra', label: 'L', pattern: 'x', severity: 'soft', message: 'm', enabled: true });
    S().resetRules();
    expect(S().rules).toHaveLength(DEFAULT_RULES.length);
  });
});

describe('settingsSlice: setOwnAuthor / setCadenceGoal', () => {
  it('setOwnAuthor обрезает пробелы, пустое → дефолт', () => {
    S().setOwnAuthor('  Алексей  ');
    expect(S().ownAuthor).toBe('Алексей');
    S().setOwnAuthor('   ');
    expect(S().ownAuthor).toBeTruthy(); // fallback to OWN_AUTHOR
  });

  it('setCadenceGoal клипает 1–14', () => {
    S().setCadenceGoal(7);
    expect(S().cadenceGoal).toBe(7);
    S().setCadenceGoal(0);
    expect(S().cadenceGoal).toBe(1);
    S().setCadenceGoal(20);
    expect(S().cadenceGoal).toBe(14);
    S().setCadenceGoal(3.7);
    expect(S().cadenceGoal).toBe(4);
  });
});

describe('settingsSlice: addCluster / updateCluster / deleteCluster', () => {
  it('addCluster добавляет, дубликат игнорируется', () => {
    const def: ClusterDef = { id: 'custom-cl', label: 'Кастом', keywords: ['кастом'] };
    const before = S().clusters.length;
    S().addCluster(def);
    expect(S().clusters).toHaveLength(before + 1);
    // дубликат
    S().addCluster({ ...def });
    expect(S().clusters).toHaveLength(before + 1);
  });

  it('deleteCluster удаляет пользовательский кластер; builtin не удаляется', () => {
    const def: ClusterDef = { id: 'del-me', label: 'Удали', keywords: ['удали'] };
    S().addCluster(def);
    const withCustom = S().clusters.length;
    S().deleteCluster('del-me');
    expect(S().clusters).toHaveLength(withCustom - 1);
    // builtin не удаляется
    const builtin = S().clusters.find((c) => c.builtin);
    if (builtin) {
      S().deleteCluster(builtin.id);
      expect(S().clusters.some((c) => c.id === builtin.id)).toBe(true);
    }
  });

  it('updateCluster патчит кластер', () => {
    const def: ClusterDef = { id: 'upd-me', label: 'Старый', keywords: ['старый'] };
    S().addCluster(def);
    S().updateCluster('upd-me', { label: 'Новый', keywords: ['новый'] });
    const c = S().clusters.find((c) => c.id === 'upd-me')!;
    expect(c.label).toBe('Новый');
    expect(c.id).toBe('upd-me'); // id не меняется
  });
});

describe('settingsSlice: logTeamSignal', () => {
  it('добавляет audit-запись про Team-спрос', () => {
    S().logTeamSignal();
    expect(S().auditLog.some((e) => e.msg.includes('Team'))).toBe(true);
  });
});

describe('settingsSlice: setReadOnly', () => {
  it('переключает режим только чтение', () => {
    expect(S().readOnly).toBe(false);
    S().setReadOnly(true);
    expect(S().readOnly).toBe(true);
    S().setReadOnly(false);
    expect(S().readOnly).toBe(false);
  });
});

// --- uiSlice ---

describe('uiSlice: setTheme / toggleTheme', () => {
  it('setTheme устанавливает тему', () => {
    S().setTheme('light');
    expect(S().theme).toBe('light');
    S().setTheme('dark');
    expect(S().theme).toBe('dark');
  });

  it('toggleTheme переключает', () => {
    S().setTheme('dark');
    S().toggleTheme();
    expect(S().theme).toBe('light');
    S().toggleTheme();
    expect(S().theme).toBe('dark');
  });
});

describe('uiSlice: setTab / setSearch / setFilters / resetFilters / setViewMode', () => {
  it('setTab переключает вкладку', () => {
    S().setTab('analytics');
    expect(S().tab).toBe('analytics');
  });

  it('setSearch обновляет поиск', () => {
    S().setSearch('RAG');
    expect(S().search).toBe('RAG');
  });

  it('setFilters мержит фильтры', () => {
    S().setFilters({ lang: 'EN', hook: 'вопрос' });
    expect(S().filters.lang).toBe('EN');
    expect(S().filters.hook).toBe('вопрос');
    expect(S().filters.cluster).toBe('all'); // не затронут
  });

  it('resetFilters сбрасывает фильтры и поиск', () => {
    S().setSearch('test');
    S().setFilters({ lang: 'EN' });
    S().resetFilters();
    expect(S().search).toBe('');
    expect(S().filters.lang).toBe('all');
  });

  it('setViewMode переключает вид', () => {
    S().setViewMode('table');
    expect(S().viewMode).toBe('table');
  });
});

describe('uiSlice: openPost / closePost / setForecastId', () => {
  it('openPost/closePost управляют selectedPostId', () => {
    S().openPost('p1');
    expect(S().selectedPostId).toBe('p1');
    S().closePost();
    expect(S().selectedPostId).toBeNull();
  });

  it('setForecastId устанавливает forecastId', () => {
    S().setForecastId('f1');
    expect(S().forecastId).toBe('f1');
  });
});

describe('uiSlice: flash / setSettingsOpen', () => {
  it('flash показывает toast и убирает через таймаут', () => {
    vi.useFakeTimers();
    S().flash('Привет!');
    expect(S().toast).toBe('Привет!');
    vi.advanceTimersByTime(3000);
    expect(S().toast).toBe('');
    vi.useRealTimers();
  });

  it('setSettingsOpen', () => {
    S().setSettingsOpen(true);
    expect(S().settingsOpen).toBe(true);
    S().setSettingsOpen(false);
    expect(S().settingsOpen).toBe(false);
  });
});

describe('uiSlice: askConfirm / resolveConfirm', () => {
  it('askConfirm показывает сообщение, resolveConfirm подтверждает', async () => {
    const p = S().askConfirm('Удалить?');
    expect(S().confirmMsg).toBe('Удалить?');
    S().resolveConfirm(true);
    expect(await p).toBe(true);
    expect(S().confirmMsg).toBeNull();
  });

  it('askConfirm → resolveConfirm(false) отклоняет', async () => {
    const p = S().askConfirm('Удалить?');
    S().resolveConfirm(false);
    expect(await p).toBe(false);
  });

  it('новый askConfirm отклоняет предыдущий', async () => {
    const p1 = S().askConfirm('Первый?');
    const p2 = S().askConfirm('Второй?');
    expect(await p1).toBe(false);
    S().resolveConfirm(true);
    expect(await p2).toBe(true);
  });
});
