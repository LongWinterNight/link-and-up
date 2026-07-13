import { useStore } from '@/store';
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
