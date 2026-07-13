import type { StateCreator } from 'zustand';
import type { ClusterDef, Rule } from '@/types';
import { CADENCE_GOAL, DEFAULT_CLUSTER_DEFS, OWN_AUTHOR } from '@/lib/constants';
import { DEFAULT_RULES } from '@/lib/guardrails';
import { NICHE_PACKS, NICHES } from '@/lib/nichePacks';
import { assignCluster, buildClusters } from '@/lib/autoCluster';
import { clusterOf } from '@/lib/enrich';
import { ensureLocale, tr } from '@/i18n';
import type { AuditEntry, PersistedSlice, State } from './types';
import { audit } from './utils';

/** Слайс настроек: гардрейлы/пакеты, автор, каденс, кластеры тем, журнал, бэкап. */
export interface SettingsSlice {
  readOnly: boolean;
  auditLog: AuditEntry[];
  rules: Rule[];
  ownAuthor: string;
  cadenceGoal: number;
  /** NICHE-2: выбранная ниша ('' = не выбрана); локальный сигнал спроса на пакеты. */
  niche: string;
  /** NICHE-1: реестр кластеров тем (builtin AI-ниша по умолчанию). */
  clusters: ClusterDef[];

  setReadOnly: (v: boolean) => void;
  setNiche: (id: string) => void;
  setOwnAuthor: (name: string) => void;
  setCadenceGoal: (n: number) => void;
  addRule: (rule: Rule) => void;
  updateRule: (id: string, patch: Partial<Rule>) => void;
  deleteRule: (id: string) => void;
  resetRules: () => void;
  /** Б3: подключить/отключить нишевый пакет правил (по полю pack). */
  toggleNichePack: (packId: string) => void;
  /** NICHE-1: пересобрать кластеры из корпуса (TF-IDF) и переназначить посты. */
  rebuildClusters: () => void;
  /** NICHE-1: вернуть встроенные кластеры AI-ниши и переразметить посты эвристикой. */
  resetClusters: () => void;
  updateCluster: (id: string, patch: Partial<ClusterDef>) => void;
  addCluster: (def: ClusterDef) => void;
  /** Удалить кластер; его посты уходят в 'other'. */
  deleteCluster: (id: string) => void;
  /** М32: восстановление из файла-бэкапа — полная замена persisted-среза. */
  applyBackup: (slice: PersistedSlice) => void;
}

export const createSettingsSlice: StateCreator<State, [], [], SettingsSlice> = (set, get) => ({
  readOnly: false,
  auditLog: [],
  rules: DEFAULT_RULES.map((r) => ({ ...r })),
  ownAuthor: OWN_AUTHOR,
  cadenceGoal: CADENCE_GOAL,
  niche: '',
  clusters: DEFAULT_CLUSTER_DEFS.map((c) => ({ ...c })),

  setReadOnly: (readOnly) => set({ readOnly }),
  setNiche: (id) => {
    const opt = NICHES.find((n) => n.id === id);
    set({ niche: id, auditLog: audit(get().auditLog, 'Выбрана ниша: ' + (id || '—')) });
    // если для ниши есть пакет правил и он ещё не подключён — подключаем
    if (opt?.packId && !get().rules.some((r) => r.pack === opt.packId)) {
      get().toggleNichePack(opt.packId);
    }
  },
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

  rebuildClusters: () => {
    const posts = get().posts;
    const { defs, assignments } = buildClusters(posts);
    const other: ClusterDef = { id: 'other', label: 'Другое', keywords: [], builtin: true };
    set({
      clusters: [...defs, other],
      posts: posts.map((p) => ({ ...p, meta_cluster: assignments.get(p.id) || 'other' })),
      auditLog: audit(get().auditLog, 'Кластеры пересобраны из корпуса: ' + defs.length + ' тем'),
    });
    get().flash(tr(get().locale, 'st.clustersRebuilt') + defs.length);
  },
  resetClusters: () => {
    set({
      clusters: DEFAULT_CLUSTER_DEFS.map((c) => ({ ...c })),
      posts: get().posts.map((p) => ({ ...p, meta_cluster: clusterOf((p.query || '') + ' ' + (p.text || '')) })),
      auditLog: audit(get().auditLog, 'Кластеры сброшены к встроенным'),
    });
  },
  updateCluster: (id, patch) => {
    const clusters = get().clusters.map((c) => (c.id === id ? { ...c, ...patch, id: c.id } : c));
    // правка keywords переназначает посты небилтин-кластеров
    const changed = get().clusters.find((c) => c.id === id);
    const keywordsChanged = patch.keywords && changed && !changed.builtin;
    set({
      clusters,
      posts: keywordsChanged
        ? get().posts.map((p) => {
            const cur = clusters.find((c) => c.id === p.meta_cluster);
            if (cur?.builtin) return p; // встроенные назначения не трогаем
            return {
              ...p,
              meta_cluster: assignCluster(
                p.text,
                clusters.filter((c) => !c.builtin),
              ),
            };
          })
        : get().posts,
    });
  },
  addCluster: (def) => {
    if (get().clusters.some((c) => c.id === def.id)) return;
    set({
      clusters: [...get().clusters, def],
      auditLog: audit(get().auditLog, 'Добавлен кластер «' + def.label + '»'),
    });
  },
  deleteCluster: (id) => {
    const def = get().clusters.find((c) => c.id === id);
    if (!def || def.builtin) return; // встроенные не удаляем — у 'other' роль фолбэка
    set({
      clusters: get().clusters.filter((c) => c.id !== id),
      posts: get().posts.map((p) => (p.meta_cluster === id ? { ...p, meta_cluster: 'other' } : p)),
      auditLog: audit(get().auditLog, 'Удалён кластер «' + def.label + '»'),
    });
  },

  applyBackup: (slice) => {
    set({
      ...slice,
      clusters: slice.clusters ?? DEFAULT_CLUSTER_DEFS.map((c) => ({ ...c })),
      selectedPostId: null,
      importPreview: null,
      lastDeletedIdea: null,
    });
    void ensureLocale(slice.locale);
    get().flash(
      tr(get().locale, 'st.backupRestored.a') +
        slice.posts.length +
        tr(get().locale, 'st.backupRestored.b') +
        slice.ideas.length,
    );
  },
});
