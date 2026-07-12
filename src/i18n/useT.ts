import { useStore } from '@/store';
import { tr, type DictKey } from './index';

/** Хук перевода: ре-рендерится при смене locale и после догрузки словаря (i18nVersion). */
export function useT(): (key: DictKey) => string {
  const locale = useStore((s) => s.locale);
  useStore((s) => s.i18nVersion);
  return (key) => tr(locale, key);
}
