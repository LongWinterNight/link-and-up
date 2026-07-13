import { useMemo } from 'react';
import { useStore } from '@/store';
import {
  clusterStats,
  collectionByMonth,
  isPostingDay,
  kpis,
  ownPostsThisWeek,
  topByComments,
  topByRate,
} from '@/lib/derive';
import { median, nf } from '@/lib/stats';
import { Bars, Donut } from '@/components/charts';
import { Btn, Kpi, Panel, Pill } from '@/components/ui';
import { CLUSTER_LABEL } from '@/lib/constants';
import EmptyCorpus from '@/components/EmptyCorpus';
import { useT } from '@/i18n/useT';

export default function Overview() {
  const posts = useStore((s) => s.posts);
  const ideas = useStore((s) => s.ideas);
  const openPost = useStore((s) => s.openPost);
  const setTab = useStore((s) => s.setTab);
  const cadenceGoal = useStore((s) => s.cadenceGoal);
  const t = useT();

  const k = useMemo(() => kpis(posts), [posts]);
  const clusters = useMemo(() => clusterStats(posts), [posts]);
  const topC = useMemo(() => topByComments(posts, 12), [posts]);
  const topR = useMemo(() => topByRate(posts, 12), [posts]);
  const byMonth = useMemo(() => collectionByMonth(posts), [posts]);

  // North-Star: свои посты на этой неделе против цели 3–5
  const own = useMemo(() => posts.filter((p) => p.is_own), [posts]);
  const ownThisWeek = ownPostsThisWeek(posts);
  const goal = cadenceGoal;
  const pct = Math.min(100, Math.round((ownThisWeek / goal) * 100));
  const ownComments = own.filter((p) => p.has_metrics).map((p) => p.comments);
  const ownMed = ownComments.length ? nf(median(ownComments)) : '—';

  // P-6: retention-триггер — в день публикации предлагаем идеи из банка
  const postingDay = isPostingDay();
  const candidateIdeas = useMemo(() => ideas.filter((i) => i.status !== 'published').slice(0, 3), [ideas]);
  const showCadenceNudge = postingDay && ownThisWeek < goal;

  if (posts.length === 0) {
    return <EmptyCorpus title={t('ov.empty.title')} hint={t('ov.empty.hint')} />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* North-Star */}
      <section
        style={{
          background: 'var(--surface-1)',
          border: '1px solid var(--border)',
          borderLeft: `4px solid ${ownThisWeek >= 3 ? 'var(--positive)' : 'var(--warning)'}`,
          borderRadius: 'var(--radius-card)',
          padding: 18,
          display: 'flex',
          gap: 24,
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        <div>
          <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{t('ov.northstar.label')}</div>
          <div className="num" style={{ fontSize: 40, fontWeight: 800, lineHeight: 1 }}>
            {ownThisWeek}
            <span style={{ fontSize: 18, color: 'var(--text-3)', fontWeight: 600 }}> / {goal}</span>
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ height: 10, background: 'var(--surface-2)', borderRadius: 6, overflow: 'hidden' }}>
            <div
              style={{
                width: pct + '%',
                height: '100%',
                background: ownThisWeek >= 3 ? 'var(--positive)' : 'var(--warning)',
              }}
            />
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 8 }}>
            {t('ov.northstar.goalNote')}
            <span className="num">{ownMed}</span>
            {t('ov.northstar.comm')}
            {own.length === 0 && t('ov.northstar.none')}
          </div>
        </div>
      </section>

      {/* P-6: день публикации — идеи из банка под руку */}
      {showCadenceNudge && (
        <section
          style={{
            background: 'var(--accent-soft)',
            border: '1px solid var(--accent)',
            borderRadius: 'var(--radius-card)',
            padding: '14px 18px',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          <div style={{ fontSize: 13.5, fontWeight: 700 }}>{t('ov.nudge.title')}</div>
          {candidateIdeas.length > 0 ? (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {candidateIdeas.map((i) => (
                  <div
                    key={i.id}
                    style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, flexWrap: 'wrap' }}
                  >
                    <span style={{ fontWeight: 500 }}>{i.title || t('today.untitled')}</span>
                    <Pill kind="cluster">{CLUSTER_LABEL[i.cluster] || i.cluster}</Pill>
                  </div>
                ))}
              </div>
              <div>
                <Btn variant="accent" onClick={() => setTab('today')}>
                  {t('ov.nudge.cta')}
                </Btn>
              </div>
            </>
          ) : (
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 13, color: 'var(--text-2)' }}>{t('ov.nudge.empty')}</span>
              <Btn variant="accent" onClick={() => setTab('ideas')}>
                {t('ov.nudge.create')}
              </Btn>
            </div>
          )}
        </section>
      )}

      {/* KPI */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
        <Kpi label={t('ov.kpi.total')} value={nf(k.total)} />
        <Kpi
          label={t('ov.kpi.withMetrics')}
          value={nf(k.withMetrics)}
          sub={`${k.withMetricsPct}${t('ov.kpi.corpus')}`}
          tone="positive"
        />
        <Kpi label={t('ov.kpi.angles')} value={nf(k.angles)} />
        <Kpi label={t('ov.kpi.langs')} value={`${nf(k.ru)} / ${nf(k.en)}`} />
        <Kpi
          label={t('ov.kpi.medComments')}
          value={k.medComments == null ? '—' : nf(k.medComments)}
          sub={t('ov.kpi.medComments.sub')}
        />
        <Kpi label={t('ov.kpi.maxComments')} value={k.maxComments == null ? '—' : nf(k.maxComments)} />
        <Kpi label={t('ov.kpi.medEr')} value={k.medRatePct == null ? '—' : k.medRatePct} sub={t('ov.kpi.medEr.sub')} />
      </div>

      {/* Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 16 }}>
        <Panel title={t('ov.panel.clusters')}>
          <Bars
            caption={t('ov.panel.clusters.caption')}
            items={clusters.map((c) => ({
              label: c.label,
              value: c.count,
              onClick: () => setTab('explorer'),
            }))}
          />
        </Panel>

        <Panel title={t('ov.panel.lang')}>
          <Donut
            caption={t('ov.panel.lang.caption')}
            segments={[
              { label: 'RU', value: k.ru, color: 'var(--accent)' },
              { label: 'EN', value: k.en, color: 'var(--warning)' },
            ]}
          />
          <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 10 }}>{t('ov.panel.lang.note')}</div>
        </Panel>

        <Panel title={t('ov.panel.topC')}>
          <Bars
            caption={t('ov.panel.topC.caption')}
            color="var(--positive)"
            items={topC.map((p) => ({
              label: p.author,
              value: p.comments,
              onClick: () => openPost(p.id),
            }))}
          />
        </Panel>

        <Panel title={t('ov.panel.topR')}>
          <Bars
            caption={t('ov.panel.topR.caption')}
            color="var(--text-accent)"
            items={topR.map((p) => ({
              label: p.author,
              value: (p.rate as number) * 100,
              display: ((p.rate as number) * 100).toFixed(2) + '%',
              onClick: () => openPost(p.id),
            }))}
          />
          <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 10 }}>{t('ov.panel.topR.note')}</div>
        </Panel>

        <Panel title={t('ov.panel.months')}>
          <Bars caption={t('ov.panel.months.caption')} items={byMonth} />
        </Panel>
      </div>
    </div>
  );
}
