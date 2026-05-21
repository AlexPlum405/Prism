import { useMemo } from 'react';
import { t as translate } from '../../../domains/i18n';
import {
  getLocalizedExportQualityPreset,
  getLocalizedExportQualityPresets,
  normalizeExportQualityScale,
} from '../../../domains/export/quality';
import type { SettingsState } from '../../../domains/settings/types';

type ExportDefaults = SettingsState['exportDefaults'];

export function getExportSettingsModel(exportDefaults: ExportDefaults) {
  const qualityScale = normalizeExportQualityScale(exportDefaults.pngScale);
  return {
    customDirectoryHint: exportDefaults.customDirectory || translate('settings.customExportDirectory.hint'),
    defaultLocationHint: exportDefaults.customDirectory || translate('common.unspecified'),
    qualityDescription: getLocalizedExportQualityPreset(qualityScale).description,
    qualityPresets: getLocalizedExportQualityPresets(),
    qualityScale,
    showCustomDocxFont: exportDefaults.docxFontPolicy === 'custom',
    showHeaderFooterFields: exportDefaults.pageHeaderFooter,
  };
}

export function useExportSettingsModel(exportDefaults: ExportDefaults) {
  return useMemo(() => getExportSettingsModel(exportDefaults), [exportDefaults]);
}
