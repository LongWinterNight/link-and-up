import { useStore } from '@/store';
import { intlLocale, type DictKey } from '@/i18n';
import { useClusterLabel, useT } from '@/i18n/useT';

/** Печатный отчёт недели (виден только в print). */
export default function PrintReport() {
  const t = useT();
  const cl = useClusterLabel();
  const locale = useStore((s) => s.locale);
  const ideas = useStore((s) => s.ideas);
  const posts = useStore((s) => s.posts);

  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);

  const planned = ideas.filter((i) => {
    if (!i.date) return false;
    const d = new Date(i.date);
    return d >= weekStart && d <= weekEnd;
  });
  const ownThisWeek = posts.filter((p) => p.is_own && new Date(p.collected_at || 0) >= weekStart).length;

  return (
    <div id="print-report">
      <h1 style={{ fontSize: 20 }}>{t('pr.title')}</h1>
      <p style={{ fontSize: 13 }}>
        {weekStart.toLocaleDateString(intlLocale(locale))} — {weekEnd.toLocaleDateString(intlLocale(locale))}
      </p>
      <p style={{ fontSize: 13 }}>
        {t('pr.published.a')}<b>{ownThisWeek}</b>{t('pr.published.b')}
      </p>

      <h2 style={{ fontSize: 16, marginTop: 16 }}>{t('pr.planned')}</h2>
      {planned.length === 0 ? (
        <p style={{ fontSize: 13 }}>{t('pr.none')}</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr>
              {[t('pr.col.date'), t('pr.col.title'), t('pr.col.cluster'), t('pr.col.channel'), t('pr.col.status')].map((h) => (
                <th key={h} style={{ textAlign: 'left', borderBottom: '1px solid #000', padding: 4 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {planned.map((i) => (
              <tr key={i.id}>
                <td style={{ padding: 4, borderBottom: '1px solid #ccc' }}>{i.date}</td>
                <td style={{ padding: 4, borderBottom: '1px solid #ccc' }}>{i.title}</td>
                <td style={{ padding: 4, borderBottom: '1px solid #ccc' }}>{cl(i.cluster)}</td>
                <td style={{ padding: 4, borderBottom: '1px solid #ccc' }}>{i.channel}</td>
                <td style={{ padding: 4, borderBottom: '1px solid #ccc' }}>{t(('lbl.status.' + i.status) as DictKey)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h2 style={{ fontSize: 16, marginTop: 16 }}>{t('pr.cheatsheet')}</h2>
      <ul style={{ fontSize: 12 }}>
        {(['pak', 'hook', 'reaction', 'rif', 'fail', 'arch', 'meta'] as const).map((id) => (
          <li key={id}>
            <b>{t(('lbl.formula.' + id) as DictKey)}:</b> {t(('lbl.formula.' + id + '.body') as DictKey)}
          </li>
        ))}
      </ul>
    </div>
  );
}
