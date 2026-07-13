/**
 * Б5: локальные воркспейсы (мультикорпус «клиент А / клиент Б») без бэкенда.
 * Реестр живёт ВНЕ основного persist (крошечный JSON в localStorage — нужен синхронно на старте,
 * до асинхронной IDB-гидратации). Данные воркспейса — под своим ключом хранилища; ключ
 * дефолтного совпадает с историческим LS_KEY, поэтому существующие данные мигрируются «бесплатно».
 * Free-лимит 2 — попытка третьего = измеримый сигнал Team-спроса (резолюция совета №2).
 */

export interface Workspace {
  id: string;
  name: string;
}

export const WS_REG_KEY = 'lidb_workspaces';
export const WS_ACTIVE_KEY = 'lidb_active_ws';
export const FREE_WS_LIMIT = 2;
export const DEFAULT_WS: Workspace = { id: 'default', name: '' }; // имя отдаёт словарь (ws.default)

type LS = Pick<Storage, 'getItem' | 'setItem'>;

/** Список воркспейсов; дефолтный всегда первый и неудаляем. */
export function listWorkspaces(ls: LS): Workspace[] {
  let extra: Workspace[] = [];
  try {
    const raw = ls.getItem(WS_REG_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    if (Array.isArray(parsed)) {
      extra = parsed.filter(
        (w): w is Workspace =>
          typeof w === 'object' &&
          w !== null &&
          typeof (w as Workspace).id === 'string' &&
          typeof (w as Workspace).name === 'string' &&
          (w as Workspace).id !== DEFAULT_WS.id,
      );
    }
  } catch {
    extra = [];
  }
  return [DEFAULT_WS, ...extra];
}

export function activeWorkspace(ls: LS): string {
  const id = ls.getItem(WS_ACTIVE_KEY) || DEFAULT_WS.id;
  return listWorkspaces(ls).some((w) => w.id === id) ? id : DEFAULT_WS.id;
}

/** Ключ хранилища данных воркспейса; дефолтный = исторический ключ (миграция не нужна). */
export function storageKeyFor(base: string, wsId: string): string {
  return wsId === DEFAULT_WS.id ? base : base + ':' + wsId;
}

export interface AddResult {
  ok: boolean;
  id?: string;
  /** true — упёрлись во free-лимит: сигнал Team-спроса. */
  limit?: boolean;
}

export function addWorkspace(ls: LS, name: string): AddResult {
  const all = listWorkspaces(ls);
  if (all.length >= FREE_WS_LIMIT) return { ok: false, limit: true };
  const trimmed = name.trim().slice(0, 40);
  if (!trimmed) return { ok: false };
  const id = 'ws-' + Date.now();
  const extra = [...all.slice(1), { id, name: trimmed }];
  ls.setItem(WS_REG_KEY, JSON.stringify(extra));
  return { ok: true, id };
}

export function setActiveWorkspace(ls: LS, id: string): void {
  ls.setItem(WS_ACTIVE_KEY, id);
}
