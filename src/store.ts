import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Idea, Post, Rule } from '@/types';
import { CADENCE_GOAL, FORMULAS, LS_KEY, OWN_AUTHOR, SCHEMA_VERSION } from '@/lib/constants';
import { enrich, enrichAll, tagPost } from '@/lib/enrich';
import { analyzeIngest, mergeIngest, type IngestReport } from '@/lib/dedup';
import { forecast, recalcCalibration } from '@/lib/forecast';
import { DEFAULT_RULES } from '@/lib/guardrails';
import { seedIdeas, seedPosts } from '@/data/seed';
import type { IdeaActual, Tags } from '@/types';

export type TabId = 'overview' | 'analytics' | 'explorer' | 'clusters' | 'ideas' | 'forecast';
export type Theme = 'dark' | 'light';
export type ViewMode = 'cards' | 'table';

export interface Filters {
  cluster: string;
  lang: string;
  metrics: string;
  hook: string;
  structure: string;
  sort: string;
  minC: string;
  maxC: string;
  minER: string;
  dateFrom: string;
  dateTo: string;
}

export const DEFAULT_FILTERS: Filters = {
  cluster: 'all',
  lang: 'all',
  metrics: 'all',
  hook: 'all',
  structure: 'all',
  sort: 'comments',
  minC: '',
  maxC: '',
  minER: '',
  dateFrom: '',
  dateTo: '',
};

interface AuditEntry {
  t: string;
  msg: string;
}

export interface Preset {
  name: string;
  search: string;
  filters: Filters;
}

interface State {
  version: number;
  posts: Post[];
  ideas: Idea[];
  theme: Theme;
  tab: TabId;
  search: string;
  filters: Filters;
  viewMode: ViewMode;
  selectedPostId: string | null;
  calibration: number;
  forecastId: string;
  isDemo: boolean;
  onboarded: boolean;
  readOnly: boolean;
  auditLog: AuditEntry[];
  toast: string;
  importOpen: boolean;
  importPreview: IngestReport | null;
  // настройки продукта
  rules: Rule[];
  ownAuthor: string;
  cadenceGoal: number;
  settingsOpen: boolean;
  presets: Preset[];

  // actions
  setTheme: (t: Theme) => void;
  toggleTheme: () => void;
  setTab: (t: TabId) => void;
  setSearch: (s: string) => void;
  setFilters: (patch: Partial<Filters>) => void;
  resetFilters: () => void;
  setViewMode: (v: ViewMode) => void;
  openPost: (id: string) => void;
  closePost: () => void;
  setForecastId: (id: string) => void;
  setReadOnly: (v: boolean) => void;
  flash: (msg: string) => void;
  ingestJson: (text: string) => IngestReport;
  completeOnboarding: (mode: 'demo' | 'fresh') => void;
  reset: () => void;
  saveIdea: (idea: Idea) => void;
  delIdea: (id: string) => void;
  moveIdeaStatus: (id: string, status: Idea['status']) => void;
  scheduleIdea: (id: string) => void;
  saveReal: (ideaId: string, real: IdeaActual) => void;
  updatePostTag: (id: string, field: keyof Tags, value: string) => void;
  retagPost: (id: string) => void;
  setImportOpen: (v: boolean) => void;
  previewImport: (text: string) => IngestReport;
  commitImport: () => void;
  clearImport: () => void;
  // настройки
  setSettingsOpen: (v: boolean) => void;
  setOwnAuthor: (name: string) => void;
  setCadenceGoal: (n: number) => void;
  addRule: (rule: Rule) => void;
  updateRule: (id: string, patch: Partial<Rule>) => void;
  deleteRule: (id: string) => void;
  resetRules: () => void;
  savePreset: (name: string) => void;
  applyPreset: (name: string) => void;
  deletePreset: (name: string) => void;
}

/** Ближайший вторник(2) или четверг(4). */
function nextPostingDay(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  for (let i = 1; i <= 14; i++) {
    const c = new Date(d);
    c.setDate(c.getDate() + i);
    const w = c.getDay();
    if (w === 2 || w === 4) return c.toISOString().slice(0, 10);
  }
  return d.toISOString().slice(0, 10);
}

function audit(log: AuditEntry[], msg: string): AuditEntry[] {
  return [{ t: new Date().toISOString(), msg }, ...log].slice(0, 100);
}

/** Тема по умолчанию (только для первого запуска — persist перекрывает своим значением). */
function initialTheme(): Theme {
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }
  return 'dark';
}

