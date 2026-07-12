import { useEffect, useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useStore } from '@/store';
import { filterPosts } from '@/lib/derive';
import { CLUSTERS, CLUSTER_LABEL } from '@/lib/constants';
import type { HookType, Post, Structure } from '@/types';
import { nf } from '@/lib/stats';
import { EmptyState, Pill } from '@/components/ui';
import EmptyCorpus from '@/components/EmptyCorpus';

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
        <Pill kind="cluster">{CLUSTER_LABEL[post.meta_cluster]}</Pill>
        <Pill kind="lang">{post.lang}</Pill>
        {post.has_metrics ? (
          <Pill kind="metric">
            ♥ {nf(post.reactions)} · 💬 {nf(post.comments)}
          </Pill>
        ) : (
          <Pill kind="nometric">нет метрик</Pill>
        )}
      </div>
      <div style={{ fontSize: 13, color: 'var(--text-2)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
        {post.text.replace(/\s*Формат\s*:.*/is, '').trim()}
      </div>
      <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
        <Pill>{post.tags.hook_type}</Pill>
        <Pill>{post.tags.structure}</Pill>
        {post.tags.cta_type !== 'без CTA' && <Pill>{post.tags.cta_type}</Pill>}
      </div>
    </button>
  );
}

const COLS: [string, string][] = [
  ['author', 'Автор'],
  ['cluster', 'Кластер'],
  ['lang', 'Язык'],
  ['reactions', '♥'],
  ['comments', '💬'],
  ['rate', 'ER'],
  ['hook', 'Хук'],
  ['structure', 'Структура'],
];
const GRID = 'minmax(140px,1.4fr) 120px 52px 72px 72px 80px minmax(120px,1fr) minmax(140px,1.2fr)';

function TableView({ list, openPost }: { list: Post[]; openPost: (id: string) => void }) {
  const parentRef = useRef<HTMLDivElement>(null);
  const virt = useVirtualizer({
    count: list.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 44,
    overscan: 12,
  });
  const cell: React.CSSProperties = { padding: '0 8px', fontSize: 12.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center' };
  return (
    <div role="table" aria-label="Таблица постов" aria-rowcount={list.length + 1} style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', overflow: 'hidden' }}>
      <div style={{ overflowX: 'auto' }}>
        <div style={{ minWidth: 860 }}>
          <div role="row" aria-rowindex={1} style={{ display: 'grid', gridTemplateColumns: GRID, background: 'var(--surface-2)', borderBottom: '1px solid var(--border)', height: 38, fontSize: 11, fontWeight: 600, color: 'var(--text-3)' }}>
            {COLS.map(([k, l]) => (
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
                    <div style={cell}>{CLUSTER_LABEL[p.meta_cluster]}</div>
                    <div style={cell}>{p.lang}</div>
                    <div style={{ ...cell, justifyContent: 'flex-end' }} className="num">{p.has_metrics ? nf(p.reactions) : '—'}</div>
                    <div style={{ ...cell, justifyContent: 'flex-end' }} className="num">{p.has_metrics ? nf(p.comments) : '—'}</div>
                    <div style={{ ...cell, justifyContent: 'flex-end' }} className="num">{p.rate != null ? (p.rate * 100).toFixed(2) + '%' : '—'}</div>
                    <div style={{ ...cell, color: 'var(--text-3)' }}>{p.tags.hook_type}</div>
                    <div style={{ ...cell, color: 'var(--text-3)' }}>{p.tags.structure}</div>
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
          placeholder="Имя пресета фильтров"
          aria-label="Имя пресета"
          style={{ ...selStyle, padding: '6px 10px', width: 180 }}
        />
        <button type="button" onClick={save} style={{ ...selStyle, cursor: 'pointer', padding: '6px 12px' }}>Сохранить</button>
      </div>
      {presets.map((p) => (
        <span key={p.name} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-pill)', padding: '2px 4px 2px 10px', fontSize: 12 }}>
          <button type="button" onClick={() => applyPreset(p.name)} style={{ background: 'none', border: 'none', color: 'var(--text-accent)', cursor: 'pointer', fontSize: 12 }}>{p.name}</button>
          <button type="button" onClick={() => deletePreset(p.name)} aria-label={'Удалить пресет ' + p.name} style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', width: 18, height: 18, lineHeight: '16px' }}>×</button>
        </span>
      ))}
    </div>
  );
}

export default function Explorer() {
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
    return <EmptyCorpus title="Нет постов для анализа" hint="Загрузите свой экспорт постов (JSON-массив) — они появятся здесь с фильтрами, поиском и таблицей. Или верните демо-корпус." />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <input
        type="search"
        id="post-search"
        name="post-search"
        value={searchLocal}
        onChange={(e) => onSearch(e.target.value)}
        placeholder="Поиск по автору, тексту, углу…"
        aria-label="Поиск постов"
        style={{ ...selStyle, padding: '10px 12px', fontSize: 14 }}
      />

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <Sel label="Кластер" value={filters.cluster} onChange={(v) => setFilters({ cluster: v })} options={[['all', 'Все кластеры'], ...CLUSTERS]} />
        <Sel label="Язык" value={filters.lang} onChange={(v) => setFilters({ lang: v })} options={[['all', 'Все языки'], ['RU', 'RU'], ['EN', 'EN']]} />
        <Sel label="Метрики" value={filters.metrics} onChange={(v) => setFilters({ metrics: v })} options={[['all', 'Все'], ['yes', 'С метриками'], ['no', 'Без метрик']]} />
        <Sel label="Хук" value={filters.hook} onChange={(v) => setFilters({ hook: v })} options={[['all', 'Любой хук'], ...HOOKS.map((h) => [h, h] as [string, string])]} />
        <Sel label="Структура" value={filters.structure} onChange={(v) => setFilters({ structure: v })} options={[['all', 'Любая структура'], ...STRUCTS.map((s) => [s, s] as [string, string])]} />
        <Sel
          label="Сортировка"
          value={filters.sort}
          onChange={(v) => setFilters({ sort: v })}
          options={[['comments', 'По комментариям'], ['reactions', 'По реакциям'], ['rate', 'По ER'], ['date', 'По дате сбора']]}
        />
        <button type="button" onClick={resetFilters} style={{ ...selStyle, cursor: 'pointer', alignSelf: 'flex-end' }}>
          Сбросить
        </button>
      </div>

      <Presets />

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
          Показано <span className="num">{nf(list.length)}</span> из <span className="num">{nf(posts.length)}</span> постов
        </div>
        <div role="group" aria-label="Вид списка" style={{ display: 'flex', gap: 6 }}>
          {toggleBtn('cards', 'Карточки')}
          {toggleBtn('table', 'Таблица')}
        </div>
      </div>

      {list.length === 0 ? (
        <EmptyState>Ничего не найдено — измените фильтры или запрос.</EmptyState>
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
