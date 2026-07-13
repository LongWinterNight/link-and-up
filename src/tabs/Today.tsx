import { useMemo, useState } from 'react';
import { useStore } from '@/store';
import { CLUSTER_LABEL, STATUS_LABEL } from '@/lib/constants';
import { generateDraft } from '@/lib/draft';
import { CALIBRATION_MIN_FACTS, effectiveCalibration, forecast, selectMultipliers } from '@/lib/forecast';
import { validateIdea, hasHardFlag } from '@/lib/guardrails';
import { clusterStats, isPostingDay, ownPostsThisWeek } from '@/lib/derive';
import { download } from '@/lib/download';
import { nf, percentileOf } from '@/lib/stats';
import { Btn, EmptyState, Input, Panel, Pill, Select } from '@/components/ui';
import { FORMULAS } from '@/lib/constants';
import type { ClusterId } from '@/types';
import EmptyCorpus from '@/components/EmptyCorpus';
import { useT } from '@/i18n/useT';

/**
 * P-1 «Пост сегодня» — дефолтный экран: главная петля продукта в одном месте.
 * Идея → черновик по формуле → диапазон вовлечения (D3) → гардрейлы → действие.
 * Аналитика — обоснование, а не место назначения.
 */
export default function Today() {
  const posts = useStore((s) => s.posts);
  const ideas = useStore((s) => s.ideas);
  const rules = useStore((s) => s.rules);
  const readOnly = useStore((s) => s.readOnly);
  const cadenceGoal = useStore((s) => s.cadenceGoal);
  const calibration = useStore((s) => s.calibration);
  const calibrationCount = useStore((s) => s.calibrationCount);
  const setTab = useStore((s) => s.setTab);
  const setForecastId = useStore((s) => s.setForecastId);
  const scheduleIdea = useStore((s) => s.scheduleIdea);
  const moveIdeaStatus = useStore((s) => s.moveIdeaStatus);
  const flash = useStore((s) => s.flash);
  const t = useT();

  const saveIdea = useStore((s) => s.saveIdea);
  const candidates = useMemo(() => ideas.filter((i) => i.status !== 'published'), [ideas]);
  const [selectedId, setSelectedId] = useState('');
  const idea = candidates.find((i) => i.id === selectedId) || candidates[0] || null;

  // М2: быстрая идея, не покидая главный флоу
  const [quickOpen, setQuickOpen] = useState(false);
  const [qTitle, setQTitle] = useState('');
  const [qHook, setQHook] = useState('');
  const createQuick = () => {
    if (!qTitle.trim()) {
      flash(t('toast.idea.titleRequired'));
      return;
    }
    const cluster = (clusterStats(posts)[0]?.id || 'spec') as ClusterId;
    const id = 'idea-' + Date.now();
    saveIdea({
      id, title: qTitle.trim(), hook: qHook.trim(), cluster,
      formula: FORMULAS[0].id, source: '', channel: 'LinkedIn',
      status: 'draft', date: '', refPostId: '', predicted: 0, actual: null,
    });
    setQTitle('');
    setQHook('');
    setQuickOpen(false);
    setSelectedId(id);
  };
  const quickForm = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8, maxWidth: 440 }}>
      <Input label={t('today.quick.title')} id="quick-title" name="quick-title" autoComplete="off" value={qTitle} onChange={(e) => setQTitle(e.target.value)} />
      <Input label={t('today.quick.hook')} id="quick-hook" name="quick-hook" autoComplete="off" value={qHook} onChange={(e) => setQHook(e.target.value)} />
      <div>
        <Btn variant="accent" onClick={createQuick}>{t('today.quick.create')}</Btn>
      </div>
    </div>
  );

  const flags = useMemo(() => (idea ? validateIdea(idea, rules) : []), [idea, rules]);
  const hard = hasHardFlag(flags);
  const draft = useMemo(() => (idea ? generateDraft(idea, rules) : null), [idea, rules]);
  const effCal = effectiveCalibration(calibration, calibrationCount);
  const sel = useMemo(() => selectMultipliers(posts), [posts]);
  const fc = useMemo(() => forecast(idea, posts, effCal, sel.multipliers), [idea, posts, effCal, sel]);
  // М8: перцентиль честен только на достаточной выборке (резолюция раунда 3: ≥30 метрик)
  const metricComments = useMemo(() => posts.filter((p) => p.has_metrics && p.comments > 0).map((p) => p.comments), [posts]);
  const pctl = fc && !fc.lowData && metricComments.length >= 30 ? percentileOf(metricComments, fc.expected) : null;

  const ownThisWeek = ownPostsThisWeek(posts);
  const postingDay = isPostingDay();

  if (posts.length === 0) {
    return <EmptyCorpus title={t('today.empty.title')} hint={t('today.empty.hint')} />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* статус каденса */}
      <section style={{ display: 'flex', gap: 14, alignItems: 'baseline', flexWrap: 'wrap' }}>
        <h2 style={{ fontSize: 'var(--fs-2xl)', fontWeight: 800 }}>{t('today.h1')}</h2>
        <span style={{ fontSize: 'var(--fs-md)', color: 'var(--text-3)' }}>
          {t('today.week')}<span className="num" style={{ color: 'var(--text-1)' }}>{ownThisWeek}</span>/{cadenceGoal}
          {postingDay ? t('today.postingDay') : t('today.nextDay')}
        </span>
      </section>

      {candidates.length === 0 ? (
        <Panel>
          <EmptyState>{t('today.noIdeas')}</EmptyState>
          {!readOnly ? quickForm : <Btn variant="accent" onClick={() => setTab('ideas')}>{t('today.createIdea')}</Btn>}
        </Panel>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16, alignItems: 'start' }}>
          {/* левая колонка: идея + гардрейлы + действия */}
          <Panel title={t('today.panel.idea')}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Select
                label={t('today.select.label')}
                id="today-idea"
                name="today-idea"
                value={idea?.id || ''}
                onChange={(e) => setSelectedId(e.target.value)}
              >
                {candidates.map((i) => (
                  <option key={i.id} value={i.id}>
                    {(i.title || t('today.untitled')).slice(0, 70)} · {STATUS_LABEL[i.status]}
                  </option>
                ))}
              </Select>
              {!readOnly && (
                <button type="button" onClick={() => setQuickOpen((v) => !v)} style={{ background: 'none', border: 'none', color: 'var(--text-accent)', cursor: 'pointer', fontSize: 'var(--fs-xs)', textAlign: 'left', padding: 0 }}>
                  {t('today.quick.button')}
                </button>
              )}
              {quickOpen && !readOnly && quickForm}

              {idea && (
                <>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <Pill kind="cluster">{CLUSTER_LABEL[idea.cluster] || idea.cluster}</Pill>
                    <Pill>{idea.channel}</Pill>
                    {idea.date && <Pill>{t('today.plan')}{idea.date}</Pill>}
                  </div>
                  {idea.hook && <div style={{ fontSize: 'var(--fs-md)', color: 'var(--text-2)', lineHeight: 1.55 }}>{idea.hook}</div>}

                  {/* гардрейлы */}
                  {flags.length > 0 && (
                    <div style={{ background: hard ? 'var(--critical-soft)' : 'var(--warning-soft)', border: `1px solid ${hard ? 'var(--critical)' : 'var(--border-warning)'}`, borderRadius: 8, padding: '8px 10px' }}>
                      <div style={{ fontSize: 'var(--fs-2xs)', fontWeight: 700, color: hard ? 'var(--critical)' : 'var(--warning)', marginBottom: 4 }}>
                        {hard ? t('today.guard.block') : t('today.guard.warn')}
                      </div>
                      {flags.map((f, i) => (
                        <div key={i} style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-2)' }}>• {f.message}</div>
                      ))}
                    </div>
                  )}
                  {flags.length === 0 && <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--positive)' }}>{t('today.guard.clean')}</div>}

                  {!readOnly && (
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <Btn onClick={() => scheduleIdea(idea.id)}>{t('today.schedule')}</Btn>
                      <Btn
                        variant="accent"
                        disabled={hard}
                        title={hard ? t('today.publish.blocked') : undefined}
                        onClick={() => {
                          moveIdeaStatus(idea.id, 'published');
                          flash(t('today.published.toast'));
                          setForecastId(idea.id);
                          setTab('forecast');
                        }}
                      >
                        {t('today.publish')}
                      </Btn>
                      <Btn onClick={() => setTab('ideas')}>{t('today.editInIdeas')}</Btn>
                    </div>
                  )}
                </>
              )}
            </div>
          </Panel>

          {/* правая колонка: черновик + оценка */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {fc && (
              <Panel title={t('today.panel.estimate')}>
                {fc.lowData ? (
                  <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--warning)' }}>{t('today.lowdata')}</div>
                ) : (
                  <div style={{ display: 'flex', gap: 16, alignItems: 'baseline', flexWrap: 'wrap' }}>
                    <div className="num" style={{ fontSize: 'var(--fs-num)', fontWeight: 800 }}>
                      {nf(fc.low)}<span style={{ color: 'var(--text-3)', fontWeight: 400 }}>–</span>{nf(fc.high)}
                    </div>
                    <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-3)' }}>
                      {t('today.comments.by')}<span className="num">{nf(fc.expected)}</span>{t('today.analogs')}{fc.poolSize}{t('today.analogs2')}
                      {calibrationCount < CALIBRATION_MIN_FACTS && t('today.noCalib')}
                    </span>
                    {pctl != null && (
                      <span style={{ fontSize: 'var(--fs-xs)', padding: '2px 9px', borderRadius: 'var(--radius-pill)', background: 'var(--positive-soft)', color: 'var(--positive)', border: '1px solid var(--positive)' }}>
                        {t('today.pctl.above')}{pctl}{t('today.pctl.rest')}
                      </span>
                    )}
                  </div>
                )}
                <div style={{ fontSize: 'var(--fs-2xs)', color: 'var(--text-3)', marginTop: 8 }}>{t('today.fullBreakdown')}</div>
              </Panel>
            )}

            {draft && (
              <Panel title={t('today.panel.draft')}>
                {draft.blocked && (
                  <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--critical)', marginBottom: 8 }}>{t('today.draft.blocked')}</div>
                )}
                <pre style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, padding: 12, fontSize: 'var(--fs-sm)', lineHeight: 1.55, whiteSpace: 'pre-wrap', fontFamily: 'var(--mono)', margin: 0, maxHeight: '44vh', overflowY: 'auto' }}>
                  {draft.text}
                </pre>
                <div style={{ display: 'flex', gap: 8, marginTop: 10, justifyContent: 'flex-end' }}>
                  <Btn onClick={() => { navigator.clipboard?.writeText(draft.text); flash(t('today.copied')); }}>{t('today.copy')}</Btn>
                  <Btn onClick={() => download(((idea?.title || 'draft').slice(0, 40)) + '.md', draft.text, 'text/markdown')}>{t('today.download')}</Btn>
                </div>
              </Panel>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
