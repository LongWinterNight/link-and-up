import { useStore } from '@/store';
import { useT } from '@/i18n/useT';
import { Btn } from './ui';

/** Пустое состояние для нового пользователя, начавшего с чистого корпуса. */
export default function EmptyCorpus({ title, hint }: { title?: string; hint?: string }) {
  const setImportOpen = useStore((s) => s.setImportOpen);
  const reset = useStore((s) => s.reset);
  const readOnly = useStore((s) => s.readOnly);
  const t = useT();
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 12,
        textAlign: 'center',
        background: 'var(--surface-1)',
        border: '1px dashed var(--border-strong)',
        borderRadius: 'var(--radius-card)',
        padding: '40px 24px',
      }}
    >
      <div style={{ fontSize: 15, fontWeight: 700 }}>{title || t('empty.title')}</div>
      <div style={{ fontSize: 13, color: 'var(--text-3)', maxWidth: 420, lineHeight: 1.55 }}>
        {hint || t('empty.hint')}
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginTop: 4 }}>
        {!readOnly && <Btn variant="accent" onClick={() => setImportOpen(true)}>{t('empty.cta.import')}</Btn>}
        <Btn onClick={() => void reset()}>{t('empty.cta.demo')}</Btn>
      </div>
    </div>
  );
}
