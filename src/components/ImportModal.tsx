import { useRef, useState } from 'react';
import { useStore } from '@/store';
import { MAX_IMPORT_BYTES, type IngestProgress } from '@/lib/dedup';
import { parseLinkedInShares } from '@/lib/linkedinImport';
import type { RawPost } from '@/types';
import { Btn, Input } from './ui';
import { Modal } from './Modal';

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
      setError(`Файл слишком большой (${(f.size / 1048576).toFixed(1)} МБ). Лимит ${MAX_IMPORT_BYTES / 1048576} МБ — разбейте на части.`);
      return;
    }
    const rd = new FileReader();
    rd.onload = () => onText(String(rd.result));
    rd.onerror = () => setError('Не удалось прочитать файл');
    rd.readAsText(f);
  };

  const doPreviewJson = () => {
    if (!text.trim()) {
      setError('Вставьте JSON или выберите файл');
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
          `Найдено записей: ${parsed.total}; с текстом: ${parsed.raws.length}; пропущено (репосты без текста): ${parsed.skipped}. ` +
            'Метрик в экспорте LinkedIn нет — они честно останутся «неизвестно», вносите факты в «Прогнозе».',
        );
        await previewImportRaws(parsed.raws, setProg, cancelRef.current);
      });
    });
    e.target.value = '';
  };

  const doPreviewSingle = () => {
    if (!sText.trim()) {
      setError('Текст поста обязателен');
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
    <Modal onClose={() => setOpen(false)} label="Загрузка постов" width={680} zIndex={55}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700 }}>Загрузить посты</h2>
          <button type="button" onClick={() => setOpen(false)} aria-label="Закрыть" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', color: 'var(--text-1)', fontSize: 18 }}>×</button>
        </div>

        {/* Б4/Б4b: режимы импорта */}
        <div role="group" aria-label="Способ загрузки" style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
          {(
            [
              ['json', 'JSON-массив'],
              ['linkedin', 'Экспорт LinkedIn (Shares.csv)'],
              ['single', 'Один пост-референс'],
            ] as [Mode, string][]
          ).map(([m, label]) => (
            <button key={m} type="button" onClick={() => switchMode(m)} aria-pressed={mode === m} style={{ ...seg, ...(mode === m ? { background: 'var(--surface-3)', color: 'var(--text-1)', fontWeight: 600 } : {}) }}>
              {label}
            </button>
          ))}
        </div>

        {mode === 'json' && (
          <>
            <div style={{ fontSize: 12.5, color: 'var(--text-3)', marginBottom: 10 }}>JSON-массив постов (та же схема, что датасет). Дубликаты и near-dup отсеиваются, невалидные записи отклоняются.</div>
            <input type="file" accept="application/json,.json" onChange={(e) => { const f = e.target.files?.[0]; if (f) readFile(f, (t) => { setText(t); clearImport(); }); e.target.value = ''; }} style={{ fontSize: 12.5, marginBottom: 10, color: 'var(--text-2)' }} aria-label="Выбрать JSON-файл" />
            <textarea
              value={text}
              onChange={(e) => { setText(e.target.value); clearImport(); }}
              placeholder="… или вставьте JSON сюда"
              rows={6}
              style={{ width: '100%', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, padding: 10, color: 'var(--text-1)', fontSize: 12.5, fontFamily: 'var(--mono)', resize: 'vertical' }}
            />
          </>
        )}

        {mode === 'linkedin' && (
          <>
            <div style={{ fontSize: 12.5, color: 'var(--text-2)', lineHeight: 1.55, marginBottom: 10 }}>
              Официальный экспорт ваших постов: LinkedIn → <b>Settings &amp; Privacy → Data privacy → Get a copy of your data</b> →
              отметьте <b>Posts / Shares</b> → архив придёт на почту (до 24 часов) → из архива нужен файл <b>Shares.csv</b>.
              Тексты и ссылки берутся из архива платформы — это проверяемые данные. Посты будут помечены как ваши (автор: «{ownAuthor}»).
            </div>
            <input type="file" accept=".csv,text/csv" onChange={onLinkedInFile} style={{ fontSize: 12.5, marginBottom: 6, color: 'var(--text-2)' }} aria-label="Выбрать Shares.csv" />
            {liInfo && <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 6 }}>{liInfo}</div>}
          </>
        )}

        {mode === 'single' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 12.5, color: 'var(--text-3)' }}>
              Клип-форма референса (Б4b): скопируйте текст открытого поста и видимые счётчики. Ссылку вставляйте только скопированную из адресной строки — реконструированные адреса не работают.
            </div>
            <Input label="Автор" id="clip-author" name="clip-author" autoComplete="off" value={sAuthor} onChange={(e) => setSAuthor(e.target.value)} />
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11, color: 'var(--text-3)' }}>
              Текст поста
              <textarea value={sText} onChange={(e) => setSText(e.target.value)} rows={5} style={{ width: '100%', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, padding: 10, color: 'var(--text-1)', fontSize: 12.5, resize: 'vertical' }} />
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <Input label="Реакции (пусто = неизвестно)" id="clip-reactions" name="clip-reactions" type="number" min={0} value={sReactions} onChange={(e) => setSReactions(e.target.value)} />
              <Input label="Комментарии (пусто = неизвестно)" id="clip-comments" name="clip-comments" type="number" min={0} value={sComments} onChange={(e) => setSComments(e.target.value)} />
            </div>
            <Input label="Ссылка (из адресной строки, необязательно)" id="clip-url" name="clip-url" autoComplete="off" value={sUrl} onChange={(e) => setSUrl(e.target.value)} />
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
            <Btn onClick={() => { cancelRef.current.cancelled = true; }}>Отменить</Btn>
          </div>
        )}

        {preview && (
          <div style={{ marginTop: 12, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, padding: 12, fontSize: 12.5 }}>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>Предпросмотр (без изменений):</div>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', color: 'var(--text-2)' }}>
              <span>всего: <span className="num">{preview.total}</span></span>
              <span style={{ color: 'var(--positive)' }}>будет добавлено: <span className="num">{preview.added}</span></span>
              <span>дублей: <span className="num">{preview.dupes}</span></span>
              <span>near-dup: <span className="num">{preview.nearDupes}</span></span>
              <span style={{ color: 'var(--critical)' }}>отклонено: <span className="num">{preview.rejected}</span></span>
            </div>
            {preview.reasons.length > 0 && (
              <ul style={{ margin: '8px 0 0', paddingLeft: 16, color: 'var(--text-3)', maxHeight: 120, overflowY: 'auto' }}>
                {preview.reasons.map((r, i) => <li key={i}>{r}</li>)}
                {preview.more > 0 && <li>…и ещё {preview.more}</li>}
              </ul>
            )}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 14 }}>
          <Btn onClick={() => setOpen(false)}>Отмена</Btn>
          {!preview ? (
            mode !== 'linkedin' && (
              <Btn variant="accent" disabled={!!prog} onClick={mode === 'json' ? doPreviewJson : doPreviewSingle}>
                Проверить
              </Btn>
            )
          ) : (
            <Btn variant="accent" disabled={preview.added === 0} onClick={() => { commitImport(); setText(''); setSText(''); }}>
              Подтвердить загрузку ({preview.added})
            </Btn>
          )}
        </div>
    </Modal>
  );
}
