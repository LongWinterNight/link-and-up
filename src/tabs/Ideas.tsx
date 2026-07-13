import { useMemo, useState } from 'react';
import { useStore } from '@/store';
import { CHANNELS, CLUSTERS, FORMULAS, STATUS } from '@/lib/constants';
import { validateIdea, hasHardFlag } from '@/lib/guardrails';
import { generateDraft } from '@/lib/draft';
import { download } from '@/lib/download';
import type { ClusterId, Idea, IdeaStatus } from '@/types';
import { Btn, EmptyState, Panel, Pill } from '@/components/ui';
import { Modal } from '@/components/Modal';
import { useClusterLabel, useLbl, useT } from '@/i18n/useT';
import { intlLocale, type DictKey } from '@/i18n';

const inp: React.CSSProperties = {
  background: 'var(--surface-2)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-ctl)',
  padding: '8px 10px',
  color: 'var(--text-1)',
  fontSize: 13,
  width: '100%',
};

const emptyIdea = (): Idea => ({
  id: 'i' + Date.now(),
  title: '',
  hook: '',
  cluster: 'spec',
  formula: 'arch',
  source: '',
  channel: 'LinkedIn',
  status: 'draft',
  date: '',
  refPostId: '',
  predicted: 0,
  actual: null,
});

/** Локализованный заголовок формулы по id (fallback — RU-title из констант). */
function useFormulaTitle(): (id: string) => string {
  const t = useT();
  return (id) => {
    const key = ('lbl.formula.' + id) as DictKey;
    const out = t(key);
    return out === key ? FORMULAS.find((f) => f.id === id)?.title || id : out;
  };
}

function GuardrailBox({ idea }: { idea: Idea }) {
  const t = useT();
  const rules = useStore((s) => s.rules);
  // FE-7: regex-прогон всех правил мемоизирован — не считаем на каждый ре-рендер
  const flags = useMemo(() => validateIdea(idea, rules), [idea, rules]);
  if (!flags.length) return null;
  const hard = hasHardFlag(flags);
  return (
    <div
      style={{
        background: hard ? 'var(--critical-soft)' : 'var(--warning-soft)',
        border: `1px solid ${hard ? 'var(--critical)' : 'var(--border-warning)'}`,
        borderRadius: 8,
        padding: '8px 10px',
        fontSize: 12,
      }}
    >
      <div style={{ fontWeight: 700, color: hard ? 'var(--critical)' : 'var(--warning)', marginBottom: 4 }}>
        {hard ? t('id.guard.block') : t('id.guard.warn')}
      </div>
      <ul style={{ margin: 0, paddingLeft: 16, color: 'var(--text-2)' }}>
        {flags.map((f, i) => (
          <li key={i}>
            {f.severity === 'hard' ? '[HARD] ' : ''}
            {f.message}
          </li>
        ))}
      </ul>
    </div>
  );
}

