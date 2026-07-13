import { useMemo, useState } from 'react';
import { useStore } from '@/store';
import { clusterStats } from '@/lib/derive';
import { FORMULAS } from '@/lib/constants';
import { DEFAULT_RULES } from '@/lib/guardrails';
import { NICHE_PACKS } from '@/lib/nichePacks';
import { topByComments } from '@/lib/derive';
import { nf } from '@/lib/stats';
import { Btn, Input, Panel } from '@/components/ui';
import { useClusterLabel, useT } from '@/i18n/useT';
import type { DictKey } from '@/i18n';

/** NICHE-1: редактор кластеров тем — имя + видимые ключевые слова, без магии. */
function ClusterEditor() {
  const t = useT();
  const clusters = useStore((s) => s.clusters);
  const posts = useStore((s) => s.posts);
  const readOnly = useStore((s) => s.readOnly);
  const rebuildClusters = useStore((s) => s.rebuildClusters);
  const resetClusters = useStore((s) => s.resetClusters);
  const updateCluster = useStore((s) => s.updateCluster);
  const addCluster = useStore((s) => s.addCluster);
  const deleteCluster = useStore((s) => s.deleteCluster);
  const askConfirm = useStore((s) => s.askConfirm);
  const [newName, setNewName] = useState('');
  const [newKw, setNewKw] = useState('');

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of posts) m.set(p.meta_cluster, (m.get(p.meta_cluster) || 0) + 1);
    return m;
  }, [posts]);

  const parseKw = (s: string) =>
    s
      .split(',')
      .map((x) => x.trim().toLowerCase())
      .filter(Boolean)
      .slice(0, 20);

  const add = () => {
    const label = newName.trim();
    if (!label) return;
    addCluster({
      id: 'custom-' + Date.now(),
      label,
      keywords: parseKw(newKw),
    });
    setNewName('');
    setNewKw('');
  };

  return (
    <Panel title={t('nc.title')}>
      <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 10 }}>{t('nc.note')}</div>
      {!readOnly && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          <Btn
            variant="accent"
            disabled={posts.length < 10}
            onClick={() => {
              void askConfirm(t('nc.rebuild.confirm')).then((ok) => {
                if (ok) rebuildClusters();
              });
            }}
          >
            {t('nc.rebuild')}
          </Btn>
          <Btn
            onClick={() => {
              void askConfirm(t('nc.reset.confirm')).then((ok) => {
                if (ok) resetClusters();
              });
            }}
          >
            {t('nc.reset')}
          </Btn>
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {clusters.map((c) => (
          <div
            key={c.id}
            style={{
              display: 'flex',
              gap: 8,
              alignItems: 'center',
              flexWrap: 'wrap',
              padding: '6px 0',
              borderBottom: '1px solid var(--border)',
            }}
          >
            {c.builtin ? (
              <>
                <span style={{ fontSize: 13, fontWeight: 500, minWidth: 180 }}>
                  {c.id === 'other' ? c.label : c.label}
                </span>
                <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{t('nc.builtin')}</span>
              </>
            ) : (
              <>
                <input
                  value={c.label}
                  onChange={(e) => updateCluster(c.id, { label: e.target.value })}
                  aria-label={t('nc.name.aria') + c.id}
                  disabled={readOnly}
                  style={{
                    background: 'var(--surface-2)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-ctl)',
                    padding: '6px 8px',
                    color: 'var(--text-1)',
                    fontSize: 13,
                    width: 200,
                  }}
                />
                <input
                  value={c.keywords.join(', ')}
                  onChange={(e) => updateCluster(c.id, { keywords: parseKw(e.target.value) })}
                  placeholder={t('nc.kw.ph')}
                  aria-label={t('nc.kw.aria') + c.label}
                  disabled={readOnly}
                  style={{
                    background: 'var(--surface-2)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-ctl)',
                    padding: '6px 8px',
                    color: 'var(--text-2)',
                    fontSize: 12,
                    fontFamily: 'var(--mono)',
                    flex: 1,
                    minWidth: 220,
                  }}
                />
              </>
            )}
            <span className="num" style={{ fontSize: 12, color: 'var(--text-3)', marginLeft: 'auto' }}>
              {counts.get(c.id) || 0}
              {t('nc.posts')}
            </span>
            {!c.builtin && !readOnly && (
              <button
                type="button"
                onClick={() => deleteCluster(c.id)}
                aria-label={t('nc.del') + c.label}
                style={{
                  background: 'var(--surface-2)',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  width: 26,
                  height: 26,
                  cursor: 'pointer',
                  color: 'var(--critical)',
                  flexShrink: 0,
                }}
              >
                ×
              </button>
            )}
          </div>
        ))}
      </div>
      {!readOnly && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap', marginTop: 12 }}>
          <Input
            label={t('nc.add.name')}
            id="new-cluster-name"
            name="new-cluster-name"
            autoComplete="off"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <Input
            label={t('nc.kw.ph')}
            id="new-cluster-kw"
            name="new-cluster-kw"
            autoComplete="off"
            value={newKw}
            onChange={(e) => setNewKw(e.target.value)}
          />
          <Btn onClick={add} disabled={!newName.trim()}>
            {t('nc.add')}
          </Btn>
        </div>
      )}
    </Panel>
  );
}

export default function Clusters() {
  const t = useT();
  const cl = useClusterLabel();
  const posts = useStore((s) => s.posts);
  const rules = useStore((s) => s.rules);
  const openPost = useStore((s) => s.openPost);
  const setTab = useStore((s) => s.setTab);
  const setFilters = useStore((s) => s.setFilters);
  const clusterDefs = useStore((s) => s.clusters);
  // Б3: активные нишевые пакеты — их формулы/анти-паттерны показываются рядом с базовыми
  const activePacks = NICHE_PACKS.filter((p) => rules.some((r) => r.pack === p.id));

  const stats = useMemo(() => clusterStats(posts, clusterDefs), [posts, clusterDefs]);
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

      {/* NICHE-1: редактор кластеров тем */}
      <ClusterEditor />

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
