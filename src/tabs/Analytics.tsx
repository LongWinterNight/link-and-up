import { useMemo, useState } from 'react';
import { useStore } from '@/store';
import { dataQuality, distributionBy, effectivenessBy } from '@/lib/derive';
import { CHART_PALETTE } from '@/lib/constants';
import { Bars, Donut, Scatter } from '@/components/charts';
import { EmptyState, Panel } from '@/components/ui';
import { Modal } from '@/components/Modal';
import EmptyCorpus from '@/components/EmptyCorpus';
import { useLbl, useT } from '@/i18n/useT';

function QualityBar({ label, pct }: { label: string; pct: number }) {
  const color = pct >= 60 ? 'var(--positive)' : pct >= 30 ? 'var(--warning)' : 'var(--critical)';
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, color: 'var(--text-2)', marginBottom: 4 }}>
        <span>{label}</span>
        <span className="num" style={{ color }}>{pct}%</span>
      </div>
      <div style={{ height: 8, background: 'var(--surface-2)', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ width: pct + '%', height: '100%', background: color }} />
      </div>
    </div>
  );
}

export default function Analytics() {
  const t = useT();
  const lbl = useLbl();
  const posts = useStore((s) => s.posts);
  const openPost = useStore((s) => s.openPost);
  const [scatterZoom, setScatterZoom] = useState(false);

  const dq = useMemo(() => dataQuality(posts), [posts]);
  const byHook = useMemo(() => effectivenessBy(posts, 'hook_type'), [posts]);
  const byStruct = useMemo(() => effectivenessBy(posts, 'structure'), [posts]);
  const byCta = useMemo(() => effectivenessBy(posts, 'cta_type'), [posts]);
  const emotionDist = useMemo(() => distributionBy(posts, 'emotion'), [posts]);
  const scatterAll = useMemo(
    () => posts.filter((p) => p.has_metrics).map((p) => ({ x: p.reactions, y: p.comments, label: p.author, onClick: () => openPost(p.id) })),
    [posts, openPost],
  );
  // SCALE-3: на тысячах постов SVG-точки — DOM-тормоза и перекрытие; берём стратифицированную
  // выборку по квантилям комментариев (каждая step-я из отсортированных) и честно подписываем.
  const sample = (limit: number) => {
    if (scatterAll.length <= limit) return scatterAll;
    const sorted = [...scatterAll].sort((a, b) => b.y - a.y);
    const step = Math.ceil(sorted.length / limit);
    return sorted.filter((_, i) => i % step === 0);
  };
  const scatter = useMemo(() => sample(1000), [scatterAll]); // eslint-disable-line react-hooks/exhaustive-deps
  const scatterZoomPts = useMemo(() => sample(3000), [scatterAll]); // eslint-disable-line react-hooks/exhaustive-deps
  const sampleNote = (shown: number) =>
    scatterAll.length > shown ? t('an.scatter.sample.a') + shown + t('an.scatter.sample.b') + scatterAll.length + t('an.scatter.sample.c') : '';

  const topInsight = byHook[0];

  if (posts.length === 0) {
    return <EmptyCorpus title={t('an.empty.title')} hint={t('an.empty.hint')} />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {topInsight && (
        <div style={{ background: 'var(--accent-soft)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', padding: 14, fontSize: 13.5 }}>
          {t('an.insight.a')}<strong>{lbl(topInsight.label)}</strong>{t('an.insight.b')}<span className="num">{topInsight.avg}</span>{t('an.insight.c')}{topInsight.n}{t('an.insight.d')}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 16 }}>
        <Panel title={t('an.quality.title')}>
          <QualityBar label={t('an.quality.metrics')} pct={dq.metricsPct} />
          <QualityBar label={t('an.quality.followers')} pct={dq.followersPct} />
          <QualityBar label={t('an.quality.er')} pct={dq.ratePct} />
          <QualityBar label={t('an.quality.cluster')} pct={dq.clusteredPct} />
          <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 8 }}>{t('an.quality.note')}</div>
        </Panel>

        <Panel title={t('an.hook.title')}>
          <Bars caption={t('an.hook.caption')} color="var(--positive)" items={byHook.map((x) => ({ label: `${lbl(x.label)} (${x.n})`, value: x.avg }))} />
        </Panel>

        <Panel title={t('an.struct.title')}>
          <Bars caption={t('an.struct.caption')} items={byStruct.map((x) => ({ label: `${lbl(x.label)} (${x.n})`, value: x.avg }))} />
        </Panel>

        <Panel title={t('an.cta.title')}>
          <Bars caption={t('an.cta.caption')} color="var(--warning)" items={byCta.map((x) => ({ label: `${lbl(x.label)} (${x.n})`, value: x.avg }))} />
        </Panel>

        <Panel title={t('an.scatter.title')}>
          {scatter.length ? (
            <>
              {/* клик по графику или кнопке — увеличенная версия поверх экрана */}
              <div
                onClick={() => setScatterZoom(true)}
                style={{ cursor: 'zoom-in' }}
                title={t('an.scatter.zoomTitle')}
              >
                <Scatter caption={t('an.scatter.caption')} points={scatter} />
              </div>
              <button
                type="button"
                onClick={() => setScatterZoom(true)}
                style={{ fontSize: 12, background: 'none', border: 'none', color: 'var(--text-accent)', cursor: 'pointer', padding: 0, marginTop: 6 }}
              >
                {t('an.scatter.zoom')}
              </button>
              {sampleNote(scatter.length) && <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>{sampleNote(scatter.length)}</div>}
            </>
          ) : (
            <EmptyState>{t('an.scatter.none')}</EmptyState>
          )}
        </Panel>

        <Panel title={t('an.emotion.title')}>
          <Donut caption={t('an.emotion.caption')} segments={emotionDist.map((s, i) => ({ label: lbl(s.label), value: s.value, color: CHART_PALETTE[i % CHART_PALETTE.length] }))} />
        </Panel>
      </div>

      {/* увеличенный scatter поверх экрана; клик по точке открывает пост (PostModal выше по z) */}
      {scatterZoom && (
        <Modal onClose={() => setScatterZoom(false)} label={t('an.scatter.zoomed')} width={1100} zIndex={40}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700 }}>{t('an.scatter.title')}</h2>
            <button type="button" onClick={() => setScatterZoom(false)} aria-label={t('an.modal.close')} style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', color: 'var(--text-1)', fontSize: 18 }}>×</button>
          </div>
          <Scatter caption={t('an.scatter.zoomed.caption')} points={scatterZoomPts} width={1040} height={560} />
          <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 8 }}>
            {t('an.scatter.lognote')}
            {sampleNote(scatterZoomPts.length) && ' ' + sampleNote(scatterZoomPts.length)}
          </div>
        </Modal>
      )}
    </div>
  );
}
