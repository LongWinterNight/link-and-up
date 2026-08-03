import { useStore } from '@/store';
import type { BacktestLabels, ForecastLabels } from '@/lib/forecast';
import type { DraftLabels } from '@/lib/draft';
import type { ExportLabels } from '@/lib/exports';
import type { GuardrailsLabels } from '@/lib/guardrails';
import type { ImportLabels } from '@/lib/linkedinImport';
import type { ShareCardLabels } from '@/lib/shareCard';
import type { BackupLabels } from '@/lib/backup';
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

/** FE-3c: локализованные метки для lib/draft (строки живут в словаре, lib остаётся чистым). */
export function useDraftLabels(): { labels: DraftLabels; locale: string } {
  const t = useT();
  const locale = useStore((s) => s.locale);
  return {
    locale,
    labels: {
      header: t('draft.header'),
      noTitle: t('draft.noTitle'),
      formulaNote: (f) => t('draft.formulaNote') + f + t('draft.formulaNoteEnd'),
      cluster: t('draft.cluster'),
      source: t('draft.source'),
      channel: t('draft.channel'),
      guardrailsNote: t('draft.guardrailsNote'),
      blocked: t('draft.blocked'),
      warnings: t('draft.warnings'),
      hardTag: t('draft.hardTag'),
    },
  };
}

/** FE-3c: локализованные метки для lib/exports. */
export function useExportLabels(): ExportLabels {
  const t = useT();
  return {
    col: {
      author: t('export.col.author'),
      headline: t('export.col.headline'),
      lang: t('export.col.lang'),
      cluster: t('export.col.cluster'),
      hook: t('export.col.hook'),
      structure: t('export.col.structure'),
      cta: t('export.col.cta'),
      emotion: t('export.col.emotion'),
      flags: t('export.col.flags'),
      reactions: t('export.col.reactions'),
      comments: t('export.col.comments'),
      reposts: t('export.col.reposts'),
      followers: t('export.col.followers'),
      er: t('export.col.er'),
      metrics: t('export.col.metrics'),
      own: t('export.col.own'),
      date: t('export.col.date'),
      url: t('export.col.url'),
      angle: t('export.col.angle'),
      yes: t('export.col.yes'),
      no: t('export.col.no'),
    },
    idea: {
      title: t('export.idea.title'),
      hook: t('export.idea.hook'),
      cluster: t('export.idea.cluster'),
      formula: t('export.idea.formula'),
      source: t('export.idea.source'),
      channel: t('export.idea.channel'),
      status: t('export.idea.status'),
      date: t('export.idea.date'),
      ref: t('export.idea.ref'),
      forecast: t('export.idea.forecast'),
      actual: t('export.idea.actual'),
      redaction: t('export.idea.redaction'),
    },
    audit: {
      time: t('export.audit.time'),
      event: t('export.audit.event'),
    },
    redacted: {
      title: t('export.redacted.title'),
      hook: t('export.redacted.hook'),
    },
  };
}

/** Локализованные метки для lib/guardrails. */
export function useGuardrailsLabels(): GuardrailsLabels {
  const t = useT();
  return {
    ruleLabels: {
      superlative: { label: t('guard.rule.superlative.label'), message: t('guard.rule.superlative.msg') },
      absolute: { label: t('guard.rule.absolute.label'), message: t('guard.rule.absolute.msg') },
      'unverified-big': { label: t('guard.rule.unverifiedBig.label'), message: t('guard.rule.unverifiedBig.msg') },
      hype: { label: t('guard.rule.hype.label'), message: t('guard.rule.hype.msg') },
    },
    patEmpty: t('guard.pat.empty'),
    patTooLong: (max) => t('guard.pat.tooLong') + max + t('guard.pat.tooLongEnd'),
    patBadRegex: (msg) => t('guard.pat.badRegex') + msg,
    patNestedQuant: t('guard.pat.nestedQuant'),
    patSlow: t('guard.pat.slow'),
    redactedA: t('guard.redacted.a'),
    redactedB: t('guard.redacted.b'),
  };
}

/** Локализованные метки для lib/linkedinImport. */
export function useImportLabels(): ImportLabels {
  const t = useT();
  return {
    empty: t('import.linkedin.empty'),
    badFormat: t('import.linkedin.badFormat'),
  };
}

/** Локализованные метки для lib/shareCard. */
export function useShareCardLabels(): ShareCardLabels {
  const t = useT();
  return {
    altPrefix: t('card.alt.prefix'),
    altCluster: t('card.alt.cluster'),
    altTechniques: t('card.alt.techniques'),
    altEngagement: t('card.alt.engagement'),
    altReactions: t('card.alt.reactions'),
    altReactionsUnknown: t('card.alt.reactionsUnknown'),
    altComments: t('card.alt.comments'),
    altCommentsUnknown: t('card.alt.commentsUnknown'),
    altMetricsUnknown: t('card.alt.metricsUnknown'),
    altGenerated: t('card.alt.generated'),
    heading: t('card.heading'),
    metricsUnknown: t('card.metricsUnknown'),
    canvasError: t('card.canvasError'),
    pngError: t('card.pngError'),
  };
}

/** Локализованные метки для lib/backup. */
export function useBackupLabels(): BackupLabels {
  const t = useT();
  return {
    notJson: t('backup.notJson'),
    notOurs: t('backup.notOurs'),
    badSchema: (found, current) =>
      t('backup.badSchema') + found + t('backup.badSchemaEnd') + current + t('backup.badSchemaEnd2'),
    corrupt: t('backup.corrupt'),
  };
}
