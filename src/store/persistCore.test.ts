import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { toPersistedSlice } from './persistCore';
import type { State } from './types';
import { DEFAULT_FILTERS } from '@/store';

// --- helpers ---
const makeState = (): State =>
  ({
    version: 1,
    posts: [],
    ideas: [],
    theme: 'dark',
    locale: 'ru',
    calibration: 1,
    calibrationCount: 0,
    isDemo: true,
    onboarded: false,
    readOnly: false,
    auditLog: [],
    rules: [],
    ownAuthor: '',
    cadenceGoal: 2,
    presets: [],
    niche: '',
    clusters: [],
    search: '',
    filters: { ...DEFAULT_FILTERS },
    settingsOpen: false,
    tab: 'today',
    viewMode: 'cards',
    selectedPostId: null,
    forecastId: '',
    importOpen: false,
    importPreview: null,
    toast: '',
    confirmMsg: null,
    lastDeletedIdea: null,
    i18nVersion: 0,
  }) as unknown as State;

describe('toPersistedSlice', () => {
  it('извлекает только persisted-поля', () => {
    const s = makeState();
    const slice = toPersistedSlice(s);
    expect(slice.version).toBe(1);
    expect(slice.posts).toEqual([]);
    expect(slice.theme).toBe('dark');
    expect(slice.locale).toBe('ru');
    expect(slice.rules).toEqual([]);
    expect(slice.ownAuthor).toBe('');
    expect(slice.cadenceGoal).toBe(2);
    expect(slice.presets).toEqual([]);
    expect(slice.niche).toBe('');
    expect(slice.clusters).toEqual([]);
    // не-persisted поля не попадают
    expect((slice as Record<string, unknown>).search).toBeUndefined();
    expect((slice as Record<string, unknown>).toast).toBeUndefined();
    expect((slice as Record<string, unknown>).filters).toBeUndefined();
    expect((slice as Record<string, unknown>).selectedPostId).toBeUndefined();
    expect((slice as Record<string, unknown>).confirmMsg).toBeUndefined();
    expect((slice as Record<string, unknown>).lastDeletedIdea).toBeUndefined();
  });

  it('включает все 17 persisted-полей', () => {
    const s = makeState();
    const slice = toPersistedSlice(s);
    const keys = Object.keys(slice);
    expect(keys).toHaveLength(17);
    expect(keys).toContain('version');
    expect(keys).toContain('posts');
    expect(keys).toContain('ideas');
    expect(keys).toContain('theme');
    expect(keys).toContain('locale');
    expect(keys).toContain('calibration');
    expect(keys).toContain('calibrationCount');
    expect(keys).toContain('isDemo');
    expect(keys).toContain('onboarded');
    expect(keys).toContain('readOnly');
    expect(keys).toContain('auditLog');
    expect(keys).toContain('rules');
    expect(keys).toContain('ownAuthor');
    expect(keys).toContain('cadenceGoal');
    expect(keys).toContain('presets');
    expect(keys).toContain('niche');
    expect(keys).toContain('clusters');
  });

  it('сохраняет данные постов', () => {
    const s = makeState();
    s.posts = [{ id: 'p1', author: 'A' } as unknown as (typeof s.posts)[0]];
    const slice = toPersistedSlice(s);
    expect(slice.posts).toHaveLength(1);
    expect(slice.posts[0].author).toBe('A');
  });
});

