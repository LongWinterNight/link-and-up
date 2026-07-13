import { useRef, useState } from 'react';
import { useStore } from '@/store';
import { MAX_IMPORT_BYTES, type IngestProgress } from '@/lib/dedup';
import { parseLinkedInShares } from '@/lib/linkedinImport';
import type { RawPost } from '@/types';
import { Btn, Input } from './ui';
import { Modal } from './Modal';
import { useT } from '@/i18n/useT';

type Mode = 'json' | 'linkedin' | 'single';

const seg: React.CSSProperties = {
  background: 'var(--surface-2)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-ctl)',
  padding: '6px 12px',
  cursor: 'pointer',
  color: 'var(--text-2)',
  fontSize: 12.5,
};

export default function ImportModal() {
  const t = useT();
  const open = useStore((s) => s.importOpen);
  const setOpen = useStore((s) => s.setImportOpen);
  const preview = useStore((s) => s.importPreview);
  const previewImportChunked = useStore((s) => s.previewImportChunked);
  const previewImportRaws = useStore((s) => s.previewImportRaws);
  const commitImport = useStore((s) => s.commitImport);
  const clearImport = useStore((s) => s.clearImport);
  const ownAuthor = useStore((s) => s.ownAuthor);

  const [mode, setMode] = useState<Mode>('json');
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [liInfo, setLiInfo] = useState('');
  const [prog, setProg] = useState<IngestProgress | null>(null);
  const cancelRef = useRef({ cancelled: false });

  // Б4b: клип-форма одного референса
  const [sAuthor, setSAuthor] = useState('');
  const [sText, setSText] = useState('');
  const [sReactions, setSReactions] = useState('');
  const [sComments, setSComments] = useState('');
  const [sUrl, setSUrl] = useState('');

  if (!open) return null;

  const switchMode = (m: Mode) => {
    setMode(m);
    setError('');
    setLiInfo('');
    clearImport();
  };

  const runPreview = async (fn: () => Promise<unknown>) => {
    setError('');
    cancelRef.current = { cancelled: false };
    setProg({ processed: 0, total: 0 });
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setProg(null);
    }
  };

  const readFile = (f: File, onText: (t: string) => void) => {
    if (f.size > MAX_IMPORT_BYTES) {
      setError(t('im.file.tooBig.a') + (f.size / 1048576).toFixed(1) + t('im.file.tooBig.b') + MAX_IMPORT_BYTES / 1048576 + t('im.file.tooBig.c'));
      return;
    }
    const rd = new FileReader();
    rd.onload = () => onText(String(rd.result));
    rd.onerror = () => setError(t('im.file.readErr'));
    rd.readAsText(f);
  };

  const doPreviewJson = () => {
    if (!text.trim()) {
      setError(t('im.json.empty'));
      return;
    }
    void runPreview(() => previewImportChunked(text, setProg, cancelRef.current));
  };

  const onLinkedInFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    readFile(f, (csv) => {
      void runPreview(async () => {
        // Б4: официальный self-export — реальные тексты и пермалинки из архива платформы
        const parsed = parseLinkedInShares(csv, ownAuthor);
        setLiInfo(
          t('im.li.info.a') + parsed.total + t('im.li.info.b') + parsed.raws.length + t('im.li.info.c') + parsed.skipped + t('im.li.info.d'),
        );
        await previewImportRaws(parsed.raws, setProg, cancelRef.current);
      });
    });
    e.target.value = '';
  };

  const doPreviewSingle = () => {
    if (!sText.trim()) {
      setError(t('im.single.textRequired'));
      return;
    }
    const raw: RawPost = {
      author: sAuthor.trim() || '—',
      headline: '',
      reactions: Number(sReactions) || 0,
      comments: Number(sComments) || 0,
      reposts: 0,
      text: sText.trim(),
      url: sUrl.trim(),
      collected_at: new Date().toISOString().slice(0, 10),
    };
    void runPreview(() => previewImportRaws([raw], setProg, cancelRef.current));
  };


  return (
    <Modal onClose={() => setOpen(false)} label={t('im.aria')} width={680} zIndex={55}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700 }}>{t('im.title')}</h2>
          <button type="button" onClick={() => setOpen(false)} aria-label={t('an.modal.close')} style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', color: 'var(--text-1)', fontSize: 18 }}>×</button>
        </div>

        {/* Б4/Б4b: режимы импорта */}
        <div role="group" aria-label={t('im.mode.aria')} style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
          {(
            [
              ['json', t('im.mode.json')],
              ['linkedin', t('im.mode.linkedin')],
              ['single', t('im.mode.single')],
            ] as [Mode, string][]
          ).map(([m, label]) => (
            <button key={m} type="button" onClick={() => switchMode(m)} aria-pressed={mode === m} style={{ ...seg, ...(mode === m ? { background: 'var(--surface-3)', color: 'var(--text-1)', fontWeight: 600 } : {}) }}>
              {label}
            </button>
          ))}
        </div>

        {mode === 'json' && (
          <>
            <div style={{ fontSize: 12.5, color: 'var(--text-3)', marginBottom: 10 }}>{t('im.json.hint')}</div>
            <input type="file" accept="application/json,.json" onChange={(e) => { const f = e.target.files?.[0]; if (f) readFile(f, (t) => { setText(t); clearImport(); }); e.target.value = ''; }} style={{ fontSize: 12.5, marginBottom: 10, color: 'var(--text-2)' }} aria-label={t('im.json.file.aria')} />
            <textarea
              value={text}
              onChange={(e) => { setText(e.target.value); clearImport(); }}
              placeholder={t('im.json.ph')}
              rows={6}
              style={{ width: '100%', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, padding: 10, color: 'var(--text-1)', fontSize: 12.5, fontFamily: 'var(--mono)', resize: 'vertical' }}
            />
          </>
        )}

        {mode === 'linkedin' && (
          <>
            <div style={{ fontSize: 12.5, color: 'var(--text-2)', lineHeight: 1.55, marginBottom: 10 }}>
              {t('im.li.h1')}<b>Settings &amp; Privacy → Data privacy → Get a copy of your data</b>{t('im.li.h2')}<b>Posts / Shares</b>{t('im.li.h3')}<b>Shares.csv</b>{t('im.li.h4')}{ownAuthor}{t('im.li.h5')}
            </div>
            <input type="file" accept=".csv,text/csv" onChange={onLinkedInFile} style={{ fontSize: 12.5, marginBottom: 6, color: 'var(--text-2)' }} aria-label={t('im.li.file.aria')} />
            {liInfo && <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 6 }}>{liInfo}</div>}
          </>
        )}

        {mode === 'single' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 12.5, color: 'var(--text-3)' }}>
              {t('im.single.hint')}
            </div>
            <Input label={t('im.single.author')} id="clip-author" name="clip-author" autoComplete="off" value={sAuthor} onChange={(e) => setSAuthor(e.target.value)} />
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11, color: 'var(--text-3)' }}>
              {t('im.single.text')}
              <textarea value={sText} onChange={(e) => setSText(e.target.value)} rows={5} style={{ width: '100%', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, padding: 10, color: 'var(--text-1)', fontSize: 12.5, resize: 'vertical' }} />
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <Input label={t('im.single.reactions')} id="clip-reactions" name="clip-reactions" type="number" min={0} value={sReactions} onChange={(e) => setSReactions(e.target.value)} />
              <Input label={t('im.single.comments')} id="clip-comments" name="clip-comments" type="number" min={0} value={sComments} onChange={(e) => setSComments(e.target.value)} />
            </div>
            <Input label={t('im.single.url')} id="clip-url" name="clip-url" autoComplete="off" value={sUrl} onChange={(e) => setSUrl(e.target.value)} />
          </div>
        )}

        {error && <div style={{ color: 'var(--critical)', fontSize: 12.5, marginTop: 8 }}>{error}</div>}

        {/* SCALE-9: прогресс проверки больших файлов + отмена */}
        {prog && (
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 10 }}>
            <div style={{ flex: 1, height: 8, background: 'var(--surface-2)', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ width: (prog.total ? Math.round((prog.processed / prog.total) * 100) : 0) + '%', height: '100%', background: 'var(--accent)' }} />
            </div>
            <span className="num" style={{ fontSize: 12, color: 'var(--text-3)', flexShrink: 0 }}>
              {prog.processed}/{prog.total || '…'}
            </span>
            <Btn onClick={() => { cancelRef.current.cancelled = true; }}>{t('im.progress.cancel')}</Btn>
          </div>
        )}

        {preview && (
          <div style={{ marginTop: 12, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, padding: 12, fontSize: 12.5 }}>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>{t('im.preview.title')}</div>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', color: 'var(--text-2)' }}>
              <span>{t('im.preview.total')}<span className="num">{preview.total}</span></span>
              <span style={{ color: 'var(--positive)' }}>{t('im.preview.added')}<span className="num">{preview.added}</span></span>
              <span>{t('im.preview.dupes')}<span className="num">{preview.dupes}</span></span>
              <span>{t('im.preview.near')}<span className="num">{preview.nearDupes}</span></span>
              <span style={{ color: 'var(--critical)' }}>{t('im.preview.rejected')}<span className="num">{preview.rejected}</span></span>
            </div>
            {preview.reasons.length > 0 && (
              <ul style={{ margin: '8px 0 0', paddingLeft: 16, color: 'var(--text-3)', maxHeight: 120, overflowY: 'auto' }}>
                {preview.reasons.map((r, i) => <li key={i}>{r}</li>)}
                {preview.more > 0 && <li>{t('im.preview.more')}{preview.more}</li>}
              </ul>
            )}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 14 }}>
          <Btn onClick={() => setOpen(false)}>{t('id.form.cancel')}</Btn>
          {!preview ? (
            mode !== 'linkedin' && (
              <Btn variant="accent" disabled={!!prog} onClick={mode === 'json' ? doPreviewJson : doPreviewSingle}>
                {t('im.check')}
              </Btn>
            )
          ) : (
            <Btn variant="accent" disabled={preview.added === 0} onClick={() => { commitImport(); setText(''); setSText(''); }}>
              {t('im.commit')}{preview.added})
            </Btn>
          )}
        </div>
    </Modal>
  );
}
