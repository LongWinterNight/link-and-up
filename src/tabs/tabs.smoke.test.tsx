import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useStore, DEFAULT_FILTERS } from '@/store';
import { DEFAULT_RULES } from '@/lib/guardrails';
import Today from './Today';
import Overview from './Overview';
import Explorer from './Explorer';
import Analytics from './Analytics';
import Clusters from './Clusters';
import Ideas from './Ideas';
import Forecast from './Forecast';
import SettingsModal from '@/components/SettingsModal';

beforeEach(() => {
  act(() =>
    useStore.setState({
      posts: [],
      ideas: [],
      onboarded: true,
      isDemo: false,
      search: '',
      filters: { ...DEFAULT_FILTERS },
      presets: [],
      readOnly: false,
      calibration: 1,
      calibrationCount: 0,
      rules: DEFAULT_RULES.map((r) => ({ ...r })),
      settingsOpen: false,
    }),
  );
});
afterEach(cleanup);

describe('Q-4: вкладки на пустом корпусе (fresh-путь)', () => {
  it('Сегодня / Обзор / Посты / Аналитика показывают EmptyCorpus с CTA', () => {
    for (const C of [Today, Overview, Explorer, Analytics]) {
      const { container, unmount } = render(<C />);
      expect(container.textContent).toContain('Загрузить свои посты');
      unmount();
    }
  });

  it('Кластеры: библиотека формул доступна и без корпуса', () => {
    const { container } = render(<Clusters />);
    expect(container.textContent).toContain('Статистика по кластерам появится');
    expect(container.textContent).toContain('Формулы победителей');
  });

  it('Идеи: пустое состояние со смыслом', () => {
    const { container } = render(<Ideas />);
    expect(container.textContent).toContain('Пока нет идей');
  });

  it('Прогноз: рендерится на пустых данных без падений', () => {
    const { container } = render(<Forecast />);
    expect(container.textContent).toContain('бэктест');
  });
});

describe('Q-4: гардрейл-редактор (фича ICP)', () => {
  const openSettings = () => {
    act(() => useStore.setState({ settingsOpen: true }));
    return render(<SettingsModal />);
  };

  it('битый regex не добавляет правило и показывает ошибку', () => {
    openSettings();
    const before = useStore.getState().rules.length;
    fireEvent.change(screen.getByLabelText('Название правила'), { target: { value: 'Тест' } });
    fireEvent.change(screen.getByLabelText('Паттерн'), { target: { value: '(' } });
    fireEvent.click(screen.getByText('Добавить правило'));
    expect(useStore.getState().rules.length).toBe(before);
    expect(screen.getByText(/Некорректное регулярное/)).toBeTruthy();
  });

  it('ReDoS-паттерн (a+)+ отклоняется с объяснением', () => {
    openSettings();
    const before = useStore.getState().rules.length;
    fireEvent.change(screen.getByLabelText('Название правила'), { target: { value: 'Опасное' } });
    fireEvent.change(screen.getByLabelText('Паттерн'), { target: { value: '(a+)+' } });
    fireEvent.click(screen.getByText('Добавить правило'));
    expect(useStore.getState().rules.length).toBe(before);
    expect(screen.getByText(/ReDoS/)).toBeTruthy();
  });

  it('валидное правило добавляется', () => {
    openSettings();
    const before = useStore.getState().rules.length;
    fireEvent.change(screen.getByLabelText('Название правила'), { target: { value: 'NDA' } });
    fireEvent.change(screen.getByLabelText('Паттерн'), { target: { value: 'секретныйтермин' } });
    fireEvent.click(screen.getByText('Добавить правило'));
    expect(useStore.getState().rules.length).toBe(before + 1);
  });
});

describe('Q-4 / P-1: «Сегодня» на данных', () => {
  it('с корпусом и идеями собирает черновик, диапазон и гардрейл-статус', async () => {
    await act(async () => {
      await useStore.getState().loadDemo();
    });
    const { container } = render(<Today />);
    expect(container.textContent).toContain('Что публикуем сегодня');
    expect(container.textContent).toContain('Черновик по формуле');
    expect(container.textContent).toContain('Оценка вовлечения');
    expect(container.textContent).toMatch(/Гардрейлы/);
  });
});
