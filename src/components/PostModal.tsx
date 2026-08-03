import { useState } from 'react';
import { useStore } from '@/store';
import { buildPostSearchUrl } from '@/lib/links';
import { nf } from '@/lib/stats';
import type { CtaType, Emotion, FormatFlag, HookType, Structure } from '@/types';
import { Btn, Pill } from './ui';
import { Modal } from './Modal';
import { useClusterLabel, useLbl, useT } from '@/i18n/useT';
import ShareCardModal from './ShareCardModal';

const HOOKS: HookType[] = [
  'вопрос',
  'цифра-статистика',
  'провокация/контртезис',
  'личная история',
  'обещание пользы',
  'пугающий факт',
];
const STRUCTS: Structure[] = [
  'нумерованный список',
  'сюжетная арка',
  'кейс с цифрами',
  'конспект',
  'карусель',
  'пошаговый гайд',
  'манифест',
];
const CTAS: CtaType[] = ['вопрос в конце', 'лид-магнит-в-комменты', 'сохрани', 'без CTA'];
const EMOS: Emotion[] = ['уязвимость', 'юмор', 'амбиция', 'тревога', 'вдохновение', 'нейтрально'];
const FLAGS: FormatFlag[] = ['has_numbers', 'personal_story', 'contrarian', 'list_format', 'save_bait'];

const tagSel: React.CSSProperties = {
  background: 'var(--surface-2)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-ctl)',
  padding: '6px 8px',
  color: 'var(--text-1)',
  fontSize: 12.5,
};

