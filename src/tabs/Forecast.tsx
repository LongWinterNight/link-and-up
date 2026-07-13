import { useMemo, useState } from 'react';
import { useStore } from '@/store';
import {
  backtest,
  CALIBRATION_MIN_FACTS,
  effectiveCalibration,
  forecast,
  recalcCalibration,
  selectMultipliers,
} from '@/lib/forecast';
import { corpusFreshness } from '@/lib/derive';
import { nf } from '@/lib/stats';
import type { IdeaActual } from '@/types';
import { Btn, EmptyState, Kpi, Panel } from '@/components/ui';
import { useClusterLabel, useT } from '@/i18n/useT';

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
      <input
        type="number"
        min={0}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={inp}
        aria-label={label}
      />
    </label>
  );
}

export default function Forecast() {
  const t = useT();
  const cl = useClusterLabel();
  const posts = useStore((s) => s.posts);
  const ideas = useStore((s) => s.ideas);
  const forecastId = useStore((s) => s.forecastId);
  const setForecastId = useStore((s) => s.setForecastId);
  const calibration = useStore((s) => s.calibration);
  const calibrationCount = useStore((s) => s.calibrationCount);
  const openPost = useStore((s) => s.openPost);
  const saveReal = useStore((s) => s.saveReal);
  const scheduleIdea = useStore((s) => s.scheduleIdea);
  const readOnly = useStore((s) => s.readOnly);

  // FCST-2: набор множителей выбирается автоматически по leave-one-out бэктесту на этом корпусе
  const sel = useMemo(() => selectMultipliers(posts), [posts]);
  const bt = useMemo(() => backtest(posts, sel.multipliers), [posts, sel]);
  const fresh = useMemo(() => corpusFreshness(posts), [posts]);
  const idea = ideas.find((i) => i.id === forecastId) || null;
  // COR-8: множитель калибровки активен только от CALIBRATION_MIN_FACTS фактов
  const effCal = effectiveCalibration(calibration, calibrationCount);
  const fc = useMemo(() => forecast(idea, posts, effCal, sel.multipliers), [idea, posts, effCal, sel]);
  const cal = useMemo(() => recalcCalibration(ideas, calibration), [ideas, calibration]);

  const published = useMemo(
    () => ideas.filter((i) => i.status === 'published' && i.actual && i.predicted > 0),
    [ideas],
  );
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
        <Kpi label={t('fc.kpi.own')} value={nf(own.length)} />
        <Kpi
          label={t('fc.kpi.acc')}
          value={cal.accuracy == null ? '—' : cal.accuracy + '%'}
          sub={cal.count ? t('fc.kpi.acc.sub.a') + cal.count + t('fc.kpi.acc.sub.b') : t('fc.kpi.acc.none')}
          tone={cal.accuracy != null && cal.accuracy >= 60 ? 'positive' : undefined}
        />
        <Kpi
          label={t('fc.kpi.calib')}
          value={'×' + calibration.toFixed(2)}
          sub={
            calibrationCount >= CALIBRATION_MIN_FACTS
              ? t('fc.kpi.calib.on.a') + calibrationCount + t('fc.kpi.calib.on.b')
              : t('fc.kpi.calib.off.a') + calibrationCount + '/' + CALIBRATION_MIN_FACTS + t('fc.kpi.calib.off.b')
          }
          tone={calibrationCount >= CALIBRATION_MIN_FACTS ? 'positive' : undefined}
        />
        <Kpi
          label={t('fc.kpi.biz')}
          value={nf(leads + interviews)}
          sub={leads + t('fc.kpi.biz.sub.a') + interviews + t('fc.kpi.biz.sub.b')}
          tone="positive"
        />
      </div>

      {/* М51: двухслойная честность — простая строка по умолчанию, математика под раскрытием */}
      <Panel title={t('fc.acc.title')}>
        {bt.mape == null ? (
          <EmptyState>{bt.note}</EmptyState>
        ) : (
          <>
            <div style={{ fontSize: 13.5, color: 'var(--text-1)' }}>
              {t('fc.acc.line.a')}
              <span className="num">{nf(bt.n)}</span>
              {t('fc.acc.line.b')}
              <b style={{ color: bt.within2x! >= 50 ? 'var(--positive)' : 'var(--warning)' }}>{bt.within2x}</b>
              {t('fc.acc.line.c')}
              {sel.chosen === 'empirical' && (
                <>
                  {t('fc.acc.emp.a')}
                  <b style={{ color: 'var(--positive)' }}>{t('fc.acc.emp.b')}</b>
                  {t('fc.acc.emp.c')}
                </>
              )}
            </div>
            <details style={{ marginTop: 10 }}>
              <summary style={{ cursor: 'pointer', fontSize: 12.5, color: 'var(--text-accent)' }}>
                {t('fc.details.summary')}
              </summary>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))',
                  gap: 12,
                  marginTop: 10,
                }}
              >
                <Kpi label={t('fc.bt.n')} value={nf(bt.n)} />
                <Kpi
                  label={t('fc.bt.within')}
                  value={bt.within2x + '%'}
                  tone={bt.within2x! >= 50 ? 'positive' : 'warning'}
                  sub={t('fc.bt.within.sub')}
                />
                <Kpi label="MAPE" value={bt.mape} sub={t('fc.bt.mape.sub')} />
                <Kpi label={t('fc.bt.median')} value={nf(bt.medianAbsErr)} sub={t('fc.bt.median.sub')} />
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 10 }}>
                {bt.note} {t('fc.bt.estimate')}
              </div>
              {/* FCST-2: честное сравнение наборов множителей */}
              {sel.empirical ? (
                <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 8 }}>
                  {t('fc.mult.label')}
                  {sel.chosen === 'empirical' ? (
                    <>
                      {t('fc.mult.emp.a')}
                      <b style={{ color: 'var(--positive)' }}>{t('fc.mult.emp.b')}</b>
                      {t('fc.mult.emp.c')}
                      {sel.empiricalMape}
                      {t('fc.mult.emp.d')}
                      {sel.defaultMape}
                      {t('fc.mult.emp.e')}
                    </>
                  ) : (
                    <>
                      {t('fc.mult.def.a')}
                      {sel.defaultMape}
                      {t('fc.mult.def.b')}
                      {sel.empiricalMape ?? '—'}
                      {t('fc.mult.def.c')}
                    </>
                  )}{' '}
                  {Object.entries(sel.empirical.details)
                    .filter(([, d]) => !d.fallback)
                    .map(([k, d]) => `${k} ×${d.value} (n=${d.nWith}/${d.nWithout})`)
                    .join(' · ')}
                </div>
              ) : (
                <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 8 }}>{t('fc.mult.none')}</div>
              )}
            </details>
          </>
        )}
        {fresh.latest && (
          <div style={{ fontSize: 12, color: fresh.stale ? 'var(--warning)' : 'var(--text-3)', marginTop: 8 }}>
            {t('fc.fresh.a')}
            {fresh.latest}
            {fresh.ageDays != null && ` (${fresh.ageDays}${t('fc.fresh.b')})`}.
            {fresh.stale && ' ' + t('fc.fresh.stale')}
          </div>
        )}
      </Panel>

      <Panel title={t('fc.idea.title')}>
        <label
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
            fontSize: 11,
            color: 'var(--text-3)',
            maxWidth: 460,
          }}
        >
          {t('fc.idea.label')}
          <select
            value={forecastId}
            onChange={(e) => setForecastId(e.target.value)}
            aria-label={t('fc.idea.aria')}
            style={{ ...inp, width: 'auto' }}
          >
            <option value="">{t('fc.idea.select')}</option>
            {ideas.map((i) => (
              <option key={i.id} value={i.id}>
                {(i.title || t('today.untitled')).slice(0, 70)}
              </option>
            ))}
          </select>
        </label>

        {!fc ? (
          <EmptyState>{t('fc.idea.empty')}</EmptyState>
        ) : (
          <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
            {fc.lowData && (
              <div
                style={{
                  background: 'var(--warning-soft)',
                  border: '1px solid var(--border-warning)',
                  borderRadius: 8,
                  padding: '10px 12px',
                  fontSize: 12.5,
                  color: 'var(--warning)',
                }}
              >
                {t('fc.lowdata')}
              </div>
            )}
            {/* D3: диапазон — главное число; точечная оценка — вторичный ориентир */}
            <div style={{ display: 'flex', gap: 20, alignItems: 'baseline', flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{t('fc.range.label')}</div>
                <div className="num" style={{ fontSize: 30, fontWeight: 800 }}>
                  {nf(fc.low)}
                  <span style={{ color: 'var(--text-3)', fontWeight: 400 }}>–</span>
                  {nf(fc.high)}
                </div>
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-3)' }}>
                {t('fc.range.center')}
                <span className="num" style={{ color: 'var(--text-2)' }}>
                  {nf(fc.expected)}
                </span>
              </div>
              {fc.er && (
                <div style={{ fontSize: 13, color: 'var(--text-2)' }}>
                  ER ≈ <span className="num">{fc.er.expected.toFixed(2)}%</span> (n={fc.er.n})
                </div>
              )}
            </div>

            {/* полоса диапазона: где центр оценки внутри low–high */}
            {fc.high > fc.low && (
              <div aria-hidden style={{ maxWidth: 440 }}>
                <div style={{ position: 'relative', height: 8, background: 'var(--accent-soft)', borderRadius: 4 }}>
                  <div
                    style={{
                      position: 'absolute',
                      top: -2,
                      left: `calc(${Math.min(100, Math.max(0, ((fc.expected - fc.low) / (fc.high - fc.low)) * 100))}% - 4px)`,
                      width: 8,
                      height: 12,
                      borderRadius: 3,
                      background: 'var(--accent)',
                    }}
                  />
                </div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: 11,
                    color: 'var(--text-3)',
                    marginTop: 4,
                  }}
                >
                  <span className="num">{nf(fc.low)}</span>
                  <span className="num">{nf(fc.high)}</span>
                </div>
              </div>
            )}
            <div style={{ fontSize: 12.5, color: 'var(--text-3)' }}>{fc.bandNote}</div>

            {/* М51: разложение — эксперт-слой, по умолчанию свёрнуто */}
            <details>
              <summary style={{ cursor: 'pointer', fontSize: 12.5, color: 'var(--text-accent)' }}>
                {t('fc.steps.summary')}
              </summary>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}>
                {fc.steps.map((s, i) => (
                  <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 13 }}>
                    <span style={{ flex: 1, color: 'var(--text-2)' }}>{s.label}</span>
                    <span className="num" style={{ width: 54, textAlign: 'right', color: 'var(--text-3)' }}>
                      {s.factor}
                    </span>
                    <span className="num" style={{ width: 70, textAlign: 'right', fontWeight: 600 }}>
                      {nf(s.running)}
                    </span>
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 8 }}>{fc.explain}</div>
            </details>

            {fc.evidence.length > 0 && (
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)', marginBottom: 8 }}>
                  {t('fc.evidence')}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {fc.evidence.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => openPost(p.id)}
                      style={{
                        textAlign: 'left',
                        background: 'var(--surface-2)',
                        border: '1px solid var(--border)',
                        borderRadius: 8,
                        padding: '8px 10px',
                        cursor: 'pointer',
                        color: 'inherit',
                        fontSize: 13,
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: 10,
                      }}
                    >
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {p.author} · {cl(p.meta_cluster)}
                      </span>
                      <span className="num" style={{ flexShrink: 0, color: 'var(--text-2)' }}>
                        💬 {nf(p.comments)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Петля обучения: ввод фактов */}
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)', marginBottom: 4 }}>
                {t('fc.loop.title')}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 10 }}>{t('fc.loop.note')}</div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
                  gap: 10,
                  maxWidth: 640,
                }}
              >
                <NumField
                  label={t('fc.loop.reactions')}
                  value={String(form.reactions || '')}
                  onChange={(v) => set('reactions', v)}
                />
                <NumField
                  label={t('fc.loop.comments')}
                  value={String(form.comments || '')}
                  onChange={(v) => set('comments', v)}
                />
                <NumField
                  label={t('fc.loop.leads')}
                  value={String(form.leads || '')}
                  onChange={(v) => set('leads', v)}
                />
                <NumField
                  label={t('fc.loop.interviews')}
                  value={String(form.interviews || '')}
                  onChange={(v) => set('interviews', v)}
                />
                <label
                  style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11, color: 'var(--text-3)' }}
                >
                  {t('fc.loop.date')}
                  <input
                    type="date"
                    value={form.date}
                    onChange={(e) => set('date', e.target.value)}
                    style={inp}
                    aria-label={t('fc.loop.date.aria')}
                  />
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
                  {t('fc.loop.save')}
                </Btn>
                <Btn disabled={readOnly} onClick={() => scheduleIdea(idea!.id)}>
                  {t('fc.loop.schedule')}
                </Btn>
              </div>
            </div>
          </div>
        )}
      </Panel>

      {/* Прогноз против факта */}
      <Panel title={t('fc.vs.title')}>
        {published.length === 0 ? (
          <EmptyState>{t('fc.vs.empty')}</EmptyState>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {published.map((i) => (
              <div key={i.id}>
                <div
                  style={{
                    fontSize: 12.5,
                    color: 'var(--text-2)',
                    marginBottom: 6,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {i.title}
                </div>
                {[
                  [t('fc.vs.pred'), i.predicted, 'var(--text-accent)'],
                  [t('fc.vs.fact'), Number(i.actual!.comments), 'var(--positive)'],
                ].map(([lbl, val, col]) => (
                  <div key={lbl as string} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ width: 62, fontSize: 11, color: 'var(--text-3)', flexShrink: 0 }}>{lbl}</span>
                    <div
                      style={{
                        flex: 1,
                        height: 14,
                        background: 'var(--surface-2)',
                        borderRadius: 4,
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          width: Math.max(2, (Number(val) / maxCmp) * 100) + '%',
                          height: '100%',
                          background: col as string,
                          borderRadius: 4,
                        }}
                      />
                    </div>
                    <span className="num" style={{ width: 44, textAlign: 'right', fontSize: 12, flexShrink: 0 }}>
                      {nf(Number(val))}
                    </span>
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