function IdeaCard({ idea, onEdit, onDraft }: { idea: Idea; onEdit: () => void; onDraft: () => void }) {
  const t = useT();
  const lbl = useLbl();
  const cl = useClusterLabel();
  const ft = useFormulaTitle();
  const del = useStore((s) => s.delIdea);
  const setForecastId = useStore((s) => s.setForecastId);
  const setTab = useStore((s) => s.setTab);
  const readOnly = useStore((s) => s.readOnly);
  return (
    <div
      style={{
        background: 'var(--surface-1)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-card)',
        padding: 14,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
        <strong style={{ fontSize: 14 }}>{idea.title || t('today.untitled')}</strong>
        <span
          style={{
            fontSize: 11,
            padding: '3px 10px',
            borderRadius: 'var(--radius-pill)',
            border: `1px solid ${idea.status === 'published' ? 'var(--positive)' : idea.status === 'inwork' ? 'var(--warning)' : 'var(--text-3)'}`,
            color:
              idea.status === 'published'
                ? 'var(--positive)'
                : idea.status === 'inwork'
                  ? 'var(--warning)'
                  : 'var(--text-3)',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          {t(('lbl.status.' + idea.status) as DictKey)}
        </span>
      </div>
      {idea.hook && <div style={{ fontSize: 13, color: 'var(--text-2)' }}>{idea.hook}</div>}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <Pill kind="cluster">{cl(idea.cluster)}</Pill>
        <Pill>{ft(idea.formula)}</Pill>
        <Pill>{idea.source || '—'}</Pill>
        <Pill kind="lang">{lbl(idea.channel)}</Pill>
        {idea.date && <Pill>{idea.date}</Pill>}
      </div>
      <GuardrailBox idea={idea} />
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <Btn
          onClick={() => {
            setForecastId(idea.id);
            setTab('forecast');
          }}
        >
          {t('id.card.forecast')}
        </Btn>
        <Btn onClick={onDraft}>{t('id.card.draft')}</Btn>
        {!readOnly && <Btn onClick={onEdit}>{t('id.card.edit')}</Btn>}
        {!readOnly && <Btn onClick={() => del(idea.id)}>{t('id.card.del')}</Btn>}
      </div>
    </div>
  );
}

function IdeaForm({ initial, onClose }: { initial: Idea; onClose: () => void }) {
  const t = useT();
  const lbl = useLbl();
  const cl = useClusterLabel();
  const ft = useFormulaTitle();
  const save = useStore((s) => s.saveIdea);
  const flash = useStore((s) => s.flash);
  const posts = useStore((s) => s.posts);
  const rules = useStore((s) => s.rules);
  const [idea, setIdea] = useState<Idea>(initial);
  const upd = (patch: Partial<Idea>) => setIdea((i) => ({ ...i, ...patch }));
  const flags = useMemo(() => validateIdea(idea, rules), [idea, rules]);
  const publishBlocked = idea.status === 'published' && hasHardFlag(flags);

  return (
    <Modal onClose={onClose} label={t('id.form.aria')} width={640}>
      <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 14 }}>
        {initial.title ? t('id.form.edit') : t('id.form.new')}
      </h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <label style={{ fontSize: 11, color: 'var(--text-3)' }}>
          {t('id.form.title')}
          <input
            value={idea.title}
            onChange={(e) => upd({ title: e.target.value })}
            style={{ ...inp, marginTop: 4 }}
            autoFocus
          />
        </label>
        <label style={{ fontSize: 11, color: 'var(--text-3)' }}>
          {t('id.form.hook')}
          <textarea
            value={idea.hook}
            onChange={(e) => upd({ hook: e.target.value })}
            rows={2}
            style={{ ...inp, marginTop: 4, resize: 'vertical' }}
          />
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px,1fr))', gap: 12 }}>
          <label style={{ fontSize: 11, color: 'var(--text-3)' }}>
            {t('id.form.cluster')}
            <select
              value={idea.cluster}
              onChange={(e) => upd({ cluster: e.target.value as ClusterId })}
              style={{ ...inp, marginTop: 4 }}
            >
              {CLUSTERS.map(([v]) => (
                <option key={v} value={v}>
                  {cl(v)}
                </option>
              ))}
            </select>
          </label>
          <label style={{ fontSize: 11, color: 'var(--text-3)' }}>
            {t('id.form.formula')}
            <select
              value={idea.formula}
              onChange={(e) => upd({ formula: e.target.value })}
              style={{ ...inp, marginTop: 4 }}
            >
              {FORMULAS.map((f) => (
                <option key={f.id} value={f.id}>
                  {ft(f.id)}
                </option>
              ))}
            </select>
          </label>
          <label style={{ fontSize: 11, color: 'var(--text-3)' }}>
            {t('id.form.source')}
            <input
              value={idea.source}
              onChange={(e) => upd({ source: e.target.value })}
              placeholder={t('id.form.source.ph')}
              style={{ ...inp, marginTop: 4 }}
            />
          </label>
          <label style={{ fontSize: 11, color: 'var(--text-3)' }}>
            {t('id.form.channel')}
            <select
              value={idea.channel}
              onChange={(e) => upd({ channel: e.target.value })}
              style={{ ...inp, marginTop: 4 }}
            >
              {CHANNELS.map((c) => (
                <option key={c} value={c}>
                  {lbl(c)}
                </option>
              ))}
            </select>
          </label>
          <label style={{ fontSize: 11, color: 'var(--text-3)' }}>
            {t('id.form.status')}
            <select
              value={idea.status}
              onChange={(e) => upd({ status: e.target.value as IdeaStatus })}
              style={{ ...inp, marginTop: 4 }}
            >
              {STATUS.map(([v]) => (
                <option key={v} value={v}>
                  {t(('lbl.status.' + v) as DictKey)}
                </option>
              ))}
            </select>
          </label>
          <label style={{ fontSize: 11, color: 'var(--text-3)' }}>
            {t('id.form.date')}
            <input
              type="date"
              value={idea.date}
              onChange={(e) => upd({ date: e.target.value })}
              style={{ ...inp, marginTop: 4 }}
            />
          </label>
          <label style={{ fontSize: 11, color: 'var(--text-3)', gridColumn: '1 / -1' }}>
            {t('id.form.ref')}
            <select
              value={idea.refPostId}
              onChange={(e) => upd({ refPostId: e.target.value })}
              style={{ ...inp, marginTop: 4 }}
            >
              <option value="">{t('id.form.ref.none')}</option>
              {posts
                .filter((p) => p.has_metrics)
                .slice(0, 60)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.author} · 💬{p.comments}
                  </option>
                ))}
            </select>
          </label>
        </div>
        <GuardrailBox idea={idea} />
        {publishBlocked && <div style={{ fontSize: 12, color: 'var(--critical)' }}>{t('id.form.publishBlocked')}</div>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Btn onClick={onClose}>{t('id.form.cancel')}</Btn>
          <Btn
            variant="accent"
            disabled={publishBlocked}
            onClick={() => {
              if (!idea.title.trim()) {
                flash(t('toast.idea.titleRequired'));
                return;
              }
              save(idea);
              flash(t('id.form.saved'));
              onClose();
            }}
          >
            {t('id.form.save')}
          </Btn>
        </div>
      </div>
    </Modal>
  );
}

