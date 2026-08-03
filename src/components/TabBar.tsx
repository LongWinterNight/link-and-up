import { useStore, type TabId } from '@/store';
import { useT } from '@/i18n/useT';
import type { DictKey } from '@/i18n';

const TAB_IDS: TabId[] = ['today', 'overview', 'analytics', 'explorer', 'clusters', 'ideas', 'forecast'];

export default function TabBar() {
  const t = useT();
  const tab = useStore((s) => s.tab);
  const setTab = useStore((s) => s.setTab);

  return (
    <div
      className="no-print"
      style={{ borderBottom: '1px solid var(--border)', padding: '0 20px', background: 'var(--surface-0)' }}
    >
      <div
        role="tablist"
        aria-label={t('app.tabs.aria')}
        style={{ display: 'flex', gap: 4, overflowX: 'auto' }}
        onKeyDown={(e) => {
          if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft' && e.key !== 'Home' && e.key !== 'End') return;
          e.preventDefault();
          const idx = TAB_IDS.indexOf(tab);
          const next =
            e.key === 'ArrowRight'
              ? (idx + 1) % TAB_IDS.length
              : e.key === 'ArrowLeft'
                ? (idx - 1 + TAB_IDS.length) % TAB_IDS.length
                : e.key === 'Home'
                  ? 0
                  : TAB_IDS.length - 1;
          setTab(TAB_IDS[next]);
          e.currentTarget.querySelectorAll<HTMLElement>('[role="tab"]')[next]?.focus();
        }}
      >
        {TAB_IDS.map((id) => {
          const active = tab === id;
          return (
            <button
              key={id}
              id={'tab-' + id}
              role="tab"
              aria-selected={active}
              aria-controls="tabpanel"
              tabIndex={active ? 0 : -1}
              onClick={() => setTab(id)}
              style={{
                background: active ? 'var(--surface-3)' : 'transparent',
                border: `1px solid ${active ? 'var(--border-strong)' : 'transparent'}`,
                borderBottom: active ? '1px solid var(--surface-3)' : '1px solid transparent',
                color: active ? 'var(--text-1)' : 'var(--text-2)',
                borderRadius: '8px 8px 0 0',
                padding: '9px 16px',
                cursor: 'pointer',
                fontSize: 13.5,
                fontWeight: active ? 600 : 400,
                whiteSpace: 'nowrap',
              }}
            >
              {t(('tab.' + id) as DictKey)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
