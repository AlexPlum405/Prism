import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, type SettingsState } from './types';
import { normalizeSettings } from './normalize';

describe('normalizeSettings', () => {
  it('fills missing 1.0.3 fields from defaults for old configs', () => {
    const settings = normalizeSettings({
      theme: 'dark',
      contentTheme: 'miaoyan',
      fontSize: 18,
      editorFontFamily: 'Menlo',
      autoSaveInterval: 3000,
      showLineNumbers: true,
      windowState: { width: 900, height: 700, x: 10, y: 20 },
    });

    expect(settings.theme).toBe('dark');
    expect(settings.settingsVersion).toBe(DEFAULT_SETTINGS.settingsVersion);
    expect(settings.fontSize).toBe(18);
    expect(settings.editorLineHeight).toBe(DEFAULT_SETTINGS.editorLineHeight);
    expect(settings.previewFontFamily).toBe(DEFAULT_SETTINGS.previewFontFamily);
    expect(settings.previewFontSize).toBe(DEFAULT_SETTINGS.previewFontSize);
    expect(settings.defaultViewMode).toBe(DEFAULT_SETTINGS.defaultViewMode);
    expect(settings.exportDefaults).toEqual(DEFAULT_SETTINGS.exportDefaults);
    expect(settings.pandoc).toEqual(DEFAULT_SETTINGS.pandoc);
    expect(settings.citation).toEqual(DEFAULT_SETTINGS.citation);
    expect(settings.shortcutStyle).toBe(DEFAULT_SETTINGS.shortcutStyle);
    expect(settings.locale).toBe(DEFAULT_SETTINGS.locale);
    expect(settings.wordWrap).toBe(DEFAULT_SETTINGS.wordWrap);
  });

  it('upgrades mixed legacy settings to the current schema without leaking old fields', () => {
    const settings = normalizeSettings({
      settingsVersion: 0,
      theme: 'dark',
      contentTheme: 'slate',
      editorFontFamily: 'Menlo',
      previewFontFamily: 'Georgia',
      autoSaveInterval: 7500,
      exportDefaults: {
        format: 'docx',
        pdfHeaderFooter: true,
        pdfHeaderText: '  {title}  ',
        pdfFooterText: ' {page}/{pages} ',
        docxFontPolicy: 'preview',
      },
    } as unknown as Partial<SettingsState>);

    expect(settings.settingsVersion).toBe(DEFAULT_SETTINGS.settingsVersion);
    expect(settings.theme).toBe('dark');
    expect(settings.contentTheme).toBe('slate');
    expect(settings.editorFontSource).toEqual({ kind: 'builtin', value: 'Menlo' });
    expect(settings.previewFontSource).toEqual({ kind: 'builtin', value: 'Georgia' });
    expect(settings.autoSaveInterval).toBe(7500);
    expect(settings.autoSaveStrategy).toBe('battery');
    expect(settings.exportDefaults).toMatchObject({
      format: 'docx',
      pageHeaderFooter: true,
      pageHeaderText: '{title}',
      pageFooterText: '{page}/{pages}',
      docxFontPolicy: 'preview',
    });
    expect(settings.exportDefaults).not.toHaveProperty('pdfHeaderFooter');
    expect(settings.exportDefaults).not.toHaveProperty('pdfHeaderText');
    expect(settings.exportDefaults).not.toHaveProperty('pdfFooterText');
    expect(settings.pandoc).toEqual(DEFAULT_SETTINGS.pandoc);
    expect(settings.citation).toEqual(DEFAULT_SETTINGS.citation);
    expect(settings.exportHistory).toEqual([]);
    expect(settings.lastSession).toBeNull();
  });

  it('rejects invalid persisted values and keeps valid nested export defaults', () => {
    const settings = normalizeSettings({
      theme: 'sepia',
      settingsVersion: 999,
      contentTheme: 'unknown theme!',
      fontSize: Number.NaN,
      editorLineHeight: 99,
      previewFontSize: 'large',
      defaultViewMode: 'reader',
      shortcutStyle: 'linux',
      locale: 'fr-FR',
      showLineNumbers: 'yes',
      wordWrap: 'no',
      exportDefaults: {
        format: 'docx',
        pngScale: 3,
        htmlIncludeTheme: false,
      },
    } as unknown as Partial<SettingsState>);

    expect(settings.theme).toBe(DEFAULT_SETTINGS.theme);
    expect(settings.settingsVersion).toBe(DEFAULT_SETTINGS.settingsVersion);
    expect(settings.contentTheme).toBe(DEFAULT_SETTINGS.contentTheme);
    expect(settings.fontSize).toBe(DEFAULT_SETTINGS.fontSize);
    expect(settings.editorLineHeight).toBe(3);
    expect(settings.previewFontSize).toBe(DEFAULT_SETTINGS.previewFontSize);
    expect(settings.defaultViewMode).toBe(DEFAULT_SETTINGS.defaultViewMode);
    expect(settings.shortcutStyle).toBe(DEFAULT_SETTINGS.shortcutStyle);
    expect(settings.locale).toBe(DEFAULT_SETTINGS.locale);
    expect(settings.showLineNumbers).toBe(DEFAULT_SETTINGS.showLineNumbers);
    expect(settings.wordWrap).toBe(DEFAULT_SETTINGS.wordWrap);
    expect(settings.exportDefaults).toEqual({
      ...DEFAULT_SETTINGS.exportDefaults,
      format: 'docx',
      pngScale: 3,
      htmlIncludeTheme: false,
    });
  });

  it('preserves syntactically valid user theme ids for registry validation at runtime', () => {
    const settings = normalizeSettings({
      contentTheme: 'warm-paper',
      exportHistory: [{
        documentPath: '/tmp/report.md',
        documentName: 'report.md',
        format: 'pdf',
        outputPath: '/tmp/report.pdf',
        settings: {
          contentTheme: 'warm-paper',
          htmlIncludeTheme: true,
          pngScale: 2,
          pdfPaper: 'a4',
          pdfMargin: 'standard',
          pdfPageNumbers: false,
          pageHeaderFooter: false,
          pageHeaderText: '{title}',
          pageFooterText: '{filename}',
          templateId: 'theme',
          frontMatterOverrides: false,
          toc: false,
          defaultLocation: 'document',
          docxFontPolicy: 'theme',
          docxCustomFontId: '',
        },
        exportedAt: 1,
      }],
    });

    expect(settings.contentTheme).toBe('warm-paper');
    expect(settings.exportHistory[0].settings.contentTheme).toBe('warm-paper');
  });

  it('normalizes 1.0.3 export, autosave, font and session fields', () => {
    const settings = normalizeSettings({
      autoSaveEnabled: false,
      autoSaveInterval: 8000,
      exportDefaults: {
        ...DEFAULT_SETTINGS.exportDefaults,
        templateId: 'academic',
        pdfPaper: 'letter',
        pdfMargin: 'compact',
        pdfPageNumbers: true,
        pageHeaderFooter: true,
        pageHeaderText: '  {title}  ',
        pageFooterText: '{filename} · {page}/{pages}',
        frontMatterOverrides: true,
        toc: true,
        defaultLocation: 'custom',
        customDirectory: '/tmp/exports',
        docxFontPolicy: 'custom',
        docxCustomFontId: 'font-1',
      },
      customFonts: [{
        id: 'font-1',
        family: 'Prism Demo',
        displayName: 'Demo',
        filename: 'demo.ttf',
        path: '/tmp/demo.ttf',
        format: 'ttf',
        importedAt: 1,
      }],
      previewFontSource: { kind: 'custom', value: 'font-1' },
      recentFilesLimit: 5,
      recentFiles: [
        { path: '/tmp/a.md', name: 'a.md', lastOpened: 1 },
        { path: '/tmp/b.md', name: 'b.md', lastOpened: 2 },
      ],
      restoreLastSession: false,
      wordWrap: false,
      lastSession: {
        filePath: '/tmp/b.md',
        folderPath: '/tmp',
        viewMode: 'split',
        scrollState: { editorRatio: 0.4, previewRatio: 1.4 },
        sidebarVisible: false,
        sidebarTab: 'files',
        updatedAt: 3,
      },
    });

    expect(settings.autoSaveEnabled).toBe(false);
    expect(settings.autoSaveStrategy).toBe('battery');
    expect(settings.exportDefaults).toMatchObject({
      templateId: 'academic',
      pdfPaper: 'letter',
      pdfMargin: 'compact',
      pdfPageNumbers: true,
      pageHeaderFooter: true,
      pageHeaderText: '{title}',
      pageFooterText: '{filename} · {page}/{pages}',
      frontMatterOverrides: true,
      toc: true,
      defaultLocation: 'custom',
      customDirectory: '/tmp/exports',
      docxFontPolicy: 'custom',
      docxCustomFontId: 'font-1',
    });
    expect(settings.customFonts).toHaveLength(1);
    expect(settings.previewFontSource).toEqual({ kind: 'custom', value: 'font-1' });
    expect(settings.recentFiles.map((file) => file.name)).toEqual(['b.md', 'a.md']);
    expect(settings.restoreLastSession).toBe(false);
    expect(settings.wordWrap).toBe(false);
    expect(settings.lastSession?.viewMode).toBe('split');
    expect(settings.lastSession?.scrollState).toEqual({ editorRatio: 0.4, previewRatio: 1 });
  });

  it('normalizes export history and drops unsafe entries', () => {
    const settings = normalizeSettings({
      exportHistory: [
        {
          documentPath: '/tmp/report.md',
          documentName: 'report.md',
          format: 'pdf',
          outputPath: '/tmp/report.pdf',
          settings: {
            contentTheme: 'slate',
            htmlIncludeTheme: false,
            pngScale: 3,
            pdfPaper: 'letter',
            pdfMargin: 'wide',
            pdfPageNumbers: true,
            pageHeaderFooter: true,
            pageHeaderText: '{title}',
            pageFooterText: '{filename} · {page}/{pages}',
            templateId: 'business',
            frontMatterOverrides: true,
            toc: true,
            defaultLocation: 'document',
            docxFontPolicy: 'preview',
            docxCustomFontId: '',
          },
          exportedAt: 2,
        },
        {
          documentPath: '',
          documentName: 'broken.md',
          format: 'pdf',
          outputPath: '/tmp/broken.pdf',
          settings: {},
          exportedAt: 1,
        },
        {
          documentPath: '/tmp/invalid.md',
          documentName: 'invalid.md',
          format: 'epub',
          outputPath: '/tmp/invalid.epub',
          settings: {},
          exportedAt: 1,
        },
      ] as unknown as SettingsState['exportHistory'],
    });

    expect(settings.exportHistory).toEqual([
      expect.objectContaining({
        documentPath: '/tmp/report.md',
        documentName: 'report.md',
        format: 'pdf',
        outputPath: '/tmp/report.pdf',
        settings: expect.objectContaining({
          contentTheme: 'slate',
          htmlIncludeTheme: false,
          pngScale: 3,
          pdfPaper: 'letter',
          pdfMargin: 'wide',
          pdfPageNumbers: true,
          pageHeaderFooter: true,
          pageHeaderText: '{title}',
          pageFooterText: '{filename} · {page}/{pages}',
          templateId: 'business',
          frontMatterOverrides: true,
          toc: true,
          docxFontPolicy: 'preview',
        }),
      }),
    ]);
  });

  it('migrates temporary pdf header/footer field names to generic page fields', () => {
    const settings = normalizeSettings({
      exportDefaults: {
        pdfHeaderFooter: true,
        pdfHeaderText: '{title}',
        pdfFooterText: '{filename} · {page}/{pages}',
      },
      exportHistory: [{
        documentPath: '/tmp/legacy.md',
        documentName: 'legacy.md',
        format: 'pdf',
        outputPath: '/tmp/legacy.pdf',
        settings: {
          contentTheme: 'miaoyan',
          htmlIncludeTheme: true,
          pngScale: 2,
          pdfPaper: 'a4',
          pdfMargin: 'standard',
          pdfPageNumbers: true,
          pdfHeaderFooter: true,
          pdfHeaderText: '{title}',
          pdfFooterText: '{filename}',
          templateId: 'theme',
          frontMatterOverrides: false,
          toc: false,
          defaultLocation: 'document',
          docxFontPolicy: 'theme',
          docxCustomFontId: '',
        },
        exportedAt: 1,
      }],
    } as unknown as Partial<SettingsState>);

    expect(settings.exportDefaults).toMatchObject({
      pageHeaderFooter: true,
      pageHeaderText: '{title}',
      pageFooterText: '{filename} · {page}/{pages}',
    });
    expect(settings.exportHistory[0].settings).toMatchObject({
      pageHeaderFooter: true,
      pageHeaderText: '{title}',
      pageFooterText: '{filename}',
      toc: false,
    });
  });

  it('normalizes pandoc detection settings and preserves valid state', () => {
    const settings = normalizeSettings({
      pandoc: {
        path: ' /opt/homebrew/bin/pandoc ',
        detected: true,
        version: ' pandoc 3.2.1 ',
        lastCheckedAt: 123,
        lastError: 'stale error',
      },
    } as Partial<SettingsState>);

    expect(settings.pandoc).toEqual({
      path: '/opt/homebrew/bin/pandoc',
      detected: true,
      version: 'pandoc 3.2.1',
      lastCheckedAt: 123,
      lastError: '',
    });
  });

  it('drops invalid pandoc detection values without breaking old configs', () => {
    const settings = normalizeSettings({
      pandoc: {
        path: 42,
        detected: 'yes',
        version: 'pandoc 3.2.1',
        lastCheckedAt: Number.NaN,
        lastError: '  command not found  ',
      },
    } as unknown as Partial<SettingsState>);

    expect(settings.pandoc).toEqual({
      path: '',
      detected: false,
      version: '',
      lastCheckedAt: null,
      lastError: 'command not found',
    });
  });

  it('normalizes citation bibliography and CSL settings', () => {
    const settings = normalizeSettings({
      citation: {
        bibliographyPath: ' /Users/Alex/Library/Prism/library.bib ',
        cslStylePath: ' /Users/Alex/Library/Prism/styles/chinese-gb7714.csl ',
      },
    } as Partial<SettingsState>);

    expect(settings.citation).toEqual({
      bibliographyPath: '/Users/Alex/Library/Prism/library.bib',
      cslStylePath: '/Users/Alex/Library/Prism/styles/chinese-gb7714.csl',
    });
  });

  it('drops invalid citation settings for old or corrupt configs', () => {
    const settings = normalizeSettings({
      citation: {
        bibliographyPath: 42,
        cslStylePath: null,
      },
    } as unknown as Partial<SettingsState>);

    expect(settings.citation).toEqual(DEFAULT_SETTINGS.citation);
  });
});
