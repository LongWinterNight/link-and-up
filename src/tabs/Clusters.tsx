import { useMemo } from 'react';
import { useStore } from '@/store';
import { clusterStats } from '@/lib/derive';
import { FORMULAS } from '@/lib/constants';
import { DEFAULT_RULES } from '@/lib/guardrails';
import { NICHE_PACKS } from '@/lib/nichePacks';
import { topByComments } from '@/lib/derive';
import { nf } from '@/lib/stats';
import { Panel } from '@/components/ui';
import { useClusterLabel, useT } from '@/i18n/useT';
import type { DictKey } from '@/i18n';

export default function Clusters() {
  const t = useT();
  const cl = useClusterLabel();
  const posts = useStore((s) => s.posts);
  const rules = useStore((s) => s.rules);
  const openPost = useStore((s) => s.openPost);
  const setTab = useStore((s) => s.setTab);
  const setFilters = useStore((s) => s.setFilters);
  // Б3: активные нишевые пакеты — их формулы/анти-паттерны показываются рядом с базовыми
  const activePacks = NICHE_PACKS.filter((p) => rules.some((r) => r.pack === p.id));

  const stats = useMemo(() => clusterStats(posts), [posts]);
  const exemplarsByCluster = useMemo(() => {
    const m = new Map<string, ReturnType<typeof topByComments>>();
    for (const s of stats)
      m.set(
        s.id,
        topByComments(
          posts.filter((p) => p.meta_cluster === s.id),
          4,
        ),
      );
    return m;
  }, [stats, posts]);

  const gotoCluster = (id: string) => {
    setFilters({ cluster: id });
    setTab('explorer');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Кластеры */}
      {posts.length === 0 ? (
        <Panel>
          <div style={{ fontSize: 13, color: 'var(--text-3)' }}>{t('cl.empty')}</div>
        </Panel>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 12 }}>
          {stats.map((s) => (
            <Panel key={s.id}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                <h3 style={{ fontSize: 14, fontWeight: 600 }}>{cl(s.id)}</h3>
                <button
                  type="button"
                  onClick={() => gotoCluster(s.id)}
                  style={{
                    fontSize: 12,
                    color: 'var(--text-accent)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  {s.count}
                  {t('cl.posts')}
                </button>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-3)', margin: '4px 0 10px' }}>
                {t('cl.stats.a')}
                {s.metricCount}
                {t('cl.stats.b')}
                <span className="num">{s.medComments == null ? '—' : nf(s.medComments)}</span>
                {t('cl.stats.c')}
                <span className="num">{s.maxComments == null ? '—' : nf(s.maxComments)}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {(exemplarsByCluster.get(s.id) || []).map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => openPost(p.id)}
                    style={{
                      textAlign: 'left',
                      background: 'var(--surface-2)',
                      border: '1px solid var(--border)',
                      borderRadius: 7,
                      padding: '6px 9px',
                      cursor: 'pointer',
                      color: 'inherit',
                      fontSize: 12.5,
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: 8,
                    }}
                  >
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {p.author}
                    </span>
                    <span className="num" style={{ flexShrink: 0, color: 'var(--text-2)' }}>
                      💬 {nf(p.comments)}
                    </span>
                  </button>
                ))}
              </div>
            </Panel>
          ))}
        </div>
      )}

      {/* Формулы победителей */}
      <Panel title={t('cl.formulas.title')}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
          {FORMULAS.map((f) => (
            <div
              key={f.id}
              style={{
                background: 'var(--surface-2)',
                border: '1px solid var(--border)',
                borderRadius: 10,
                padding: 12,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
                <strong style={{ fontSize: 13.5 }}>{t(('lbl.formula.' + f.id) as DictKey)}</strong>
                <button
                  type="button"
                  onClick={() => gotoCluster(f.cluster)}
                  style={{
                    fontSize: 11,
                    color: 'var(--text-accent)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {cl(f.cluster)} →
                </button>
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--text-2)' }}>
                {t(('lbl.formula.' + f.id + '.body') as DictKey)}
              </div>
            </div>
          ))}
          {activePacks.flatMap((pack) =>
            pack.formulas.map((f) => (
              <div
                key={f.id}
                style={{
                  background: 'var(--surface-2)',
                  border: '1px solid var(--accent)',
                  borderRadius: 10,
                  padding: 12,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
                  <strong style={{ fontSize: 13.5 }}>{f.title}</strong>
                  <span style={{ fontSize: 11, color: 'var(--text-accent)', whiteSpace: 'nowrap' }}>{pack.label}</span>
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--text-2)' }}>{f.body}</div>
              </div>
            )),
          )}
        </div>
        {activePacks.map((p) => (
          <div key={p.id} style={{ fontSize: 11.5, color: 'var(--warning)', marginTop: 8 }}>
            {p.label}: {p.disclaimer}
          </div>
        ))}
      </Panel>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
        <Panel title={t('cl.anti.title')}>
          <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {(['cl.anti.1', 'cl.anti.2', 'cl.anti.3', 'cl.anti.4'] as DictKey[]).map((k) => (
              <li key={k} style={{ fontSize: 13, color: 'var(--critical)' }}>
                {t(k)}
              </li>
            ))}
            {activePacks.flatMap((pack) =>
              pack.antipatterns.map((a, i) => (
                <li key={pack.id + i} style={{ fontSize: 13, color: 'var(--critical)' }}>
                  {a} <span style={{ color: 'var(--text-3)' }}>· {pack.label}</span>
                </li>
              )),
            )}
          </ul>
        </Panel>
        <Panel title={t('cl.guard.title')}>
          <div style={{ fontSize: 12.5, color: 'var(--text-3)', marginBottom: 8 }}>{t('cl.guard.note')}</div>
          <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {DEFAULT_RULES.map((r) => (
              <li
                key={r.id}
                style={{ fontSize: 13, color: r.severity === 'hard' ? 'var(--critical)' : 'var(--warning)' }}
              >
                {r.label} <span style={{ color: 'var(--text-3)' }}>· {r.severity}</span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <Panel title={t('cl.principles.title')}>
        <div style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6 }}>{t('cl.principles.body')}</div>
      </Panel>
    </div>
  );
}
