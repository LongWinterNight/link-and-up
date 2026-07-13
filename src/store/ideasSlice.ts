import type { StateCreator } from 'zustand';
import type { Idea, IdeaActual } from '@/types';
import { FORMULAS } from '@/lib/constants';
import { enrich } from '@/lib/enrich';
import { effectiveCalibration, forecast, recalcCalibration } from '@/lib/forecast';
import { tr } from '@/i18n';
import type { State } from './types';
import { audit } from './utils';

/** Слайс идей и петли обучения (факты → калибровка). */
export interface IdeasSlice {
  ideas: Idea[];
  /** М12: снапшот последней удалённой идеи для undo (не персистится). */
  lastDeletedIdea: Idea | null;
  calibration: number;
  /** Сколько опубликованных фактов легло в калибровку (COR-8: множитель активен от 3). */
  calibrationCount: number;

  saveIdea: (idea: Idea) => void;
  delIdea: (id: string) => void;
  restoreLastIdea: () => void;
  moveIdeaStatus: (id: string, status: Idea['status']) => void;
  scheduleIdea: (id: string) => void;
  saveReal: (ideaId: string, real: IdeaActual) => void;
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

export const createIdeasSlice: StateCreator<State, [], [], IdeasSlice> = (set, get) => ({
  ideas: [],
  lastDeletedIdea: null,
  calibration: 1,
  calibrationCount: 0,

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
    const ideas = get().ideas.map((x) =>
      x.id === id ? { ...x, date, status: x.status === 'draft' ? ('inwork' as const) : x.status } : x,
    );
    set({ ideas });
    get().flash(tr(get().locale, 'st.scheduled.a') + date + tr(get().locale, 'st.scheduled.b'));
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
      auditLog: audit(
        get().auditLog,
        'Опубликован пост «' + (idea.title || '?') + '»: ' + real.comments + ' комм., ' + real.reactions + ' реакц.',
      ),
    });
    get().flash(tr(get().locale, 'st.factSaved') + cal.calibration.toFixed(2));
  },
});