describe('debouncedStorage: модульные тесты', () => {
  // persistCore захватывает rawLS на уровне модуля:
  //   const rawLS = typeof window !== 'undefined' ? window.localStorage : null;
  // Поэтому vi.stubGlobal('localStorage', mockLS) нужно вызывать ДО динамического импорта,
  // иначе rawLS будет указывать на настоящий localStorage, а не на наш mock.

  beforeEach(() => {
    vi.resetModules();
  });

  it('setItem до markPersistWritable — не пишет', async () => {
    const setItemSpy = vi.fn();
    const mockLS = {
      getItem: vi.fn(),
      setItem: setItemSpy,
      removeItem: vi.fn(),
      clear: vi.fn(),
      length: 0,
      key: vi.fn(),
    };
    vi.stubGlobal('localStorage', mockLS);

    vi.doMock('@/lib/kv', () => ({
      idbAvailable: () => false,
      kvSet: vi.fn(),
      kvDel: vi.fn(),
      kvReadWithMigration: vi.fn(() => Promise.resolve(null)),
    }));
    const { debouncedStorage } = await import('./persistCore');

    vi.useFakeTimers();
    debouncedStorage.setItem('lidb', { state: { version: 1 }, version: 0 });
    vi.advanceTimersByTime(500);
    vi.useRealTimers();

    expect(setItemSpy).not.toHaveBeenCalled();
  });

  it('setItem после markPersistWritable — пишет (localStorage fallback)', async () => {
    const setItemSpy = vi.fn();
    const mockLS = {
      getItem: vi.fn(),
      setItem: setItemSpy,
      removeItem: vi.fn(),
      clear: vi.fn(),
      length: 0,
      key: vi.fn(),
    };
    vi.stubGlobal('localStorage', mockLS);

    vi.doMock('@/lib/kv', () => ({
      idbAvailable: () => false,
      kvSet: vi.fn(() => Promise.resolve()),
      kvDel: vi.fn(),
      kvReadWithMigration: vi.fn(() => Promise.resolve(null)),
    }));
    const { debouncedStorage, markPersistWritable } = await import('./persistCore');

    markPersistWritable();
    vi.useFakeTimers();
    debouncedStorage.setItem('lidb', { state: { version: 1 }, version: 0 });
    vi.advanceTimersByTime(400);
    vi.useRealTimers();

    expect(setItemSpy).toHaveBeenCalled();
  });

  it('setItem после markPersistWritable — пишет через kvSet (IDB)', async () => {
    const mockLS = { getItem: vi.fn(), setItem: vi.fn(), removeItem: vi.fn(), clear: vi.fn(), length: 0, key: vi.fn() };
    vi.stubGlobal('localStorage', mockLS);

    const kvSetSpy = vi.fn(() => Promise.resolve());
    vi.doMock('@/lib/kv', () => ({
      idbAvailable: () => true,
      kvSet: kvSetSpy,
      kvDel: vi.fn(),
      kvReadWithMigration: vi.fn(() => Promise.resolve(null)),
    }));
    const { debouncedStorage, markPersistWritable } = await import('./persistCore');

    markPersistWritable();
    vi.useFakeTimers();
    debouncedStorage.setItem('lidb', { state: { version: 1 }, version: 0 });
    vi.advanceTimersByTime(400);
    // flushPersist вызывает kvSet асинхронно — нужно подождать микротаски
    await vi.runAllTimersAsync();
    vi.useRealTimers();

    expect(kvSetSpy).toHaveBeenCalledWith('lidb', { state: { version: 1 }, version: 0 });
  });

  it('removeItem очищает pending и удаляет', async () => {
    const removeItemSpy = vi.fn();
    const mockLS = {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: removeItemSpy,
      clear: vi.fn(),
      length: 0,
      key: vi.fn(),
    };
    vi.stubGlobal('localStorage', mockLS);

    vi.doMock('@/lib/kv', () => ({
      idbAvailable: () => false,
      kvSet: vi.fn(),
      kvDel: vi.fn(),
      kvReadWithMigration: vi.fn(() => Promise.resolve(null)),
    }));
    const { debouncedStorage, markPersistWritable } = await import('./persistCore');

    markPersistWritable();
    vi.useFakeTimers();
    debouncedStorage.setItem('lidb', { state: { version: 1 }, version: 0 });
    debouncedStorage.removeItem('lidb');
    vi.advanceTimersByTime(500);
    vi.useRealTimers();

    expect(removeItemSpy).toHaveBeenCalledWith('lidb');
  });

  it('setStorageErrorHandler вызывается при ошибке kvSet', async () => {
    const mockLS = { getItem: vi.fn(), setItem: vi.fn(), removeItem: vi.fn(), clear: vi.fn(), length: 0, key: vi.fn() };
    vi.stubGlobal('localStorage', mockLS);

    vi.doMock('@/lib/kv', () => ({
      idbAvailable: () => true,
      kvSet: vi.fn(() => Promise.reject(new Error('IDB error'))),
      kvDel: vi.fn(),
      kvReadWithMigration: vi.fn(() => Promise.resolve(null)),
    }));
    const { debouncedStorage, markPersistWritable, setStorageErrorHandler } = await import('./persistCore');

    const errorHandler = vi.fn();
    setStorageErrorHandler(errorHandler);
    markPersistWritable();

    vi.useFakeTimers();
    debouncedStorage.setItem('lidb', { state: { version: 1 }, version: 0 });
    vi.advanceTimersByTime(400);
    await vi.runAllTimersAsync();
    vi.useRealTimers();

    expect(errorHandler).toHaveBeenCalled();
    expect(errorHandler.mock.calls[0][0]).toContain('Не удалось сохранить');
  });

  it('setStorageErrorHandler вызывается при ошибке localStorage', async () => {
    const setItemSpy = vi.fn(() => {
      throw new Error('QuotaExceededError');
    });
    const mockLS = {
      getItem: vi.fn(),
      setItem: setItemSpy,
      removeItem: vi.fn(),
      clear: vi.fn(),
      length: 0,
      key: vi.fn(),
    };
    vi.stubGlobal('localStorage', mockLS);

    vi.doMock('@/lib/kv', () => ({
      idbAvailable: () => false,
      kvSet: vi.fn(),
      kvDel: vi.fn(),
      kvReadWithMigration: vi.fn(() => Promise.resolve(null)),
    }));
    const { debouncedStorage, markPersistWritable, setStorageErrorHandler } = await import('./persistCore');

    const errorHandler = vi.fn();
    setStorageErrorHandler(errorHandler);
    markPersistWritable();

    vi.useFakeTimers();
    debouncedStorage.setItem('lidb', { state: { version: 1 }, version: 0 });
    vi.advanceTimersByTime(400);
    vi.useRealTimers();

    expect(errorHandler).toHaveBeenCalled();
    expect(errorHandler.mock.calls[0][0]).toContain('переполнено');
  });
});
