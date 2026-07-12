import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useStore, type TabId } from './store';
// FE-2: вкладки — ленивые чанки; на первом экране нужен только «Сегодня»
const Today = lazy(() => import('./tabs/Today'));
const Overview = lazy(() => import('./tabs/Overview'));
const Explorer = lazy(() => import('./tabs/Explorer'));
const Analytics = lazy(() => import('./tabs/Analytics'));
const Clusters = lazy(() => import('./tabs/Clusters'));
const Ideas = lazy(() => import('./tabs/Ideas'));
const Forecast = lazy(() => import('./tabs/Forecast'));
import PostModal from './components/PostModal';
import ImportModal from './components/ImportModal';
import SettingsModal from './components/SettingsModal';
import OnboardingModal from './components/OnboardingModal';
import PrintReport from './components/PrintReport';
import { download } from './lib/download';
import { setNumberLocale } from './lib/stats';
import { isPostingDay, ownPostsThisWeek } from './lib/derive';
import { exportPostsJson, exportPostsCsv, exportIdeasCsv, exportObsidian } from './lib/exports';
import { PRODUCT_NAME } from './lib/constants';
import { ensureLocale, intlLocale, type DictKey } from './i18n';
import { useT } from './i18n/useT';

const TAB_IDS: TabId[] = ['today', 'overview', 'analytics', 'explorer', 'clusters', 'ideas', 'forecast'];

const hdrBtn: React.CSSProperties = {
  background: 'var(--surface-2)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-ctl)',
  padding: '8px 12px',
  cursor: 'pointer',
  color: 'var(--text-1)',
  fontSize: 13,
};

