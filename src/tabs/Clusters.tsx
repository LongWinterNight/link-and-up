import { useMemo } from 'react';
import { useStore } from '@/store';
import { clusterStats } from '@/lib/derive';
import { ANTIPATTERNS, CLUSTER_LABEL, FORMULAS } from '@/lib/constants';
import { DEFAULT_RULES } from '@/lib/guardrails';
import { topByComments } from '@/lib/derive';
import { nf } from '@/lib/stats';
import { Panel } from '@/components/ui';

export default function Clusters() {
  const posts = useStore((s) => s.posts);
  const openPost = useStore((s) => s.openPost);
  const setTab = useStore((s) => s.setTab);
  const setFilters = useStore((s) => s.setFilters);

  const stats = useMemo(() => clusterStats(posts), [posts]);
  const exemplarsByCluster = useMemo(() => {
    const m = new Map<string, ReturnType<typeof topByComments>>();
    for (const s of stats) m.set(s.id, topByComments(posts.filter((p) => p.meta_cluster === s.id), 4));
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
          <div style={{ fontSize: 13, color: 'var(--text-3)' }}>
            Статистика по кластерам появится после загрузки постов. Библиотека формул и анти-паттернов ниже доступна всегда.
          </div>
        </Panel>
      ) : (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 12 }}>
        {stats.map((s) => (
          <Panel key={s.id}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600 }}>{s.label}</h3>
              <button type="button" onClick={() => gotoCluster(s.id)} style={{ fontSize: 12, color: 'var(--text-accent)', background: 'none', border: 'none', cursor: 'pointer' }}>
                {s.count} постов →
              </button>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-3)', margin: '4px 0 10px' }}>
              с метриками: {s.metricCount} · медиана комм.: <span className="num">{s.medComments == null ? '—' : nf(s.medComments)}</span> · макс: <span className="num">{s.maxComments == null ? '—' : nf(s.maxComments)}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {(exemplarsByCluster.get(s.id) || []).map((p) => (
                <button key={p.id} type="button" onClick={() => openPost(p.id)} style={{ textAlign: 'left', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 7, padding: '6px 9px', cursor: 'pointer', color: 'inherit', fontSize: 12.5, display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.author}</span>
                  <span className="num" style={{ flexShrink: 0, color: 'var(--text-2)' }}>💬 {nf(p.comments)}</span>
                </button>
              ))}
            </div>
          </Panel>
        ))}
      </div>
      )}

      {/* Формулы победителей */}
      <Panel title="Формулы победителей">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
          {FORMULAS.map((f) => (
            <div key={f.id} style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10, padding: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
                <strong style={{ fontSize: 13.5 }}>{f.title}</strong>
                <button type="button" onClick={() => gotoCluster(f.cluster)} style={{ fontSize: 11, color: 'var(--text-accent)', background: 'none', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  {CLUSTER_LABEL[f.cluster]} →
                </button>
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--text-2)' }}>{f.body}</div>
            </div>
          ))}
        </div>
      </Panel>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
        <Panel title="Анти-паттерны">
          <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {ANTIPATTERNS.map((a, i) => (
              <li key={i} style={{ fontSize: 13, color: 'var(--critical)' }}>{a}</li>
            ))}
          </ul>
        </Panel>
        <Panel title="Гардрейлы (brand-safety)">
          <div style={{ fontSize: 12.5, color: 'var(--text-3)', marginBottom: 8 }}>Правила проверяют идеи и черновики. Жёсткие (hard) блокируют публикацию и экспорт. Настраиваются под ваш бренд.</div>
          <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {DEFAULT_RULES.map((r) => (
              <li key={r.id} style={{ fontSize: 13, color: r.severity === 'hard' ? 'var(--critical)' : 'var(--warning)' }}>
                {r.label} <span style={{ color: 'var(--text-3)' }}>· {r.severity}</span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <Panel title="Принципы продукта">
        <div style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6 }}>
          Честные метрики: 0 = неизвестно (не ноль), средние считаются только по постам с метриками.
          Прозрачный прогноз: пошаговое разложение + бэктест leave-one-out и честная неопределённость, без ложной точности.
          Гардрейлы: настраиваемые правила brand-safety; жёсткие блокируют публикацию и экспорт. Всё локально в браузере,
          данные не покидают устройство.
        </div>
      </Panel>
    </div>
  );
}
