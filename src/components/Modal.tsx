import { useEffect, useRef, type ReactNode } from 'react';

const FOCUSABLE = 'button,a[href],input,select,textarea,[tabindex]:not([tabindex="-1"])';

/**
 * Единый примитив модалки: оверлей + role="dialog" + focus-trap + Escape + автофокус +
 * возврат фокуса на триггер. Заменяет дублированные обёртки (WCAG 2.4.3 / no focus leak).
 */
export function Modal({
  onClose,
  label,
  labelledBy,
  children,
  width = 720,
  closeOnOverlay = true,
  zIndex = 50,
}: {
  onClose: () => void;
  label?: string;
  labelledBy?: string;
  children: ReactNode;
  width?: number;
  closeOnOverlay?: boolean;
  zIndex?: number;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const lastFocus = useRef<Element | null>(null);

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
        {children}
      </div>
    </div>
  );
}
