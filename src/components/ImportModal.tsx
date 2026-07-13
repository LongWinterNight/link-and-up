import { useRef, useState } from 'react';
import { useStore } from '@/store';
import { MAX_IMPORT_BYTES, type IngestProgress } from '@/lib/dedup';
import { Btn } from './ui';
import { Modal } from './Modal';

export default function ImportModal() {
  const open = useStore((s) => s.importOpen);
  const setOpen = useStore((s) => s.setImportOpen);
  const preview = useStore((s) => s.importPreview);
  const previewImportChunked = useStore((s) => s.previewImportChunked);
  const commitImport = useStore((s) => s.commitImport);
  const clearImport = useStore((s) => s.clearImport);
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [prog, setProg] = useState<IngestProgress | null>(null);
  const cancelRef = useRef({ cancelled: false });

  if (!open) return null;

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    // SEC-4: кап размера файла до чтения — защита от зависания вкладки
    if (f.size > MAX_IMPORT_BYTES) {
      setError(`Файл слишком большой (${(f.size / 1048576).toFixed(1)} МБ). Лимит ${MAX_IMPORT_BYTES / 1048576} МБ — разбейте экспорт на части.`);
      return;
    }
    const rd = new FileReader();
    rd.onload = () => { setText(String(rd.result)); setError(''); clearImport(); };
    rd.onerror = () => setError('Не удалось прочитать файл');
    rd.readAsText(f);
  };

  const doPreview = async () => {
    if (!text.trim()) { setError('Вставьте JSON или выберите файл'); return; }
    setError('');
    cancelRef.current = { cancelled: false };
    setProg({ processed: 0, total: 0 });
    try {
      await previewImportChunked(text, setProg, cancelRef.current);
    } catch (e) {
      setError('Не удалось разобрать JSON: ' + (e as Error).message);
    } finally {
      setProg(null);
    }
  };

  return (
    <Modal onClose={() => setOpen(false)} label="Загрузка постов" width={680} zIndex={55}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700 }}>Загрузить посты</h2>
          <button type="button" onClick={() => setOpen(false)} aria-label="Закрыть" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', color: 'var(--text-1)', fontSize: 18 }}>×</button>
        </div>

        <div style={{ fontSize: 12.5, color: 'var(--text-3)', marginBottom: 10 }}>JSON-массив постов (та же схема, что датасет). Дубликаты и near-dup отсеиваются, невалидные записи отклоняются.</div>

        <input type="file" accept="application/json,.json" onChange={onFile} style={{ fontSize: 12.5, marginBottom: 10, color: 'var(--text-2)' }} aria-label="Выбрать JSON-файл" />
        <textarea
          value={text}
          onChange={(e) => { setText(e.target.value); clearImport(); }}
          placeholder="… или вставьте JSON сюда"
          rows={6}
          style={{ width: '100%', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, padding: 10, color: 'var(--text-1)', fontSize: 12.5, fontFamily: 'var(--mono)', resize: 'vertical' }}
        />

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
            <Btn variant="accent" disabled={!!prog} onClick={() => void doPreview()}>Проверить</Btn>
          ) : (
            <Btn variant="accent" disabled={preview.added === 0} onClick={() => { commitImport(); setText(''); }}>
              Подтвердить загрузку ({preview.added})
            </Btn>
          )}
        </div>
    </Modal>
  );
}
