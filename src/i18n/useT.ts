import { useStore } from '@/store';
import type { BacktestLabels, ForecastLabels } from '@/lib/forecast';
import { clusterLabel, lbl, tr, type DictKey } from './index';

/** Хук перевода: ре-рендерится при смене locale и после догрузки словаря (i18nVersion). */
export function useT(): (key: DictKey) => string {
  const locale = useStore((s) => s.locale);
  useStore((s) => s.i18nVersion);
  return (key) => tr(locale, key);
}

/** Хук метки enum-значения (хук/структура/CTA/эмоция) — см. lbl(). */
export function useLbl(): (value: string) => string {
  const locale = useStore((s) => s.locale);
  useStore((s) => s.i18nVersion);
  return (value) => lbl(locale, value);
}

/** Хук метки мета-кластера: пользовательские кластеры (NICHE-1) берут label из реестра, встроенные — из словаря. */
export function useClusterLabel(): (id: string) => string {
  const locale = useStore((s) => s.locale);
  useStore((s) => s.i18nVersion);
  const clusters = useStore((s) => s.clusters);
  return (id) => {
    const def = clusters.find((c) => c.id === id);
    if (def && !def.builtin) return def.label;
    return clusterLabel(locale, id);
  };
}

/** FE-3c: локализованные метки для lib/forecast (строки живут в словаре, lib остаётся чистым). */
export function useForecastLabels(): { fl: ForecastLabels; bl: BacktestLabels } {
  const t = useT();
  const cl = useClusterLabel();
  return {
    fl: {
      clusterName: cl,
      baseRef: (a) => t('fcstr.base.ref.a') + a + t('fcstr.base.ref.b'),
      baseNoData: () => t('fcstr.base.nodata'),
      baseMedian: (c) => t('fcstr.base.median.a') + c + t('fcstr.base.median.b'),
      strongHook: t('fcstr.f.hook'),
      personal: t('fcstr.f.personal'),
      numbers: t('fcstr.f.numbers'),
      questionCta: t('fcstr.f.cta'),
      ruMarket: t('fcstr.f.ru'),
      calibration: t('fcstr.f.cal'),
      bandIqr: (n, q25, q75) =>
        t('fcstr.band.iqr.a') + n + t('fcstr.band.iqr.b') + q25 + t('fcstr.band.iqr.c') + q75 + t('fcstr.band.iqr.d'),
      bandLow: (n) => t('fcstr.band.low.a') + n + t('fcstr.band.low.b'),
      explainRef: (a, c, cl2) =>
        t('fcstr.explain.ref.a') +
        a +
        t('fcstr.explain.ref.b') +
        c +
        t('fcstr.explain.ref.c') +
        cl2 +
        t('fcstr.explain.ref.d'),
      explainNoData: () => t('fcstr.explain.nodata'),
      explainMedian: (cl2, n, med) =>
        t('fcstr.explain.median.a') +
        cl2 +
        t('fcstr.explain.median.b') +
        n +
        t('fcstr.explain.median.c') +
        med +
        t('fcstr.explain.median.d'),
    },
    bl: {
      low: (n) => t('fcstr.bt.low.a') + n + t('fcstr.bt.low.b'),
      ok: (n) => t('fcstr.bt.ok.a') + n + t('fcstr.bt.ok.b'),
    },
  };
}
