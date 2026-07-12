import type { CSSProperties, ReactNode } from 'react';

export function Panel({ children, style, title }: { children: ReactNode; style?: CSSProperties; title?: string }) {
  return (
    <section
      style={{
        background: 'var(--surface-1)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-card)',
        padding: 16,
        ...style,
      }}
    >
      {title && <SectionTitle>{title}</SectionTitle>}
      {children}
    </section>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 style={{ fontSize: 15, fontWeight: 600, margin: '0 0 12px' }}>{children}</h2>;
}

export function Kpi({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: 'positive' | 'warning' | 'critical' }) {
  const color = tone ? `var(--${tone})` : 'var(--text-1)';
  return (
    <div
      style={{
        background: 'var(--surface-1)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-card)',
        padding: '14px 16px',
      }}
    >
      <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 6 }}>{label}</div>
      <div className="num" style={{ fontSize: 26, fontWeight: 700, color, lineHeight: 1.1 }}>
        {value}
      </div>
      {sub != null && <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

export function Pill({ children, kind = 'lang' }: { children: ReactNode; kind?: 'lang' | 'metric' | 'nometric' | 'cluster' }) {
  const map = {
    lang: { bg: 'var(--surface-2)', bd: 'var(--border)', c: 'var(--text-2)' },
    metric: { bg: 'var(--positive-soft)', bd: 'var(--positive)', c: 'var(--positive)' },
    nometric: { bg: 'var(--warning-soft)', bd: 'var(--border-warning)', c: 'var(--warning)' },
    cluster: { bg: 'var(--accent-soft)', bd: 'var(--border)', c: 'var(--text-accent)' },
  } as const;
  const s = map[kind];
  return (
    <span
      style={{
        fontSize: 11,
        padding: '2px 9px',
        borderRadius: 'var(--radius-pill)',
        background: s.bg,
        border: `1px solid ${s.bd}`,
        color: s.c,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  );
}

export function Btn({
  children,
  onClick,
  variant = 'ghost',
  disabled,
  title,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'ghost' | 'accent';
  disabled?: boolean;
  title?: string;
}) {
  const accent = variant === 'accent';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        background: accent ? 'var(--accent)' : 'var(--surface-2)',
        color: accent ? '#fff' : 'var(--text-1)',
        border: `1px solid ${accent ? 'var(--accent)' : 'var(--border)'}`,
        borderRadius: 'var(--radius-ctl)',
        padding: '8px 13px',
        fontSize: 13,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {children}
    </button>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <div style={{ color: 'var(--text-3)', fontSize: 13, padding: '10px 0' }}>{children}</div>;
}
