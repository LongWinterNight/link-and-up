import { lazy, Suspense, useEffect, useState } from 'react';
import { useStore } from './store';
// FE-2: вкладки — ленивые чанки; на первом экране нужен только «Сегодня»
const Today = lazy(() => import('./tabs/Today'));
const Overview = lazy(() => import('./tabs/Overview'));
const Explorer = lazy(() => import('./tabs/Explorer'));
const Analytics = lazy(() => import('./tabs/Analytics'));
const Clusters = lazy(() => import('./tabs/Clusters'));
const Ideas = lazy(() => import('./tabs/Ideas'));
const Forecast = lazy(() => import('./tabs/Forecast'));
import { ErrorBoundary } from './components/ErrorBoundary';
import ConfirmHost from './components/ConfirmHost';
import PostModal from './components/PostModal';
import ImportModal from './components/ImportModal';
import SettingsModal from './components/SettingsModal';
import OnboardingModal from './components/OnboardingModal';
import PrintReport from './components/PrintReport';
import ExportMenu from './components/ExportMenu';
import TabBar from './components/TabBar';
import ToastHost from './components/ToastHost';
import WorkspaceSwitcher from '@/components/WorkspaceSwitcher';
import { setNumberLocale } from './lib/stats';
import { isPostingDay, ownPostsThisWeek } from './lib/derive';
import { PRODUCT_NAME } from './lib/constants';
import { ensureLocale, intlLocale } from './i18n';
import { useT } from './i18n/useT';

import { hdrBtn } from './components/ui';

export default function App() {
  const theme = useStore((s) => s.theme);
  const toggleTheme = useStore((s) => s.toggleTheme);
  const locale = useStore((s) => s.locale);
  const setLocale = useStore((s) => s.setLocale);
  const tab = useStore((s) => s.tab);
  const readOnly = useStore((s) => s.readOnly);
  const setReadOnly = useStore((s) => s.setReadOnly);
  const setImportOpen = useStore((s) => s.setImportOpen);
  const reset = useStore((s) => s.reset);
  const posts = useStore((s) => s.posts);
  const isDemo = useStore((s) => s.isDemo);
  const setSettingsOpen = useStore((s) => s.setSettingsOpen);
  const cadenceGoal = useStore((s) => s.cadenceGoal);
  const askConfirm = useStore((s) => s.askConfirm);
  const t = useT();
  // SCALE-1: IndexedDB-гидратация асинхронна — до её конца не решаем «первый ли это запуск»
  const [hydrated, setHydrated] = useState(useStore.persist.hasHydrated());
  useEffect(() => useStore.persist.onFinishHydration(() => setHydrated(true)), []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  // FE-3: локаль — html lang, формат чисел, догрузка словаря (persist мог восстановить en)
  useEffect(() => {
    document.documentElement.lang = locale;
    setNumberLocale(intlLocale(locale));
    void ensureLocale(locale).then(() => useStore.setState((s) => ({ i18nVersion: s.i18nVersion + 1 })));
  }, [locale]);

  // FE-2: первый запуск (нет онбординга и нет персистентного корпуса) — демо грузится отдельным чанком
  useEffect(() => {
    if (!hydrated) return;
    const s = useStore.getState();
    if (!s.onboarded && s.posts.length === 0) void s.loadDemo();
  }, [hydrated]);

  // М16: в день публикации title вкладки показывает прогресс каденса
  useEffect(() => {
    const base = PRODUCT_NAME + ' — ' + t('app.tagline');
    const n = ownPostsThisWeek(posts);
    document.title = isPostingDay() && n < cadenceGoal ? `(${n}/${cadenceGoal}) ${base}` : base;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [posts, cadenceGoal, locale]);

  // до конца гидратации не показываем UI: иначе вернувшийся пользователь на миг увидит онбординг
  if (!hydrated) return <div style={{ minHeight: '100%' }} />;

  return (
    <div style={{ minHeight: '100%', display: 'flex', flexDirection: 'column' }}>
      <header
        className="no-print"
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 20,
          background: 'var(--surface-0)',
          borderBottom: '1px solid var(--border)',
          padding: '12px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <h1 style={{ fontSize: 16, fontWeight: 700 }}>
          {PRODUCT_NAME}
          <span style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 400, marginLeft: 10 }}>
            {t('app.tagline')}
          </span>
        </h1>
        {isDemo && posts.length > 0 && (
          <span
            title={t('app.demo.badge.title')}
            style={{
              fontSize: 11,
              padding: '3px 10px',
              borderRadius: 'var(--radius-pill)',
              background: 'var(--accent-soft)',
              border: '1px solid var(--border)',
              color: 'var(--text-accent)',
            }}
          >
            {t('app.demo.badge')}
          </span>
        )}
        {readOnly && (
          <span
            style={{
              fontSize: 11,
              padding: '3px 10px',
              borderRadius: 'var(--radius-pill)',
              background: 'var(--warning-soft)',
              border: '1px solid var(--border-warning)',
              color: 'var(--warning)',
            }}
          >
            {t('app.readonly.badge')}
          </span>
        )}

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {!readOnly && (
            <button type="button" style={hdrBtn} onClick={() => setImportOpen(true)}>
              {t('app.load')}
            </button>
          )}
          <ExportMenu />
          <button type="button" style={hdrBtn} onClick={() => window.print()}>
            {t('app.report')}
          </button>
          <WorkspaceSwitcher />
          <button type="button" style={hdrBtn} onClick={() => setSettingsOpen(true)}>
            {t('app.settings')}
          </button>
          <button type="button" style={hdrBtn} onClick={() => setReadOnly(!readOnly)} aria-pressed={readOnly}>
            {readOnly ? t('app.readonly.off') : t('app.readonly.on')}
          </button>
          {!readOnly && (
            <button
              type="button"
              style={hdrBtn}
              onClick={() => {
                void askConfirm(t('app.reset.confirm')).then((ok) => {
                  if (ok) void reset();
                });
              }}
            >
              {t('app.reset')}
            </button>
          )}
          <button
            type="button"
            style={hdrBtn}
            onClick={() => void setLocale(locale === 'ru' ? 'en' : 'ru')}
            aria-label={t('app.lang.aria')}
          >
            {locale === 'ru' ? 'EN' : 'RU'}
          </button>
          <button type="button" style={hdrBtn} onClick={toggleTheme} aria-label={t('app.theme.aria')}>
            {theme === 'dark' ? t('app.theme.dark') : t('app.theme.light')}
          </button>
        </div>
      </header>

      <TabBar />

      <main
        id="tabpanel"
        role="tabpanel"
        aria-labelledby={'tab-' + tab}
        className="no-print"
        style={{ flex: 1, maxWidth: 1240, width: '100%', margin: '0 auto', padding: 20 }}
      >
        <ErrorBoundary>
          <Suspense
            fallback={<div style={{ color: 'var(--text-3)', fontSize: 13, padding: 20 }}>{t('app.loading')}</div>}
          >
            {tab === 'today' && <Today />}
            {tab === 'overview' && <Overview />}
            {tab === 'analytics' && <Analytics />}
            {tab === 'explorer' && <Explorer />}
            {tab === 'clusters' && <Clusters />}
            {tab === 'ideas' && <Ideas />}
            {tab === 'forecast' && <Forecast />}
          </Suspense>
        </ErrorBoundary>
      </main>

      <PostModal />
      <ImportModal />
      <SettingsModal />
      <OnboardingModal />
      <ConfirmHost />
      <PrintReport />

      <ToastHost />
    </div>
  );
}
