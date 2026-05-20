import { describe, expect, it } from 'vitest';
import { CONTENT_THEMES } from '../settings/types';
import {
  docxThemeByContentTheme,
  getDocxThemeByContentTheme,
  getMermaidFontByTheme,
  getWriteClassByTheme,
  mermaidFontByTheme,
  writeClassByTheme,
} from './exportSettings';
import { getExportFormatLabel } from './types';
import { builtInThemeContracts, getThemeContract } from '../themes';
import { __themeRegistryTesting } from '../themes/themeRegistry';

describe('export domain settings', () => {
  it('covers every content theme with export tokens', () => {
    for (const theme of CONTENT_THEMES) {
      expect(writeClassByTheme[theme]).toBeTruthy();
      expect(docxThemeByContentTheme[theme].font).toBeTruthy();
      expect(docxThemeByContentTheme[theme].codeFont).toBeTruthy();
      expect(mermaidFontByTheme[theme]).toBeTruthy();
      expect(writeClassByTheme[theme]).toBe(getThemeContract(theme).export.writeClass);
      expect(docxThemeByContentTheme[theme]).toBe(getThemeContract(theme).export.docx);
      expect(mermaidFontByTheme[theme]).toBe(getThemeContract(theme).mermaid.fontFamily);
    }
  });

  it('exposes stable format labels', () => {
    expect(getExportFormatLabel('html')).toBe('HTML');
    expect(getExportFormatLabel('pdf')).toBe('PDF');
    expect(getExportFormatLabel('docx')).toBe('Word');
    expect(getExportFormatLabel('png')).toBe('PNG 图像');
  });

  it('resolves runtime user theme export tokens from the registry', () => {
    __themeRegistryTesting.setRuntimeEntries([{
      id: 'warm-paper',
      name: '暖纸',
      author: '',
      version: '',
      description: '',
      isDark: false,
      directory: '/tmp/warm-paper',
      css: "html[data-content-theme='warm-paper'] { --theme-main-bg: #fff; }",
      contract: {
        ...builtInThemeContracts.miaoyan,
        id: 'warm-paper',
        label: '暖纸',
        export: {
          writeClass: 'markdown-body heti warm-paper-write',
          docx: {
            ...builtInThemeContracts.miaoyan.export.docx,
            font: 'Songti SC',
          },
        },
        mermaid: {
          ...builtInThemeContracts.miaoyan.mermaid,
          fontFamily: 'Songti SC',
        },
      },
      fonts: [],
    }], []);

    expect(getWriteClassByTheme('warm-paper')).toBe('markdown-body heti warm-paper-write');
    expect(getDocxThemeByContentTheme('warm-paper').font).toBe('Songti SC');
    expect(getMermaidFontByTheme('warm-paper')).toBe('Songti SC');

    __themeRegistryTesting.setRuntimeEntries([], []);
  });
});
