import { nf } from '@/lib/stats';
import { EmptyState } from './ui';

export interface BarItem {
  label: string;
  value: number;
  display?: string;
  onClick?: () => void;
}

/** Горизонтальные бары. Доступно: sr-only таблица + aria на контейнере. */
export function Bars({ items, color = 'var(--accent)', caption }: { items: BarItem[]; color?: string; caption: string }) {
  if (!items.length) return <EmptyState>Нет данных</EmptyState>;
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <div>
      {/* контейнер без role="img": внутри интерактивные ряды (axe: nested-interactive);
          данные для скринридера — в sr-only таблице ниже */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {items.map((it, idx) => {
          const pct = Math.max(2, (it.value / max) * 100);
          const clickable = !!it.onClick;
          return (
            <div
              key={idx}
              role={clickable ? 'button' : undefined}
              tabIndex={clickable ? 0 : undefined}
              aria-label={clickable ? it.label + ': ' + (it.display ?? nf(it.value)) : undefined}
              onClick={it.onClick}
              onKeyDown={
                clickable
                  ? (e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        it.onClick!();
                      }
                    }
                  : undefined
              }
              title={it.label}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '3px 0', cursor: clickable ? 'pointer' : 'default' }}
            >
              <div style={{ width: 150, flexShrink: 0, fontSize: 12, color: 'var(--text-2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {it.label}
              </div>
              <div style={{ flex: 1, background: 'var(--surface-2)', borderRadius: 5, overflow: 'hidden', height: 16 }}>
                <div style={{ width: pct + '%', height: '100%', background: color, borderRadius: 5 }} />
              </div>
              <div className="num" style={{ width: 56, textAlign: 'right', fontSize: 12, color: 'var(--text-1)', flexShrink: 0 }}>
                {it.display != null ? it.display : nf(it.value)}
              </div>
            </div>
          );
        })}
      </div>
      <table className="sr-only">
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th>Категория</th>
            <th>Значение</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it, i) => (
            <tr key={i}>
              <td>{it.label}</td>
              <td>{it.display ?? nf(it.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export interface ScatterPoint {
  x: number;
  y: number;
  label: string;
  onClick?: () => void;
}

/**
 * Диаграмма рассеяния (реакции ↔ комментарии).
 * Лог-шкала по обеим осям: вовлечение распределено лог-нормально, на линейной шкале
 * выбросы сжимают 90% точек в слипшееся пятно у нуля. Тики — честные значения 1/10/100/1000.
 */
export function Scatter({ points, caption, width = 340, height = 220 }: { points: ScatterPoint[]; caption: string; width?: number; height?: number }) {
  if (!points.length) return <EmptyState>Нет данных</EmptyState>;
  const W = width;
  const H = height;
  const pad = 40;
  const lg = (v: number) => Math.log10(1 + Math.max(0, v));
  const rawMaxX = Math.max(1, ...points.map((p) => p.x));
  const rawMaxY = Math.max(1, ...points.map((p) => p.y));
  const maxLX = lg(rawMaxX);
  const maxLY = lg(rawMaxY);
  const sx = (x: number) => pad + (lg(x) / maxLX) * (W - pad - 12);
  const sy = (y: number) => H - pad - (lg(y) / maxLY) * (H - pad - 16);
  const ticks = (rawMax: number) => [1, 10, 100, 1000, 10000].filter((t) => t <= rawMax * 1.05);
  const r = Math.max(4, Math.min(6, Math.round(W / 90)));
  return (
    <>
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={caption} style={{ maxWidth: '100%', height: 'auto' }}>
      {/* сетка по лог-тикам */}
      {ticks(rawMaxX).map((t) => (
        <g key={'x' + t}>
          <line x1={sx(t)} y1={12} x2={sx(t)} y2={H - pad} stroke="var(--border)" strokeDasharray="2 3" />
          <text x={sx(t)} y={H - pad + 14} textAnchor="middle" fill="var(--text-3)" fontSize={9} className="num">{nf(t)}</text>
        </g>
      ))}
      {ticks(rawMaxY).map((t) => (
        <g key={'y' + t}>
          <line x1={pad} y1={sy(t)} x2={W - 8} y2={sy(t)} stroke="var(--border)" strokeDasharray="2 3" />
          <text x={pad - 4} y={sy(t) + 3} textAnchor="end" fill="var(--text-3)" fontSize={9} className="num">{nf(t)}</text>
        </g>
      ))}
      <line x1={pad} y1={H - pad} x2={W - 6} y2={H - pad} stroke="var(--border-strong)" />
      <line x1={pad} y1={8} x2={pad} y2={H - pad} stroke="var(--border-strong)" />
      <text x={W / 2} y={H - 4} textAnchor="middle" fill="var(--text-3)" fontSize={10}>реакции → (лог)</text>
      <text x={8} y={12} fill="var(--text-3)" fontSize={10}>↑ коммент. (лог)</text>
      {points.map((p, i) => (
        <circle key={i} cx={sx(p.x)} cy={sy(p.y)} r={r} fill="var(--accent)" fillOpacity={0.55} stroke="var(--surface-1)" strokeWidth={1} style={{ cursor: p.onClick ? 'pointer' : 'default' }} onClick={p.onClick}>
          <title>{p.label + ' · ♥' + p.x + ' 💬' + p.y}</title>
        </circle>
      ))}
    </svg>
      {/* FE-4: данные scatter доступны скринридеру, как у Bars/Donut */}
      <table className="sr-only">
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th>Автор</th>
            <th>Реакции</th>
            <th>Комментарии</th>
          </tr>
        </thead>
        <tbody>
          {points.map((p, i) => (
            <tr key={i}>
              <td>{p.label}</td>
              <td>{p.x}</td>
              <td>{p.y}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

export interface Segment {
  label: string;
  value: number;
  color: string;
}

/** Кольцевая диаграмма с легендой и sr-only таблицей. */
export function Donut({ segments, caption }: { segments: Segment[]; caption: string }) {
  const total = segments.reduce((a, s) => a + s.value, 0) || 1;
  const r = 54;
  const sw = 20;
  const c = 2 * Math.PI * r;
  // офсеты сегментов считаются заранее (чистый рендер, без мутации аккумулятора)
  const visible = segments.filter((s) => s.value > 0);
  const arcs = visible.map((s, i) => {
    const len = (s.value / total) * c;
    const offset = visible.slice(0, i).reduce((a, x) => a + (x.value / total) * c, 0);
    return { ...s, len, offset };
  });
  return (
    <div style={{ display: 'flex', gap: 18, alignItems: 'center', flexWrap: 'wrap' }}>
      <svg width={140} height={140} viewBox="0 0 140 140" role="img" aria-label={caption + ': ' + segments.map((s) => s.label + ' ' + s.value).join(', ')}>
        <circle cx={70} cy={70} r={r} fill="none" stroke="var(--surface-2)" strokeWidth={sw} />
        <g transform="rotate(-90 70 70)">
          {arcs.map((s, i) => (
            <circle key={i} cx={70} cy={70} r={r} fill="none" stroke={s.color} strokeWidth={sw} strokeLinecap="butt" strokeDasharray={`${s.len} ${c - s.len}`} strokeDashoffset={-s.offset} />
          ))}
        </g>
        <text x={70} y={70} textAnchor="middle" dominantBaseline="central" fill="var(--text-1)" fontSize={26} fontWeight={700} fontFamily="var(--mono)">
          {total}
        </text>
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7, fontSize: 12.5, flex: 1, minWidth: 160 }}>
        {segments.map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 11, height: 11, borderRadius: 3, background: s.color, flexShrink: 0 }} />
            <span style={{ color: 'var(--text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.label}</span>
            <span className="num" style={{ marginLeft: 'auto', color: 'var(--text-1)', flexShrink: 0 }}>
              {s.value} · {Math.round((s.value / total) * 100)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
