import { useEffect, useRef } from 'react';
import { useStore } from '@/store';
import { PRODUCT_NAME } from '@/lib/constants';

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
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onboarded]);

  if (onboarded) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 70 }}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="onb-title"
        style={{ background: 'var(--surface-1)', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-card)', boxShadow: 'var(--shadow-modal)', width: 'min(640px,100%)', maxHeight: '88vh', overflowY: 'auto', padding: 24 }}
      >
        <h2 id="onb-title" style={{ fontSize: 20, fontWeight: 800, marginBottom: 6 }}>Добро пожаловать в {PRODUCT_NAME}</h2>
        <p style={{ fontSize: 13.5, color: 'var(--text-2)', lineHeight: 1.6, margin: '0 0 18px' }}>
          Инструмент превращает поток постов LinkedIn в решения: аналитика вовлечения, библиотека паттернов,
          контент-план, прозрачный прогноз и петля обучения на своих метриках. С чего начнём?
        </p>

        <div style={{ display: 'grid', gap: 12 }}>
          <button type="button" style={card} onClick={() => complete('demo')}>
            <div style={{ fontSize: 15, fontWeight: 700 }}>Изучить демо-корпус →</div>
            <div style={{ fontSize: 12.5, color: 'var(--text-3)', lineHeight: 1.5 }}>
              {posts.length} публичных постов (ниша AI/контент) уже загружены. Пройдитесь по вкладкам, посмотрите
              аналитику и прогноз на живых данных. Это демо — не привязано к конкретному человеку; свой корпус
              подключите в любой момент кнопкой «Загрузить».
            </div>
          </button>

          <button type="button" style={card} onClick={() => complete('fresh')}>
            <div style={{ fontSize: 15, fontWeight: 700 }}>Начать со своих постов →</div>
            <div style={{ fontSize: 12.5, color: 'var(--text-3)', lineHeight: 1.5 }}>
              Очистить демо и сразу загрузить свой экспорт (JSON-массив постов). Откроется окно импорта с
              предпросмотром и проверкой дублей. Данные хранятся локально в браузере.
            </div>
          </button>
        </div>

        <p style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 16 }}>
          Выбор можно поменять позже: «Сброс» вернёт демо, «Загрузить» — добавит ваши посты.
        </p>
      </div>
    </div>
  );
}
