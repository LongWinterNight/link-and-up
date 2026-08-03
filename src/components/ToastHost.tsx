import { useStore } from '@/store';
import { useT } from '@/i18n/useT';

export default function ToastHost() {
  const t = useT();
  const toast = useStore((s) => s.toast);
  const lastDeletedIdea = useStore((s) => s.lastDeletedIdea);
  const restoreLastIdea = useStore((s) => s.restoreLastIdea);

  if (!toast) return null;

  return (
    <div
      className="no-print"
      role="status"
      style={{
        position: 'fixed',
        bottom: 20,
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'var(--surface-3)',
        border: '1px solid var(--border-strong)',
        borderRadius: 10,
        padding: '10px 16px',
        fontSize: 13,
        boxShadow: 'var(--shadow-modal)',
        zIndex: 60,
        display: 'flex',
        gap: 12,
        alignItems: 'center',
      }}
    >
      {toast}
      {lastDeletedIdea && (
        <button
          type="button"
          onClick={restoreLastIdea}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-accent)',
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          {t('toast.undo')}
        </button>
      )}
    </div>
  );
}
