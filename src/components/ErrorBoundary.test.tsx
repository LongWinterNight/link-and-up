import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { ErrorBoundary, readErrorLog } from './ErrorBoundary';

afterEach(cleanup);

function Bomb(): never {
  throw new Error('тестовый взрыв рендера');
}

describe('ErrorBoundary (М42)', () => {
  it('ловит ошибку рендера, показывает fallback и пишет в кольцевой лог', () => {
    localStorage.removeItem('lidb_errors');
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { container } = render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>,
    );
    spy.mockRestore();
    expect(container.textContent).toContain('Ваши данные целы');
    expect(container.textContent).toContain('тестовый взрыв рендера');
    const log = readErrorLog();
    expect(log.length).toBe(1);
    expect(log[0].msg).toBe('тестовый взрыв рендера');
  });

  it('без ошибки просто рендерит детей', () => {
    const { container } = render(
      <ErrorBoundary>
        <div>всё хорошо</div>
      </ErrorBoundary>,
    );
    expect(container.textContent).toBe('всё хорошо');
  });
});
