/// <reference types="vitest/config" />
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

/** SEC-5: строгий CSP только в прод-сборке (dev-режиму нужны inline-скрипты Vite/HMR). */
const cspPlugin = () => ({
  name: 'html-csp',
  apply: 'build' as const,
  transformIndexHtml(html: string) {
    const csp = [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline'", // инлайн-стили React (style-атрибуты)
      "img-src 'self' data:",
      "font-src 'self'",
      "connect-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      // frame-ancestors в <meta> игнорируется браузером (шумит в консоли) — доставляется HTTP-заголовком (vercel.json)
    ].join('; ');
    return html.replace('<head>', `<head>\n    <meta http-equiv="Content-Security-Policy" content="${csp}" />`);
  },
});

export default defineConfig({
  plugins: [react(), cspPlugin()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // FE-2: вендор отдельно от кода приложения; сид уходит в свой чанк динамическим импортом
        manualChunks: {
          vendor: ['react', 'react-dom', 'zustand', '@tanstack/react-virtual'],
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      include: ['src/lib/**', 'src/store/**'],
      // Q-5/М35: гейт покрытия lib+store (факт: lib ~97%, store ~70%); растим по мере добора тестов
      thresholds: { lines: 75, functions: 65, statements: 75, branches: 60 },
    },
  },
});
