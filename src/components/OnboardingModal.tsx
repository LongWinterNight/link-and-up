import { useEffect, useRef } from 'react';
import { useStore } from '@/store';
import { PRODUCT_NAME } from '@/lib/constants';
import { NICHES } from '@/lib/nichePacks';
import { Select } from './ui';
import { useT } from '@/i18n/useT';
import type { DictKey } from '@/i18n';

const card: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  textAlign: 'left',
  background: 'var(--surface-2)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-card)',
  padding: 18,
  cursor: 'pointer',
  color: 'inherit',
  width: '100%',
};

export default function OnboardingModal() {
  const onboarded = useStore((s) => s.onboarded);
  const posts = useStore((s) => s.posts);
  const complete = useStore((s) => s.completeOnboarding);
  const niche = useStore((s) => s.niche);
  const setNiche = useStore((s) => s.setNiche);
  const t = useT();
  const nichePicked = NICHES.find((n) => n.id === niche);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (onboarded) return;
    requestAnimationFrame(() => dialogRef.current?.querySelector<HTMLElement>('button')?.focus());
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || !dialogRef.current) return;
      const f = [...dialogRef.current.querySelectorAll<HTMLElement>('button')].filter((el) => el.offsetParent !== null);
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
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onboarded]);

  if (onboarded) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        zIndex: 70,
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="onb-title"
        style={{
          background: 'var(--surface-1)',
          border: '1px solid var(--border-strong)',
          borderRadius: 'var(--radius-card)',
          boxShadow: 'var(--shadow-modal)',
          width: 'min(640px,100%)',
          maxHeight: '88vh',
          overflowY: 'auto',
          padding: 24,
        }}
      >
        <h2 id="onb-title" style={{ fontSize: 20, fontWeight: 800, marginBottom: 6 }}>
          {t('onb.title')}
          {PRODUCT_NAME}
        </h2>
        <p style={{ fontSize: 13.5, color: 'var(--text-2)', lineHeight: 1.6, margin: '0 0 18px' }}>{t('onb.intro')}</p>

        <div style={{ display: 'grid', gap: 12 }}>
          <button type="button" style={card} onClick={() => complete('demo')}>
            <div style={{ fontSize: 15, fontWeight: 700 }}>{t('onb.demo.title')}</div>
            <div style={{ fontSize: 12.5, color: 'var(--text-3)', lineHeight: 1.5 }}>
              {posts.length > 0 ? `${posts.length}${t('onb.demo.loaded')}` : t('onb.demo.loading')}
              {t('onb.demo.rest')}
            </div>
          </button>

          <button type="button" style={card} onClick={() => complete('fresh')}>
            <div style={{ fontSize: 15, fontWeight: 700 }}>{t('onb.fresh.title')}</div>
            <div style={{ fontSize: 12.5, color: 'var(--text-3)', lineHeight: 1.5 }}>{t('onb.fresh.desc')}</div>
          </button>
        </div>

        {/* NICHE-2: выбор ниши — подключает пакет правил (если есть) и даёт сигнал спроса */}
        <div style={{ marginTop: 16 }}>
          <Select
            label={t('onb.niche.label')}
            id="onb-niche"
            name="onb-niche"
            value={niche || ''}
            onChange={(e) => setNiche(e.target.value)}
          >
            <option value="">{t('onb.niche.none')}</option>
            {NICHES.map((n) => (
              <option key={n.id} value={n.id}>
                {t(('niche.' + n.id) as DictKey)}
              </option>
            ))}
          </Select>
          {niche && (
            <div
              style={{ fontSize: 11.5, color: nichePicked?.packId ? 'var(--positive)' : 'var(--text-3)', marginTop: 6 }}
            >
              {nichePicked?.packId ? t('onb.niche.pack') : t('onb.niche.nopack')}
            </div>
          )}
        </div>

        <p style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 16 }}>{t('onb.footer')}</p>
      </div>
    </div>
  );
}
