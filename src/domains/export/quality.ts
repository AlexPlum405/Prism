import { t } from '../i18n/runtime';
import type { I18nKey } from '../i18n/resources';

export interface ExportQualityPreset {
  scale: number;
  label: string;
  shortLabel: string;
  description: string;
}

type LocalizedExportQualityPreset = ExportQualityPreset & {
  labelKey: I18nKey;
  shortLabelKey: I18nKey;
  descriptionKey: I18nKey;
};

export const EXPORT_QUALITY_PRESETS: LocalizedExportQualityPreset[] = [
  {
    scale: 1,
    labelKey: 'export.quality.light.label',
    shortLabelKey: 'export.quality.light.short',
    descriptionKey: 'export.quality.light.description',
    label: 'Light',
    shortLabel: 'Light 1x',
    description: 'Best for quick previews, fastest export, and smaller files.',
  },
  {
    scale: 2,
    labelKey: 'export.quality.clear.label',
    shortLabelKey: 'export.quality.clear.short',
    descriptionKey: 'export.quality.clear.description',
    label: 'Clear',
    shortLabel: 'Clear 2x',
    description: 'Recommended for everyday documents, balancing clarity and export speed.',
  },
  {
    scale: 3,
    labelKey: 'export.quality.high.label',
    shortLabelKey: 'export.quality.high.short',
    descriptionKey: 'export.quality.high.description',
    label: 'High',
    shortLabel: 'High 3x',
    description: 'For formal delivery, with sharper diagrams and text at longer export time.',
  },
  {
    scale: 4,
    labelKey: 'export.quality.extreme.label',
    shortLabelKey: 'export.quality.extreme.short',
    descriptionKey: 'export.quality.extreme.description',
    label: 'Extreme',
    shortLabel: 'Extreme 4x',
    description: 'Exports at maximum quality and may take several minutes. Prism fails with diagnostics if the system cannot handle it.',
  },
];

export function getExportQualityPreset(scale: number | undefined) {
  return EXPORT_QUALITY_PRESETS.find((preset) => preset.scale === scale)
    ?? EXPORT_QUALITY_PRESETS[1];
}

export function localizeExportQualityPreset(preset: LocalizedExportQualityPreset): ExportQualityPreset {
  return {
    scale: preset.scale,
    label: t(preset.labelKey),
    shortLabel: t(preset.shortLabelKey),
    description: t(preset.descriptionKey),
  };
}

export function getLocalizedExportQualityPresets() {
  return EXPORT_QUALITY_PRESETS.map(localizeExportQualityPreset);
}

export function getLocalizedExportQualityPreset(scale: number | undefined) {
  return localizeExportQualityPreset(getExportQualityPreset(scale));
}

export function normalizeExportQualityScale(scale: unknown, fallback = 2) {
  const value = typeof scale === 'number' && Number.isFinite(scale) ? scale : fallback;
  const rounded = Number.isFinite(value) ? Math.round(value) : 2;
  return Math.min(4, Math.max(1, rounded));
}
