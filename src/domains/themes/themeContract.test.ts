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

const mermaidRuntimeKeys = [
  'edgeLabelTextColor',
  'actorBkg',
  'actorBorder',
  'actorTextColor',
  'signalColor',
  'signalTextColor',
  'noteBkgColor',
  'noteBorderColor',
  'noteTextColor',
  'arrowheadColor',
  'relationColor',
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
      if (contract.preview.maxWidth !== 'none') {
        expect(contract.preview.maxWidth).toBeGreaterThanOrEqual(520);
        expect(contract.preview.maxWidth).toBeLessThanOrEqual(1280);
      }
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

    expect(config.theme).toBe('base');
    expect(config.securityLevel).toBe('loose');
    expect(config.fontFamily).toBe(getThemeContract('miaoyan').mermaid.fontFamily);
    expect(config.fontSize).toBe(15);
    expect(getThemeContract('miaoyan').preview.fontSize).toBe(16);
    expect(config.themeVariables.primaryBorderColor).toBe('#d0d7e2');
    expect(config.themeVariables.lineColor).toBe('#1C5D33');
    expect(config.themeVariables.edgeLabelBackground).toBe('transparent');
    expect(config.flowchart.htmlLabels).toBe(true);
    expect(config.flowchart.useMaxWidth).toBe(true);
    expect(config.flowchart.nodeSpacing).toBe(80);
    expect(config.flowchart.rankSpacing).toBe(80);
    expect(config.flowchart.padding).toBe(30);
    expect(config.sequence.useMaxWidth).toBe(true);
    expect(config.gantt.useMaxWidth).toBe(true);
    expect(config.journey.useMaxWidth).toBe(true);
    expect(config.flowchart.curve).toBe('basis');
  });

  it('keeps the MiaoYan code color tokens aligned with its light preview palette', () => {
    expect(getThemeContract('miaoyan').code).toMatchObject({
      background: '#f7f7f7',
      inlineBackground: '#f7f7f7',
      text: '#24292e',
      comment: '#6a737d',
      keyword: '#d73a49',
      string: '#032f62',
      meta: '#208bff',
      attribute: '#e36209',
      symbol: '#8250df',
    });
  });

  it('keeps MiaoYan Mermaid runtime stroke colors aligned with theme-manager.js', () => {
    expect(getThemeContract('miaoyan').mermaid.themeVariables).toMatchObject({
      nodeBorder: '#262626',
      clusterBorder: '#262626',
      actorBorder: '#262626',
      noteBorderColor: '#262626',
    });
  });

  it('keeps Miaoyan full-width and other reading themes explicitly bounded', () => {
    expect(getThemeContract('miaoyan').preview.maxWidth).toBe('none');
    expect(getThemeContract('inkstone').preview.maxWidth).toBe(1000);
    expect(getThemeContract('slate').preview.maxWidth).toBe(1000);
    expect(getThemeContract('mono').preview.maxWidth).toBe(1000);
    expect(getThemeContract('nocturne').preview.maxWidth).toBe(920);
    expect(getThemeContract('carbon').preview.maxWidth).toBe(960);
  });

  it('keeps non-MiaoYan Mermaid runtime palettes complete for diagram families', () => {
    for (const theme of ['inkstone', 'slate', 'mono', 'nocturne', 'carbon'] as const) {
      const variables = getThemeContract(theme).mermaid.themeVariables;

      for (const key of mermaidRuntimeKeys) {
        expect(variables[key]).toBeTruthy();
      }

      expect(variables.arrowheadColor).toBe(variables.lineColor);
      expect(variables.relationColor).toBe(variables.lineColor);
      expect(variables.signalColor).toBe(variables.lineColor);
      expect(variables.actorTextColor).toBe(variables.textColor);
      expect(variables.noteTextColor).toBe(variables.textColor);
    }
  });

  it('keeps Inkstone distinct from MiaoYan and Carbon as a true black theme', () => {
    expect(getThemeContract('inkstone').preview.fontFamily).not.toContain('TsangerJinKai02');
    expect(getThemeContract('inkstone').preview.fontFamily).toContain('Songti SC');
    expect(getThemeContract('carbon')).toMatchObject({
      isDark: true,
      editor: {
        background: '#000000',
        text: '#ededed',
      },
      preview: {
        background: '#000000',
        text: '#ededed',
      },
    });
    expect(getThemeContract('carbon').code).toMatchObject({
      keyword: '#6cb6d9',
      string: '#a78bfa',
      meta: '#a78bfa',
      attribute: '#d16a93',
      symbol: '#a3e635',
    });
  });

  it('keeps built-in themes separated by distinct focus, title, link, and code colors', () => {
    const expected = {
      miaoyan: { focus: '#1c5d33', codeKeyword: '#d73a49', codeString: '#032f62' },
      inkstone: { focus: '#9a3412', codeKeyword: '#9a3412', codeString: '#214e9a' },
      slate: { focus: '#b45309', codeKeyword: '#246a73', codeString: '#2356b8' },
      mono: { focus: '#b91c1c', codeKeyword: '#6d28d9', codeString: '#047857' },
      nocturne: { focus: '#c45a84', codeKeyword: '#d6a84f', codeString: '#6cb6d9' },
      carbon: { focus: '#a3e635', codeKeyword: '#6cb6d9', codeString: '#a78bfa' },
    } as const;

    for (const theme of CONTENT_THEMES) {
      expect(getThemeContract(theme).search.focus).toBe(expected[theme].focus);
      expect(getThemeContract(theme).code.keyword).toBe(expected[theme].codeKeyword);
      expect(getThemeContract(theme).code.string).toBe(expected[theme].codeString);
    }

    const focusColors = CONTENT_THEMES.map((theme) => getThemeContract(theme).search.focus);
    expect(new Set(focusColors).size).toBe(focusColors.length);
  });
});
