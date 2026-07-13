// Визуальный обход всех вкладок (light+dark) для ручного ревью скриншотов.
// Использование: npm run build && npm run preview (порт 4173) → node scripts/visual-pass.mjs [outDir]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const URL = process.env.VP_URL || 'http://localhost:4173';
const OUT = process.argv[2] || 'visual-pass';
mkdirSync(OUT, { recursive: true });

const TABS = ['Сегодня', 'Обзор', 'Аналитика', 'Посты', 'Кластеры и знания', 'Идеи и контент-план', 'Прогноз'];

const browser = await chromium.launch();
for (const scheme of ['light', 'dark']) {
  const ctx = await browser.newContext({
    locale: 'ru-RU',
    viewport: { width: 1348, height: 900 },
    colorScheme: scheme,
  });
  const page = await ctx.newPage();
  await page.goto(URL, { waitUntil: 'networkidle' });
  const demoBtn = page.getByText('Изучить демо-корпус');
  if (await demoBtn.isVisible().catch(() => false)) {
    await demoBtn.click();
    await page.waitForTimeout(1200);
  }
  for (const tab of TABS) {
    await page.getByRole('tab', { name: tab }).click();
    await page.waitForTimeout(900);
    const slug = tab.split(' ')[0].toLowerCase();
    await page.screenshot({ path: `${OUT}/${scheme}-${slug}.png`, fullPage: true });
  }
  await ctx.close();
}
await browser.close();
console.log('visual pass done →', OUT);
