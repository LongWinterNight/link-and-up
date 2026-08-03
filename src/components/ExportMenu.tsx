import { useEffect, useRef, useState } from 'react';
import { useStore } from '@/store';
import { download } from '@/lib/download';
import { exportPostsJson, exportPostsCsv, exportIdeasCsv, exportObsidian } from '@/lib/exports';
import { useClusterLabel, useExportLabels, useT } from '@/i18n/useT';
import type { DictKey } from '@/i18n';
import { hdrBtn } from './ui';

export default function ExportMenu() {
  const t = useT();
  const cl = useClusterLabel();
  const exportLabels = useExportLabels();
  const posts = useStore((s) => s.posts);
  const ideas = useStore((s) => s.ideas);
  const rules = useStore((s) => s.rules);
  const flash = useStore((s) => s.flash);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const items = () => [...(ref.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') || [])];
    requestAnimationFrame(() => items()[0]?.focus());
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        ref.current?.querySelector<HTMLElement>('button[aria-haspopup]')?.focus();
        return;
      }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const f = items();
        if (!f.length) return;
        const idx = f.indexOf(document.activeElement as HTMLElement);
        const next = e.key === 'ArrowDown' ? (idx + 1) % f.length : (idx - 1 + f.length) % f.length;
        f[next].focus();
      }
    };
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onDown);
    };
  }, [open]);

  const doExport = (kind: 'json' | 'csv' | 'ideas' | 'obsidian') => {
    setOpen(false);
    if (kind === 'json') {
      download('linkedin_baza.json', exportPostsJson(posts, rules));
      flash(t('toast.posts.exported') + posts.length);
    }
    if (kind === 'csv') {
      download('linkedin_baza.csv', exportPostsCsv(posts, rules, cl, exportLabels), 'text/csv;charset=utf-8');
      flash(t('toast.csv.exported'));
    }
    if (kind === 'ideas') {
      download('idei.csv', exportIdeasCsv(ideas, posts, rules, cl, exportLabels), 'text/csv;charset=utf-8');
      flash(t('toast.ideas.exported'));
    }
    if (kind === 'obsidian') {
      download('link-and-up-ideas.md', exportObsidian(ideas, rules, cl), 'text/markdown');
      flash(t('toast.md.exported'));
    }
  };

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button type="button" style={hdrBtn} onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-haspopup="menu">
        {t('app.export')}
      </button>
      {open && (
        <div
          role="menu"
          style={{
            position: 'absolute',
            right: 0,
            top: '110%',
            background: 'var(--surface-1)',
            border: '1px solid var(--border-strong)',
            borderRadius: 8,
            boxShadow: 'var(--shadow-modal)',
            minWidth: 200,
            zIndex: 30,
            overflow: 'hidden',
          }}
        >
          {(
            [
              ['json', 'app.export.json'],
              ['csv', 'app.export.csv'],
              ['ideas', 'app.export.ideas'],
              ['obsidian', 'app.export.obsidian'],
            ] as [string, DictKey][]
          ).map(([k, key]) => (
            <button
              key={k}
              role="menuitem"
              type="button"
              onClick={() => doExport(k as 'json')}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                background: 'none',
                border: 'none',
                padding: '9px 12px',
                cursor: 'pointer',
                color: 'var(--text-1)',
                fontSize: 13,
              }}
            >
              {t(key)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
