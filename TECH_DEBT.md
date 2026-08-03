# Технический долг — Link-and-Up

> Живой документ. Пометка ✅ = выполнено. Дата обновления: 2026-07-16.

---

## Фаза 1: Базовый техдолг ✅ ЗАВЕРШЕНА (коммит 78f3429)

| # | Задача | Файл | Статус |
|---|--------|------|--------|
| 1.1 | i18n injection — DraftLabels/ExportLabels/BackupLabels/DedupLabels + useDraftLabels/useExportLabels hooks; ~70 ключей в ru.ts/en.ts | draft.ts, exports.ts, backup.ts, dedup.ts, useT.ts, ru.ts, en.ts | ✅ |
| 1.2 | Рефакторинг App.tsx — ExportMenu, TabBar, ToastHost вынесены | App.tsx, ExportMenu.tsx, TabBar.tsx, ToastHost.tsx | ✅ |
| 1.3 | Унификация focus-trap — PostModal/OnboardingModal через Modal.tsx | PostModal.tsx, OnboardingModal.tsx | ✅ |
| 1.4 | Фильтры Explorer — 5 UI-контролов (minC/maxC/minER/dateFrom/dateTo) | Explorer.tsx | ✅ |
| 1.5 | substr → substring в dedup.ts | dedup.ts | ✅ |
| 1.6 | 34 новых теста — settingsSlice (11), uiSlice (14), shareCard (6), download (3) | store.slices.test.ts, shareCard.test.ts, download.test.ts | ✅ |
| 1.7 | coverage.all=false — убран баг дублирования файлов v8 | vite.config.ts | ✅ |

---

## Фаза 2: i18n-хвосты ✅ ЗАВЕРШЕНА (коммиты d4d3a3f + eeb9da1)

> EN-переключатель теперь полон — все захардкоженные русские строки
> в lib-функциях, ErrorBoundary и store-слайсах проходят через tr().

### 2.1 GuardrailsLabels инъекция (M) ✅

**Файл:** `src/lib/guardrails.ts`

Захардкожены:
- `DEFAULT_RULES[].label` (4): 'Превосходная степень без доказательства', 'Абсолютные обещания', 'Непроверяемая крупная цифра', 'Хайп / мотивационный шум'
- `DEFAULT_RULES[].message` (4): 'Заявление «первый / лучший / единственный»...', 'Абсолютные обещания снижают доверие...', 'Крупная цифра без источника...', 'Хайп-обороты сжигают доверие...'
- `validatePattern()` (5): 'Пустой паттерн', 'Паттерн длиннее...', 'Некорректное регулярное выражение:...', 'Вложенные квантификаторы вида (a+)+ запрещены...', 'Паттерн слишком медленный...'
- `redactHard()`: '[удалено: ' + r.label + ']'

**Подход:** интерфейс `GuardrailsLabels` по шаблону ForecastLabels/DedupLabels; инжекция через `useGuardrailsLabels()` в SettingsModal/PostModal; fallback на русские строки.

**Ключи в словаре:** `guard.rule.*.label/msg`, `guard.pat.*`, `guard.redacted.*`

---

### 2.2 ImportLabels инъекция (S) ✅

**Файл:** `src/lib/linkedinImport.ts`

Захардкожены:
- 'Файл пуст'
- 'Это не Shares.csv из экспорта LinkedIn: не найдены колонки Date/ShareCommentary'

**Подход:** интерфейс `ImportLabels`; инжекция через `useImportLabels()` в ImportModal.

**Ключи:** `import.linkedin.empty`, `import.linkedin.badFormat`

---

### 2.3 Audit-строки через tr() (S) ✅

**Файлы:** `src/store/postsSlice.ts`, `src/store/ideasSlice.ts`, `src/store/settingsSlice.ts`

Захардкожены (примеры):
- postsSlice: 'Импорт: добавлено N постов', 'Старт с чистого корпуса', 'Ожидался JSON-массив постов'
- ideasSlice: 'Изменена/Создана идея «…»', 'Удалена идея «…»', 'Опубликован пост «…»', 'Формат: …'
- settingsSlice: 'Выбрана ниша: …', 'Подключён/Отключён пакет правил «…»', 'Кластеры пересобраны…', 'Добавлен/Удалён кластер «…»', 'Запрошен 3-й воркспейс'

**Подход:** заменить конкатенации на `tr(locale, 'audit.*')` — слайсы уже имеют доступ к `get().locale`.

**Ключи:** `audit.importAdded`, `audit.freshStart`, `audit.ideaCreated/Changed/Deleted`, `audit.published`, `audit.nicheSelected`, `audit.packOn/Off`, `audit.clustersRebuilt/Reset/Added/Deleted`, `audit.teamSignal`, `audit.formatLabel`

---

### 2.4 ShareCardLabels инъекция (M) ✅

**Файл:** `src/lib/shareCard.ts`

