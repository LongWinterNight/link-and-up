import { useMemo, useState } from 'react';
import { useStore } from '@/store';
import { dataQuality, distributionBy, effectivenessBy } from '@/lib/derive';
import { CHART_PALETTE } from '@/lib/constants';
import { Bars, Donut, Scatter } from '@/components/charts';
import { EmptyState, Panel } from '@/components/ui';
import { Modal } from '@/components/Modal';
import EmptyCorpus from '@/components/EmptyCorpus';

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
  const posts = useStore((s) => s.posts);
  const openPost = useStore((s) => s.openPost);
  const [scatterZoom, setScatterZoom] = useState(false);

  const dq = useMemo(() => dataQuality(posts), [posts]);
  const byHook = useMemo(() => effectivenessBy(posts, 'hook_type'), [posts]);
  const byStruct = useMemo(() => effectivenessBy(posts, 'structure'), [posts]);
  const byCta = useMemo(() => effectivenessBy(posts, 'cta_type'), [posts]);
  const emotionDist = useMemo(() => distributionBy(posts, 'emotion'), [posts]);
  const scatter = useMemo(
    () => posts.filter((p) => p.has_metrics).map((p) => ({ x: p.reactions, y: p.comments, label: p.author, onClick: () => openPost(p.id) })),
    [posts, openPost],
  );

  const topInsight = byHook[0];

  if (posts.length === 0) {
    return <EmptyCorpus title="Нет данных для аналитики" hint="Загрузите свой корпус — здесь появятся эффективность хуков/структур/CTA, качество данных и корреляции. Или верните демо-корпус." />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {topInsight && (
        <div style={{ background: 'var(--accent-soft)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', padding: 14, fontSize: 13.5 }}>
          Сильнее всего заходит хук <strong>«{topInsight.label}»</strong> — в среднем <span className="num">{topInsight.avg}</span> комментариев ({topInsight.n} постов).
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 16 }}>
        <Panel title="Качество данных">
          <QualityBar label="Постов с метриками" pct={dq.metricsPct} />
          <QualityBar label="С распознанными подписчиками" pct={dq.followersPct} />
          <QualityBar label="С рассчитанным ER" pct={dq.ratePct} />
          <QualityBar label="С определённым кластером (не «Другое»)" pct={dq.clusteredPct} />
          <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 8 }}>Метрики вовлечения считаются только по постам с метриками (0 = неизвестно, не ноль).</div>
        </Panel>

        <Panel title="Эффективность по типу хука">
          <Bars caption="Средние комментарии по типу хука" color="var(--positive)" items={byHook.map((x) => ({ label: `${x.label} (${x.n})`, value: x.avg }))} />
        </Panel>

        <Panel title="Эффективность по структуре">
          <Bars caption="Средние комментарии по структуре" items={byStruct.map((x) => ({ label: `${x.label} (${x.n})`, value: x.avg }))} />
        </Panel>

        <Panel title="Эффективность по CTA">
          <Bars caption="Средние комментарии по CTA" color="var(--warning)" items={byCta.map((x) => ({ label: `${x.label} (${x.n})`, value: x.avg }))} />
        </Panel>

        <Panel title="Реакции ↔ комментарии">
          {scatter.length ? (
            <>
              {/* клик по графику или кнопке — увеличенная версия поверх экрана */}
              <div
                onClick={() => setScatterZoom(true)}
                style={{ cursor: 'zoom-in' }}
                title="Увеличить график"
              >
                <Scatter caption="Реакции против комментариев" points={scatter} />
              </div>
              <button
                type="button"
                onClick={() => setScatterZoom(true)}
                style={{ fontSize: 12, background: 'none', border: 'none', color: 'var(--text-accent)', cursor: 'pointer', padding: 0, marginTop: 6 }}
              >
                ⤢ Увеличить
              </button>
            </>
          ) : (
            <EmptyState>Нет постов с метриками</EmptyState>
          )}
        </Panel>

        <Panel title="Распределение по эмоции">
          <Donut caption="Посты по эмоции" segments={emotionDist.map((s, i) => ({ label: s.label, value: s.value, color: CHART_PALETTE[i % CHART_PALETTE.length] }))} />
        </Panel>
      </div>

      {/* увеличенный scatter поверх экрана; клик по точке открывает пост (PostModal выше по z) */}
      {scatterZoom && (
        <Modal onClose={() => setScatterZoom(false)} label="Реакции ↔ комментарии (увеличено)" width={1100} zIndex={40}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700 }}>Реакции ↔ комментарии</h2>
            <button type="button" onClick={() => setScatterZoom(false)} aria-label="Закрыть" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', color: 'var(--text-1)', fontSize: 18 }}>×</button>
          </div>
          <Scatter caption="Реакции против комментариев (увеличено)" points={scatter} width={1040} height={560} />
          <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 8 }}>
            Обе оси — логарифмические (вовлечение распределено лог-нормально). Клик по точке — открыть пост.
          </div>
        </Modal>
      )}
    </div>
  );
}
