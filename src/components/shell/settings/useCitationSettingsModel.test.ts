import { describe, expect, it } from 'vitest';
import { getCitationSettingsModel, hasSupportedPathExtension } from './useCitationSettingsModel';

describe('useCitationSettingsModel', () => {
  it('accepts empty paths and supported citation suffixes', () => {
    expect(hasSupportedPathExtension('', ['.bib'])).toBe(true);
    expect(hasSupportedPathExtension('/tmp/library.bib', ['.bib', '.json'])).toBe(true);
    expect(hasSupportedPathExtension('/tmp/library.txt', ['.bib', '.json'])).toBe(false);
  });

  it('reports invalid citation paths before readiness', () => {
    const model = getCitationSettingsModel({
      bibliographyPath: '/tmp/references.txt',
      cslStylePath: '/tmp/style.json',
      pandocDetected: true,
    });

    expect(model.bibliographyPathIsSupported).toBe(false);
    expect(model.cslStylePathIsSupported).toBe(false);
    expect(model.bibliographyHint).toBe('建议使用 .bib、.bibtex 或 .json 文件');
    expect(model.cslStyleHint).toBe('CSL 样式通常是 .csl 文件');
    expect(model.citationReadinessHint).toBe('引用路径后缀需要先修正；否则导出会回退到 citekey 占位。');
  });

  it('reports ready citation export only when bibliography and pandoc are available', () => {
    expect(getCitationSettingsModel({
      bibliographyPath: '/tmp/library.bib',
      cslStylePath: '',
      pandocDetected: true,
    }).citationReadinessHint).toBe('引用导出已就绪；HTML 导出会优先尝试 Pandoc citeproc。');

    expect(getCitationSettingsModel({
      bibliographyPath: '/tmp/library.bib',
      cslStylePath: '',
      pandocDetected: false,
    }).citationReadinessHint).toBe('已配置参考文献；当前未检测到 Pandoc，导出会保留 citekey 占位并提示原因。');
  });
});