Захардкожены:
- `buildAltText()`: 'Карточка разбора поста LinkedIn. Автор: ', 'реакций', 'комментарии неизвестны', 'метрики неизвестны', 'Сгенерировано в'
- `drawShareCard()`: 'РАЗБОР ПОСТА', 'метрики неизвестны', 'Canvas недоступен…', 'Не удалось сформировать PNG'
- Водяной знак `PRODUCT_NAME + ' · link-and-up.vercel.app'` — не локализуем

**Подход:** интерфейс `ShareCardLabels`; инжекция через `useShareCardLabels()` в ShareCardModal. Canvas-рендеринг использует переданные labels.

**Ключи:** `card.alt.*`, `card.heading`, `card.metricsUnknown`, `card.canvasError`, `card.pngError`

---

### 2.5 ErrorBoundary — locale из localStorage (S) ✅

**Файл:** `src/components/ErrorBoundary.tsx`

Class-компонент не может использовать useT(). Все строки русские:
- 'Что-то сломалось в интерфейсе'
- 'Ваши данные целы — они сохраняются локально…'
- 'Перезагрузить', 'Скопировать отчёт'

**Подход:** читать locale напрямую из localStorage/IndexedDB (persist-ключ) и использовать `tr()` напрямую. Альтернатива: конвертировать в функциональный компонент с ErrorBoundary-хуком.

**Ключи:** `error.title`, `error.body`, `error.reload`, `error.copyReport`

---

### 2.6 Инъекция DedupLabels/BackupLabels из store (S) ✅

**Файлы:** `src/store/postsSlice.ts`, `src/components/ImportModal.tsx`, `src/components/SettingsModal.tsx`

DedupLabels и BackupLabels интерфейсы уже существуют, но не инжектируются при вызовах из store/UI:
- `postsSlice.ingestJson()` → `analyzeIngest()` без labels
- `postsSlice.previewImport()` → `analyzeIngestChunked()` без labels
- `SettingsModal` → `parseBackup()` без labels

**Подход:** создать хуки `useDedupLabels()` и `useBackupLabels()`, передавать в store-методы через параметры.

**Ключи:** уже есть в ru.ts/en.ts (`dedup.*`, `backup.*`)

---

### 2.7 Новые ключи в ru.ts/en.ts (S) ✅

Добавить ~30 новых ключей для пп. 2.1–2.6. Обновить `DictKey` — он автопроизводный от ru.ts.

---

## Фаза 3: Тестовое покрытие → блокирует уверенность в качестве

> Текущее покрытие: 95.54% lines / 86.82% branches / 87.41% functions.
> Слабые места: postsSlice (72.72%), settingsSlice (82.58%), guardrails branches (77.77%).

### 3.1 drawShareCard — mock-canvas тест (M) ✅

**Файл:** `src/lib/shareCard.test.ts`

`drawShareCard()` не покрыта (canvas в jsdom). Нужен mock `CanvasRenderingContext2D`:
- проверить градиент, текст автора, pills, метрики, водяной знак
- проверить toBlob → PNG
- проверить ошибки (canvas unavailable)

---

### 3.2 exports.ts — ветки с labels (S) ✅

**Файл:** `src/lib/exports.ts` (90.57% statements, 46.96% branches)

Не покрыты:
- `exportPostsCsv()` с labels-параметром
- `exportIdeasCsv()` с labels-параметром
- `exportPostsJson()` — не тестирован
- Fallback-пути без labels

---

### 3.3 persistCore.ts — debounce, IDB, errors (M) ✅

**Файл:** `src/store/persistCore.test.ts` (9 тестов, 95.74% statements / 86.36% branches)

Покрыто:
- Debounce 300мс (batch-запись)
- Pre-hydration gate (не писать до гидратации)
- IDB-fallback (localStorage → IndexedDB)
- Error handling (quota, write failure)
- removeItem (очистка pending + удаление)

**Подход:** `vi.stubGlobal('localStorage', mockLS)` ДО динамического импорта — `rawLS` захватывается при оценке модуля, поэтому mock нужно ставить раньше.

---

### 3.4 ideasSlice — edge cases (S) ✅

**Файл:** `src/store/ideasSlice.ts` (74.21%)

Не покрыты:
- `moveIdeaStatus()` — случай, когда статус не меняется
- `scheduleIdea()` — валидация даты (вторник/четверг)
- `saveReal()` — ownPost получает правильный meta_cluster, leads/interviews

---

## Фаза 4: A11y + код-качество → блокирует WCAG-AA

### 4.1 FormatFlag aria-pressed (S)

**Файл:** `src/components/PostModal.tsx`

Кнопки FormatFlag (has_numbers, personal_story, contrarian, list_format, save_bait) — toggle-кнопки без `aria-pressed`. Скринридер не может определить состояние.

**Исправление:** добавить `aria-pressed={flag}` на каждую кнопку.

---

### 4.2 ToastHost role="status" (S)

**Файл:** `src/components/ToastHost.tsx`

