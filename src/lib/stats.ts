/** Медиана. Пустой массив → 0. */
export function median(nums: number[]): number {
  if (!nums.length) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** Квантиль по ОТСОРТИРОВАННОМУ массиву (линейная интерполяция). */
export function quantile(sorted: number[], q: number): number {
  if (!sorted.length) return 0;
  const pos = (sorted.length - 1) * q;
  const b = Math.floor(pos);
  const rest = pos - b;
  return sorted[b + 1] !== undefined ? sorted[b] + rest * (sorted[b + 1] - sorted[b]) : sorted[b];
}

/** FE-3: локаль форматирования настраивается при смене языка (см. App). */
let numberFormat = new Intl.NumberFormat('ru-RU');
export function setNumberLocale(locale: string): void {
  numberFormat = new Intl.NumberFormat(locale);
}

/** Форматирование числа в текущей локали. null → «—». */
export function nf(n: number | null | undefined): string {
  if (n == null) return '—';
  return numberFormat.format(Math.round(n));
}

/** Ограничить значение диапазоном. */
export function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/** М8: доля значений строго меньше v, % (перцентиль «выше, чем у X%»). */
export function percentileOf(values: number[], v: number): number {
  if (!values.length) return 0;
  return Math.round((values.filter((x) => x < v).length / values.length) * 100);
}
