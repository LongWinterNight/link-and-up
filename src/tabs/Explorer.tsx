import { useEffect, useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useStore } from '@/store';
import { filterPosts } from '@/lib/derive';
import { CLUSTERS } from '@/lib/constants';
import type { HookType, Post, Structure } from '@/types';
import { nf } from '@/lib/stats';
import { EmptyState, Pill } from '@/components/ui';
import EmptyCorpus from '@/components/EmptyCorpus';
import { useClusterLabel, useLbl, useT } from '@/i18n/useT';

const HOOKS: HookType[] = ['вопрос', 'цифра-статистика', 'провокация/контртезис', 'личная история', 'обещание пользы', 'пугающий факт'];
const STRUCTS: Structure[] = ['нумерованный список', 'сюжетная арка', 'кейс с цифрами', 'конспект', 'карусель', 'пошаговый гайд', 'манифест'];

const selStyle: React.CSSProperties = {
  background: 'var(--surface-2)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-ctl)',
  padding: '8px 10px',
  color: 'var(--text-1)',
  fontSize: 13,
};

function Sel({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11, color: 'var(--text-3)' }}>
      {label}
      <select value={value} onChange={(e) => onChange(e.target.value)} style={selStyle} aria-label={label}>
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}

function PostCard({ post, onOpen }: { post: Post; onOpen: () => void }) {
  const t = useT();
  const lbl = useLbl();
  const cl = useClusterLabel();
  return (
    <button
      type="button"
      onClick={onOpen}
      style={{
        display: 'block',
        width: '100%',
        textAlign: 'left',
        background: 'var(--surface-1)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-card)',
        padding: 14,
        cursor: 'pointer',
        color: 'inherit',
      }}
    >
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6, flexWrap: 'wrap' }}>
        <strong style={{ fontSize: 13.5 }}>{post.author}</strong>
        <Pill kind="cluster">{cl(post.meta_cluster)}</Pill>
        <Pill kind="lang">{post.lang}</Pill>
        {post.has_metrics ? (
          <Pill kind="metric">
            ♥ {nf(post.reactions)} · 💬 {nf(post.comments)}
          </Pill>
        ) : (
          <Pill kind="nometric">{t('ex.noMetrics')}</Pill>
        )}
      </div>
      <div style={{ fontSize: 13, color: 'var(--text-2)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
        {post.text.replace(/\s*Формат\s*:.*/is, '').trim()}
      </div>
      <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
        <Pill>{lbl(post.tags.hook_type)}</Pill>
        <Pill>{lbl(post.tags.structure)}</Pill>
        {post.tags.cta_type !== 'без CTA' && <Pill>{lbl(post.tags.cta_type)}</Pill>}
      </div>
    </button>
  );
}

const GRID = 'minmax(140px,1.4fr) 120px 52px 72px 72px 80px minmax(120px,1fr) minmax(140px,1.2fr)';

