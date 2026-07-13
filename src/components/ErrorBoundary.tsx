import { Component, type ErrorInfo, type ReactNode } from 'react';

/**
 * М42 (Б10): ошибка рендера не должна ронять всё приложение и терять работу пользователя
 * (persist продолжает жить). Кольцевой лог последних 20 ошибок — локально, без телеметрии
 * (инвариант Governance); «Скопировать отчёт» — для ручной отправки при желании пользователя.
 */
const ERR_KEY = 'lidb_errors';

interface ErrEntry {
  t: string;
  msg: string;
  stack?: string;
}

export function readErrorLog(): ErrEntry[] {
  try {
    return JSON.parse(localStorage.getItem(ERR_KEY) || '[]');
  } catch {
    return [];
  }
}

function logError(err: unknown, info?: ErrorInfo) {
  try {
    const e: ErrEntry = {
      t: new Date().toISOString(),
      msg: err instanceof Error ? err.message : String(err),
      stack: ((err instanceof Error ? err.stack : '') || '').slice(0, 2000) + (info?.componentStack || '').slice(0, 1000),
    };
    const log = [e, ...readErrorLog()].slice(0, 20);
    localStorage.setItem(ERR_KEY, JSON.stringify(log));
  } catch {
    // логирование не должно порождать вторичных ошибок
  }
}

export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    logError(error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div role="alert" style={{ maxWidth: 560, margin: '48px auto', padding: 24, background: 'var(--surface-1)', border: '1px solid var(--critical)', borderRadius: 'var(--radius-card)' }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Что-то сломалось в интерфейсе</h2>
        <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.55, marginBottom: 6 }}>
          Ваши данные целы — они сохраняются локально независимо от интерфейса. Перезагрузите страницу;
          если повторится — скопируйте отчёт и приложите его к issue.
        </p>
        <pre style={{ fontSize: 11.5, color: 'var(--critical)', whiteSpace: 'pre-wrap', margin: '0 0 12px', maxHeight: 120, overflowY: 'auto' }}>{this.state.error.message}</pre>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" onClick={() => location.reload()} style={{ background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-ctl)', padding: '8px 14px', cursor: 'pointer', fontSize: 13 }}>
            Перезагрузить
          </button>
          <button
            type="button"
            onClick={() => navigator.clipboard?.writeText(JSON.stringify(readErrorLog(), null, 2))}
            style={{ background: 'var(--surface-2)', color: 'var(--text-1)', border: '1px solid var(--border)', borderRadius: 'var(--radius-ctl)', padding: '8px 14px', cursor: 'pointer', fontSize: 13 }}
          >
            Скопировать отчёт
          </button>
        </div>
      </div>
    );
  }
}
