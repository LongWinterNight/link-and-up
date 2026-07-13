import { describe, expect, it } from 'vitest';
import {
  activeWorkspace,
  addWorkspace,
  FREE_WS_LIMIT,
  listWorkspaces,
  setActiveWorkspace,
  storageKeyFor,
} from './workspaces';

const mkLs = () => {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
  };
};

describe('Б5: воркспейсы', () => {
  it('дефолтный всегда есть; ключ дефолтного = исторический (миграция бесплатна)', () => {
    const ls = mkLs();
    expect(listWorkspaces(ls)).toHaveLength(1);
    expect(activeWorkspace(ls)).toBe('default');
    expect(storageKeyFor('lidb_state_v4', 'default')).toBe('lidb_state_v4');
    expect(storageKeyFor('lidb_state_v4', 'ws-1')).toBe('lidb_state_v4:ws-1');
  });

  it('создание/активация; ключи данных разных воркспейсов изолированы', () => {
    const ls = mkLs();
    const res = addWorkspace(ls, '  Клиент А  ');
    expect(res.ok).toBe(true);
    const all = listWorkspaces(ls);
    expect(all).toHaveLength(2);
    expect(all[1].name).toBe('Клиент А');
    setActiveWorkspace(ls, res.id!);
    expect(activeWorkspace(ls)).toBe(res.id);
    expect(storageKeyFor('base', res.id!)).not.toBe(storageKeyFor('base', 'default'));
  });

  it('free-лимит: третий воркспейс не создаётся и помечается как Team-сигнал', () => {
    const ls = mkLs();
    expect(addWorkspace(ls, 'А').ok).toBe(true);
    expect(listWorkspaces(ls)).toHaveLength(FREE_WS_LIMIT);
    const third = addWorkspace(ls, 'Б');
    expect(third.ok).toBe(false);
    expect(third.limit).toBe(true);
    expect(listWorkspaces(ls)).toHaveLength(FREE_WS_LIMIT);
  });

  it('битый реестр и неизвестный активный id падают на дефолт', () => {
    const ls = mkLs();
    ls.setItem('lidb_workspaces', 'не json');
    ls.setItem('lidb_active_ws', 'ws-нет');
    expect(listWorkspaces(ls)).toHaveLength(1);
    expect(activeWorkspace(ls)).toBe('default');
    expect(addWorkspace(ls, '')).toEqual({ ok: false });
  });
});
