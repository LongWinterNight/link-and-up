import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const URL = 'https://link-and-up.vercel.app';
mkdirSync('docs', { recursive: true });
mkdirSync('public', { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({
  locale: 'ru-RU',
  viewport: { width: 1280, height: 800 },
  colorScheme: 'dark',
});
const page = await ctx.newPage();
await page.goto(URL, { waitUntil: 'networkidle' });

// онбординг: выбрать демо-корпус
const demoBtn = page.getByText('Изучить демо-корпус');
if (await demoBtn.isVisible().catch(() => false)) {
  await demoBtn.click();
  await page.waitForTimeout(1500);
}
// дождаться данных на «Сегодня»
await page.waitForTimeout(2000);
await page.screenshot({ path: 'docs/screenshot.png' });

// OG 1200×630 — вкладка «Обзор» (графики смотрятся лучше)
await page.setViewportSize({ width: 1200, height: 630 });
await page.getByRole('tab', { name: 'Обзор' }).click();
await page.waitForTimeout(1500);
await page.screenshot({ path: 'public/og.png' });

console.log('screenshots done');
await browser.close();
