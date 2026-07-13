import { useState } from 'react';
import { toPersistedSlice, useStore } from '@/store';
import { exportStateJson, parseBackup } from '@/lib/backup';
import { validatePattern } from '@/lib/guardrails';
import { NICHE_PACKS, NICHES } from '@/lib/nichePacks';
import { useT } from '@/i18n/useT';
import type { DictKey } from '@/i18n';
import { exportAuditCsv } from '@/lib/exports';
import { download } from '@/lib/download';
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
  const t = useT();
  const updateRule = useStore((s) => s.updateRule);
  const deleteRule = useStore((s) => s.deleteRule);
  return (
    <div
      style={{
        display: 'flex',
        gap: 8,
        alignItems: 'center',
        padding: '8px 0',
        borderBottom: '1px solid var(--border)',
      }}
    >
      <input
        type="checkbox"
        checked={rule.enabled}
        onChange={(e) => updateRule(rule.id, { enabled: e.target.checked })}
        aria-label={t('se.rule.enable') + rule.label}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: rule.enabled ? 'var(--text-1)' : 'var(--text-3)' }}>
          {rule.label}
        </div>
        <div
          style={{
            fontSize: 11,
            color: 'var(--text-3)',
            fontFamily: 'var(--mono)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          /{rule.pattern}/i
        </div>
      </div>
      <select
        value={rule.severity}
        onChange={(e) => updateRule(rule.id, { severity: e.target.value as Rule['severity'] })}
        aria-label={t('se.rule.severity')}
        style={{ ...inp, width: 'auto', color: rule.severity === 'hard' ? 'var(--critical)' : 'var(--warning)' }}
      >
        <option value="soft">{t('se.rule.soft')}</option>
        <option value="hard">{t('se.rule.hard')}</option>
      </select>
      {!rule.builtin && (
        <button
          type="button"
          onClick={() => deleteRule(rule.id)}
          aria-label={t('se.rule.del')}
          style={{
            background: 'var(--surface-2)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            width: 28,
            height: 28,
            cursor: 'pointer',
            color: 'var(--critical)',
            flexShrink: 0,
          }}
        >
          ×
        </button>
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
  const toggleNichePack = useStore((s) => s.toggleNichePack);
  const ownAuthor = useStore((s) => s.ownAuthor);
  const setOwnAuthor = useStore((s) => s.setOwnAuthor);
  const cadenceGoal = useStore((s) => s.cadenceGoal);
  const setCadenceGoal = useStore((s) => s.setCadenceGoal);
  const auditLog = useStore((s) => s.auditLog);
  const applyBackup = useStore((s) => s.applyBackup);
  const niche = useStore((s) => s.niche);
  const setNiche = useStore((s) => s.setNiche);
  const flash = useStore((s) => s.flash);
  const askConfirm = useStore((s) => s.askConfirm);
  const t = useT();

  const onRestoreFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const rd = new FileReader();
    rd.onload = () => {
      try {
        const backup = parseBackup(String(rd.result));
        const cur = useStore.getState();
        void askConfirm(
          t('se.data.confirm.a') +
            backup.exportedAt.slice(0, 16).replace('T', ' ') +
            t('se.data.confirm.b') +
            cur.posts.length +
            t('se.data.confirm.c') +
            cur.ideas.length +
            t('se.data.confirm.d') +
            backup.state.posts.length +
            t('se.data.confirm.e') +
            backup.state.ideas.length +
            t('se.data.confirm.f'),
        ).then((ok) => {
          if (ok) applyBackup(backup.state);
        });
      } catch (err) {
        flash(t('se.data.restoreErr') + (err as Error).message);
      }
    };
    rd.readAsText(f);
    e.target.value = '';
  };

  const [nLabel, setNLabel] = useState('');
  const [nPattern, setNPattern] = useState('');
  const [nMsg, setNMsg] = useState('');
  const [nSev, setNSev] = useState<Rule['severity']>('soft');
  const [patternErr, setPatternErr] = useState('');

  if (!open) return null;

  const addCustom = () => {
    if (!nLabel.trim() || !nPattern.trim()) {
      flash(t('se.add.needFields'));
      return;
    }
    // SEC-2: длина, компиляция, вложенные квантификаторы, тайминг-проба
    const err = validatePattern(nPattern);
    if (err) {
      setPatternErr(err);
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
    flash(t('se.add.toast'));
  };

  return (
    <Modal onClose={() => setOpen(false)} label={t('se.title')} width={720} zIndex={55}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700 }}>{t('se.title')}</h2>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label={t('an.modal.close')}
          style={{
            background: 'var(--surface-2)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            width: 32,
            height: 32,
            cursor: 'pointer',
            color: 'var(--text-1)',
            fontSize: 18,
          }}
        >
          ×
        </button>
      </div>

      {/* Общие */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(220px,1fr))',
          gap: 12,
          marginBottom: 22,
        }}
      >
        <label style={{ fontSize: 11, color: 'var(--text-3)' }} htmlFor="own-author">
          {t('se.general.author')}
          <input
            id="own-author"
            name="own-author"
            value={ownAuthor}
            onChange={(e) => setOwnAuthor(e.target.value)}
            style={{ ...inp, marginTop: 4 }}
          />
        </label>
        <label style={{ fontSize: 11, color: 'var(--text-3)' }} htmlFor="cadence-goal">
          {t('se.general.cadence')}
          <input
            id="cadence-goal"
            name="cadence-goal"
            type="number"
            min={1}
            max={14}
            value={cadenceGoal}
            onChange={(e) => setCadenceGoal(Number(e.target.value))}
            style={{ ...inp, marginTop: 4 }}
          />
        </label>
        <label style={{ fontSize: 11, color: 'var(--text-3)' }} htmlFor="settings-niche">
          {t('se.general.niche')}
          <select
            id="settings-niche"
            name="settings-niche"
            value={niche || ''}
            onChange={(e) => setNiche(e.target.value)}
            style={{ ...inp, marginTop: 4 }}
          >
            <option value="">{t('onb.niche.none')}</option>
            {NICHES.map((n) => (
              <option key={n.id} value={n.id}>
                {t(('niche.' + n.id) as DictKey)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Гардрейлы */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600 }}>{t('cl.guard.title')}</h3>
        <button
          type="button"
          onClick={() => {
            resetRules();
            flash(t('se.guard.resetToast'));
          }}
          style={{ fontSize: 12, color: 'var(--text-accent)', background: 'none', border: 'none', cursor: 'pointer' }}
        >
          {t('se.guard.reset')}
        </button>
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 6 }}>
        {t('se.guard.note.a')}
        <b>hard</b>
        {t('se.guard.note.b')}
      </div>
      {/* SEC-6: честная граница доверия localStorage */}
      <div style={{ fontSize: 12, color: 'var(--warning)', marginBottom: 10 }}>{t('se.guard.trust')}</div>

      <div style={{ marginBottom: 16 }}>
        {rules.map((r) => (
          <RuleRow key={r.id} rule={r} />
        ))}
      </div>

      {/* Б3: нишевые пакеты правил */}
      <div
        style={{
          background: 'var(--surface-2)',
          border: '1px solid var(--border)',
          borderRadius: 10,
          padding: 12,
          marginBottom: 16,
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>{t('se.packs.title')}</div>
        {NICHE_PACKS.map((pack) => {
          const active = rules.some((r) => r.pack === pack.id);
          return (
            <div key={pack.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <input
                type="checkbox"
                id={'pack-' + pack.id}
                checked={active}
                onChange={() => toggleNichePack(pack.id)}
                aria-label={t('se.packs.aria') + pack.label}
                style={{ marginTop: 3 }}
              />
              <label htmlFor={'pack-' + pack.id} style={{ cursor: 'pointer' }}>
                <span style={{ fontSize: 13, fontWeight: 500 }}>{pack.label}</span>
                <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
                  {' '}
                  · {pack.rules.length}
                  {t('se.packs.rules')}
                  {pack.formulas.length}
                  {t('se.packs.formulas')}
                </span>
                <div style={{ fontSize: 11.5, color: 'var(--warning)', marginTop: 2 }}>{pack.disclaimer}</div>
              </label>
            </div>
          );
        })}
      </div>

      {/* Добавить правило */}
      <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10, padding: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>{t('se.add.title')}</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <input
            id="rule-label"
            name="rule-label"
            autoComplete="off"
            value={nLabel}
            onChange={(e) => setNLabel(e.target.value)}
            placeholder={t('se.add.name.ph')}
            style={inp}
            aria-label={t('se.add.name.aria')}
          />
          <input
            id="rule-pattern"
            name="rule-pattern"
            autoComplete="off"
            value={nPattern}
            onChange={(e) => {
              setNPattern(e.target.value);
              setPatternErr('');
            }}
            placeholder={t('se.add.pattern.ph')}
            style={{ ...inp, fontFamily: 'var(--mono)' }}
            aria-label={t('se.add.pattern.aria')}
          />
          <input
            id="rule-message"
            name="rule-message"
            autoComplete="off"
            value={nMsg}
            onChange={(e) => setNMsg(e.target.value)}
            placeholder={t('se.add.msg.ph')}
            style={inp}
            aria-label={t('se.add.msg.aria')}
          />
          <select
            value={nSev}
            onChange={(e) => setNSev(e.target.value as Rule['severity'])}
            style={inp}
            aria-label={t('se.add.sev.aria')}
          >
            <option value="soft">{t('se.rule.soft')}</option>
            <option value="hard">{t('se.rule.hard')}</option>
          </select>
        </div>
        {patternErr && <div style={{ color: 'var(--critical)', fontSize: 12, marginTop: 8 }}>{patternErr}</div>}
        <div style={{ marginTop: 10, textAlign: 'right' }}>
          <Btn variant="accent" onClick={addCustom}>
            {t('se.add.btn')}
          </Btn>
        </div>
      </div>

      {/* М32 (Б10): бэкап и восстановление всего состояния */}
      <div style={{ marginTop: 20, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>{t('se.data.title')}</h3>
        <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 10 }}>{t('se.data.note')}</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <Btn
            variant="accent"
            onClick={() => {
              download('link-and-up-backup.json', exportStateJson(toPersistedSlice(useStore.getState())));
              flash(t('se.data.downloaded'));
            }}
          >
            {t('se.data.download')}
          </Btn>
          <label style={{ fontSize: 13, cursor: 'pointer', color: 'var(--text-accent)' }}>
            {t('se.data.restore')}
            <input
              type="file"
              accept="application/json,.json"
              onChange={onRestoreFile}
              style={{ display: 'none' }}
              aria-label={t('se.data.restore.aria')}
            />
          </label>
        </div>
      </div>

      {/* OBS-1: локальный журнал действий */}
      <div style={{ marginTop: 20, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
        <div
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}
        >
          <h3 style={{ fontSize: 14, fontWeight: 600 }}>{t('se.audit.title')}</h3>
          <Btn
            disabled={!auditLog.length}
            onClick={() => {
              download('audit-log.csv', exportAuditCsv(auditLog), 'text/csv;charset=utf-8');
              flash(t('se.audit.exported'));
            }}
          >
            {t('se.audit.export')}
            {auditLog.length})
          </Btn>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 6 }}>{t('se.audit.note')}</div>
      </div>

      {/* SEC-6: полное удаление данных */}
      <div style={{ marginTop: 20, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--critical)', marginBottom: 6 }}>
          {t('se.danger.title')}
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => {
              void askConfirm(t('se.danger.confirm')).then((ok) => {
                if (!ok) return;
                useStore.persist.clearStorage();
                location.reload();
              });
            }}
            style={{
              background: 'var(--critical-soft)',
              border: '1px solid var(--critical)',
              borderRadius: 'var(--radius-ctl)',
              padding: '8px 12px',
              color: 'var(--critical)',
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            {t('se.danger.btn')}
          </button>
          <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{t('se.danger.note')}</span>
        </div>
      </div>
    </Modal>
  );
}
