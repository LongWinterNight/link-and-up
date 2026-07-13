import type { StateCreator } from 'zustand';
import type { Rule } from '@/types';
import { CADENCE_GOAL, OWN_AUTHOR } from '@/lib/constants';
import { DEFAULT_RULES } from '@/lib/guardrails';
import { NICHE_PACKS } from '@/lib/nichePacks';
import { ensureLocale } from '@/i18n';
import type { AuditEntry, PersistedSlice, State } from './types';
import { audit } from './utils';

/** Слайс настроек: гардрейлы/пакеты, автор, каденс, режим просмотра, журнал, бэкап. */
export interface SettingsSlice {
  readOnly: boolean;
  auditLog: AuditEntry[];
  rules: Rule[];
  ownAuthor: string;
  cadenceGoal: number;

  setReadOnly: (v: boolean) => void;
  setOwnAuthor: (name: string) => void;
  setCadenceGoal: (n: number) => void;
  addRule: (rule: Rule) => void;
  updateRule: (id: string, patch: Partial<Rule>) => void;
  deleteRule: (id: string) => void;
  resetRules: () => void;
  /** Б3: подключить/отключить нишевый пакет правил (по полю pack). */
  toggleNichePack: (packId: string) => void;
  /** М32: восстановление из файла-бэкапа — полная замена persisted-среза. */
  applyBackup: (slice: PersistedSlice) => void;
}

export const createSettingsSlice: StateCreator<State, [], [], SettingsSlice> = (set, get) => ({
  readOnly: false,
  auditLog: [],
  rules: DEFAULT_RULES.map((r) => ({ ...r })),
  ownAuthor: OWN_AUTHOR,
  cadenceGoal: CADENCE_GOAL,

  setReadOnly: (readOnly) => set({ readOnly }),
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

  applyBackup: (slice) => {
    set({ ...slice, selectedPostId: null, importPreview: null, lastDeletedIdea: null });
    void ensureLocale(slice.locale);
    get().flash('Бэкап восстановлен: постов ' + slice.posts.length + ', идей ' + slice.ideas.length);
  },
});
