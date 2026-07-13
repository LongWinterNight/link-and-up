import { expect, test } from '@playwright/test';

/**
 * Б9: e2e-смоук главной петли — онбординг → демо → вкладки → идея в «Сегодня».
 * Смоук, не пиксели: скриншот-обход остаётся в scripts/visual-pass.mjs (ручное ревью).
 */

test('онбординг → демо-корпус → все вкладки живые', async ({ page }) => {
  await page.goto('/');

  // онбординг: путь «изучить демо»
  await page.getByRole('button', { name: /Изучить демо-корпус/ }).click();

  // «Сегодня» — дефолтный экран
  await expect(page.getByRole('heading', { name: 'Что публикуем сегодня' })).toBeVisible();

  // Обзор: KPI на демо-данных
  await page.getByRole('tab', { name: 'Обзор' }).click();
  await expect(page.getByText('Всего постов')).toBeVisible();

  // Посты: поиск и таблица/карточки
  await page.getByRole('tab', { name: 'Посты' }).click();
  const search = page.getByRole('searchbox', { name: 'Поиск постов' });
  await expect(search).toBeVisible();
  await search.fill('spec');
  await expect(page.getByText(/Показано/)).toBeVisible();

  // Аналитика
  await page.getByRole('tab', { name: 'Аналитика' }).click();
  await expect(page.getByText('Качество данных')).toBeVisible();

  // Кластеры: статистика + редактор NICHE-1
  await page.getByRole('tab', { name: 'Кластеры и знания' }).click();
  await expect(page.getByText('Кластеры тем (редактор)')).toBeVisible();

  // Прогноз: двухслойная панель точности (М51)
  await page.getByRole('tab', { name: 'Прогноз' }).click();
  await expect(page.getByText('Точность модели прогноза')).toBeVisible();
});

test('быстрая идея в «Сегодня» → черновик и диапазон оценки', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Изучить демо-корпус/ }).click();
  await expect(page.getByRole('heading', { name: 'Что публикуем сегодня' })).toBeVisible();

  // демо содержит идеи — выбор идеи и черновик уже на экране
  await expect(page.getByText('Черновик по формуле')).toBeVisible();
  await expect(page.getByText('Оценка вовлечения', { exact: false })).toBeVisible();

  // Б7: панель вариантов хука присутствует
  await expect(page.getByText('Варианты хука (сравнение)')).toBeVisible();
});

test('перезагрузка сохраняет состояние (IndexedDB persist)', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Изучить демо-корпус/ }).click();
  await expect(page.getByRole('heading', { name: 'Что публикуем сегодня' })).toBeVisible();

  // дождаться debounce-flush persist (300мс) и перезагрузить
  await page.waitForTimeout(700);
  await page.reload();

  // онбординг не должен показаться снова — сразу «Сегодня»
  await expect(page.getByRole('heading', { name: 'Что публикуем сегодня' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Изучить демо-корпус/ })).toHaveCount(0);
});