function TableView({ list, openPost }: { list: Post[]; openPost: (id: string) => void }) {
  const t = useT();
  const lbl = useLbl();
  const cl = useClusterLabel();
  const parentRef = useRef<HTMLDivElement>(null);
  const virt = useVirtualizer({
    count: list.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 44,
    overscan: 12,
  });
  const cols: [string, string][] = [
    ['author', t('ex.col.author')],
    ['cluster', t('ex.col.cluster')],
    ['lang', t('ex.col.lang')],
    ['reactions', '♥'],
    ['comments', '💬'],
    ['rate', t('ex.col.er')],
    ['hook', t('ex.col.hook')],
    ['structure', t('ex.col.structure')],
  ];
  const cell: React.CSSProperties = { padding: '0 8px', fontSize: 12.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center' };
  return (
    <div role="table" aria-label={t('ex.table.aria')} aria-rowcount={list.length + 1} style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', overflow: 'hidden' }}>
      <div style={{ overflowX: 'auto' }}>
        <div style={{ minWidth: 860 }}>
          <div role="row" aria-rowindex={1} style={{ display: 'grid', gridTemplateColumns: GRID, background: 'var(--surface-2)', borderBottom: '1px solid var(--border)', height: 38, fontSize: 11, fontWeight: 600, color: 'var(--text-3)' }}>
            {cols.map(([k, l]) => (
              <div key={k} role="columnheader" style={{ ...cell, fontSize: 11 }}>{l}</div>
            ))}
          </div>
          <div ref={parentRef} style={{ height: 'calc(100vh - 380px)', minHeight: 320, overflowY: 'auto' }}>
            <div style={{ height: virt.getTotalSize(), position: 'relative' }}>
              {virt.getVirtualItems().map((vi) => {
                const p = list[vi.index];
                return (
                  <div
                    key={p.id}
                    role="row"
                    aria-rowindex={vi.index + 2}
                    tabIndex={0}
                    onClick={() => openPost(p.id)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openPost(p.id); } }}
                    style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: 44, transform: `translateY(${vi.start}px)`, display: 'grid', gridTemplateColumns: GRID, borderBottom: '1px solid var(--border)', cursor: 'pointer', background: vi.index % 2 ? 'var(--surface-0)' : 'transparent' }}
                  >
                    <div style={cell}><strong style={{ fontWeight: 500 }}>{p.author}</strong></div>
                    <div style={cell}>{cl(p.meta_cluster)}</div>
                    <div style={cell}>{p.lang}</div>
                    <div style={{ ...cell, justifyContent: 'flex-end' }} className="num">{p.has_metrics ? nf(p.reactions) : '—'}</div>
                    <div style={{ ...cell, justifyContent: 'flex-end' }} className="num">{p.has_metrics ? nf(p.comments) : '—'}</div>
                    <div style={{ ...cell, justifyContent: 'flex-end' }} className="num">{p.rate != null ? (p.rate * 100).toFixed(2) + '%' : '—'}</div>
                    <div style={{ ...cell, color: 'var(--text-3)' }}>{lbl(p.tags.hook_type)}</div>
                    <div style={{ ...cell, color: 'var(--text-3)' }}>{lbl(p.tags.structure)}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Presets() {
  const t = useT();
  const presets = useStore((s) => s.presets);
  const savePreset = useStore((s) => s.savePreset);
  const applyPreset = useStore((s) => s.applyPreset);
  const deletePreset = useStore((s) => s.deletePreset);
  const [name, setName] = useState('');
  const save = () => { savePreset(name); setName(''); };
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <input
          id="preset-name"
          name="preset-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') save(); }}
          placeholder={t('ex.preset.placeholder')}
          aria-label={t('ex.preset.aria')}
          style={{ ...selStyle, padding: '6px 10px', width: 180 }}
        />
        <button type="button" onClick={save} style={{ ...selStyle, cursor: 'pointer', padding: '6px 12px' }}>{t('ex.preset.save')}</button>
      </div>
      {presets.map((p) => (
        <span key={p.name} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-pill)', padding: '2px 4px 2px 10px', fontSize: 12 }}>
          <button type="button" onClick={() => applyPreset(p.name)} style={{ background: 'none', border: 'none', color: 'var(--text-accent)', cursor: 'pointer', fontSize: 12 }}>{p.name}</button>
          <button type="button" onClick={() => deletePreset(p.name)} aria-label={t('ex.preset.delete') + p.name} style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', width: 18, height: 18, lineHeight: '16px' }}>×</button>
        </span>
      ))}
    </div>
  );
}

export default function Explorer() {
  const t = useT();
  const lbl = useLbl();
  const cl = useClusterLabel();
  const posts = useStore((s) => s.posts);
  const search = useStore((s) => s.search);
  const setSearch = useStore((s) => s.setSearch);
  const filters = useStore((s) => s.filters);
  const setFilters = useStore((s) => s.setFilters);
  const resetFilters = useStore((s) => s.resetFilters);
  const openPost = useStore((s) => s.openPost);
  const viewMode = useStore((s) => s.viewMode);
  const setViewMode = useStore((s) => s.setViewMode);

  // SCALE-4: debounce поиска — на 20K постов каждый keystroke стоил ~50мс фильтрации
  const [searchLocal, setSearchLocal] = useState(search);
  const searchTimer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => setSearchLocal(search), [search]); // внешние изменения (пресеты, сброс)
  const onSearch = (v: string) => {
    setSearchLocal(v);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setSearch(v), 150);
  };

  const list = useMemo(() => filterPosts(posts, search, filters), [posts, search, filters]);

  const parentRef = useRef<HTMLDivElement>(null);
  const virt = useVirtualizer({
    count: list.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 128,
    overscan: 6,
    gap: 10,
  });

  const toggleBtn = (mode: 'cards' | 'table', label: string) => (
    <button
      type="button"
      onClick={() => setViewMode(mode)}
      aria-pressed={viewMode === mode}
      style={{ ...selStyle, cursor: 'pointer', padding: '6px 12px', background: viewMode === mode ? 'var(--surface-3)' : 'var(--surface-2)', fontWeight: viewMode === mode ? 600 : 400 }}
    >
      {label}
    </button>
  );

  if (posts.length === 0) {
    return <EmptyCorpus title={t('ex.empty.title')} hint={t('ex.empty.hint')} />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <input
        type="search"
        id="post-search"
        name="post-search"
        value={searchLocal}
        onChange={(e) => onSearch(e.target.value)}
        placeholder={t('ex.search.placeholder')}
        aria-label={t('ex.search.aria')}
        style={{ ...selStyle, padding: '10px 12px', fontSize: 14 }}
      />

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <Sel label={t('ex.f.cluster')} value={filters.cluster} onChange={(v) => setFilters({ cluster: v })} options={[['all', t('ex.f.cluster.all')], ...CLUSTERS.map(([id]) => [id, cl(id)] as [string, string])]} />
        <Sel label={t('ex.f.lang')} value={filters.lang} onChange={(v) => setFilters({ lang: v })} options={[['all', t('ex.f.lang.all')], ['RU', 'RU'], ['EN', 'EN']]} />
        <Sel label={t('ex.f.metrics')} value={filters.metrics} onChange={(v) => setFilters({ metrics: v })} options={[['all', t('ex.f.metrics.all')], ['yes', t('ex.f.metrics.yes')], ['no', t('ex.f.metrics.no')]]} />
        <Sel label={t('ex.f.hook')} value={filters.hook} onChange={(v) => setFilters({ hook: v })} options={[['all', t('ex.f.hook.all')], ...HOOKS.map((h) => [h, lbl(h)] as [string, string])]} />
        <Sel label={t('ex.f.structure')} value={filters.structure} onChange={(v) => setFilters({ structure: v })} options={[['all', t('ex.f.structure.all')], ...STRUCTS.map((s) => [s, lbl(s)] as [string, string])]} />
        <Sel
          label={t('ex.f.sort')}
          value={filters.sort}
          onChange={(v) => setFilters({ sort: v })}
          options={[['comments', t('ex.sort.comments')], ['reactions', t('ex.sort.reactions')], ['rate', t('ex.sort.rate')], ['date', t('ex.sort.date')]]}
        />
        <button type="button" onClick={resetFilters} style={{ ...selStyle, cursor: 'pointer', alignSelf: 'flex-end' }}>
          {t('ex.reset')}
        </button>
      </div>

      <Presets />

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
          {t('ex.shown.a')}<span className="num">{nf(list.length)}</span>{t('ex.shown.b')}<span className="num">{nf(posts.length)}</span>{t('ex.shown.c')}
        </div>
        <div role="group" aria-label={t('ex.view.aria')} style={{ display: 'flex', gap: 6 }}>
          {toggleBtn('cards', t('ex.view.cards'))}
          {toggleBtn('table', t('ex.view.table'))}
        </div>
      </div>

      {list.length === 0 ? (
        <EmptyState>{t('ex.notFound')}</EmptyState>
      ) : viewMode === 'table' ? (
        <TableView list={list} openPost={openPost} />
      ) : (
        <div ref={parentRef} style={{ height: 'calc(100vh - 320px)', minHeight: 360, overflowY: 'auto' }}>
          <div style={{ height: virt.getTotalSize(), position: 'relative' }}>
            {virt.getVirtualItems().map((vi) => {
              const post = list[vi.index];
              return (
                <div
                  key={post.id}
                  ref={virt.measureElement}
                  data-index={vi.index}
                  style={{ position: 'absolute', top: 0, left: 0, width: '100%', transform: `translateY(${vi.start}px)` }}
                >
                  <PostCard post={post} onOpen={() => openPost(post.id)} />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
