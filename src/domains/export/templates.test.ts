import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, type SettingsState } from '../settings/types';
import { EXPORT_TEMPLATES, resolveExportOptions } from './templates';

function createSettings(overrides: Partial<SettingsState> = {}): SettingsState {
  return {
    ...DEFAULT_SETTINGS,
    ...overrides,
    exportDefaults: {
      ...DEFAULT_SETTINGS.exportDefaults,
      ...overrides.exportDefaults,
    },
  };
}

describe('export templates', () => {
  it('defines the four built-in export templates', () => {
    expect(Object.keys(EXPORT_TEMPLATES)).toEqual(['theme', 'business', 'plain', 'academic']);
    expect(EXPORT_TEMPLATES.business.pdfMargin).toBe('wide');
    expect(EXPORT_TEMPLATES.plain.codeStyle).toBe('plain');
    expect(EXPORT_TEMPLATES.academic.tableStyle).toBe('grid');
  });

  it('resolves export options from settings', () => {
    const options = resolveExportOptions({
      content: '# Title',
      filename: 'demo.md',
      settings: createSettings({
        contentTheme: 'slate',
        exportDefaults: {
          ...DEFAULT_SETTINGS.exportDefaults,
          templateId: 'business',
          pdfPaper: 'letter',
          pdfMargin: 'wide',
          pdfPageNumbers: true,
          pageHeaderFooter: true,
          pageHeaderText: '{title}',
          pageFooterText: '{filename} · {page}/{pages}',
          pngScale: 3,
          htmlIncludeTheme: false,
          toc: true,
          docxFontPolicy: 'preview',
        },
      }),
    });

    expect(options).toMatchObject({
      contentTheme: 'slate',
      templateId: 'business',
      pdfPaper: 'letter',
      pdfMargin: 'wide',
      pdfPageNumbers: true,
      pageHeaderFooter: true,
      pageHeaderText: '{title}',
      pageFooterText: '{filename} · {page}/{pages}',
      pngScale: 3,
      htmlIncludeTheme: false,
      toc: true,
      codeStyle: 'boxed',
      tableStyle: 'grid',
      docxFontPolicy: 'preview',
    });
  });

  it('uses imported preview font for DOCX when requested', () => {
    const options = resolveExportOptions({
      content: 'hello',
      filename: 'font.md',
      settings: createSettings({
        previewFontFamily: 'Prism Demo',
        previewFontSource: { kind: 'custom', value: 'font-1' },
        customFonts: [{
          id: 'font-1',
          family: 'Prism Demo',
          displayName: 'Demo',
          filename: 'demo.ttf',
          path: '/tmp/demo.ttf',
          format: 'ttf',
          importedAt: 1,
        }],
        exportDefaults: {
          ...DEFAULT_SETTINGS.exportDefaults,
          docxFontPolicy: 'preview',
        },
      }),
    });

    expect(options.docxFontFamily).toBe('Prism Demo');
    expect(options.docxFontFile).toEqual({
      filename: 'demo.ttf',
      path: '/tmp/demo.ttf',
      format: 'ttf',
    });
  });

  it('passes citation settings into resolved export options', () => {
    const options = resolveExportOptions({
      content: '参考 [@doe2024]',
      filename: 'citation.md',
      settings: createSettings({
        citation: {
          bibliographyPath: '/tmp/library.bib',
          cslStylePath: '/tmp/chinese-gb7714.csl',
        },
      }),
    });

    expect(options.citation).toEqual({
      bibliographyPath: '/tmp/library.bib',
      cslStylePath: '/tmp/chinese-gb7714.csl',
    });
  });

  it('passes pandoc settings into resolved export options', () => {
    const options = resolveExportOptions({
      content: '参考 [@doe2024]',
      filename: 'citation.md',
      settings: createSettings({
        pandoc: {
          path: '/opt/homebrew/bin/pandoc',
          detected: true,
          version: 'pandoc 3.2.1',
          lastCheckedAt: 123,
          lastError: '',
        },
      }),
    });

    expect(options.pandoc).toEqual({
      path: '/opt/homebrew/bin/pandoc',
      detected: true,
      version: 'pandoc 3.2.1',
      lastCheckedAt: 123,
      lastError: '',
    });
  });

  it('keeps yaml front matter in content when overrides are disabled', () => {
    const content = `---
title: Export Title
template: business
paper: letter
margin: wide
---
# Body`;
    const options = resolveExportOptions({
      content,
      filename: 'demo.md',
      settings: createSettings({
        exportDefaults: {
          ...DEFAULT_SETTINGS.exportDefaults,
          frontMatterOverrides: false,
          templateId: 'plain',
          toc: true,
        },
      }),
    });

    expect(options.content).toBe(content);
    expect(options.title).toBeUndefined();
    expect(options.frontMatter).toBeNull();
    expect(options.templateId).toBe('plain');
    expect(options.pdfPaper).toBe(DEFAULT_SETTINGS.exportDefaults.pdfPaper);
    expect(options.toc).toBe(true);
  });

  it('applies yaml front matter overrides when enabled', () => {
    const options = resolveExportOptions({
      content: `---
title: Export Title
author: Alex
date: "2026-05-15"
template: business
paper: letter
margin: wide
toc: true
---
# Body`,
      filename: 'demo.md',
      settings: createSettings({
        contentTheme: 'mono',
        exportDefaults: {
          ...DEFAULT_SETTINGS.exportDefaults,
          frontMatterOverrides: true,
          templateId: 'theme',
          pdfPaper: 'a4',
          pdfMargin: 'standard',
        },
      }),
    });

    expect(options).toMatchObject({
      content: '# Body',
      title: 'Export Title',
      author: 'Alex',
      date: '2026-05-15',
      contentTheme: 'mono',
      templateId: 'business',
      pdfPaper: 'letter',
      pdfMargin: 'wide',
      codeStyle: 'boxed',
      tableStyle: 'grid',
      toc: true,
      frontMatter: {
        title: 'Export Title',
        templateId: 'business',
      },
    });
  });

  it('applies nested yaml export overrides when enabled', () => {
    const options = resolveExportOptions({
      content: `---
title: Front Matter Export Override Title
author: Prism QA
date: 2026-06-30
export:
  template: theme
  paper: a4
  margin: narrow
  toc: true
---
# Body`,
      filename: 'demo.md',
      settings: createSettings({
        exportDefaults: {
          ...DEFAULT_SETTINGS.exportDefaults,
          frontMatterOverrides: true,
          templateId: 'business',
          pdfPaper: 'letter',
          pdfMargin: 'wide',
          toc: false,
        },
      }),
    });

    expect(options).toMatchObject({
      content: '# Body',
      title: 'Front Matter Export Override Title',
      author: 'Prism QA',
      date: '2026-06-30',
      templateId: 'theme',
      pdfPaper: 'a4',
      pdfMargin: 'compact',
      toc: true,
      frontMatter: {
        title: 'Front Matter Export Override Title',
        templateId: 'theme',
        pdfMargin: 'compact',
        toc: true,
      },
    });
  });

  it('applies yaml template defaults when front matter changes the template', () => {
    const options = resolveExportOptions({
      content: `---
template: business
---
# Body`,
      filename: 'demo.md',
      settings: createSettings({
        previewFontFamily: 'Preview Body',
        exportDefaults: {
          ...DEFAULT_SETTINGS.exportDefaults,
          frontMatterOverrides: true,
          templateId: 'theme',
          pdfMargin: 'standard',
          docxFontPolicy: 'theme',
        },
      }),
    });

    expect(options.templateId).toBe('business');
    expect(options.pdfMargin).toBe('wide');
    expect(options.docxFontPolicy).toBe('preview');
    expect(options.docxFontFamily).toBe('Preview Body');
    expect(options.codeStyle).toBe('boxed');
    expect(options.tableStyle).toBe('grid');
  });

  it('lets yaml front matter disable the default export toc when overrides are enabled', () => {
    const options = resolveExportOptions({
      content: `---
toc: false
---
# Body`,
      filename: 'demo.md',
      settings: createSettings({
        exportDefaults: {
          ...DEFAULT_SETTINGS.exportDefaults,
          frontMatterOverrides: true,
          toc: true,
        },
      }),
    });

    expect(options.content).toBe('# Body');
    expect(options.toc).toBe(false);
  });

  it('ignores unsupported front matter values and keeps default export settings', () => {
    const options = resolveExportOptions({
      content: `---
template: poster
paper: legal
margin: tiny
toc: maybe
---
# Body`,
      filename: 'demo.md',
      settings: createSettings({
        exportDefaults: {
          ...DEFAULT_SETTINGS.exportDefaults,
          frontMatterOverrides: true,
          templateId: 'academic',
          pdfPaper: 'letter',
          pdfMargin: 'compact',
          pdfPageNumbers: true,
        },
      }),
    });

    expect(options.content).toBe('# Body');
    expect(options.frontMatter).toBeNull();
    expect(options.templateId).toBe('academic');
    expect(options.pdfPaper).toBe('letter');
    expect(options.pdfMargin).toBe('compact');
    expect(options.pdfPageNumbers).toBe(true);
    expect(options.toc).toBe(false);
  });

  it('keeps invalid yaml front matter untouched', () => {
    const content = `---
title: [broken
---
# Body`;
    const options = resolveExportOptions({
      content,
      filename: 'demo.md',
      settings: createSettings({
        exportDefaults: {
          ...DEFAULT_SETTINGS.exportDefaults,
          frontMatterOverrides: true,
          templateId: 'business',
        },
      }),
    });

    expect(options.content).toBe(content);
    expect(options.frontMatter).toBeNull();
    expect(options.templateId).toBe('business');
  });
});