let toastTimer: ReturnType<typeof setTimeout> | undefined;

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      version: SCHEMA_VERSION,
      posts: enrichAll(seedPosts),
      ideas: seedIdeas(),
      theme: initialTheme(),
      tab: 'overview',
      search: '',
      filters: { ...DEFAULT_FILTERS },
      viewMode: 'cards',
      selectedPostId: null,
      calibration: 1,
      forecastId: '',
      isDemo: true,
      onboarded: false,
      readOnly: false,
      auditLog: [],
      toast: '',
      importOpen: false,
      importPreview: null,
      rules: DEFAULT_RULES.map((r) => ({ ...r })),
      ownAuthor: OWN_AUTHOR,
      cadenceGoal: CADENCE_GOAL,
      settingsOpen: false,
      presets: [],

      setTheme: (theme) => set({ theme }),
      toggleTheme: () => set({ theme: get().theme === 'dark' ? 'light' : 'dark' }),
      setTab: (tab) => set({ tab }),
      setSearch: (search) => set({ search }),
      setFilters: (patch) => set({ filters: { ...get().filters, ...patch } }),
      resetFilters: () => set({ filters: { ...DEFAULT_FILTERS }, search: '' }),
      setViewMode: (viewMode) => set({ viewMode }),
      openPost: (selectedPostId) => set({ selectedPostId }),
      closePost: () => set({ selectedPostId: null }),
      setForecastId: (forecastId) => set({ forecastId }),
      setReadOnly: (readOnly) => set({ readOnly }),

      flash: (toast) => {
        set({ toast });
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => set({ toast: '' }), 2600);
      },

      ingestJson: (text) => {
        const parsed = JSON.parse(text);
        const arr = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.posts) ? parsed.posts : null;
        if (!arr) throw new Error('Ожидался JSON-массив постов (или объект с полем posts)');
        const report = analyzeIngest(get().posts, arr);
        if (report.added > 0) {
          set({
            posts: mergeIngest(get().posts, report.valid),
            isDemo: false,
            auditLog: audit(get().auditLog, 'Импорт: добавлено ' + report.added + ' постов'),
          });
        }
        return report;
      },

      completeOnboarding: (mode) => {
        if (mode === 'fresh') {
          set({
            posts: [],
            ideas: [],
            calibration: 1,
            selectedPostId: null,
            search: '',
            filters: { ...DEFAULT_FILTERS },
            isDemo: false,
            onboarded: true,
            importOpen: true,
            auditLog: audit(get().auditLog, 'Старт с чистого корпуса'),
          });
        } else {
          set({ onboarded: true });
        }
      },

      reset: () =>
        set({
          posts: enrichAll(seedPosts),
          ideas: seedIdeas(),
          calibration: 1,
          selectedPostId: null,
          search: '',
          filters: { ...DEFAULT_FILTERS },
          isDemo: true,
        }),

      saveIdea: (idea) => {
        if (get().readOnly) return;
        const exists = get().ideas.some((x) => x.id === idea.id);
        const ideas = exists ? get().ideas.map((x) => (x.id === idea.id ? idea : x)) : [...get().ideas, idea];
        set({ ideas, auditLog: audit(get().auditLog, (exists ? 'Изменена' : 'Создана') + ' идея «' + idea.title + '»') });
      },
      delIdea: (id) => {
        if (get().readOnly) return;
        const it = get().ideas.find((x) => x.id === id);
        set({ ideas: get().ideas.filter((x) => x.id !== id), auditLog: audit(get().auditLog, 'Удалена идея «' + (it?.title || '?') + '»') });
      },
      moveIdeaStatus: (id, status) => {
        if (get().readOnly) return;
        const idea = get().ideas.find((x) => x.id === id);
        if (!idea || idea.status === status) return;
        const ideas = get().ideas.map((x) => (x.id === id ? { ...x, status } : x));
        set({ ideas });
      },
      scheduleIdea: (id) => {
        if (get().readOnly) return;
        const date = nextPostingDay();
        const ideas = get().ideas.map((x) => (x.id === id ? { ...x, date, status: x.status === 'draft' ? ('inwork' as const) : x.status } : x));
        set({ ideas });
        get().flash('Запланировано на ' + date + ' (следующий вт/чт)');
      },

      saveReal: (ideaId, real) => {
        if (get().readOnly) return;
        const idea = get().ideas.find((i) => i.id === ideaId);
        if (!idea) return;
        const fc = forecast(idea, get().posts, get().calibration);
        const updatedIdea: Idea = {
          ...idea,
          status: 'published',
          predicted: fc ? fc.expected : idea.predicted,
          actual: real,
        };
        const ideas = get().ideas.map((i) => (i.id === ideaId ? updatedIdea : i));
        // добавить как свой пост в датасет для петли обучения
        const formulaTitle = FORMULAS.find((f) => f.id === idea.formula)?.title || idea.formula;
        const ownPost = enrich({
          query: 'own:published',
          author: get().ownAuthor,
          headline: '',
          reactions: real.reactions,
          comments: real.comments,
          reposts: 0,
          text: idea.hook + '\n\nФормат: ' + formulaTitle + '.',
          url: '',
          collected_at: real.date || new Date().toISOString().slice(0, 10),
          is_own: true,
        });
        ownPost.meta_cluster = idea.cluster;
        ownPost.leads = real.leads;
        ownPost.interviews = real.interviews;
        const posts = [...get().posts, ownPost];
        const cal = recalcCalibration(ideas, get().calibration);
        set({
          ideas,
          posts,
          calibration: cal.calibration,
          auditLog: audit(get().auditLog, 'Опубликован пост «' + (idea.title || '?') + '»: ' + real.comments + ' комм., ' + real.reactions + ' реакц.'),
        });
        get().flash('Факт сохранён. Калибровка ×' + cal.calibration.toFixed(2));
      },

      updatePostTag: (id, field, value) => {
        if (get().readOnly) return;
        const posts = get().posts.map((p) => {
          if (p.id !== id) return p;
          const tags = { ...p.tags };
          if (field === 'flags') {
            const set2 = new Set(tags.flags);
            const v = value as Tags['flags'][number];
            set2.has(v) ? set2.delete(v) : set2.add(v);
            tags.flags = [...set2];
          } else {
            (tags as Record<string, unknown>)[field] = value;
          }
          return { ...p, tags, tags_edited: true };
        });
        set({ posts });
      },
      retagPost: (id) => {
        if (get().readOnly) return;
        const posts = get().posts.map((p) => (p.id === id ? { ...p, tags: tagPost(p), tags_edited: false } : p));
        set({ posts });
        get().flash('Теги пересчитаны эвристикой');
      },

      setImportOpen: (importOpen) => set({ importOpen, importPreview: null }),
      previewImport: (text) => {
        const parsed = JSON.parse(text);
        const arr = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.posts) ? parsed.posts : null;
        if (!arr) throw new Error('Ожидался JSON-массив постов (или объект с полем posts)');
        const report = analyzeIngest(get().posts, arr);
        set({ importPreview: report });
        return report;
      },
      commitImport: () => {
        const pv = get().importPreview;
        if (!pv || !pv.valid.length) {
          get().flash('Нет валидных записей для загрузки');
          return;
        }
        set({
          posts: mergeIngest(get().posts, pv.valid),
          importPreview: null,
          importOpen: false,
          isDemo: false,
          auditLog: audit(get().auditLog, 'Импорт: добавлено ' + pv.added + ' постов'),
        });
        get().flash('Добавлено постов: ' + pv.added);
      },
      clearImport: () => set({ importPreview: null }),

      setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
      setOwnAuthor: (ownAuthor) => set({ ownAuthor: ownAuthor.trim() || OWN_AUTHOR }),
      setCadenceGoal: (cadenceGoal) => set({ cadenceGoal: Math.max(1, Math.min(14, Math.round(cadenceGoal) || 1)) }),
      addRule: (rule) => set({ rules: [...get().rules, rule] }),
      updateRule: (id, patch) => set({ rules: get().rules.map((r) => (r.id === id ? { ...r, ...patch } : r)) }),
      deleteRule: (id) => set({ rules: get().rules.filter((r) => r.id !== id) }),
      resetRules: () => set({ rules: DEFAULT_RULES.map((r) => ({ ...r })) }),

      savePreset: (name) => {
        const n = name.trim();
        if (!n) { get().flash('Введите название пресета'); return; }
        const preset: Preset = { name: n, search: get().search, filters: { ...get().filters } };
        set({ presets: [...get().presets.filter((p) => p.name !== n), preset] });
        get().flash('Пресет сохранён: ' + n);
      },
      applyPreset: (name) => {
        const p = get().presets.find((x) => x.name === name);
        if (!p) return;
        set({ search: p.search, filters: { ...p.filters } });
        get().flash('Применён пресет: ' + name);
      },
      deletePreset: (name) => set({ presets: get().presets.filter((p) => p.name !== name) }),
    }),
    {
      name: LS_KEY,
      version: SCHEMA_VERSION,
      partialize: (s) => ({
        version: s.version,
        posts: s.posts,
        ideas: s.ideas,
        theme: s.theme,
        calibration: s.calibration,
        isDemo: s.isDemo,
        onboarded: s.onboarded,
        readOnly: s.readOnly,
        auditLog: s.auditLog,
        rules: s.rules,
        ownAuthor: s.ownAuthor,
        cadenceGoal: s.cadenceGoal,
        presets: s.presets,
      }),
      migrate: (persisted: unknown, fromVersion) => {
        const s = persisted as Partial<State> | undefined;
        if (!s) return s as unknown as State;
        // v1 → v2: гарантировать обогащённые поля на постах
        if (fromVersion < 2 && Array.isArray(s.posts)) {
          s.posts = s.posts.map((p) => enrich(p));
        }
        return s as State;
      },
    },
  ),
);

/** Пересчитать калибровку из текущих идей (вызывать после сохранения фактов). */
export function refreshCalibration() {
  const { ideas, calibration } = useStore.getState();
  const c = recalcCalibration(ideas, calibration);
  useStore.setState({ calibration: c.calibration });
  return c;
}
