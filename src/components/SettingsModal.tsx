import { useState } from 'react';
import { useStore } from '@/store';
import type { Rule } from '@/types';
import { Btn } from './ui';
import { Modal } from './Modal';

const inp: React.CSSProperties = {
  background: 'var(--surface-2)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-ctl)',
  padding: '8px 10px',
  color: 'var(--text-1)',
  fontSize: 13,
  width: '100%',
};

function RuleRow({ rule }: { rule: Rule }) {
  const updateRule = useStore((s) => s.updateRule);
  const deleteRule = useStore((s) => s.deleteRule);
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
      <input
        type="checkbox"
        checked={rule.enabled}
        onChange={(e) => updateRule(rule.id, { enabled: e.target.checked })}
        aria-label={'Включить правило ' + rule.label}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: rule.enabled ? 'var(--text-1)' : 'var(--text-3)' }}>{rule.label}</div>
        <div style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>/{rule.pattern}/i</div>
      </div>
      <select
        value={rule.severity}
        onChange={(e) => updateRule(rule.id, { severity: e.target.value as Rule['severity'] })}
        aria-label="Строгость"
        style={{ ...inp, width: 'auto', color: rule.severity === 'hard' ? 'var(--critical)' : 'var(--warning)' }}
      >
        <option value="soft">soft (предупредить)</option>
        <option value="hard">hard (блокировать)</option>
      </select>
      {!rule.builtin && (
        <button type="button" onClick={() => deleteRule(rule.id)} aria-label="Удалить правило" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 6, width: 28, height: 28, cursor: 'pointer', color: 'var(--critical)', flexShrink: 0 }}>×</button>
      )}
    </div>
  );
}

export default function SettingsModal() {
  const open = useStore((s) => s.settingsOpen);
  const setOpen = useStore((s) => s.setSettingsOpen);
  const rules = useStore((s) => s.rules);
  const addRule = useStore((s) => s.addRule);
  const resetRules = useStore((s) => s.resetRules);
  const ownAuthor = useStore((s) => s.ownAuthor);
  const setOwnAuthor = useStore((s) => s.setOwnAuthor);
  const cadenceGoal = useStore((s) => s.cadenceGoal);
  const setCadenceGoal = useStore((s) => s.setCadenceGoal);
  const flash = useStore((s) => s.flash);

  const [nLabel, setNLabel] = useState('');
  const [nPattern, setNPattern] = useState('');
  const [nMsg, setNMsg] = useState('');
  const [nSev, setNSev] = useState<Rule['severity']>('soft');
  const [patternErr, setPatternErr] = useState('');

  if (!open) return null;

  const addCustom = () => {
    if (!nLabel.trim() || !nPattern.trim()) {
      flash('Укажите название и паттерн правила');
      return;
    }
    try {
      new RegExp(nPattern, 'iu');
    } catch (e) {
      setPatternErr('Некорректное регулярное выражение: ' + (e as Error).message);
      return;
    }
    addRule({
      id: 'custom-' + Date.now(),
      label: nLabel.trim(),
      pattern: nPattern.trim(),
      severity: nSev,
      message: nMsg.trim() || nLabel.trim(),
      enabled: true,
    });
    setNLabel('');
    setNPattern('');
    setNMsg('');
    setNSev('soft');
    setPatternErr('');
    flash('Правило добавлено');
  };

  return (
    <Modal onClose={() => setOpen(false)} label="Настройки" width={720} zIndex={55}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700 }}>Настройки</h2>
          <button type="button" onClick={() => setOpen(false)} aria-label="Закрыть" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', color: 'var(--text-1)', fontSize: 18 }}>×</button>
        </div>

        {/* Общие */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px,1fr))', gap: 12, marginBottom: 22 }}>
          <label style={{ fontSize: 11, color: 'var(--text-3)' }}>Автор своих постов
            <input value={ownAuthor} onChange={(e) => setOwnAuthor(e.target.value)} style={{ ...inp, marginTop: 4 }} />
          </label>
          <label style={{ fontSize: 11, color: 'var(--text-3)' }}>Цель каденса (постов/нед)
            <input type="number" min={1} max={14} value={cadenceGoal} onChange={(e) => setCadenceGoal(Number(e.target.value))} style={{ ...inp, marginTop: 4 }} />
          </label>
        </div>

        {/* Гардрейлы */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600 }}>Гардрейлы (brand-safety)</h3>
          <button type="button" onClick={() => { resetRules(); flash('Правила сброшены к дефолтным'); }} style={{ fontSize: 12, color: 'var(--text-accent)', background: 'none', border: 'none', cursor: 'pointer' }}>Сбросить к дефолтным</button>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 10 }}>Правила проверяют идеи и черновики. <b>hard</b> блокирует публикацию и экспорт. Добавьте свои (напр. запрещённые термины / имена клиентов под NDA).</div>

        <div style={{ marginBottom: 16 }}>
          {rules.map((r) => <RuleRow key={r.id} rule={r} />)}
        </div>

        {/* Добавить правило */}
        <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10, padding: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Добавить своё правило</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <input value={nLabel} onChange={(e) => setNLabel(e.target.value)} placeholder="Название" style={inp} aria-label="Название правила" />
            <input value={nPattern} onChange={(e) => { setNPattern(e.target.value); setPatternErr(''); }} placeholder="паттерн (regex, напр. запрещённыйтермин)" style={{ ...inp, fontFamily: 'var(--mono)' }} aria-label="Паттерн" />
            <input value={nMsg} onChange={(e) => setNMsg(e.target.value)} placeholder="Сообщение (необязательно)" style={inp} aria-label="Сообщение" />
            <select value={nSev} onChange={(e) => setNSev(e.target.value as Rule['severity'])} style={inp} aria-label="Строгость нового правила">
              <option value="soft">soft (предупредить)</option>
              <option value="hard">hard (блокировать)</option>
            </select>
          </div>
          {patternErr && <div style={{ color: 'var(--critical)', fontSize: 12, marginTop: 8 }}>{patternErr}</div>}
          <div style={{ marginTop: 10, textAlign: 'right' }}>
            <Btn variant="accent" onClick={addCustom}>Добавить правило</Btn>
          </div>
        </div>
    </Modal>
  );
}