export default function PostModal() {
  const t = useT();
  const lbl = useLbl();
  const cl = useClusterLabel();
  const id = useStore((s) => s.selectedPostId);
  const post = useStore((s) => s.posts.find((p) => p.id === id) || null);
  const close = useStore((s) => s.closePost);
  const readOnly = useStore((s) => s.readOnly);
  const isDemo = useStore((s) => s.isDemo);
  const updatePostTag = useStore((s) => s.updatePostTag);
  const retagPost = useStore((s) => s.retagPost);
  const [editTags, setEditTags] = useState(false);
  const [shareOpen, setShareOpen] = useState(false); // Б8: карточка разбора

  if (!post) return null;

  const body = post.text.replace(/\s*Формат\s*:.*/is, '').trim();
  const fmt = post.tags.formatText;

  return (
    <Modal onClose={close} label={t('pm.aria') + post.author} width={720} zIndex={50}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 12,
          alignItems: 'flex-start',
          marginBottom: 12,
        }}
      >
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 700 }}>{post.author}</h2>
          {post.headline && <div style={{ fontSize: 12.5, color: 'var(--text-3)', marginTop: 2 }}>{post.headline}</div>}
        </div>
        <button
          type="button"
          onClick={close}
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
            flexShrink: 0,
          }}
        >
          ×
        </button>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        <Pill kind="cluster">{cl(post.meta_cluster)}</Pill>
        <Pill kind="lang">{post.lang}</Pill>
        {post.has_metrics ? (
          <Pill kind="metric">
            ♥ {post.reactions > 0 ? nf(post.reactions) : '—'} · 💬 {post.comments > 0 ? nf(post.comments) : '—'}
            {post.rate != null ? ` · ER ${(post.rate * 100).toFixed(2)}%` : ''}
          </Pill>
        ) : (
          <Pill kind="nometric">{t('pm.nometric')}</Pill>
        )}
      </div>

      <p style={{ fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-wrap', color: 'var(--text-1)', margin: '0 0 16px' }}>
        {body}
      </p>

      {fmt && (
        <div
          style={{
            background: 'var(--warning-soft)',
            border: '1px solid var(--border-warning)',
            borderRadius: 10,
            padding: '12px 14px',
            marginBottom: 14,
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: 'var(--warning)',
              letterSpacing: '0.04em',
              marginBottom: 6,
            }}
          >
            {t('pm.format')}
          </div>
          <div style={{ fontSize: 13.5, color: 'var(--text-1)', whiteSpace: 'pre-wrap' }}>{fmt}</div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
        <Pill>{lbl(post.tags.hook_type)}</Pill>
        <Pill>{lbl(post.tags.structure)}</Pill>
        <Pill>{lbl(post.tags.cta_type)}</Pill>
        <Pill>{lbl(post.tags.emotion)}</Pill>
        {post.tags.flags.map((f) => (
          <Pill key={f}>{f}</Pill>
        ))}
        {!readOnly && (
          <button
            type="button"
            onClick={() => setEditTags((v) => !v)}
            style={{
              fontSize: 11,
              background: 'none',
              border: 'none',
              color: 'var(--text-accent)',
              cursor: 'pointer',
              marginLeft: 'auto',
            }}
          >
            {editTags ? t('pm.tags.hide') : t('pm.tags.edit')}
          </button>
        )}
      </div>

      {editTags && !readOnly && (
        <div
          style={{
            background: 'var(--surface-2)',
            border: '1px solid var(--border)',
            borderRadius: 10,
            padding: 12,
            marginBottom: 14,
          }}
        >
          {post.tags_edited && (
            <div style={{ fontSize: 11, color: 'var(--warning)', marginBottom: 8 }}>{t('pm.tags.edited')}</div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px,1fr))', gap: 8 }}>
            <label style={{ fontSize: 11, color: 'var(--text-3)' }}>
              {t('ex.f.hook')}
              <select
                value={post.tags.hook_type}
                onChange={(e) => updatePostTag(post.id, 'hook_type', e.target.value)}
                style={{ ...tagSel, width: '100%', marginTop: 4 }}
              >
                {HOOKS.map((h) => (
                  <option key={h} value={h}>
                    {lbl(h)}
                  </option>
                ))}
              </select>
            </label>
            <label style={{ fontSize: 11, color: 'var(--text-3)' }}>
              {t('ex.f.structure')}
              <select
                value={post.tags.structure}
                onChange={(e) => updatePostTag(post.id, 'structure', e.target.value)}
                style={{ ...tagSel, width: '100%', marginTop: 4 }}
              >
                {STRUCTS.map((s) => (
                  <option key={s} value={s}>
                    {lbl(s)}
                  </option>
                ))}
              </select>
            </label>
            <label style={{ fontSize: 11, color: 'var(--text-3)' }}>
              CTA
              <select
                value={post.tags.cta_type}
                onChange={(e) => updatePostTag(post.id, 'cta_type', e.target.value)}
                style={{ ...tagSel, width: '100%', marginTop: 4 }}
              >
                {CTAS.map((c) => (
                  <option key={c} value={c}>
                    {lbl(c)}
                  </option>
                ))}
              </select>
            </label>
            <label style={{ fontSize: 11, color: 'var(--text-3)' }}>
              {t('pm.tags.emotion')}
              <select
                value={post.tags.emotion}
                onChange={(e) => updatePostTag(post.id, 'emotion', e.target.value)}
                style={{ ...tagSel, width: '100%', marginTop: 4 }}
              >
                {EMOS.map((e2) => (
                  <option key={e2} value={e2}>
                    {lbl(e2)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
            {FLAGS.map((f) => {
              const on = post.tags.flags.includes(f);
              return (
                <button
                  key={f}
                  type="button"
                  aria-pressed={on}
                  onClick={() => updatePostTag(post.id, 'flags', f)}
                  style={{
                    fontSize: 11,
                    padding: '3px 9px',
                    borderRadius: 'var(--radius-pill)',
                    cursor: 'pointer',
                    background: on ? 'var(--accent-soft)' : 'var(--surface-1)',
                    border: `1px solid ${on ? 'var(--accent)' : 'var(--border)'}`,
                    color: on ? 'var(--text-accent)' : 'var(--text-3)',
                  }}
                >
                  {on ? '✓ ' : ''}
                  {f}
                </button>
              );
            })}
          </div>
          <div style={{ marginTop: 10 }}>
            <Btn onClick={() => retagPost(post.id)}>{t('pm.tags.reset')}</Btn>
          </div>
        </div>
      )}

      <div style={{ fontSize: 12, color: 'var(--text-3)', display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        <span>
          {t('pm.angle')}
          {post.query.replace(/^tavily:/, '')}
        </span>
        {post.followers != null && (
          <span>
            {t('pm.followers')}
            {nf(post.followers)}
          </span>
        )}
        {post.collected_at && (
          <span>
            {t('pm.collected')}
            {post.collected_at}
          </span>
        )}
        {post.url && (
          <a
            href={/^https?:\/\//.test(post.url) ? post.url : `https://${post.url}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            {t('pm.openSource')}
          </a>
        )}
        {/* пермалинки демо-корпуса реконструированы при сборе и могут не открываться —
              поиск по точной цитате находит пост надёжнее прямой ссылки */}
        <a href={buildPostSearchUrl(post)} target="_blank" rel="noopener noreferrer">
          {t('pm.findSearch')}
        </a>
        <button
          type="button"
          onClick={() => setShareOpen(true)}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-accent)',
            cursor: 'pointer',
            fontSize: 12,
            padding: 0,
          }}
        >
          {t('sc.open')} ↗
        </button>
      </div>
      {isDemo && <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 8 }}>{t('pm.demoNote')}</div>}
      {shareOpen && <ShareCardModal post={post} onClose={() => setShareOpen(false)} />}
    </Modal>
  );
}
