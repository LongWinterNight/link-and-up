import { useMemo } from 'react';
import { useStore } from '@/store';
import { clusterStats, collectionByMonth, isPostingDay, kpis, topByComments, topByRate } from '@/lib/derive';
import { median, nf } from '@/lib/stats';
import { Bars, Donut } from '@/components/charts';
import { Btn, Kpi, Panel, Pill } from '@/components/ui';
import { CLUSTER_LABEL } from '@/lib/constants';
import EmptyCorpus from '@/components/EmptyCorpus';

function startOfWeek(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const day = (x.getDay() + 6) % 7; // понедельник = 0
  x.setDate(x.getDate() - day);
  return x;
}

export default function Overview() {
  const posts = useStore((s) => s.posts);
  const ideas = useStore((s) => s.ideas);
  const openPost = useStore((s) => s.openPost);
  const setTab = useStore((s) => s.setTab);
  const cadenceGoal = useStore((s) => s.cadenceGoal);

  const k = useMemo(() => kpis(posts), [posts]);
  const clusters = useMemo(() => clusterStats(posts), [posts]);
  const topC = useMemo(() => topByComments(posts, 12), [posts]);
  const topR = useMemo(() => topByRate(posts, 12), [posts]);
  const byMonth = useMemo(() => collectionByMonth(posts), [posts]);

  // North-Star: свои посты на этой неделе против цели 3–5
  const own = useMemo(() => posts.filter((p) => p.is_own), [posts]);
  const weekStart = startOfWeek(new Date());
  const ownThisWeek = own.filter((p) => new Date(p.collected_at || 0) >= weekStart).length;
  const goal = cadenceGoal;
  const pct = Math.min(100, Math.round((ownThisWeek / goal) * 100));
  const ownComments = own.filter((p) => p.has_metrics).map((p) => p.comments);
  const ownMed = ownComments.length ? nf(median(ownComments)) : '—';

  // P-6: retention-триггер — в день публикации предлагаем идеи из банка
  const postingDay = isPostingDay();
  const candidateIdeas = useMemo(() => ideas.filter((i) => i.status !== 'published').slice(0, 3), [ideas]);
  const showCadenceNudge = postingDay && ownThisWeek < goal;

  if (posts.length === 0) {
    return <EmptyCorpus title="Начните с загрузки постов" hint="Демо-корпус очищен. Загрузите свой экспорт (JSON-массив постов) — здесь появятся KPI, распределения по кластерам и топы. Или верните демо, чтобы изучить возможности." />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* North-Star */}
      <section
        style={{
          background: 'var(--surface-1)',
          border: '1px solid var(--border)',
          borderLeft: `4px solid ${ownThisWeek >= 3 ? 'var(--positive)' : 'var(--warning)'}`,
          borderRadius: 'var(--radius-card)',
          padding: 18,
          display: 'flex',
          gap: 24,
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        <div>
          <div style={{ fontSize: 12, color: 'var(--text-3)' }}>Опубликовано своих постов на этой неделе</div>
          <div className="num" style={{ fontSize: 40, fontWeight: 800, lineHeight: 1 }}>
            {ownThisWeek}
            <span style={{ fontSize: 18, color: 'var(--text-3)', fontWeight: 600 }}> / {goal}</span>
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ height: 10, background: 'var(--surface-2)', borderRadius: 6, overflow: 'hidden' }}>
            <div style={{ width: pct + '%', height: '100%', background: ownThisWeek >= 3 ? 'var(--positive)' : 'var(--warning)' }} />
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 8 }}>
            Цель — 3–5 постов/нед (вт–чт). Медиана откликов своих постов: <span className="num">{ownMed}</span> комм.
            {own.length === 0 && ' Пока нет опубликованных своих постов — заведите идею и внесите факт во вкладке «Прогноз».'}
          </div>
        </div>
      </section>

      {/* P-6: день публикации — идеи из банка под руку */}
      {showCadenceNudge && (
        <section style={{ background: 'var(--accent-soft)', border: '1px solid var(--accent)', borderRadius: 'var(--radius-card)', padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700 }}>Сегодня день публикации по вашему каденсу</div>
          {candidateIdeas.length > 0 ? (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {candidateIdeas.map((i) => (
                  <div key={i.id} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 500 }}>{i.title || 'Без названия'}</span>
                    <Pill kind="cluster">{CLUSTER_LABEL[i.cluster] || i.cluster}</Pill>
                  </div>
                ))}
              </div>
              <div>
                <Btn variant="accent" onClick={() => setTab('ideas')}>К идеям и черновику →</Btn>
              </div>
            </>
          ) : (
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 13, color: 'var(--text-2)' }}>Банк идей пуст — заведите первую, черновик соберётся по формуле.</span>
              <Btn variant="accent" onClick={() => setTab('ideas')}>Создать идею</Btn>
            </div>
          )}
        </section>
      )}

      {/* KPI */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
        <Kpi label="Всего постов" value={nf(k.total)} />
        <Kpi label="С метриками" value={nf(k.withMetrics)} sub={`${k.withMetricsPct}% корпуса`} tone="positive" />
        <Kpi label="Уникальных углов" value={nf(k.angles)} />
        <Kpi label="RU / EN" value={`${nf(k.ru)} / ${nf(k.en)}`} />
        <Kpi label="Медиана комментариев" value={k.medComments == null ? '—' : nf(k.medComments)} sub="только посты с метриками" />
        <Kpi label="Максимум комментариев" value={k.maxComments == null ? '—' : nf(k.maxComments)} />
        <Kpi label="Медиана ER, %" value={k.medRatePct == null ? '—' : k.medRatePct} sub="комм./подписчики" />
      </div>

      {/* Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 16 }}>
        <Panel title="Распределение по мета-кластерам">
          <Bars
            caption="Число постов по мета-кластерам"
            items={clusters.map((c) => ({
              label: c.label,
              value: c.count,
              onClick: () => setTab('explorer'),
            }))}
          />
        </Panel>

        <Panel title="Язык корпуса">
          <Donut
            caption="Распределение по языку"
            segments={[
              { label: 'RU', value: k.ru, color: 'var(--accent)' },
              { label: 'EN', value: k.en, color: 'var(--warning)' },
            ]}
          />
          <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 10 }}>
            RU — основной язык корпуса; EN — бенчмарк формата.
          </div>
        </Panel>

        <Panel title="Топ по комментариям">
          <Bars
            caption="Топ постов по числу комментариев"
            color="var(--positive)"
            items={topC.map((p) => ({
              label: p.author,
              value: p.comments,
              onClick: () => openPost(p.id),
            }))}
          />
        </Panel>

        <Panel title="Топ по engagement-rate">
          <Bars
            caption="Топ постов по engagement-rate"
            color="var(--text-accent)"
            items={topR.map((p) => ({
              label: p.author,
              value: (p.rate as number) * 100,
              display: ((p.rate as number) * 100).toFixed(2) + '%',
              onClick: () => openPost(p.id),
            }))}
          />
          <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 10 }}>
            ER считается только там, где в headline есть число подписчиков.
          </div>
        </Panel>

        <Panel title="Динамика сбора по месяцам">
          <Bars caption="Число собранных постов по месяцам" items={byMonth} />
        </Panel>
      </div>
    </div>
  );
}