Используется `aria-live="polite"`, но нет `role="status"`. По WCAG 2.1 toast-уведомления должны иметь `role="status"`.

**Исправление:** заменить `aria-live="polite"` на `role="status"`.

---

### 4.3 Close-кнопка в Modal — унификация (S)

**Файлы:** ShareCardModal.tsx, ImportModal.tsx, SettingsModal.tsx, PostModal.tsx

В каждой модалке вручную прописан идентичный close-кнопка с inline-стилями (~30 строк × 4).

**Исправление:** вынести close-кнопку в Modal.tsx как опциональный `showClose` prop.

---

### 4.4 hdrBtn/ctl дедупликация стилей (S)

**Файлы:** App.tsx, ExportMenu.tsx (дубль hdrBtn); SettingsModal.tsx, ui.tsx (дубль inp/ctl)

**Исправление:** вынести hdrBtn в ui.tsx; использовать ctl из ui.tsx вместо inp.

---

## Фаза 5: Производительность + типы → фоновое

### 5.1 React.memo на критичных компонентах (M)

Ни один компонент не обёрнут в React.memo. При изменении любого поля стора zustand может триггерить лишние ре-рендеры.

**Приоритет для memo:** TabBar, ToastHost, ExportMenu, PostModal, Ideas (kanban), Explorer (virtualizer).

---

### 5.2 Type guards вместо assertions (M)

**Файлы:** dedup.ts (`raw as RawPost`), backup.ts (`raw as Partial<BackupFile>`), store/index.ts (`persisted as Partial<State>`)

**Подход:** добавить type guard-функции с runtime-проверкой.

---

### 5.3 nichePacks lazy import (S)

**Файл:** `src/lib/nichePacks.ts`

FINTECH_PACK всегда импортируется в SettingsModal, даже если не выбран. ~3KB.

**Исправление:** `const { FINTECH_PACK } = await import('./nichePacks')` в toggleNichePack.

---

## Фоновые М-малые (из BACKLOG.md)

Низкий приоритет, «по касанию файлов»:

| ID | Задача | Усилие |
|----|--------|--------|
| М3 | Inline-валидация полей идеи | S |
| М4 | Контекстные подсказки в формулу | S |
| М5 | Тултипы к метрикам | S |
| М6 | Hover-превью поста в списке | S |
| М7 | Улучшение empty-state во вкладках | S |
| М9 | Progressive disclosure настроек | S |
| М10 | CTA «создать первую идею» после импорта | S |
| М11 | Sample-путь для нового пользователя | S |
| М13 | Дата-форматы по locale | S |
| М14 | Множественное число в метках | S |
| М15 | Collapsible sections в настройках | S |
| М17 | Клавиатурные shortcuts (Ctrl+N, Ctrl+E) | S |
| М25 | Colorblind-проверка CHART_PALETTE | S |
| М27 | Skip-link для клавиатурной навигации | S |
| М28 | Focus-visible стили на всех интерактивных | S |
| М29 | Прогноз: edge-case пустого корпуса | S |
| М30 | Scatter: empty-state с подсказкой | S |
| М31 | Backtest: визуализация MAPE | S |
| М33 | Сортировка по relevance в Explorer | S |
| М34 | Debounce поиска в Explorer | S |
| М38 | GitHub Actions: cache node_modules | S |
| М41 | Web Worker для validatePattern | S |
| М43 | Source map в прод-сборке | S |
| М45 | Bundle analyzer в CI | S |
| М47 | CSP: upgrade-insecure-requests | S |
| М50 | OG-теги динамические по вкладке | S |

---

## Зависимости между фазами

```
Фаза 2 (i18n-хвосты)
  ├── блокирует полную EN-локализацию
  ├── разблокирует М13 (дата-форматы), М14 (мн. число)
  └── необходима перед Фазой 5.3 (nichePacks lazy)

Фаза 3 (тесты)
  ├── Фаза 3.1 (shareCard) зависит от Фазы 2.4 (ShareCardLabels)
  ├── Фаза 3.2 (exports) зависит от Фазы 2.6 (инъекция labels)
  └── независима от Фазы 4

Фаза 4 (A11y + код)
  ├── Фаза 4.3 (close-кнопка) зависит от Фазы 2.4 (ShareCardLabels)
  ├── независима от Фазы 3
  └── разблокирует М25 (colorblind), М27 (skip-link), М28 (focus-visible)

Фаза 5 (перф + типы)
  ├── Фаза 5.2 (type guards) полезна перед эпиком G (G-2 RLS)
  ├── Фаза 5.3 (nichePacks lazy) зависит от Фазы 2.1 (GuardrailsLabels)
  └── независима от Фаз 3–4
```

## Рекомендуемый порядок

1. **Фаза 2** → наибольшее влияние (разблокирует EN)
2. **Фаза 3** → параллельно с Фазой 2 (тесты для нового кода)
3. **Фаза 4** → после Фазы 2 (A11y зависит от i18n)
4. **Фаза 5** → фоновое (можно параллельно с Фазой 4)
