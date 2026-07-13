import { useState } from 'react';
import { useStore } from '@/store';
import { activeWorkspace, addWorkspace, FREE_WS_LIMIT, listWorkspaces, setActiveWorkspace } from '@/lib/workspaces';
import { useT } from '@/i18n/useT';

/**
 * Б5: переключатель воркспейсов в шапке. Переключение = смена активного id + перезагрузка
 * (pending-запись persist уходит по beforeunload-flush; изоляция данных — на уровне ключа
 * хранилища). Третий воркспейс — карточка Team-тарифа, попытка логируется как сигнал спроса.
 */
export default function WorkspaceSwitcher() {
  const t = useT();
  const flash = useStore((s) => s.flash);
  const logTeamSignal = useStore((s) => s.logTeamSignal);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const ls = window.localStorage;
  const all = listWorkspaces(ls);
  const active = activeWorkspace(ls);

  const switchTo = (id: string) => {
    if (id === active) return;
    setActiveWorkspace(ls, id);
    location.reload();
  };

  const create = () => {
    const res = addWorkspace(ls, name);
    if (res.limit) {
      logTeamSignal();
      flash(t('ws.limit'));
      setAdding(false);
      return;
    }
    if (!res.ok || !res.id) return;
    setActiveWorkspace(ls, res.id);
    location.reload();
  };

  const sel: React.CSSProperties = {
    background: 'var(--surface-2)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-ctl)',
    padding: '7px 10px',
    color: 'var(--text-1)',
    fontSize: 12.5,
  };

  return (
    <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
      <select
        value={active}
        onChange={(e) => {
          if (e.target.value === '__new__') {
            if (all.length >= FREE_WS_LIMIT) {
              logTeamSignal();
              flash(t('ws.limit'));
              return;
            }
            setAdding(true);
            return;
          }
          switchTo(e.target.value);
        }}
        aria-label={t('ws.label')}
        style={sel}
      >
        {all.map((w) => (
          <option key={w.id} value={w.id}>
            {w.id === 'default' ? t('ws.default') : w.name}
          </option>
        ))}
        <option value="__new__">{t('ws.new')}</option>
      </select>
      {adding && (
        <>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') create();
              if (e.key === 'Escape') setAdding(false);
            }}
            placeholder={t('ws.name.ph')}
            aria-label={t('ws.name.ph')}
            style={{ ...sel, width: 150 }}
          />
          <button type="button" onClick={create} disabled={!name.trim()} style={{ ...sel, cursor: 'pointer' }}>
            {t('ws.create')}
          </button>
        </>
      )}
    </span>
  );
}
