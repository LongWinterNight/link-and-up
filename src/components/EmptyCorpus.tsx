import { useStore } from '@/store';
import { Btn } from './ui';

/** Пустое состояние для нового пользователя, начавшего с чистого корпуса. */
export default function EmptyCorpus({ title, hint }: { title?: string; hint?: string }) {
  const setImportOpen = useStore((s) => s.setImportOpen);
  const reset = useStore((s) => s.reset);
  const readOnly = useStore((s) => s.readOnly);
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
      <div style={{ fontSize: 15, fontWeight: 700 }}>{title || 'Корпус пуст'}</div>
      <div style={{ fontSize: 13, color: 'var(--text-3)', maxWidth: 420, lineHeight: 1.55 }}>
        {hint || 'Загрузите свой экспорт постов (JSON-массив) — появится аналитика, паттерны и прогноз. Или вернитесь к демо-корпусу, чтобы посмотреть возможности на живых данных.'}
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginTop: 4 }}>
        {!readOnly && <Btn variant="accent" onClick={() => setImportOpen(true)}>Загрузить свои посты</Btn>}
        <Btn onClick={() => reset()}>Показать демо-корпус</Btn>
      </div>
    </div>
  );
}
