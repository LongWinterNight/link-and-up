import { defineConfig, devices } from '@playwright/test';

/**
 * Б9: e2e-смоук по прод-сборке (vite preview поверх dist — CSP и чанки как в проде).
 * Локаль ru-RU — иначе detectLocale переключит UI на EN и селекторы разъедутся.
 */
export default defineConfig({
  testDir: 'e2e',
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    ...devices['Desktop Chrome'],
    baseURL: 'http://localhost:4173',
    locale: 'ru-RU',
  },
  webServer: {
    command: 'npm run preview -- --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
