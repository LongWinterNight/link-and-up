import { useStore } from '@/store';
import { CLUSTER_LABEL, FORMULAS, STATUS_LABEL } from '@/lib/constants';

/** Печатный отчёт недели (виден только в print). */
export default function PrintReport() {
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
      <h1 style={{ fontSize: 20 }}>Отчёт недели — контент-план LinkedIn</h1>
      <p style={{ fontSize: 13 }}>
        {weekStart.toLocaleDateString('ru-RU')} — {weekEnd.toLocaleDateString('ru-RU')}
      </p>
      <p style={{ fontSize: 13 }}>
        Опубликовано своих постов: <b>{ownThisWeek}</b> из цели 3–5.
      </p>

      <h2 style={{ fontSize: 16, marginTop: 16 }}>Запланировано на неделю</h2>
      {planned.length === 0 ? (
        <p style={{ fontSize: 13 }}>Ничего не запланировано на эту неделю.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr>
              {['Дата', 'Заголовок', 'Кластер', 'Канал', 'Статус'].map((h) => (
                <th key={h} style={{ textAlign: 'left', borderBottom: '1px solid #000', padding: 4 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {planned.map((i) => (
              <tr key={i.id}>
                <td style={{ padding: 4, borderBottom: '1px solid #ccc' }}>{i.date}</td>
                <td style={{ padding: 4, borderBottom: '1px solid #ccc' }}>{i.title}</td>
                <td style={{ padding: 4, borderBottom: '1px solid #ccc' }}>{CLUSTER_LABEL[i.cluster]}</td>
                <td style={{ padding: 4, borderBottom: '1px solid #ccc' }}>{i.channel}</td>
                <td style={{ padding: 4, borderBottom: '1px solid #ccc' }}>{STATUS_LABEL[i.status]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h2 style={{ fontSize: 16, marginTop: 16 }}>Шпаргалка формул</h2>
      <ul style={{ fontSize: 12 }}>
        {FORMULAS.map((f) => (
          <li key={f.id}>
            <b>{f.title}:</b> {f.body}
          </li>
        ))}
      </ul>
    </div>
  );
}