export default function App() {
  const theme = useStore((s) => s.theme);
  const toggleTheme = useStore((s) => s.toggleTheme);
  const locale = useStore((s) => s.locale);
  const setLocale = useStore((s) => s.setLocale);
  const tab = useStore((s) => s.tab);
  const setTab = useStore((s) => s.setTab);
  const toast = useStore((s) => s.toast);
  const readOnly = useStore((s) => s.readOnly);
  const setReadOnly = useStore((s) => s.setReadOnly);
  const setImportOpen = useStore((s) => s.setImportOpen);
  const reset = useStore((s) => s.reset);
  const posts = useStore((s) => s.posts);
  const ideas = useStore((s) => s.ideas);
  const isDemo = useStore((s) => s.isDemo);
  const rules = useStore((s) => s.rules);
  const flash = useStore((s) => s.flash);
  const setSettingsOpen = useStore((s) => s.setSettingsOpen);
  const cadenceGoal = useStore((s) => s.cadenceGoal);
  const lastDeletedIdea = useStore((s) => s.lastDeletedIdea);
  const restoreLastIdea = useStore((s) => s.restoreLastIdea);
  const t = useT();
  const [exportOpen, setExportOpen] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  // FE-4: меню «Экспорт» — Escape, стрелки, клик-вне, автофокус первого пункта
  useEffect(() => {
    if (!exportOpen) return;
    const items = () => [...(exportRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') || [])];
    requestAnimationFrame(() => items()[0]?.focus());
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setExportOpen(false);
        exportRef.current?.querySelector<HTMLElement>('button[aria-haspopup]')?.focus();
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
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) setExportOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onDown);
    };
  }, [exportOpen]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  // FE-3: локаль — html lang, формат чисел, догрузка словаря (persist мог восстановить en)
  useEffect(() => {
    document.documentElement.lang = locale;
    setNumberLocale(intlLocale(locale));
    void ensureLocale(locale).then(() =>
      useStore.setState((s) => ({ i18nVersion: s.i18nVersion + 1 })),
    );
  }, [locale]);

  // FE-2: первый запуск (нет онбординга и нет персистентного корпуса) — демо грузится отдельным чанком
  useEffect(() => {
    const s = useStore.getState();
    if (!s.onboarded && s.posts.length === 0) void s.loadDemo();
  }, []);

  // М16: в день публикации title вкладки показывает прогресс каденса
  useEffect(() => {
    const base = PRODUCT_NAME + ' — ' + t('app.tagline');
    const n = ownPostsThisWeek(posts);
    document.title = isPostingDay() && n < cadenceGoal ? `(${n}/${cadenceGoal}) ${base}` : base;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [posts, cadenceGoal, locale]);

  const doExport = (kind: 'json' | 'csv' | 'ideas' | 'obsidian') => {
    setExportOpen(false);
    if (kind === 'json') { download('linkedin_baza.json', exportPostsJson(posts, rules)); flash(t('toast.posts.exported') + posts.length); }
    if (kind === 'csv') { download('linkedin_baza.csv', exportPostsCsv(posts, rules), 'text/csv;charset=utf-8'); flash(t('toast.csv.exported')); }
    if (kind === 'ideas') { download('idei.csv', exportIdeasCsv(ideas, posts, rules), 'text/csv;charset=utf-8'); flash(t('toast.ideas.exported')); }
    if (kind === 'obsidian') { download('link-and-up-ideas.md', exportObsidian(ideas, rules), 'text/markdown'); flash(t('toast.md.exported')); }
  };

  return (
    <div style={{ minHeight: '100%', display: 'flex', flexDirection: 'column' }}>
      <header
        className="no-print"
        style={{ position: 'sticky', top: 0, zIndex: 20, background: 'var(--surface-0)', borderBottom: '1px solid var(--border)', padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}
      >
        <h1 style={{ fontSize: 16, fontWeight: 700 }}>
          {PRODUCT_NAME}
          <span style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 400, marginLeft: 10 }}>{t('app.tagline')}</span>
        </h1>
        {isDemo && posts.length > 0 && <span title={t('app.demo.badge.title')} style={{ fontSize: 11, padding: '3px 10px', borderRadius: 'var(--radius-pill)', background: 'var(--accent-soft)', border: '1px solid var(--border)', color: 'var(--text-accent)' }}>{t('app.demo.badge')}</span>}
        {readOnly && <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 'var(--radius-pill)', background: 'var(--warning-soft)', border: '1px solid var(--border-warning)', color: 'var(--warning)' }}>{t('app.readonly.badge')}</span>}

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {!readOnly && <button type="button" style={hdrBtn} onClick={() => setImportOpen(true)}>{t('app.load')}</button>}
          <div ref={exportRef} style={{ position: 'relative' }}>
            <button type="button" style={hdrBtn} onClick={() => setExportOpen((v) => !v)} aria-expanded={exportOpen} aria-haspopup="menu">{t('app.export')}</button>
            {exportOpen && (
              <div role="menu" style={{ position: 'absolute', right: 0, top: '110%', background: 'var(--surface-1)', border: '1px solid var(--border-strong)', borderRadius: 8, boxShadow: 'var(--shadow-modal)', minWidth: 200, zIndex: 30, overflow: 'hidden' }}>
                {(
                  [
                    ['json', 'app.export.json'],
                    ['csv', 'app.export.csv'],
                    ['ideas', 'app.export.ideas'],
                    ['obsidian', 'app.export.obsidian'],
                  ] as [string, DictKey][]
                ).map(([k, key]) => (
                  <button key={k} role="menuitem" type="button" onClick={() => doExport(k as 'json')} style={{ display: 'block', width: '100%', textAlign: 'left', background: 'none', border: 'none', padding: '9px 12px', cursor: 'pointer', color: 'var(--text-1)', fontSize: 13 }}>
                    {t(key)}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button type="button" style={hdrBtn} onClick={() => window.print()}>{t('app.report')}</button>
          <button type="button" style={hdrBtn} onClick={() => setSettingsOpen(true)}>{t('app.settings')}</button>
          <button type="button" style={hdrBtn} onClick={() => setReadOnly(!readOnly)} aria-pressed={readOnly}>{readOnly ? t('app.readonly.off') : t('app.readonly.on')}</button>
          {!readOnly && <button type="button" style={hdrBtn} onClick={() => { if (confirm(t('app.reset.confirm'))) void reset(); }}>{t('app.reset')}</button>}
          <button type="button" style={hdrBtn} onClick={() => void setLocale(locale === 'ru' ? 'en' : 'ru')} aria-label={t('app.lang.aria')}>
            {locale === 'ru' ? 'EN' : 'RU'}
          </button>
          <button type="button" style={hdrBtn} onClick={toggleTheme} aria-label={t('app.theme.aria')}>{theme === 'dark' ? t('app.theme.dark') : t('app.theme.light')}</button>
        </div>
      </header>

      <div className="no-print" style={{ borderBottom: '1px solid var(--border)', padding: '0 20px', background: 'var(--surface-0)' }}>
        <div
          role="tablist"
          aria-label={t('app.tabs.aria')}
          style={{ display: 'flex', gap: 4, overflowX: 'auto' }}
          // FE-4: WAI-ARIA tabs — стрелки листают разделы, roving tabindex
          onKeyDown={(e) => {
            if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft' && e.key !== 'Home' && e.key !== 'End') return;
            e.preventDefault();
            const idx = TAB_IDS.indexOf(tab);
            const next =
              e.key === 'ArrowRight' ? (idx + 1) % TAB_IDS.length
              : e.key === 'ArrowLeft' ? (idx - 1 + TAB_IDS.length) % TAB_IDS.length
              : e.key === 'Home' ? 0
              : TAB_IDS.length - 1;
            setTab(TAB_IDS[next]);
            (e.currentTarget.querySelectorAll<HTMLElement>('[role="tab"]')[next])?.focus();
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
                style={{ background: active ? 'var(--surface-3)' : 'transparent', border: `1px solid ${active ? 'var(--border-strong)' : 'transparent'}`, borderBottom: active ? '1px solid var(--surface-3)' : '1px solid transparent', color: active ? 'var(--text-1)' : 'var(--text-2)', borderRadius: '8px 8px 0 0', padding: '9px 16px', cursor: 'pointer', fontSize: 13.5, fontWeight: active ? 600 : 400, whiteSpace: 'nowrap' }}
              >
                {t(('tab.' + id) as DictKey)}
              </button>
            );
          })}
        </div>
      </div>

      <main id="tabpanel" role="tabpanel" aria-labelledby={'tab-' + tab} className="no-print" style={{ flex: 1, maxWidth: 1240, width: '100%', margin: '0 auto', padding: 20 }}>
        <Suspense fallback={<div style={{ color: 'var(--text-3)', fontSize: 13, padding: 20 }}>{t('app.loading')}</div>}>
          {tab === 'today' && <Today />}
          {tab === 'overview' && <Overview />}
          {tab === 'analytics' && <Analytics />}
          {tab === 'explorer' && <Explorer />}
          {tab === 'clusters' && <Clusters />}
          {tab === 'ideas' && <Ideas />}
          {tab === 'forecast' && <Forecast />}
        </Suspense>
      </main>

      <PostModal />
      <ImportModal />
      <SettingsModal />
      <OnboardingModal />
      <PrintReport />

      {toast && (
        <div className="no-print" aria-live="polite" style={{ position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)', background: 'var(--surface-3)', border: '1px solid var(--border-strong)', borderRadius: 10, padding: '10px 16px', fontSize: 13, boxShadow: 'var(--shadow-modal)', zIndex: 60, display: 'flex', gap: 12, alignItems: 'center' }}>
          {toast}
          {/* М12: undo удаления идеи, пока тост на экране */}
          {lastDeletedIdea && (
            <button type="button" onClick={restoreLastIdea} style={{ background: 'none', border: 'none', color: 'var(--text-accent)', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
              {t('toast.undo')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
