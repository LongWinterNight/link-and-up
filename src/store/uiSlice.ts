import type { StateCreator } from 'zustand';
import { ensureLocale, detectLocale, type Locale } from '@/i18n';
import { DEFAULT_FILTERS, type Filters, type Preset, type State, type TabId, type Theme, type ViewMode } from './types';

/** UI-слайс: навигация, тема/локаль, фильтры/пресеты, тосты, модалки настроек. */
export interface UiSlice {
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
  forecastId: string;
  toast: string;
  settingsOpen: boolean;
  presets: Preset[];

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
  flash: (msg: string) => void;
  setSettingsOpen: (v: boolean) => void;
  savePreset: (name: string) => void;
  applyPreset: (name: string) => void;
  deletePreset: (name: string) => void;
}

/** Тема по умолчанию (только для первого запуска — persist перекрывает своим значением). */
function initialTheme(): Theme {
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }
  return 'dark';
}

let toastTimer: ReturnType<typeof setTimeout> | undefined;

export const createUiSlice: StateCreator<State, [], [], UiSlice> = (set, get) => ({
  theme: initialTheme(),
  locale: detectLocale(),
  i18nVersion: 0,
  tab: 'today', // P-1: дефолт — «что публикуем сегодня», не ретро-аналитика
  search: '',
  filters: { ...DEFAULT_FILTERS },
  viewMode: 'cards',
  selectedPostId: null,
  forecastId: '',
  toast: '',
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

  flash: (toast) => {
    set({ toast });
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => set({ toast: '' }), 2600);
  },

  setSettingsOpen: (settingsOpen) => set({ settingsOpen }),

  savePreset: (name) => {
    const n = name.trim();
    if (!n) {
      get().flash('Введите название пресета');
      return;
    }
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
});
