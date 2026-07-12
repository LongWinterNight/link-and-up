import { useMemo, useState } from 'react';
import { useStore } from '@/store';
import { backtest, forecast, recalcCalibration } from '@/lib/forecast';
import { CLUSTER_LABEL } from '@/lib/constants';
import { nf } from '@/lib/stats';
import type { IdeaActual } from '@/types';
import { Btn, EmptyState, Kpi, Panel } from '@/components/ui';

const inp: React.CSSProperties = {
  background: 'var(--surface-2)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-ctl)',
  padding: '8px 10px',
  color: 'var(--text-1)',
  fontSize: 13,
  width: '100%',
};

function NumField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11, color: 'var(--text-3)' }}>
      {label}
      <input type="number" min={0} value={value} onChange={(e) => onChange(e.target.value)} style={inp} aria-label={label} />
    </label>
  );
}

export default function Forecast() {
  const posts = useStore((s) => s.posts);
  const ideas = useStore((s) => s.ideas);
  const forecastId = useStore((s) => s.forecastId);
  const setForecastId = useStore((s) => s.setForecastId);
  const calibration = useStore((s) => s.calibration);
  const openPost = useStore((s) => s.openPost);
  const saveReal = useStore((s) => s.saveReal);
  const scheduleIdea = useStore((s) => s.scheduleIdea);
  const readOnly = useStore((s) => s.readOnly);

  const bt = useMemo(() => backtest(posts), [posts]);
  const idea = ideas.find((i) => i.id === forecastId) || null;
  const fc = useMemo(() => forecast(idea, posts, calibration), [idea, posts, calibration]);
  const cal = useMemo(() => recalcCalibration(ideas, calibration), [ideas, calibration]);

  const published = useMemo(() => ideas.filter((i) => i.status === 'published' && i.actual && i.predicted > 0), [ideas]);
  const own = useMemo(() => posts.filter((p) => p.is_own), [posts]);
  const leads = own.reduce((a, p) => a + (p.leads || 0), 0);
  const interviews = own.reduce((a, p) => a + (p.interviews || 0), 0);
  const maxCmp = Math.max(1, ...published.map((i) => Math.max(i.predicted, Number(i.actual!.comments))));

  const [form, setForm] = useState<IdeaActual>({ reactions: 0, comments: 0, leads: 0, interviews: 0, date: '' });
  const set = (k: keyof IdeaActual, v: string) => setForm((f) => ({ ...f, [k]: k === 'date' ? v : Number(v) || 0 }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* KPI модели + карьерный результат */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
        <Kpi label="Опубликовано своих" value={nf(own.length)} />
        <Kpi label="Точность прогноза" value={cal.accuracy == null ? '—' : cal.accuracy + '%'} sub={cal.count ? `по ${cal.count} постам` : 'нет фактов'} tone={cal.accuracy != null && cal.accuracy >= 60 ? 'positive' : undefined} />
        <Kpi label="Калибровка модели" value={'×' + calibration.toFixed(2)} sub="факт/прогноз" />
        <Kpi label="Карьерный результат" value={nf(leads + interviews)} sub={`${leads} лидов · ${interviews} собесов`} tone="positive" />
      </div>

      {/* Честность модели: бэктест */}
      <Panel title="Точность модели прогноза (бэктест leave-one-out по корпусу)">
        {bt.mape == null ? (
          <EmptyState>{bt.note}</EmptyState>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 12 }}>
              <Kpi label="Постов в бэктесте" value={nf(bt.n)} />
              <Kpi label="Прогнозов «в пределах 2×»" value={bt.within2x + '%'} tone={bt.within2x! >= 50 ? 'positive' : 'warning'} sub="того же порядка, что факт" />
              <Kpi label="MAPE" value={bt.mape} sub="средн. относит. ошибка" />
              <Kpi label="Медианная ошибка" value={nf(bt.medianAbsErr)} sub="комментариев" />
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 10 }}>{bt.note} Прогноз ниже — ОЦЕНКА, не факт: относитесь к диапазону, а не к точному числу.</div>
          </>
        )}
      </Panel>

      <Panel title="Прогноз вовлечения идеи">
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11, color: 'var(--text-3)', maxWidth: 460 }}>
          Идея
          <select value={forecastId} onChange={(e) => setForecastId(e.target.value)} aria-label="Выберите идею для прогноза" style={{ ...inp, width: 'auto' }}>
            <option value="">— выберите идею —</option>
            {ideas.map((i) => (
              <option key={i.id} value={i.id}>
                {(i.title || 'Без названия').slice(0, 70)}
              </option>
            ))}
          </select>
        </label>

        {!fc ? (
          <EmptyState>Выберите идею, чтобы увидеть оценку вовлечения и её разложение.</EmptyState>
        ) : (
          <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
            {fc.lowData && (
              <div style={{ background: 'var(--warning-soft)', border: '1px solid var(--border-warning)', borderRadius: 8, padding: '10px 12px', fontSize: 12.5, color: 'var(--warning)' }}>
                Недостаточно данных для прогноза: нет постов с метриками в этом кластере и нет валидного пост-референса.
                Число ниже — грубая заглушка, не оценка. Добавьте свои посты с фактами или укажите референс.
              </div>
            )}
            <div style={{ display: 'flex', gap: 20, alignItems: 'baseline', flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-3)' }}>Ожидаемо комментариев (оценка)</div>
                <div className="num" style={{ fontSize: 34, fontWeight: 800 }}>{nf(fc.expected)}</div>
              </div>
              <div style={{ fontSize: 14, color: 'var(--text-2)' }}>
                диапазон <span className="num">{nf(fc.low)}</span>–<span className="num">{nf(fc.high)}</span>
              </div>
              {fc.er && (
                <div style={{ fontSize: 13, color: 'var(--text-2)' }}>
                  ER ≈ <span className="num">{fc.er.expected.toFixed(2)}%</span> (n={fc.er.n})
                </div>
              )}
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--text-3)' }}>{fc.bandNote}</div>

            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)', marginBottom: 8 }}>Как получено число</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {fc.steps.map((s, i) => (
                  <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 13 }}>
                    <span style={{ flex: 1, color: 'var(--text-2)' }}>{s.label}</span>
                    <span className="num" style={{ width: 54, textAlign: 'right', color: 'var(--text-3)' }}>{s.factor}</span>
                    <span className="num" style={{ width: 70, textAlign: 'right', fontWeight: 600 }}>{nf(s.running)}</span>
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 8 }}>{fc.explain}</div>
            </div>

            {fc.evidence.length > 0 && (
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)', marginBottom: 8 }}>Посты-основания</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {fc.evidence.map((p) => (
                    <button key={p.id} type="button" onClick={() => openPost(p.id)} style={{ textAlign: 'left', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', cursor: 'pointer', color: 'inherit', fontSize: 13, display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.author} · {CLUSTER_LABEL[p.meta_cluster]}</span>
                      <span className="num" style={{ flexShrink: 0, color: 'var(--text-2)' }}>💬 {nf(p.comments)}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Петля обучения: ввод фактов */}
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)', marginBottom: 4 }}>Петля обучения — внесите факт после публикации</div>
              <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 10 }}>Реальные метрики становятся своим постом (is_own) и уточняют калибровку модели.</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 10, maxWidth: 640 }}>
                <NumField label="Реакции" value={String(form.reactions || '')} onChange={(v) => set('reactions', v)} />
                <NumField label="Комментарии" value={String(form.comments || '')} onChange={(v) => set('comments', v)} />
                <NumField label="Лиды" value={String(form.leads || '')} onChange={(v) => set('leads', v)} />
                <NumField label="Собеседования" value={String(form.interviews || '')} onChange={(v) => set('interviews', v)} />
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11, color: 'var(--text-3)' }}>
                  Дата
                  <input type="date" value={form.date} onChange={(e) => set('date', e.target.value)} style={inp} aria-label="Дата публикации" />
                </label>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                <Btn
                  variant="accent"
                  disabled={readOnly || (!form.reactions && !form.comments)}
                  onClick={() => {
                    saveReal(idea!.id, form);
                    setForm({ reactions: 0, comments: 0, leads: 0, interviews: 0, date: '' });
                  }}
                >
                  Сохранить факт
                </Btn>
                <Btn disabled={readOnly} onClick={() => scheduleIdea(idea!.id)}>
                  Запланировать на вт/чт
                </Btn>
              </div>
            </div>
          </div>
        )}
      </Panel>

      {/* Прогноз против факта */}
      <Panel title="Прогноз против факта (опубликованные свои посты)">
        {published.length === 0 ? (
          <EmptyState>Пока нет опубликованных своих постов с фактами. Внесите факт выше — появится калибровка.</EmptyState>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {published.map((i) => (
              <div key={i.id}>
                <div style={{ fontSize: 12.5, color: 'var(--text-2)', marginBottom: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{i.title}</div>
                {[
                  ['прогноз', i.predicted, 'var(--text-accent)'],
                  ['факт', Number(i.actual!.comments), 'var(--positive)'],
                ].map(([lbl, val, col]) => (
                  <div key={lbl as string} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ width: 62, fontSize: 11, color: 'var(--text-3)', flexShrink: 0 }}>{lbl}</span>
                    <div style={{ flex: 1, height: 14, background: 'var(--surface-2)', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ width: Math.max(2, (Number(val) / maxCmp) * 100) + '%', height: '100%', background: col as string, borderRadius: 4 }} />
                    </div>
                    <span className="num" style={{ width: 44, textAlign: 'right', fontSize: 12, flexShrink: 0 }}>{nf(Number(val))}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
