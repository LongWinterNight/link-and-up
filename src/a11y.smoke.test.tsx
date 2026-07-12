import { beforeAll, describe, expect, it, afterEach } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import axe from 'axe-core';
import { useStore } from '@/store';
import Overview from '@/tabs/Overview';
import SettingsModal from '@/components/SettingsModal';

afterEach(cleanup);

/**
 * Q-5: axe-smoke в jsdom. color-contrast и region отключены: первое jsdom не считает
 * (нет layout), второе — рендерим фрагменты без лендмарков. Полный аудит — Q-6 (Playwright).
 */
async function violations(container: HTMLElement) {
  const res = await axe.run(container, {
    rules: { 'color-contrast': { enabled: false }, region: { enabled: false } },
  });
  return res.violations
    .filter((v) => v.impact === 'critical' || v.impact === 'serious')
    .map((v) => v.id + ': ' + v.help);
}

beforeAll(async () => {
  await useStore.getState().loadDemo();
});

describe('a11y smoke (axe-core)', () => {
  it('Обзор: без critical/serious нарушений', async () => {
    const { container } = render(<Overview />);
    expect(await violations(container)).toEqual([]);
  });

  it('Настройки (гардрейл-редактор): без critical/serious нарушений', async () => {
    useStore.setState({ settingsOpen: true });
    const { container } = render(<SettingsModal />);
    expect(await violations(container)).toEqual([]);
    useStore.setState({ settingsOpen: false });
  });
});
