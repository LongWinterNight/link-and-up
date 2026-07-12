import { describe, expect, it, vi, afterEach } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/react';
import { Modal } from './Modal';

afterEach(cleanup);

describe('Modal (FE-1: единый примитив)', () => {
  it('рендерит содержимое и role=dialog c aria-label', () => {
    const { getByRole, getByText } = render(
      <Modal onClose={() => {}} label="Тест"><button>Внутри</button></Modal>,
    );
    const dlg = getByRole('dialog');
    expect(dlg.getAttribute('aria-label')).toBe('Тест');
    expect(getByText('Внутри')).toBeTruthy();
  });

  it('Escape вызывает onClose', () => {
    const onClose = vi.fn();
    render(<Modal onClose={onClose} label="Тест"><button>x</button></Modal>);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('клик по оверлею вызывает onClose, клик по диалогу — нет', () => {
    const onClose = vi.fn();
    const { getByRole } = render(<Modal onClose={onClose} label="Тест"><button>x</button></Modal>);
    const dlg = getByRole('dialog');
    fireEvent.click(dlg); // внутренний контейнер — не закрывает
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(dlg.parentElement as HTMLElement); // оверлей — закрывает
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closeOnOverlay=false — клик по оверлею не закрывает', () => {
    const onClose = vi.fn();
    const { getByRole } = render(<Modal onClose={onClose} label="Тест" closeOnOverlay={false}><button>x</button></Modal>);
    fireEvent.click(getByRole('dialog').parentElement as HTMLElement);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('возвращает фокус на триггер после размонтирования', () => {
    const trigger = document.createElement('button');
    document.body.appendChild(trigger);
    trigger.focus();
    expect(document.activeElement).toBe(trigger);
    const { unmount } = render(<Modal onClose={() => {}} label="Тест"><button>x</button></Modal>);
    unmount();
    expect(document.activeElement).toBe(trigger);
    trigger.remove();
  });
});
