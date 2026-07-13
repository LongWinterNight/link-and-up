import { useEffect, useRef, useState } from 'react';
import { useStore } from '@/store';
import { CLUSTER_LABEL } from '@/lib/constants';
import { buildPostSearchUrl } from '@/lib/links';
import { nf } from '@/lib/stats';
import type { CtaType, Emotion, FormatFlag, HookType, Structure } from '@/types';
import { Btn, Pill } from './ui';

const HOOKS: HookType[] = ['вопрос', 'цифра-статистика', 'провокация/контртезис', 'личная история', 'обещание пользы', 'пугающий факт'];
const STRUCTS: Structure[] = ['нумерованный список', 'сюжетная арка', 'кейс с цифрами', 'конспект', 'карусель', 'пошаговый гайд', 'манифест'];
const CTAS: CtaType[] = ['вопрос в конце', 'лид-магнит-в-комменты', 'сохрани', 'без CTA'];
const EMOS: Emotion[] = ['уязвимость', 'юмор', 'амбиция', 'тревога', 'вдохновение', 'нейтрально'];
const FLAGS: FormatFlag[] = ['has_numbers', 'personal_story', 'contrarian', 'list_format', 'save_bait'];

const tagSel: React.CSSProperties = { background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-ctl)', padding: '6px 8px', color: 'var(--text-1)', fontSize: 12.5 };