function DraftModal({ idea, onClose }: { idea: Idea; onClose: () => void }) {
  const t = useT();
  const rules = useStore((s) => s.rules);
  const { text, blocked } = generateDraft(idea, rules);
  return (
    <Modal onClose={onClose} label={t('id.draft.aria')} width={720}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700 }}>{t('today.panel.draft')}</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label={t('an.modal.close')}
          style={{
            background: 'var(--surface-2)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            width: 32,
            height: 32,
            cursor: 'pointer',
            color: 'var(--text-1)',
            fontSize: 18,
          }}
        >
          ×
        </button>
      </div>
      {blocked && (
        <div
          style={{
            background: 'var(--critical-soft)',
            border: '1px solid var(--critical)',
            borderRadius: 8,
            padding: '8px 10px',
            fontSize: 12.5,
            color: 'var(--critical)',
            marginBottom: 12,
          }}
        >
          {t('id.draft.blocked')}
        </div>
      )}
      <pre
        style={{
          background: 'var(--surface-2)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          padding: 14,
          fontSize: 12.5,
          lineHeight: 1.55,
          whiteSpace: 'pre-wrap',
          fontFamily: 'var(--mono)',
          margin: 0,
          maxHeight: '52vh',
          overflowY: 'auto',
        }}
      >
        {text}
      </pre>
      <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'flex-end' }}>
        <Btn
          onClick={() => {
            navigator.clipboard?.writeText(text);
          }}
        >
          {t('today.copy')}
        </Btn>
        <Btn
          variant="accent"
          onClick={() => download((idea.title || 'draft').slice(0, 40) + '.md', text, 'text/markdown')}
        >
          {t('today.download')}
        </Btn>
      </div>
    </Modal>
  );
}

