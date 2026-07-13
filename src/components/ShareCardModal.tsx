import { useEffect, useState } from 'react';
import type { Post } from '@/types';
import { buildAltText, CARD_H, CARD_W, drawShareCard } from '@/lib/shareCard';
import { useStore } from '@/store';
import { useClusterLabel, useT } from '@/i18n/useT';
import { Btn } from './ui';
import { Modal } from './Modal';

/**
 * Б8 (P-4): consent-модал → локальная генерация PNG-карточки → скачивание + alt-текст.
 * Ничего не уходит с устройства; водяной знак обязателен; автопостинга нет.
 */
export default function ShareCardModal({ post, onClose }: { post: Post; onClose: () => void }) {
  const t = useT();
  const cl = useClusterLabel();
  const flash = useStore((s) => s.flash);
  const [url, setUrl] = useState<string | null>(null);
  const [alt, setAlt] = useState('');
  const [err, setErr] = useState('');

  // объектный URL освобождается при закрытии/перегенерации
  useEffect(
    () => () => {
      if (url) URL.revokeObjectURL(url);
    },
    [url],
  );

  const generate = async () => {
    setErr('');
    try {
      const blob = await drawShareCard(post, cl(post.meta_cluster));
      setUrl(URL.createObjectURL(blob));
      setAlt(buildAltText(post, cl(post.meta_cluster)));
    } catch (e) {
      setErr(t('sc.error') + (e as Error).message);
    }
  };

  return (
    <Modal onClose={onClose} label={t('sc.title')} width={720} zIndex={60}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700 }}>{t('sc.title')}</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label={t('an.modal.close')}
          style={{
            background: 'var(--surface-2)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            width: 32,
            height: 32,
            cursor: 'pointer',
            color: 'var(--text-1)',
            fontSize: 18,
          }}
        >
          ×
        </button>
      </div>

      {/* явный consent до генерации */}
      <div style={{ fontSize: 12.5, color: 'var(--text-2)', lineHeight: 1.55, marginBottom: 12 }}>
        {t('sc.consent')}
      </div>

      {!url ? (
        <Btn variant="accent" onClick={() => void generate()}>
          {t('sc.generate')}
        </Btn>
      ) : (
        <>
          <img
            src={url}
            alt={alt}
            style={{
              width: '100%',
              aspectRatio: `${CARD_W} / ${CARD_H}`,
              borderRadius: 8,
              border: '1px solid var(--border)',
              display: 'block',
            }}
          />
          <label style={{ display: 'block', fontSize: 11, color: 'var(--text-3)', marginTop: 10 }}>
            {t('sc.alt.label')}
            <textarea
              readOnly
              value={alt}
              rows={3}
              style={{
                width: '100%',
                marginTop: 4,
                background: 'var(--surface-2)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                padding: 8,
                color: 'var(--text-2)',
                fontSize: 12,
                resize: 'vertical',
              }}
            />
          </label>
          <div style={{ display: 'flex', gap: 8, marginTop: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            <Btn
              onClick={() => {
                navigator.clipboard?.writeText(alt);
                flash(t('sc.alt.copied'));
              }}
            >
              {t('sc.alt.copy')}
            </Btn>
            <Btn
              variant="accent"
              onClick={() => {
                const a = document.createElement('a');
                a.href = url;
                a.download = 'link-and-up-card-' + post.id + '.png';
                a.click();
              }}
            >
              {t('sc.download')}
            </Btn>
          </div>
        </>
      )}
      {err && <div style={{ color: 'var(--critical)', fontSize: 12.5, marginTop: 8 }}>{err}</div>}
    </Modal>
  );
}