export default function PostModal() {
  const id = useStore((s) => s.selectedPostId);
  const post = useStore((s) => s.posts.find((p) => p.id === id) || null);
  const close = useStore((s) => s.closePost);
  const readOnly = useStore((s) => s.readOnly);
  const isDemo = useStore((s) => s.isDemo);
  const updatePostTag = useStore((s) => s.updatePostTag);
  const retagPost = useStore((s) => s.retagPost);
  const [editTags, setEditTags] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const lastFocus = useRef<Element | null>(null);

  useEffect(() => {
    if (!id) return;
    lastFocus.current = document.activeElement;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      if (e.key === 'Tab' && dialogRef.current) {
        const f = [...dialogRef.current.querySelectorAll<HTMLElement>('button,a[href],[tabindex]:not([tabindex="-1"])')].filter((el) => el.offsetParent !== null);
        if (!f.length) return;
        const first = f[0];
        const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    requestAnimationFrame(() => dialogRef.current?.querySelector<HTMLElement>('button,a[href]')?.focus());
    return () => {
      document.removeEventListener('keydown', onKey);
      (lastFocus.current as HTMLElement | null)?.focus?.();
    };
  }, [id, close]);

  if (!post) return null;

  const body = post.text.replace(/\s*Формат\s*:.*/is, '').trim();
  const fmt = post.tags.formatText;

  return (
    <div
      onClick={close}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 50 }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={'Пост: ' + post.author}
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--surface-1)',
          border: '1px solid var(--border-strong)',
          borderRadius: 'var(--radius-card)',
          boxShadow: 'var(--shadow-modal)',
          width: 'min(720px, 100%)',
          maxHeight: '86vh',
          overflowY: 'auto',
          padding: 20,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', marginBottom: 12 }}>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 700 }}>{post.author}</h2>
            {post.headline && <div style={{ fontSize: 12.5, color: 'var(--text-3)', marginTop: 2 }}>{post.headline}</div>}
          </div>
          <button type="button" onClick={close} aria-label="Закрыть" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', color: 'var(--text-1)', fontSize: 18, flexShrink: 0 }}>
            ×
          </button>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
          <Pill kind="cluster">{CLUSTER_LABEL[post.meta_cluster]}</Pill>
          <Pill kind="lang">{post.lang}</Pill>
          {post.has_metrics ? (
            <Pill kind="metric">♥ {nf(post.reactions)} · 💬 {nf(post.comments)}{post.rate != null ? ` · ER ${(post.rate * 100).toFixed(2)}%` : ''}</Pill>
          ) : (
            <Pill kind="nometric">метрика неизвестна (0 ≠ ноль)</Pill>
          )}
        </div>

        <p style={{ fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-wrap', color: 'var(--text-1)', margin: '0 0 16px' }}>{body}</p>

        {fmt && (
          <div style={{ background: 'var(--warning-soft)', border: '1px solid var(--border-warning)', borderRadius: 10, padding: '12px 14px', marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--warning)', letterSpacing: '0.04em', marginBottom: 6 }}>ФОРМАТ / ПРИЁМ</div>
            <div style={{ fontSize: 13.5, color: 'var(--text-1)', whiteSpace: 'pre-wrap' }}>{fmt}</div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
          <Pill>{post.tags.hook_type}</Pill>
          <Pill>{post.tags.structure}</Pill>
          <Pill>{post.tags.cta_type}</Pill>
          <Pill>{post.tags.emotion}</Pill>
          {post.tags.flags.map((f) => (
            <Pill key={f}>{f}</Pill>
          ))}
          {!readOnly && (
            <button type="button" onClick={() => setEditTags((v) => !v)} style={{ fontSize: 11, background: 'none', border: 'none', color: 'var(--text-accent)', cursor: 'pointer', marginLeft: 'auto' }}>
              {editTags ? 'Скрыть редактор' : 'Редактировать теги'}
            </button>
          )}
        </div>

        {editTags && !readOnly && (
          <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10, padding: 12, marginBottom: 14 }}>
            {post.tags_edited && <div style={{ fontSize: 11, color: 'var(--warning)', marginBottom: 8 }}>Теги правились вручную (golden-set для контроля авто-теггинга).</div>}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px,1fr))', gap: 8 }}>
              <label style={{ fontSize: 11, color: 'var(--text-3)' }}>Хук
                <select value={post.tags.hook_type} onChange={(e) => updatePostTag(post.id, 'hook_type', e.target.value)} style={{ ...tagSel, width: '100%', marginTop: 4 }}>
                  {HOOKS.map((h) => <option key={h} value={h}>{h}</option>)}
                </select>
              </label>
              <label style={{ fontSize: 11, color: 'var(--text-3)' }}>Структура
                <select value={post.tags.structure} onChange={(e) => updatePostTag(post.id, 'structure', e.target.value)} style={{ ...tagSel, width: '100%', marginTop: 4 }}>
                  {STRUCTS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </label>
              <label style={{ fontSize: 11, color: 'var(--text-3)' }}>CTA
                <select value={post.tags.cta_type} onChange={(e) => updatePostTag(post.id, 'cta_type', e.target.value)} style={{ ...tagSel, width: '100%', marginTop: 4 }}>
                  {CTAS.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </label>
              <label style={{ fontSize: 11, color: 'var(--text-3)' }}>Эмоция
                <select value={post.tags.emotion} onChange={(e) => updatePostTag(post.id, 'emotion', e.target.value)} style={{ ...tagSel, width: '100%', marginTop: 4 }}>
                  {EMOS.map((e2) => <option key={e2} value={e2}>{e2}</option>)}
                </select>
              </label>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
              {FLAGS.map((f) => {
                const on = post.tags.flags.includes(f);
                return (
                  <button key={f} type="button" onClick={() => updatePostTag(post.id, 'flags', f)} style={{ fontSize: 11, padding: '3px 9px', borderRadius: 'var(--radius-pill)', cursor: 'pointer', background: on ? 'var(--accent-soft)' : 'var(--surface-1)', border: `1px solid ${on ? 'var(--accent)' : 'var(--border)'}`, color: on ? 'var(--text-accent)' : 'var(--text-3)' }}>
                    {on ? '✓ ' : ''}{f}
                  </button>
                );
              })}
            </div>
            <div style={{ marginTop: 10 }}>
              <Btn onClick={() => retagPost(post.id)}>Сбросить к авто-тегам</Btn>
            </div>
          </div>
        )}

        <div style={{ fontSize: 12, color: 'var(--text-3)', display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          <span>Угол: {post.query.replace(/^tavily:/, '')}</span>
          {post.followers != null && <span>Подписчиков: {nf(post.followers)}</span>}
          {post.collected_at && <span>Собран: {post.collected_at}</span>}
          {post.url && (
            <a href={/^https?:\/\//.test(post.url) ? post.url : `https://${post.url}`} target="_blank" rel="noopener noreferrer">
              Открыть источник ↗
            </a>
          )}
          {/* пермалинки демо-корпуса реконструированы при сборе и могут не открываться —
              поиск по точной цитате находит пост надёжнее прямой ссылки */}
          <a href={buildPostSearchUrl(post)} target="_blank" rel="noopener noreferrer">
            Найти пост поиском ↗
          </a>
        </div>
        {isDemo && (
          <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 8 }}>
            Демо-корпус: ссылки на источники собраны поисковой выборкой и могут не открываться — используйте «Найти пост поиском».
          </div>
        )}
      </div>
    </div>
  );
}
