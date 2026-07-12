import { lazy, Suspense, useEffect, useState } from 'react';
import { useStore, type TabId } from './store';
// FE-2: вкладки — ленивые чанки; на первом экране нужен только «Обзор»
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
import { exportPostsJson, exportPostsCsv, exportIdeasCsv, exportObsidian } from './lib/exports';
import { PRODUCT_NAME, PRODUCT_TAGLINE } from './lib/constants';

const TABS: [TabId, string][] = [
  ['overview', 'Обзор'],
  ['analytics', 'Аналитика'],
  ['explorer', 'Посты'],
  ['clusters', 'Кластеры и знания'],
  ['ideas', 'Идеи и контент-план'],
  ['forecast', 'Прогноз'],
];

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
  const [exportOpen, setExportOpen] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  // FE-2: первый запуск (нет онбординга и нет персистентного корпуса) — демо грузится отдельным чанком
  useEffect(() => {
    const s = useStore.getState();
    if (!s.onboarded && s.posts.length === 0) void s.loadDemo();
  }, []);

  const doExport = (kind: 'json' | 'csv' | 'ideas' | 'obsidian') => {
    setExportOpen(false);
    if (kind === 'json') { download('linkedin_baza.json', exportPostsJson(posts)); flash('Экспортировано постов: ' + posts.length); }
    if (kind === 'csv') { download('linkedin_baza.csv', exportPostsCsv(posts), 'text/csv;charset=utf-8'); flash('CSV экспортирован'); }
    if (kind === 'ideas') { download('idei.csv', exportIdeasCsv(ideas, posts, rules), 'text/csv;charset=utf-8'); flash('CSV идей экспортирован'); }
    if (kind === 'obsidian') { download('link-and-up-ideas.md', exportObsidian(ideas, rules), 'text/markdown'); flash('Markdown сформирован'); }
  };

  return (
    <div style={{ minHeight: '100%', display: 'flex', flexDirection: 'column' }}>
      <header
        className="no-print"
        style={{ position: 'sticky', top: 0, zIndex: 20, background: 'var(--surface-0)', borderBottom: '1px solid var(--border)', padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}
      >
        <h1 style={{ fontSize: 16, fontWeight: 700 }}>
          {PRODUCT_NAME}
          <span style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 400, marginLeft: 10 }}>{PRODUCT_TAGLINE}</span>
        </h1>
        {isDemo && posts.length > 0 && <span title="Демонстрационный корпус публичных постов. Загрузите свои — бейдж исчезнет." style={{ fontSize: 11, padding: '3px 10px', borderRadius: 'var(--radius-pill)', background: 'var(--accent-soft)', border: '1px solid var(--border)', color: 'var(--text-accent)' }}>демо-корпус</span>}
        {readOnly && <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 'var(--radius-pill)', background: 'var(--warning-soft)', border: '1px solid var(--border-warning)', color: 'var(--warning)' }}>только просмотр</span>}

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {!readOnly && <button type="button" style={hdrBtn} onClick={() => setImportOpen(true)}>Загрузить</button>}
          <div style={{ position: 'relative' }}>
            <button type="button" style={hdrBtn} onClick={() => setExportOpen((v) => !v)} aria-expanded={exportOpen} aria-haspopup="menu">Экспорт ▾</button>
            {exportOpen && (
              <div role="menu" style={{ position: 'absolute', right: 0, top: '110%', background: 'var(--surface-1)', border: '1px solid var(--border-strong)', borderRadius: 8, boxShadow: 'var(--shadow-modal)', minWidth: 200, zIndex: 30, overflow: 'hidden' }}>
                {[
                  ['json', 'Посты → JSON'],
                  ['csv', 'Посты → CSV'],
                  ['ideas', 'Идеи → CSV'],
                  ['obsidian', 'В Obsidian (.md, с редакцией)'],
                ].map(([k, l]) => (
                  <button key={k} role="menuitem" type="button" onClick={() => doExport(k as 'json')} style={{ display: 'block', width: '100%', textAlign: 'left', background: 'none', border: 'none', padding: '9px 12px', cursor: 'pointer', color: 'var(--text-1)', fontSize: 13 }}>
                    {l}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button type="button" style={hdrBtn} onClick={() => window.print()}>Отчёт недели</button>
          <button type="button" style={hdrBtn} onClick={() => setSettingsOpen(true)}>⚙ Настройки</button>
          <button type="button" style={hdrBtn} onClick={() => setReadOnly(!readOnly)} aria-pressed={readOnly}>{readOnly ? 'Выключить просмотр' : 'Только просмотр'}</button>
          {!readOnly && <button type="button" style={hdrBtn} onClick={() => { if (confirm('Сбросить к демо-корпусу (289 постов)? Идеи и факты будут потеряны.')) void reset(); }}>Сброс</button>}
          <button type="button" style={hdrBtn} onClick={toggleTheme} aria-label="Переключить тему">{theme === 'dark' ? '☾ Тёмная' : '☀ Светлая'}</button>
        </div>
      </header>

      <div className="no-print" style={{ borderBottom: '1px solid var(--border)', padding: '0 20px', background: 'var(--surface-0)' }}>
        <div role="tablist" aria-label="Разделы дашборда" style={{ display: 'flex', gap: 4, overflowX: 'auto' }}>
          {TABS.map(([id, label]) => {
            const active = tab === id;
            return (
              <button
                key={id}
                role="tab"
                aria-selected={active}
                onClick={() => setTab(id)}
                style={{ background: active ? 'var(--surface-3)' : 'transparent', border: `1px solid ${active ? 'var(--border-strong)' : 'transparent'}`, borderBottom: active ? '1px solid var(--surface-3)' : '1px solid transparent', color: active ? 'var(--text-1)' : 'var(--text-2)', borderRadius: '8px 8px 0 0', padding: '9px 16px', cursor: 'pointer', fontSize: 13.5, fontWeight: active ? 600 : 400, whiteSpace: 'nowrap' }}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <main className="no-print" style={{ flex: 1, maxWidth: 1240, width: '100%', margin: '0 auto', padding: 20 }}>
        <Suspense fallback={<div style={{ color: 'var(--text-3)', fontSize: 13, padding: 20 }}>Загрузка…</div>}>
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
        <div className="no-print" aria-live="polite" style={{ position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)', background: 'var(--surface-3)', border: '1px solid var(--border-strong)', borderRadius: 10, padding: '10px 16px', fontSize: 13, boxShadow: 'var(--shadow-modal)', zIndex: 60 }}>
          {toast}
        </div>
      )}
    </div>
  );
}
