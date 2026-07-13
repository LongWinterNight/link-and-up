import type { AuditEntry } from './types';

/** Кольцевой журнал действий (последние 100). */
export function audit(log: AuditEntry[], msg: string): AuditEntry[] {
  return [{ t: new Date().toISOString(), msg }, ...log].slice(0, 100);
}
