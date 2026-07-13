import type { StateCreator } from 'zustand';
import type { Post, Tags } from '@/types';
import { enrichAll, tagPost } from '@/lib/enrich';
import { analyzeIngest, analyzeIngestChunked, mergeIngest, type IngestProgress, type IngestReport } from '@/lib/dedup';
import { DEFAULT_FILTERS, type State } from './types';
import { audit } from './utils';

/** Слайс корпуса постов: демо/импорт/теги. */
export interface PostsSlice {
  posts: Post[];
  isDemo: boolean;
  onboarded: boolean;
  importOpen: boolean;
  importPreview: IngestReport | null;

  ingestJson: (text: string) => IngestReport;
  completeOnboarding: (mode: 'demo' | 'fresh') => void;
  /** FE-2: демо-корпус (337 КБ JSON) грузится отдельным чанком по требованию, не в initial-бандле. */
  loadDemo: () => Promise<void>;
  reset: () => Promise<void>;
  updatePostTag: (id: string, field: keyof Tags, value: string) => void;
  retagPost: (id: string) => void;
  setImportOpen: (v: boolean) => void;
  previewImport: (text: string) => IngestReport;
  /** SCALE-9: чанкованный предпросмотр — не фризит вкладку на больших файлах; отмена через signal. */
  previewImportChunked: (
    text: string,
    onProgress: (p: IngestProgress) => void,
    signal: { cancelled: boolean },
  ) => Promise<IngestReport | null>;
  /** Б4/Б4b: превью уже разобранных записей (LinkedIn CSV, клип-форма) — тот же пайплайн дедупа. */
  previewImportRaws: (
    raws: unknown[],
    onProgress: (p: IngestProgress) => void,
    signal: { cancelled: boolean },
  ) => Promise<IngestReport | null>;
  commitImport: () => void;
  clearImport: () => void;
}

function parsePostsJson(text: string): unknown[] {
  const parsed = JSON.parse(text);
  const arr = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.posts) ? parsed.posts : null;
  if (!arr) throw new Error('Ожидался JSON-массив постов (или объект с полем posts)');
  return arr;
}

export const createPostsSlice: StateCreator<State, [], [], PostsSlice> = (set, get) => ({
  posts: [],
  isDemo: true,
  onboarded: false,
  importOpen: false,
  importPreview: null,

  ingestJson: (text) => {
    const arr = parsePostsJson(text);
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
  previewImportChunked: async (text, onProgress, signal) => {
    return get().previewImportRaws(parsePostsJson(text), onProgress, signal);
  },
  previewImportRaws: async (raws, onProgress, signal) => {
    const report = await analyzeIngestChunked(get().posts, raws, { onProgress, signal });
    if (signal.cancelled) return null;
    set({ importPreview: report });
    return report;
  },
  previewImport: (text) => {
    const arr = parsePostsJson(text);
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
});
