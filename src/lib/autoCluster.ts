import type { ClusterDef, Post } from '@/types';

/**
 * NICHE-1: динамические кластеры из корпуса пользователя. Без ML-хайпа — TF-IDF по токенам,
 * жадный проход по центроидам (посты в порядке длины текста) + агломеративное слияние
 * микрокластеров. Объяснимость: имя кластера = топ-слова его центроида, ключевые слова видимы
 * и редактируемы. Хардкод AI-ниши (clusterOf) остаётся дефолтом для встроенных кластеров.
 */

const STOP = new Set(
  (
    'и в на с не что как это по для от до из за или но а же бы ли то у о об при без про под над перед после через ' +
    'мы вы он она они я ты вот ещё еще ' +
    'его её ее их них нам вам мне тебе себя свой своя свои это этот эта эти тот та те так там тут где когда если ' +
    'чем чтобы потому просто очень можно нужно надо есть был была были будет быть всё все весь вся день раз два ' +
    'the a an and or but if then else for to of in on at by with from as is are was were be been being it its this ' +
    'that these those you your we our they their he she i my me him her them not no yes do does did done have has ' +
    'had will would can could should may might must about into over under more most less least just only also very'
  ).split(/\s+/),
);

/** Токены ≥3 символов, RU/EN/цифры/дефис, без стоп-слов и чистых чисел. */
export function tokenize(text: string): string[] {
  const out: string[] = [];
  for (const m of (text || '').toLowerCase().matchAll(/[a-zа-яё0-9][a-zа-яё0-9-]{2,}/g)) {
    const w = m[0];
    if (STOP.has(w) || /^\d+$/.test(w)) continue;
    out.push(w);
  }
  return out;
}

type Vec = Map<string, number>;

function cosine(a: Vec, b: Vec, na: number, nb: number): number {
  if (!na || !nb) return 0;
  // итерируем меньший вектор
  const [s, l] = a.size <= b.size ? [a, b] : [b, a];
  let dot = 0;
  for (const [k, v] of s) {
    const w = l.get(k);
    if (w) dot += v * w;
  }
  return dot / (na * nb);
}

function norm(v: Vec): number {
  let s = 0;
  for (const x of v.values()) s += x * x;
  return Math.sqrt(s);
}

export interface AutoClusterResult {
  defs: ClusterDef[];
  /** postId → clusterId ('other' для не попавших в кластеры) */
  assignments: Map<string, string>;
}

export interface AutoClusterOptions {
  /** Максимум итоговых кластеров (сверх — агломеративное слияние ближайших). */
  maxClusters?: number;
  /** Минимум постов, чтобы микрокластер выжил (иначе — 'other'). */
  minSize?: number;
  /** Порог косинусной близости для присоединения поста к центроиду. */
  threshold?: number;
}

/**
 * TF-IDF + жадные центроиды + агломеративное слияние. Однопроходное присоединение —
 * O(n·k), слияние — O(k²) по микрокластерам (k ≪ n), масштабируется на тысячи постов.
 */
export function buildClusters(posts: Post[], opts: AutoClusterOptions = {}): AutoClusterResult {
  const { maxClusters = 10, minSize = 3, threshold = 0.12 } = opts;
  const docs = posts.map((p) => ({ id: p.id, tokens: tokenize(p.text) })).filter((d) => d.tokens.length >= 3);

  // document frequency → idf
  const df = new Map<string, number>();
  for (const d of docs) for (const w of new Set(d.tokens)) df.set(w, (df.get(w) || 0) + 1);
  const N = docs.length || 1;
  const idf = (w: string) => Math.log(1 + N / (df.get(w) || 1));

  // tf-idf вектор поста
  const vecs = new Map<string, { v: Vec; n: number }>();
  for (const d of docs) {
    const tf = new Map<string, number>();
    for (const w of d.tokens) tf.set(w, (tf.get(w) || 0) + 1);
    const v: Vec = new Map();
    for (const [w, f] of tf) {
      if ((df.get(w) || 0) < 2) continue; // слово одного поста не образует тему
      v.set(w, (f / d.tokens.length) * idf(w));
    }
    vecs.set(d.id, { v, n: norm(v) });
  }

  interface Micro {
    ids: string[];
    centroid: Vec;
    n: number;
  }
  const micros: Micro[] = [];
  const addTo = (m: Micro, id: string, v: Vec) => {
    m.ids.push(id);
    for (const [k, x] of v) m.centroid.set(k, (m.centroid.get(k) || 0) + x);
    m.n = norm(m.centroid);
  };

  // жадный проход: длинные тексты первыми — стабильнее семена центроидов
  const order = [...docs].sort((a, b) => b.tokens.length - a.tokens.length);
  for (const d of order) {
    const { v, n } = vecs.get(d.id)!;
    let best = -1;
    let bestSim = threshold;
    for (let i = 0; i < micros.length; i++) {
      const sim = cosine(v, micros[i].centroid, n, micros[i].n);
      if (sim > bestSim) {
        bestSim = sim;
        best = i;
      }
    }
    if (best >= 0) addTo(micros[best], d.id, v);
    else micros.push({ ids: [d.id], centroid: new Map(v), n });
  }

  // агломеративное слияние ближайших пар, пока не уложимся в maxClusters
  let alive = micros.filter((m) => m.ids.length >= Math.min(minSize, 2));
  while (alive.length > maxClusters) {
    let bi = -1;
    let bj = -1;
    let bs = -1;
    for (let i = 0; i < alive.length; i++)
      for (let j = i + 1; j < alive.length; j++) {
        const s = cosine(alive[i].centroid, alive[j].centroid, alive[i].n, alive[j].n);
        if (s > bs) {
          bs = s;
          bi = i;
          bj = j;
        }
      }
    if (bi < 0) break;
    const [a, b] = [alive[bi], alive[bj]];
    for (const id of b.ids) a.ids.push(id);
    for (const [k, x] of b.centroid) a.centroid.set(k, (a.centroid.get(k) || 0) + x);
    a.n = norm(a.centroid);
    alive.splice(bj, 1);
  }
  alive = alive.filter((m) => m.ids.length >= minSize).sort((a, b) => b.ids.length - a.ids.length);

  // имена и дефы: топ-3 слова центроида; ключевые слова = топ-8 (видимы и редактируемы)
  const defs: ClusterDef[] = [];
  const assignments = new Map<string, string>();
  const seen = new Set<string>();
  alive.forEach((m, i) => {
    const top = [...m.centroid.entries()].sort((a, b) => b[1] - a[1]).map(([w]) => w);
    let id = 'auto-' + (top[0] || 'c' + i);
    while (seen.has(id)) id += 'x';
    seen.add(id);
    defs.push({ id, label: top.slice(0, 3).join(' · ') || 'кластер ' + (i + 1), keywords: top.slice(0, 8) });
    for (const pid of m.ids) assignments.set(pid, id);
  });
  for (const p of posts) if (!assignments.has(p.id)) assignments.set(p.id, 'other');
  return { defs, assignments };
}

/** Назначение кластера тексту по реестру: максимум совпадений ключевых слов (≥1 хит). */
export function assignCluster(text: string, defs: ClusterDef[]): string {
  const words = new Set(tokenize(text));
  let best = 'other';
  let bestScore = 0;
  for (const d of defs) {
    if (!d.keywords.length) continue;
    let score = 0;
    for (const k of d.keywords) if (words.has(k.toLowerCase())) score++;
    if (score > bestScore) {
      bestScore = score;
      best = d.id;
    }
  }
  return best;
}
