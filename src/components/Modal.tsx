import { useEffect, useRef, type ReactNode } from 'react';

const FOCUSABLE = 'button,a[href],input,select,textarea,[tabindex]:not([tabindex="-1"])';

const CLOSE_BTN_STYLE: React.CSSProperties = {
  background: 'var(--surface-2)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  width: 32,
  height: 32,
  cursor: 'pointer',
  color: 'var(--text-1)',
  fontSize: 18,
  flexShrink: 0,
};

/**
 * Единый примитив модалки: оверлей + role="dialog" + focus-trap + Escape + автофокус +
 * возврат фокуса на триггер. Заменяет дублированные обёртки (WCAG 2.4.3 / no focus leak).
 */
export function Modal({
  onClose,
  label,
  labelledBy,
  title,
  titleNode,
  closeLabel,
  children,
  width = 720,
  closeOnOverlay = true,
  zIndex = 50,
}: {
  onClose: () => void;
  label?: string;
  labelledBy?: string;
  title?: string;
  titleNode?: ReactNode;
  closeLabel?: string;
  children: ReactNode;
  width?: number;
  closeOnOverlay?: boolean;
  zIndex?: number;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const lastFocus = useRef<Element | null>(null);
  const showHeader = title || titleNode;

  useEffect(() => {
    lastFocus.current = document.activeElement;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === 'Tab' && dialogRef.current) {
        const f = [...dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
          (el) => el.offsetParent !== null && !el.hasAttribute('disabled'),
        );
        if (!f.length) return;
        const first = f[0];
        const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    requestAnimationFrame(() => {
      const el = dialogRef.current?.querySelector<HTMLElement>('[data-autofocus],' + FOCUSABLE);
      el?.focus();
    });
    return () => {
      document.removeEventListener('keydown', onKey);
      (lastFocus.current as HTMLElement | null)?.focus?.();
    };
  }, [onClose]);

  return (
    <div
      onClick={closeOnOverlay ? onClose : undefined}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        zIndex,
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        aria-labelledby={labelledBy}
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--surface-1)',
          border: '1px solid var(--border-strong)',
          borderRadius: 'var(--radius-card)',
          boxShadow: 'var(--shadow-modal)',
          width: `min(${width}px, 100%)`,
          maxHeight: '88vh',
          overflowY: 'auto',
          padding: 20,
        }}
      >
        {showHeader && (
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: titleNode ? 'flex-start' : 'center',
              gap: titleNode ? 12 : undefined,
              marginBottom: 12,
            }}
          >
            {titleNode ? titleNode : <h2 style={{ fontSize: 16, fontWeight: 700 }}>{title}</h2>}
            <button type="button" onClick={onClose} aria-label={closeLabel} style={CLOSE_BTN_STYLE}>
              ×
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
