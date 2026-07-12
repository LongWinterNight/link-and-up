import { create } from 'zustand';
import { persist, type PersistStorage, type StorageValue } from 'zustand/middleware';
import type { Idea, Post, Rule } from '@/types';
import { CADENCE_GOAL, FORMULAS, LS_KEY, OWN_AUTHOR, SCHEMA_VERSION } from '@/lib/constants';
import { enrich, enrichAll, tagPost } from '@/lib/enrich';
import { analyzeIngest, mergeIngest, type IngestReport } from '@/lib/dedup';
import { effectiveCalibration, forecast, recalcCalibration } from '@/lib/forecast';
import { DEFAULT_RULES } from '@/lib/guardrails';
import { NICHE_PACKS } from '@/lib/nichePacks';
import { detectLocale, ensureLocale, tr, type Locale } from '@/i18n';
import type { IdeaActual, Tags } from '@/types';

export type TabId = 'today' | 'overview' | 'analytics' | 'explorer' | 'clusters' | 'ideas' | 'forecast';
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
  /** FE-3: язык интерфейса; словарь en грузится ленивым чанком. */
  locale: Locale;
  /** Бамп после догрузки словаря (не персистится) — форсит ре-рендер useT-подписчиков. */
  i18nVersion: number;
  tab: TabId;
  search: string;
  filters: Filters;
  viewMode: ViewMode;
  selectedPostId: string | null;
  calibration: number;
  /** Сколько опубликованных фактов легло в калибровку (COR-8: множитель активен от 3). */
  calibrationCount: number;
  forecastId: string;
  isDemo: boolean;
  onboarded: boolean;
  readOnly: boolean;
  auditLog: AuditEntry[];
  toast: string;
  importOpen: boolean;
  importPreview: IngestReport | null;
  /** М12: снапшот последней удалённой идеи для undo (не персистится). */
  lastDeletedIdea: Idea | null;
  // настройки продукта
  rules: Rule[];
  ownAuthor: string;
  cadenceGoal: number;
  settingsOpen: boolean;
  presets: Preset[];

  // actions
  setTheme: (t: Theme) => void;
  toggleTheme: () => void;
  setLocale: (l: Locale) => Promise<void>;
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
  /** FE-2: демо-корпус (337 КБ JSON) грузится отдельным чанком по требованию, не в initial-бандле. */
  loadDemo: () => Promise<void>;
  reset: () => Promise<void>;
  saveIdea: (idea: Idea) => void;
  delIdea: (id: string) => void;
  restoreLastIdea: () => void;
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
  /** Б3: подключить/отключить нишевый пакет правил (по полю pack). */
  toggleNichePack: (packId: string) => void;
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

/**
 * SCALE-8: отложенная запись persist. Zustand сериализует ВСЁ состояние на каждое действие —
 * на 20K постов это ~111мс фриза на клик. Здесь JSON.stringify выполняется только на flush:
 * раз в 300мс после последнего изменения и принудительно при уходе со страницы.
 */
/** Точный тип persisted-среза (partialize ниже обязан ему соответствовать). */
interface PersistedSlice {
  version: number;
  posts: Post[];
  ideas: Idea[];
  theme: Theme;
  locale: Locale;
  calibration: number;
  calibrationCount: number;
  isDemo: boolean;
  onboarded: boolean;
  readOnly: boolean;
  auditLog: AuditEntry[];
  rules: Rule[];
  ownAuthor: string;
  cadenceGoal: number;
  presets: Preset[];
}

