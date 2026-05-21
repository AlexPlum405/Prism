import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../../../domains/settings/types';
import { getExportSettingsModel } from './useExportSettingsModel';

describe('useExportSettingsModel', () => {
  it('normalizes export quality and exposes localized preset metadata', () => {
    const model = getExportSettingsModel({
      ...DEFAULT_SETTINGS.exportDefaults,
      pngScale: 999,
    });

    expect(model.qualityScale).toBe(4);
    expect(model.qualityDescription).toContain('最高质量');
    expect(model.qualityPresets.map((preset) => preset.scale)).toEqual([1, 2, 3, 4]);
  });

  it('derives directory and conditional export UI hints', () => {
    const model = getExportSettingsModel({
      ...DEFAULT_SETTINGS.exportDefaults,
      customDirectory: '/tmp/exports',
      docxFontPolicy: 'custom',
      pageHeaderFooter: true,
    });

    expect(model.defaultLocationHint).toBe('/tmp/exports');
    expect(model.customDirectoryHint).toBe('/tmp/exports');
    expect(model.showCustomDocxFont).toBe(true);
    expect(model.showHeaderFooterFields).toBe(true);
  });
});
