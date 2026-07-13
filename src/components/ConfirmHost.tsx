import { useStore } from '@/store';
import { useT } from '@/i18n/useT';
import { Modal } from './Modal';
import { Btn } from './ui';

/** М24: единый подтверждающий диалог вместо нативного confirm() — тема, i18n, focus-trap. */
export default function ConfirmHost() {
  const msg = useStore((s) => s.confirmMsg);
  const resolve = useStore((s) => s.resolveConfirm);
  const t = useT();
  if (msg == null) return null;
  return (
    <Modal onClose={() => resolve(false)} label={t('confirm.title')} width={460} zIndex={80}>
      <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>{t('confirm.title')}</h2>
      <p style={{ fontSize: 13.5, color: 'var(--text-2)', whiteSpace: 'pre-wrap', lineHeight: 1.55, margin: '0 0 16px' }}>{msg}</p>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <Btn onClick={() => resolve(false)}>{t('confirm.no')}</Btn>
        <Btn variant="accent" onClick={() => resolve(true)}>{t('confirm.yes')}</Btn>
      </div>
    </Modal>
  );
}