function Kanban() {
  const t = useT();
  const ideas = useStore((s) => s.ideas);
  const move = useStore((s) => s.moveIdeaStatus);
  const flash = useStore((s) => s.flash);
  const readOnly = useStore((s) => s.readOnly);
  const rules = useStore((s) => s.rules);
  const [dragId, setDragId] = useState<string | null>(null);

  // FE-7: hard-флаги считаются один раз на [ideas, rules], а не regex-прогоном на каждую карточку в каждом рендере
  const hardIds = useMemo(() => {
    const s = new Set<string>();
    for (const i of ideas) if (hasHardFlag(validateIdea(i, rules))) s.add(i.id);
    return s;
  }, [ideas, rules]);

  const cols: IdeaStatus[] = ['draft', 'inwork', 'published'];
  const tryMove = (id: string, status: IdeaStatus) => {
    if (status === 'published' && hardIds.has(id)) {
      flash(t('id.kanban.blocked'));
      return;
    }
    move(id, status);
  };

  return (
    <div className="kanban-grid">
      {cols.map((col) => (
        <div
          key={col}
          onDragOver={(e) => e.preventDefault()}
          onDrop={() => {
            if (dragId) {
              tryMove(dragId, col);
              setDragId(null);
            }
          }}
          style={{
            background: 'var(--surface-0)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-card)',
            padding: 10,
            minHeight: 200,
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)', marginBottom: 10 }}>
            {t(('lbl.status.' + col) as DictKey)} · {ideas.filter((i) => i.status === col).length}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {ideas
              .filter((i) => i.status === col)
              .map((i) => {
                const idx = cols.indexOf(col);
                return (
                  <div
                    key={i.id}
                    draggable={!readOnly}
                    onDragStart={() => setDragId(i.id)}
                    style={{
                      background: 'var(--surface-2)',
                      border: '1px solid var(--border)',
                      borderRadius: 8,
                      padding: 10,
                      fontSize: 12.5,
                    }}
                  >
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>{i.title || t('today.untitled')}</div>
                    {hardIds.has(i.id) && (
                      <div style={{ fontSize: 11, color: 'var(--critical)', marginBottom: 4 }}>
                        {t('id.kanban.hard')}
                      </div>
                    )}
                    {/* клавиатурная альтернатива drag-n-drop (a11y) */}
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button
                        type="button"
                        disabled={readOnly || idx === 0}
                        onClick={() => tryMove(i.id, cols[idx - 1])}
                        aria-label={t('id.kanban.left')}
                        style={{ ...miniBtn }}
                      >
                        ←
                      </button>
                      <button
                        type="button"
                        disabled={readOnly || idx === 2}
                        onClick={() => tryMove(i.id, cols[idx + 1])}
                        aria-label={t('id.kanban.right')}
                        style={{ ...miniBtn }}
                      >
                        →
                      </button>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      ))}
    </div>
  );
}

const miniBtn: React.CSSProperties = {
  background: 'var(--surface-3)',
  border: '1px solid var(--border)',
  borderRadius: 6,
  padding: '2px 8px',
  cursor: 'pointer',
  color: 'var(--text-1)',
  fontSize: 12,
};

function Calendar() {
  const t = useT();
  const locale = useStore((s) => s.locale);
  const ideas = useStore((s) => s.ideas);
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const first = new Date(y, m, 1);
  const startPad = (first.getDay() + 6) % 7; // пн=0
  const days = new Date(y, m + 1, 0).getDate();
  const todayStr = now.toISOString().slice(0, 10);
  const byDate = new Map<string, Idea[]>();
  for (const i of ideas) if (i.date) byDate.set(i.date, [...(byDate.get(i.date) || []), i]);
  const cells: (number | null)[] = [...Array(startPad).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];

  return (
    <div>
      <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 10 }}>
        {first.toLocaleDateString(intlLocale(locale), { month: 'long', year: 'numeric' })}
        {t('id.cal.note')}
      </div>
      {/* FE-5: на узких экранах календарь скроллится внутри контейнера */}
      <div className="scroll-x">
        <div className="calendar-grid">
          {t('id.cal.wd')
            .split(',')
            .map((d) => (
              <div key={d} style={{ fontSize: 11, color: 'var(--text-3)', textAlign: 'center' }}>
                {d}
              </div>
            ))}
          {cells.map((day, idx) => {
            if (day == null) return <div key={idx} />;
            const dateStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const wd = new Date(y, m, day).getDay();
            const target = wd === 2 || wd === 4;
            const items = byDate.get(dateStr) || [];
            const isToday = dateStr === todayStr;
            return (
              <div
                key={idx}
                style={{
                  minHeight: 62,
                  border: `1px solid ${isToday ? 'var(--accent)' : 'var(--border)'}`,
                  borderRadius: 8,
                  padding: 6,
                  background: target ? 'var(--accent-soft)' : 'var(--surface-1)',
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    color: isToday ? 'var(--text-accent)' : 'var(--text-3)',
                    fontWeight: isToday ? 700 : 400,
                  }}
                >
                  {day}
                </div>
                {items.map((i) => (
                  <div
                    key={i.id}
                    title={i.title}
                    style={{
                      fontSize: 10.5,
                      marginTop: 3,
                      padding: '2px 4px',
                      borderRadius: 4,
                      background: 'var(--surface-3)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      color: i.status === 'published' ? 'var(--positive)' : 'var(--text-2)',
                    }}
                  >
                    {i.title || '—'}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function Ideas() {
  const t = useT();
  const ideas = useStore((s) => s.ideas);
  const readOnly = useStore((s) => s.readOnly);
  const [view, setView] = useState<'list' | 'kanban' | 'calendar'>('list');
  const [editing, setEditing] = useState<Idea | null>(null);
  const [drafting, setDrafting] = useState<Idea | null>(null);

  const seg = (active: boolean): React.CSSProperties => ({
    background: active ? 'var(--surface-3)' : 'transparent',
    border: `1px solid ${active ? 'var(--border-strong)' : 'var(--border)'}`,
    color: active ? 'var(--text-1)' : 'var(--text-2)',
    borderRadius: 'var(--radius-ctl)',
    padding: '7px 13px',
    cursor: 'pointer',
    fontSize: 12.5,
    fontWeight: active ? 600 : 400,
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 4 }}>
          <button type="button" style={seg(view === 'list')} onClick={() => setView('list')}>
            {t('id.view.list')}
          </button>
          <button type="button" style={seg(view === 'kanban')} onClick={() => setView('kanban')}>
            {t('id.view.kanban')}
          </button>
          <button type="button" style={seg(view === 'calendar')} onClick={() => setView('calendar')}>
            {t('id.view.calendar')}
          </button>
        </div>
        {!readOnly && (
          <Btn variant="accent" onClick={() => setEditing(emptyIdea())}>
            {t('id.new')}
          </Btn>
        )}
      </div>

      {view === 'list' &&
        (ideas.length === 0 ? (
          <EmptyState>{t('id.empty')}</EmptyState>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 12 }}>
            {ideas.map((i) => (
              <IdeaCard key={i.id} idea={i} onEdit={() => setEditing(i)} onDraft={() => setDrafting(i)} />
            ))}
          </div>
        ))}
      {view === 'kanban' && (
        <Panel>
          <Kanban />
        </Panel>
      )}
      {view === 'calendar' && (
        <Panel>
          <Calendar />
        </Panel>
      )}

      {editing && <IdeaForm initial={editing} onClose={() => setEditing(null)} />}
      {drafting && <DraftModal idea={drafting} onClose={() => setDrafting(null)} />}
    </div>
  );
}
