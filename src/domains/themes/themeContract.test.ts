import { describe, expect, it } from 'vitest';
import { CONTENT_THEMES } from '../settings/types';
import { getMermaidThemeConfig, getThemeContract, themeContracts } from './themeContract';

const requiredAreas = [
  'editor',
  'preview',
  'search',
  'export',
  'code',
  'mermaid',
  'selection',
] as const;

describe('theme contract', () => {
  it('defines one complete contract for every content theme', () => {
    expect(Object.keys(themeContracts).sort()).toEqual([...CONTENT_THEMES].sort());

    for (const theme of CONTENT_THEMES) {
      const contract = getThemeContract(theme);
      expect(contract.id).toBe(theme);

      for (const area of requiredAreas) {
        expect(contract[area]).toBeTruthy();
      }

      expect(contract.editor.fontFamily).toBeTruthy();
      expect(contract.editor.codeFontFamily).toBeTruthy();
      expect(contract.preview.writeClass).toContain('markdown-body');
      expect(contract.search.fieldBackground).toBeTruthy();
      expect(contract.export.docx.font).toBeTruthy();
      expect(contract.export.docx.codeFont).toBeTruthy();
      expect(contract.code.inlineBackground).toBeTruthy();
      expect(contract.mermaid.fontFamily).toBeTruthy();
      expect(contract.mermaid.themeVariables).not.toEqual({});
      expect(contract.selection.currentMatchBackground).toBeTruthy();
    }
  });

  it('exposes Mermaid config through the contract source', () => {
    const config = getMermaidThemeConfig('miaoyan');

    expect(config.theme).toBe('neutral');
    expect(config.securityLevel).toBe('loose');
    expect(config.fontFamily).toBe(getThemeContract('miaoyan').mermaid.fontFamily);
    expect(config.themeVariables.primaryBorderColor).toBe('#262626');
    expect(config.flowchart.htmlLabels).toBe(true);
  });

  it('keeps the default and dark reading measure bounded for wide screens', () => {
    expect(getThemeContract('miaoyan').preview.maxWidth).toBe(920);
    expect(getThemeContract('nocturne').preview.maxWidth).toBe(920);
  });
});