const rawLS = typeof window !== 'undefined' ? window.localStorage : null;
let pendingWrite: { name: string; value: StorageValue<PersistedSlice> } | null = null;
let writeTimer: ReturnType<typeof setTimeout> | undefined;
const flushPersist = () => {
  if (rawLS && pendingWrite) {
    try {
      rawLS.setItem(pendingWrite.name, JSON.stringify(pendingWrite.value));
    } catch {
      // квота localStorage переполнена (SCALE-1: миграция на IndexedDB в Б10)
      useStore.getState().flash('Хранилище браузера переполнено — данные не сохраняются. Экспортируйте корпус.');
    }
  }
  pendingWrite = null;
};
const debouncedStorage: PersistStorage<PersistedSlice> = {
  getItem: (name) => {
    const s = rawLS?.getItem(name);
    return s ? JSON.parse(s) : null;
  },
  setItem: (name, value) => {
    pendingWrite = { name, value };
    clearTimeout(writeTimer);
    writeTimer = setTimeout(flushPersist, 300);
  },
  removeItem: (name) => {
    clearTimeout(writeTimer);
    pendingWrite = null;
    rawLS?.removeItem(name);
  },
};
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', flushPersist);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushPersist();
  });
}

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      version: SCHEMA_VERSION,
      posts: [],
      ideas: [],
      theme: initialTheme(),
      locale: detectLocale(),
      i18nVersion: 0,
      tab: 'today', // P-1: дефолт — «что публикуем сегодня», не ретро-аналитика
      search: '',
      filters: { ...DEFAULT_FILTERS },
      viewMode: 'cards',
      selectedPostId: null,
      calibration: 1,
      calibrationCount: 0,
      forecastId: '',
      isDemo: true,
      onboarded: false,
      readOnly: false,
      auditLog: [],
      toast: '',
      importOpen: false,
      importPreview: null,
      lastDeletedIdea: null,
      rules: DEFAULT_RULES.map((r) => ({ ...r })),
      ownAuthor: OWN_AUTHOR,
      cadenceGoal: CADENCE_GOAL,
      settingsOpen: false,
      presets: [],

      setTheme: (theme) => set({ theme }),
      toggleTheme: () => set({ theme: get().theme === 'dark' ? 'light' : 'dark' }),
      setLocale: async (locale) => {
        await ensureLocale(locale); // словарь до переключения — без мигания ключей
        set({ locale, i18nVersion: get().i18nVersion + 1 });
      },
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
            calibrationCount: 0,
            selectedPostId: null,
            search: '',
            filters: { ...DEFAULT_FILTERS },
            isDemo: false,
            onboarded: true,
            importOpen: true,
            auditLog: audit(get().auditLog, 'Старт с чистого корпуса'),
          });
        } else {
          if (get().posts.length === 0) void get().loadDemo();
          set({ onboarded: true });
        }
      },

      loadDemo: async () => {
        const { seedPosts, seedIdeas } = await import('@/data/seed');
        set({
          posts: enrichAll(seedPosts),
          ideas: seedIdeas(),
          calibration: 1,
          calibrationCount: 0,
          selectedPostId: null,
          search: '',
          filters: { ...DEFAULT_FILTERS },
          isDemo: true,
        });
      },

      reset: () => get().loadDemo(),

      saveIdea: (idea) => {
        if (get().readOnly) return;
        const exists = get().ideas.some((x) => x.id === idea.id);
        const ideas = exists ? get().ideas.map((x) => (x.id === idea.id ? idea : x)) : [...get().ideas, idea];
        set({ ideas, auditLog: audit(get().auditLog, (exists ? 'Изменена' : 'Создана') + ' идея «' + idea.title + '»') });
      },
      delIdea: (id) => {
        if (get().readOnly) return;
        const it = get().ideas.find((x) => x.id === id);
        set({
          ideas: get().ideas.filter((x) => x.id !== id),
          lastDeletedIdea: it || null, // М12: undo доступен, пока виден тост
          auditLog: audit(get().auditLog, 'Удалена идея «' + (it?.title || '?') + '»'),
        });
        get().flash(tr(get().locale, 'toast.idea.deleted'));
      },
      restoreLastIdea: () => {
        const it = get().lastDeletedIdea;
        if (!it) return;
        set({ ideas: [...get().ideas, it], lastDeletedIdea: null });
        get().flash(tr(get().locale, 'toast.idea.restored'));
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
        const fc = forecast(idea, get().posts, effectiveCalibration(get().calibration, get().calibrationCount));
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
          calibrationCount: cal.count,
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
            if (set2.has(v)) set2.delete(v);
            else set2.add(v);
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
      toggleNichePack: (packId) => {
        const pack = NICHE_PACKS.find((p) => p.id === packId);
        if (!pack) return;
        const active = get().rules.some((r) => r.pack === packId);
        const rest = get().rules.filter((r) => r.pack !== packId);
        set({
          rules: active ? rest : [...rest, ...pack.rules.map((r) => ({ ...r }))],
          auditLog: audit(get().auditLog, (active ? 'Отключён' : 'Подключён') + ' пакет правил «' + pack.label + '»'),
        });
      },

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
      storage: debouncedStorage,
      partialize: (s) => ({
        version: s.version,
        posts: s.posts,
        ideas: s.ideas,
        theme: s.theme,
        locale: s.locale,
        calibration: s.calibration,
        calibrationCount: s.calibrationCount,
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
