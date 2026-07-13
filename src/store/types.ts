import type { Post, Idea, Rule } from '@/types';
import type { Locale } from '@/i18n';
import type { UiSlice } from './uiSlice';
import type { PostsSlice } from './postsSlice';
import type { IdeasSlice } from './ideasSlice';
import type { SettingsSlice } from './settingsSlice';

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

export interface AuditEntry {
  t: string;
  msg: string;
}

export interface Preset {
  name: string;
  search: string;
  filters: Filters;
}

/** Точный тип persisted-среза (partialize в persistCore обязан ему соответствовать). */
export interface PersistedSlice {
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
  /** NICHE-2 (опционально для обратной совместимости бэкапов). */
  niche?: string;
}

/** Полное состояние = композиция слайсов (Б10: расслоение под воркспейсы Б5 и синк G-1). */
export interface State extends UiSlice, PostsSlice, IdeasSlice, SettingsSlice {
  version: number;
}
