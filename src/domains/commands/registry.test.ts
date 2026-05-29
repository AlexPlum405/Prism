import { beforeEach, describe, expect, it, vi } from 'vitest';

const exportMock = vi.hoisted(() => ({
  exportDocument: vi.fn(async (_input?: any) => true),
  resolveExportOptions: vi.fn((input: any) => ({
    content: input.content,
    filename: input.filename,
    contentTheme: input.settings.contentTheme,
    templateId: input.settings.exportDefaults.templateId,
    frontMatterOverrides: input.settings.exportDefaults.frontMatterOverrides,
    pdfPaper: input.settings.exportDefaults.pdfPaper,
    pdfMargin: input.settings.exportDefaults.pdfMargin,
    pdfPageNumbers: input.settings.exportDefaults.pdfPageNumbers,
    pageHeaderFooter: input.settings.exportDefaults.pageHeaderFooter,
    pageHeaderText: input.settings.exportDefaults.pageHeaderText,
    pageFooterText: input.settings.exportDefaults.pageFooterText,
    toc: input.settings.exportDefaults.toc,
    pngScale: input.settings.exportDefaults.pngScale,
    htmlIncludeTheme: input.settings.exportDefaults.htmlIncludeTheme,
    docxFontPolicy: input.settings.exportDefaults.docxFontPolicy,
    onProgress: input.onProgress,
    onWarning: input.onWarning,
  })),
}));

const fsMock = vi.hoisted(() => ({
  readTextFile: vi.fn(),
  stat: vi.fn(),
  writeTextFile: vi.fn(),
}));

const recoveryMock = vi.hoisted(() => ({
  clearRecoverySnapshotsForDocument: vi.fn(),
  createRecoverySnapshot: vi.fn(),
}));

const invokeMock = vi.hoisted(() => vi.fn());
const openerMock = vi.hoisted(() => ({
  openPath: vi.fn(),
  openUrl: vi.fn(),
  revealItemInDir: vi.fn(),
}));

vi.mock('@tauri-apps/plugin-fs', () => fsMock);
vi.mock('@tauri-apps/api/core', () => ({ invoke: invokeMock }));
vi.mock('@tauri-apps/plugin-opener', () => openerMock);

vi.mock('../document/services/recovery', () => recoveryMock);

vi.mock('../export', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../export')>();
  return {
    ...actual,
    exportDocument: exportMock.exportDocument,
    resolveExportOptions: exportMock.resolveExportOptions,
  };
});

import {
  commandRegistry,
  commandRegistryById,
  getMenuSections,
  runCommand,
  type CommandContext,
} from './index';
import { DEFAULT_SETTINGS } from '../settings/types';
import { builtInThemeContracts } from '../themes';
import { __themeRegistryTesting } from '../themes/themeRegistry';

function createCommandContext(overrides: Partial<CommandContext> = {}): CommandContext {
  return {
    documentStore: {
      currentDocument: null,
      createNewDocument: vi.fn(),
      openDocument: vi.fn(),
      closeDocument: vi.fn(),
      updateContent: vi.fn(),
      updateDocumentPath: vi.fn(),
      updateScrollState: vi.fn(),
      setViewMode: vi.fn(),
      updateFileSnapshot: vi.fn(),
      markSaving: vi.fn(),
      markSaved: vi.fn(),
      markSaveFailed: vi.fn(),
      markSaveConflict: vi.fn(),
    },
    settingsStore: {
      ...DEFAULT_SETTINGS,
      themeRegistryVersion: 0,
      themeRegistry: [],
      setLocale: vi.fn(),
      setTheme: vi.fn(),
      setContentTheme: vi.fn(),
      reloadThemeRegistry: vi.fn(),
      setFontSize: vi.fn(),
      setEditorFontFamily: vi.fn(),
      setEditorLineHeight: vi.fn(),
      setPreviewFontFamily: vi.fn(),
      setPreviewFontSize: vi.fn(),
      setEditorFontSource: vi.fn(),
      setPreviewFontSource: vi.fn(),
      addCustomFont: vi.fn(),
      removeCustomFont: vi.fn(),
      setDefaultViewMode: vi.fn(),
      setExportDefaultFormat: vi.fn(),
      setExportPngScale: vi.fn(),
      setExportHtmlIncludeTheme: vi.fn(),
      setExportPdfPaper: vi.fn(),
      setExportPdfMargin: vi.fn(),
      setExportPdfPageNumbers: vi.fn(),
      setExportPageHeaderFooter: vi.fn(),
      setExportPageHeaderText: vi.fn(),
      setExportPageFooterText: vi.fn(),
      setExportTemplateId: vi.fn(),
      setExportFrontMatterOverrides: vi.fn(),
      setExportToc: vi.fn(),
      setExportDefaultLocation: vi.fn(),
      setExportCustomDirectory: vi.fn(),
      setExportDocxFontPolicy: vi.fn(),
      setExportDocxCustomFontId: vi.fn(),
      setPandocPath: vi.fn(),
      setPandocDetection: vi.fn(),
      detectPandoc: vi.fn(),
      setCitationBibliographyPath: vi.fn(),
      setCitationCslStylePath: vi.fn(),
      setCitationSettings: vi.fn(),
      setShortcutStyle: vi.fn(),
      setAutoSaveEnabled: vi.fn(),
      setAutoSaveInterval: vi.fn(),
      setAutoSaveStrategy: vi.fn(),
      setShowLineNumbers: vi.fn(),
      setWordWrap: vi.fn(),
      addRecentFile: vi.fn(),
      clearRecentFiles: vi.fn(),
      setRecentFilesLimit: vi.fn(),
      recordExportHistory: vi.fn(),
      setRestoreLastSession: vi.fn(),
      setLastSession: vi.fn(),
      loadSettings: vi.fn(),
      saveSettings: vi.fn(),
    },
    workspaceStore: {
      mode: 'single',
      rootPath: null,
      fileTree: [],
      fileTreeMode: 'tree',
      fileSortMode: 'name',
      sidebarVisible: true,
      sidebarTab: 'files',
      focusMode: false,
      statusBarVisible: true,
      typewriterMode: false,
      isFullscreen: false,
      isAlwaysOnTop: false,
      setRootPath: vi.fn(),
      setFileTree: vi.fn(),
      setFileTreeMode: vi.fn(),
      setFileSortMode: vi.fn(),
      toggleSidebar: vi.fn(),
      setSidebarVisible: vi.fn(),
      toggleStatusBar: vi.fn(),
      toggleTypewriterMode: vi.fn(),
      setSidebarTab: vi.fn(),
      toggleFocusMode: vi.fn(),
      setFullscreen: vi.fn(),
      setAlwaysOnTop: vi.fn(),
    },
    ...overrides,
  };
}

describe('command registry', () => {
  beforeEach(() => {
    exportMock.exportDocument.mockClear();
    exportMock.exportDocument.mockResolvedValue(true);
    exportMock.resolveExportOptions.mockClear();
    fsMock.readTextFile.mockReset();
    fsMock.stat.mockReset();
    fsMock.stat.mockResolvedValue({ size: 3, mtime: new Date(1000) });
    fsMock.writeTextFile.mockReset();
    fsMock.writeTextFile.mockResolvedValue(undefined);
    recoveryMock.clearRecoverySnapshotsForDocument.mockReset();
    recoveryMock.clearRecoverySnapshotsForDocument.mockResolvedValue(undefined);
    recoveryMock.createRecoverySnapshot.mockReset();
    recoveryMock.createRecoverySnapshot.mockResolvedValue(null);
    invokeMock.mockReset();
    invokeMock.mockResolvedValue(undefined);
    openerMock.openPath.mockReset();
    openerMock.openPath.mockResolvedValue(undefined);
    openerMock.openUrl.mockReset();
    openerMock.openUrl.mockResolvedValue(undefined);
    openerMock.revealItemInDir.mockReset();
    openerMock.revealItemInDir.mockResolvedValue(undefined);
    __themeRegistryTesting.setRuntimeEntries([], []);
  });

  it('defines each command id once', () => {
    const ids = commandRegistry.map((command) => command.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(commandRegistryById.size).toBe(commandRegistry.length);
  });

  it('builds menu sections only from registered commands', () => {
    const sections = getMenuSections(createCommandContext());
    const actions: string[] = [];

    const collect = (items: Array<{ action?: string; children?: unknown }>) => {
      for (const item of items) {
        if (item.action) actions.push(item.action);
        if (Array.isArray(item.children)) collect(item.children as Array<{ action?: string; children?: unknown }>);
      }
    };

    Object.values(sections).forEach(collect);

    expect(actions.length).toBeGreaterThan(0);
    expect(actions.every((action) => commandRegistryById.has(action as never) || action.startsWith('setTheme:'))).toBe(true);
  });

  it('builds the theme menu from the runtime theme registry', () => {
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
      },
      fonts: [],
    }], [{
      id: 'broken-theme',
      name: 'Broken',
      directory: '/tmp/broken-theme',
      error: 'theme.css 缺失',
    }]);

    const sections = getMenuSections(createCommandContext({
      settingsStore: {
        ...createCommandContext().settingsStore,
        contentTheme: 'warm-paper',
      },
    }));
    const themeMenu = sections['视图'].find((item) => item.type !== 'separator' && item.label === '主题');
    expect(themeMenu).toMatchObject({ submenu: true });
    const themeItems = themeMenu && themeMenu.type !== 'separator' ? themeMenu.children ?? [] : [];

    expect(themeItems.some((item) => item.type !== 'separator' && item.action === 'setTheme:warm-paper')).toBe(true);
    expect(themeItems.some((item) => item.type !== 'separator' && item.action === 'setTheme:broken-theme')).toBe(false);
    expect(themeItems.find((item) => item.type !== 'separator' && item.action === 'setTheme:warm-paper')).toMatchObject({
      label: '暖纸',
      checked: true,
    });
  });

  it('places settings in File and product help in Help', () => {
    const sections = getMenuSections(createCommandContext());
    const fileActions = sections['文件'].flatMap((item) => item.type === 'separator' ? [] : [item.action]);
    const helpActions = sections['帮助'].flatMap((item) => item.type === 'separator' ? [] : [item.action]);

    expect(Object.keys(sections)).not.toContain('Prism');
    expect(Object.keys(sections)).toEqual(['文件', '编辑', '插入', '格式', '导航', '视图', '导出', '窗口', '帮助']);
    expect(fileActions).toContain('preferences');
    expect(helpActions).toEqual(expect.arrayContaining(['showShortcuts', 'checkUpdate', 'about']));
    expect(helpActions).not.toContain('commandPalette');
  });

  it('does not expose deferred platform features in menus', () => {
    const context = createCommandContext({
      documentStore: {
        ...createCommandContext().documentStore,
        currentDocument: {
          path: '/tmp/report.md',
          name: 'report.md',
          content: '# Report',
          isDirty: false,
          lastKnownMtime: null,
          lastKnownSize: null,
          lastSavedAt: 0,
          saveError: null,
          viewMode: 'split',
          scrollState: { editorRatio: 0, previewRatio: 0 },
          saveStatus: 'saved',
        },
      },
      settingsStore: {
        ...createCommandContext().settingsStore,
        exportHistory: [{
          documentPath: '/tmp/report.md',
          documentName: 'report.md',
          format: 'pdf',
          outputPath: '/tmp/report.pdf',
          settings: {
            contentTheme: 'miaoyan',
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
      },
      workspaceStore: {
        ...createCommandContext().workspaceStore,
        rootPath: '/notes',
        fileTree: [
          { path: '/notes/a.md', name: 'a.md', kind: 'file', modifiedAt: 1 },
        ],
      },
    });
    const visibleText: string[] = [];
    const collectMenuText = (items: Array<{ action?: string; label?: string; children?: unknown }>) => {
      for (const item of items) {
        if (item.action) visibleText.push(item.action);
        if (item.label) visibleText.push(item.label);
        if (Array.isArray(item.children)) {
          collectMenuText(item.children as Array<{ action?: string; label?: string; children?: unknown }>);
        }
      }
    };

    Object.values(getMenuSections(context)).forEach(collectMenuText);
    expect(visibleText.join('\n')).not.toMatch(/插件市场|插件 API|plugin marketplace|marketplace|prism:\/\/|deep\s*link|deeplink|云同步|移动端|实时协作|WYSIWYG/i);
  });

  it('opens quick-open from the Navigate menu when a workspace has markdown files', async () => {
    const openQuickOpen = vi.fn();
    const context = createCommandContext({
      openQuickOpen,
      workspaceStore: {
        ...createCommandContext().workspaceStore,
        rootPath: '/notes',
        fileTree: [
          { path: '/notes/a.md', name: 'a.md', kind: 'file', modifiedAt: 1 },
        ],
      },
    });
    const navigationActions = getMenuSections(context)['导航']
      .flatMap((item) => item.type === 'separator' ? [] : [item.action]);

    expect(navigationActions).toContain('quickOpen');

    await runCommand('quickOpen', context);

    expect(openQuickOpen).toHaveBeenCalledTimes(1);
    expect(commandRegistryById.get('quickOpen')?.shortcuts).toEqual([{ code: 'KeyP', mod: true }]);
    expect(commandRegistryById.get('print')?.shortcuts).toBeUndefined();
  });

  it('opens workspace full-text search with Cmd+Shift+F when a workspace is available', async () => {
    const openWorkspaceSearch = vi.fn();
    const context = createCommandContext({
      openWorkspaceSearch,
      workspaceStore: {
        ...createCommandContext().workspaceStore,
        rootPath: '/notes',
        fileTree: [
          { path: '/notes/a.md', name: 'a.md', kind: 'file', modifiedAt: 1 },
        ],
      },
    });
    const editActions = getMenuSections(context)['编辑']
      .flatMap((item) => item.type === 'separator' ? [] : [item.action]);

    expect(editActions).toEqual(expect.arrayContaining(['showSearch', 'showReplace', 'workspaceSearch']));

    await runCommand('workspaceSearch', context);

    expect(openWorkspaceSearch).toHaveBeenCalledTimes(1);
    expect(commandRegistryById.get('workspaceSearch')?.shortcuts).toEqual([{ code: 'KeyF', mod: true, shift: true }]);
  });

  it('routes document info commands through the Navigate menu instead of status bar entries', async () => {
    const openDocumentProperties = vi.fn();
    const openDocumentLinks = vi.fn();
    const openBacklinks = vi.fn();
    const openRelationGraph = vi.fn();
    const context = createCommandContext({
      documentStore: {
        ...createCommandContext().documentStore,
        currentDocument: {
          path: '/notes/report.md',
          name: 'report.md',
          content: '# Report',
          isDirty: false,
          lastKnownMtime: null,
          lastKnownSize: null,
          lastSavedAt: 0,
          saveError: null,
          viewMode: 'split',
          scrollState: { editorRatio: 0, previewRatio: 0 },
          saveStatus: 'saved',
        },
      },
      openDocumentProperties,
      openDocumentLinks,
      openBacklinks,
      openRelationGraph,
    });
    const navigationActions = getMenuSections(context)['导航']
      .flatMap((item) => item.type === 'separator' ? [] : [item.action]);

    expect(navigationActions).toEqual(expect.arrayContaining([
      'openDocumentProperties',
      'showDocumentLinks',
      'showBacklinks',
      'showRelationGraph',
      'showOutline',
    ]));

    await runCommand('openDocumentProperties', context);
    await runCommand('showDocumentLinks', context);
    await runCommand('showBacklinks', context);
    await runCommand('showRelationGraph', context);

    expect(openDocumentProperties).toHaveBeenCalledTimes(1);
    expect(openDocumentLinks).toHaveBeenCalledTimes(1);
    expect(openBacklinks).toHaveBeenCalledTimes(1);
    expect(openRelationGraph).toHaveBeenCalledTimes(1);
  });

  it('places automatic line wrapping in the View menu and toggles the persisted editor setting', async () => {
    const setWordWrap = vi.fn();
    const context = createCommandContext({
      settingsStore: {
        ...createCommandContext().settingsStore,
        wordWrap: true,
        setWordWrap,
      },
    });
    const viewActions = getMenuSections(context)['视图']
      .flatMap((item) => item.type === 'separator' ? [] : [item.action]);

    expect(viewActions).toEqual(expect.arrayContaining(['typewriterMode', 'wordWrap', 'statusBar']));

    await runCommand('wordWrap', context);
    expect(setWordWrap).toHaveBeenCalledWith(false);
  });

  it('keeps the Insert menu focused on primary table insertion', () => {
    const context = createCommandContext({
      documentStore: {
        ...createCommandContext().documentStore,
        currentDocument: {
          path: '/tmp/doc.md',
          name: 'doc.md',
          content: '',
          isDirty: false,
          lastKnownMtime: null,
          lastKnownSize: null,
          lastSavedAt: 0,
          saveError: null,
          viewMode: 'edit',
          scrollState: { editorRatio: 0, previewRatio: 0 },
          saveStatus: 'saved',
        },
      },
    });
    const insertActions = getMenuSections(context)['插入']
      .flatMap((item) => item.type === 'separator' ? [] : [item.action]);

    expect(insertActions).toEqual(expect.arrayContaining([
      'link',
      'insertImage',
      'insertTable',
      'codeBlock',
      'mathBlock',
      'quote',
      'insertCallout',
      'insertToggle',
    ]));
    expect(insertActions).not.toEqual(expect.arrayContaining([
      'formatTable',
      'addTableRow',
      'deleteTableColumn',
      'moveTableRowUp',
      'sortTableAsc',
      'copyTableCsv',
      'convertTableToHtml',
    ]));
  });

  it('exposes markdown templates from the Insert menu', async () => {
    const createNewDocument = vi.fn();
    const showToast = vi.fn();
    const context = createCommandContext({
      documentStore: {
        ...createCommandContext().documentStore,
        createNewDocument,
      },
      showToast,
    });
    const insertMenu = getMenuSections(context)['插入'];
    const templateMenu = insertMenu.find((item) => item.type !== 'separator' && item.label === '模板');

    expect(templateMenu).toMatchObject({
      submenu: true,
      children: expect.arrayContaining([
        expect.objectContaining({ action: 'templateReadme' }),
        expect.objectContaining({ action: 'templatePrd' }),
        expect.objectContaining({ action: 'templateMeeting' }),
        expect.objectContaining({ action: 'templateWeekly' }),
        expect.objectContaining({ action: 'templateTechnicalPlan' }),
        expect.objectContaining({ action: 'templateArticle' }),
        expect.objectContaining({ action: 'templatePaperDraft' }),
        expect.objectContaining({ action: 'templateReadingNote' }),
        expect.objectContaining({ action: 'templateResearchSummary' }),
        expect.objectContaining({ action: 'templateWhitePaper' }),
      ]),
    });

    await runCommand('templatePrd', context);
    expect(createNewDocument).toHaveBeenCalledWith(expect.stringContaining('# PRD：PRD'), 'prd.md');
    expect(showToast).toHaveBeenCalledWith('已创建 PRD 模板');

    await runCommand('templatePaperDraft', context);
    expect(createNewDocument).toHaveBeenCalledWith(expect.stringContaining('# 论文草稿'), 'paper-draft.md');
    expect(showToast).toHaveBeenCalledWith('已创建 论文草稿 模板');
  });

  it('exposes selection transforms from the Format menu without paragraph maintenance clutter', () => {
    const context = createCommandContext({
      documentStore: {
        ...createCommandContext().documentStore,
        currentDocument: {
          path: '/tmp/doc.md',
          name: 'doc.md',
          content: '# Draft',
          isDirty: false,
          lastKnownMtime: null,
          lastKnownSize: null,
          lastSavedAt: 0,
          saveError: null,
          viewMode: 'edit',
          scrollState: { editorRatio: 0, previewRatio: 0 },
          saveStatus: 'saved',
        },
      },
    });
    const formatMenu = getMenuSections(context)['格式'];
    const formatText: string[] = [];
    const collectFormatText = (items: Array<{ action?: string; children?: unknown }>) => {
      for (const item of items) {
        if (item.action) formatText.push(item.action);
        if (Array.isArray(item.children)) collectFormatText(item.children as Array<{ action?: string; children?: unknown }>);
      }
    };
    collectFormatText(formatMenu);

    expect(formatText).toEqual(expect.arrayContaining([
      'selectionQuote',
      'selectionTaskList',
      'selectionCallout',
    ]));
    expect(formatText).not.toEqual(expect.arrayContaining([
      'moveParagraphUp',
      'moveParagraphDown',
      'duplicateParagraph',
      'deleteParagraph',
      'moveSectionUp',
      'moveSectionDown',
      'duplicateSection',
      'foldCurrentHeading',
    ]));
  });

  it('dispatches template insertion to the active editor when a document is open', async () => {
    const listener = vi.fn();
    window.addEventListener('prism-editor-command', listener);
    const context = createCommandContext({
      documentStore: {
        ...createCommandContext().documentStore,
        currentDocument: {
          path: '/tmp/doc.md',
          name: 'doc.md',
          content: 'Draft',
          isDirty: false,
          lastKnownMtime: null,
          lastKnownSize: null,
          lastSavedAt: 0,
          saveError: null,
          viewMode: 'edit',
          scrollState: { editorRatio: 0, previewRatio: 0 },
          saveStatus: 'saved',
        },
      },
    });

    await runCommand('templateWeekly', context);
    window.removeEventListener('prism-editor-command', listener);

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.calls[0][0]).toMatchObject({
      detail: {
        command: 'insertTemplate',
        templateId: 'weekly',
      },
    });
  });

  it('builds recent document menu items from settings', () => {
    const sections = getMenuSections(createCommandContext({
      settingsStore: {
        ...createCommandContext().settingsStore,
        recentFiles: [
          { path: '/tmp/a.md', name: 'a.md', lastOpened: 2 },
          { path: '/tmp/b.md', name: 'b.md', lastOpened: 1 },
        ],
      },
    }));
    const recentMenu = sections['文件'].find((item) => item.type !== 'separator' && item.label === '最近打开');

    expect(recentMenu).toMatchObject({
      submenu: true,
      children: [
        { label: 'a.md', action: `openRecentFile:${encodeURIComponent('/tmp/a.md')}` },
        { label: 'b.md', action: `openRecentFile:${encodeURIComponent('/tmp/b.md')}` },
      ],
    });
  });

  it('exposes previous export commands only when the current document has export history', () => {
    const baseContext = createCommandContext();
    const context = createCommandContext({
      documentStore: {
        ...baseContext.documentStore,
        currentDocument: {
          path: '/tmp/report.md',
          name: 'report.md',
          content: '# Report',
          isDirty: false,
          lastKnownMtime: null,
          lastKnownSize: null,
          lastSavedAt: 0,
          saveError: null,
          viewMode: 'edit',
          scrollState: { editorRatio: 0, previewRatio: 0 },
          saveStatus: 'saved',
        },
      },
      settingsStore: {
        ...baseContext.settingsStore,
        exportHistory: [{
          documentPath: '/tmp/report.md',
          documentName: 'report.md',
          format: 'pdf',
          outputPath: '/tmp/report.pdf',
          settings: {
            contentTheme: 'slate',
            htmlIncludeTheme: true,
            pngScale: 2,
            pdfPaper: 'letter',
            pdfMargin: 'wide',
            pdfPageNumbers: false,
            pageHeaderFooter: false,
            pageHeaderText: '{title}',
            pageFooterText: '{filename}',
            templateId: 'business',
            frontMatterOverrides: false,
            toc: false,
            defaultLocation: 'document',
            docxFontPolicy: 'preview',
            docxCustomFontId: '',
          },
          exportedAt: 1,
        }],
      },
    });

    const exportMenu = getMenuSections(context)['导出'];

    expect(exportMenu).toEqual(expect.arrayContaining([
      expect.objectContaining({ action: 'exportWithPrevious', disabled: false }),
      expect.objectContaining({ action: 'exportOverwritePrevious', disabled: false }),
      expect.objectContaining({ action: 'exportSettings' }),
    ]));

    const noHistoryExportMenu = getMenuSections(createCommandContext({
      documentStore: context.documentStore,
    }))['导出'];
    expect(noHistoryExportMenu).toEqual(expect.arrayContaining([
      expect.objectContaining({ action: 'exportWithPrevious', disabled: true }),
      expect.objectContaining({ action: 'exportOverwritePrevious', disabled: true }),
      expect.objectContaining({ action: 'exportSettings' }),
    ]));
  });

  it('reuses the previous export settings and lets the user choose a new path', async () => {
    const baseContext = createCommandContext();
    const requestExportPath = vi.fn().mockResolvedValue('/tmp/report-copy.pdf');
    const recordExportHistory = vi.fn();
    const showToast = vi.fn();
    const context = createCommandContext({
      documentStore: {
        ...baseContext.documentStore,
        currentDocument: {
          path: '/tmp/report.md',
          name: 'report.md',
          content: '# Report',
          isDirty: false,
          lastKnownMtime: null,
          lastKnownSize: null,
          lastSavedAt: 0,
          saveError: null,
          viewMode: 'edit',
          scrollState: { editorRatio: 0, previewRatio: 0 },
          saveStatus: 'saved',
        },
      },
      settingsStore: {
        ...baseContext.settingsStore,
        contentTheme: 'miaoyan',
        exportHistory: [{
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
          exportedAt: 1,
        }],
        recordExportHistory,
      },
      requestExportPath,
      showToast,
    });

    await runCommand('exportWithPrevious', context);

    expect(requestExportPath).toHaveBeenCalledWith({
      format: 'pdf',
      filename: 'report.md',
      documentPath: '/tmp/report.md',
      suggestedPath: '/tmp/report.pdf',
    });
    expect(exportMock.resolveExportOptions).toHaveBeenCalledWith(expect.objectContaining({
      content: '# Report',
      filename: 'report.md',
      settings: expect.objectContaining({
        contentTheme: 'slate',
        exportDefaults: expect.objectContaining({
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
    }));
    expect(exportMock.exportDocument).toHaveBeenCalledWith(
      expect.objectContaining({ contentTheme: 'slate', templateId: 'business' }),
      'pdf',
      '/tmp/report-copy.pdf',
    );
    expect(recordExportHistory).toHaveBeenCalledWith(expect.objectContaining({
      documentPath: '/tmp/report.md',
      documentName: 'report.md',
      format: 'pdf',
      outputPath: '/tmp/report-copy.pdf',
      settings: expect.objectContaining({
        contentTheme: 'slate',
        templateId: 'business',
        pdfMargin: 'wide',
        pdfPageNumbers: true,
        pageHeaderFooter: true,
        pageHeaderText: '{title}',
        pageFooterText: '{filename} · {page}/{pages}',
        frontMatterOverrides: true,
        toc: true,
      }),
    }));
    expect(showToast).toHaveBeenCalledWith(expect.objectContaining({
      tone: 'success',
      title: 'PDF 导出完成',
      message: 'report-copy.pdf',
    }));
    const successToast = showToast.mock.calls.find(([toast]) => typeof toast !== 'string' && toast.title === 'PDF 导出完成')?.[0] as any;
    expect(successToast.actions.map((action: any) => action.label)).toEqual(['打开', '显示位置']);

    await successToast.actions[0].onClick();

    expect(invokeMock).toHaveBeenCalledWith('open_path_with_system', { path: '/tmp/report-copy.pdf' });
    expect(openerMock.openPath).not.toHaveBeenCalled();
  });

  it('overwrites the previous export path without reopening the save dialog', async () => {
    const baseContext = createCommandContext();
    const requestExportPath = vi.fn();
    const recordExportHistory = vi.fn();
    const context = createCommandContext({
      documentStore: {
        ...baseContext.documentStore,
        currentDocument: {
          path: '/tmp/report.md',
          name: 'report.md',
          content: '# Report',
          isDirty: false,
          lastKnownMtime: null,
          lastKnownSize: null,
          lastSavedAt: 0,
          saveError: null,
          viewMode: 'edit',
          scrollState: { editorRatio: 0, previewRatio: 0 },
          saveStatus: 'saved',
        },
      },
      settingsStore: {
        ...baseContext.settingsStore,
        exportHistory: [{
          documentPath: '/tmp/report.md',
          documentName: 'report.md',
          format: 'docx',
          outputPath: '/tmp/report.docx',
          settings: {
            contentTheme: 'inkstone',
            htmlIncludeTheme: true,
            pngScale: 2,
            pdfPaper: 'a4',
            pdfMargin: 'standard',
            pdfPageNumbers: false,
            pageHeaderFooter: false,
            pageHeaderText: '{title}',
            pageFooterText: '{filename}',
            templateId: 'academic',
            frontMatterOverrides: false,
            toc: false,
            defaultLocation: 'document',
            docxFontPolicy: 'theme',
            docxCustomFontId: '',
          },
          exportedAt: 1,
        }],
        recordExportHistory,
      },
      requestExportPath,
    });

    await runCommand('exportOverwritePrevious', context);

    expect(requestExportPath).not.toHaveBeenCalled();
    expect(exportMock.exportDocument).toHaveBeenCalledWith(
      expect.objectContaining({ contentTheme: 'inkstone', templateId: 'academic' }),
      'docx',
      '/tmp/report.docx',
    );
    expect(recordExportHistory).toHaveBeenCalledWith(expect.objectContaining({
      format: 'docx',
      outputPath: '/tmp/report.docx',
    }));
  });

  it('emits export progress events and clears progress after success', async () => {
    const baseContext = createCommandContext();
    const progressListener = vi.fn();
    const requestExportPath = vi.fn().mockResolvedValue('/tmp/report.pdf');
    exportMock.exportDocument.mockImplementationOnce(async (input: any) => {
      input.onProgress?.('正在解析 Markdown');
      input.onProgress?.('正在写入 PDF 文件');
      return true;
    });
    window.addEventListener('prism-export-progress', progressListener);

    const context = createCommandContext({
      documentStore: {
        ...baseContext.documentStore,
        currentDocument: {
          path: '/tmp/report.md',
          name: 'report.md',
          content: '# Report',
          isDirty: false,
          lastKnownMtime: null,
          lastKnownSize: null,
          lastSavedAt: 0,
          saveError: null,
          viewMode: 'edit',
          scrollState: { editorRatio: 0, previewRatio: 0 },
          saveStatus: 'saved',
        },
      },
      settingsStore: baseContext.settingsStore,
      requestExportPath,
    });

    await runCommand('exportPdf', context);
    window.removeEventListener('prism-export-progress', progressListener);

    expect(progressListener.mock.calls.map(([event]) => event.detail)).toEqual([
      { visible: true, message: '准备导出' },
      { visible: true, message: '正在解析 Markdown' },
      { visible: true, message: '正在写入 PDF 文件' },
      { visible: false },
    ]);
  });

  it('continues export when requestAnimationFrame stalls before the first progress paint', async () => {
    const originalRequestAnimationFrame = window.requestAnimationFrame;
    vi.useFakeTimers();
    window.requestAnimationFrame = vi.fn(() => 1) as unknown as typeof window.requestAnimationFrame;
    const baseContext = createCommandContext();
    const requestExportPath = vi.fn().mockResolvedValue('/tmp/report.pdf');
    const context = createCommandContext({
      documentStore: {
        ...baseContext.documentStore,
        currentDocument: {
          path: '/tmp/report.md',
          name: 'report.md',
          content: '# Report',
          isDirty: false,
          lastKnownMtime: null,
          lastKnownSize: null,
          lastSavedAt: 0,
          saveError: null,
          viewMode: 'edit',
          scrollState: { editorRatio: 0, previewRatio: 0 },
          saveStatus: 'saved',
        },
      },
      settingsStore: baseContext.settingsStore,
      requestExportPath,
    });

    try {
      const runPromise = runCommand('exportPdf', context);
      await vi.advanceTimersByTimeAsync(260);
      await runPromise;
    } finally {
      window.requestAnimationFrame = originalRequestAnimationFrame;
      vi.useRealTimers();
    }

    expect(exportMock.exportDocument).toHaveBeenCalledWith(
      expect.objectContaining({ filename: 'report.md' }),
      'pdf',
      '/tmp/report.pdf',
    );
  });

  it('applies the quality selected in the export save dialog to the current export only', async () => {
    const baseContext = createCommandContext();
    const requestExportPath = vi.fn().mockResolvedValue({
      path: '/tmp/report.png',
      qualityScale: 4,
    });
    const recordExportHistory = vi.fn();
    const context = createCommandContext({
      documentStore: {
        ...baseContext.documentStore,
        currentDocument: {
          path: '/tmp/report.md',
          name: 'report.md',
          content: '# Report',
          isDirty: false,
          lastKnownMtime: null,
          lastKnownSize: null,
          lastSavedAt: 0,
          saveError: null,
          viewMode: 'edit',
          scrollState: { editorRatio: 0, previewRatio: 0 },
          saveStatus: 'saved',
        },
      },
      settingsStore: {
        ...baseContext.settingsStore,
        exportDefaults: {
          ...baseContext.settingsStore.exportDefaults,
          pngScale: 2,
        },
        recordExportHistory,
      },
      requestExportPath,
    });

    await runCommand('exportPng', context);

    expect(exportMock.resolveExportOptions).toHaveBeenCalledWith(expect.objectContaining({
      settings: expect.objectContaining({
        exportDefaults: expect.objectContaining({ pngScale: 4 }),
      }),
    }));
    expect(exportMock.exportDocument).toHaveBeenCalledWith(
      expect.objectContaining({ pngScale: 4 }),
      'png',
      '/tmp/report.png',
    );
    expect(recordExportHistory).toHaveBeenCalledWith(expect.objectContaining({
      outputPath: '/tmp/report.png',
      settings: expect.objectContaining({ pngScale: 4 }),
    }));
  });

  it('emits copyable diagnostics when export fails', async () => {
    const baseContext = createCommandContext();
    const requestExportPath = vi.fn().mockResolvedValue('/tmp/report.pdf');
    const recordExportHistory = vi.fn();
    const showToast = vi.fn();
    const failureListener = vi.fn();
    const progressListener = vi.fn();
    exportMock.exportDocument.mockImplementationOnce(async (input: any) => {
      input.onProgress?.('正在写入 PDF 文件');
      input.onWarning?.('Pandoc 未检测成功；HTML 导出已回退内置管线');
      input.onWarning?.('CSL 样式文件后缀需要是 .csl');
      throw new Error('disk full');
    });
    window.addEventListener('prism-export-failure', failureListener);
    window.addEventListener('prism-export-progress', progressListener);

    const context = createCommandContext({
      documentStore: {
        ...baseContext.documentStore,
        currentDocument: {
          path: '/tmp/report.md',
          name: 'report.md',
          content: '# Report',
          isDirty: false,
          lastKnownMtime: null,
          lastKnownSize: null,
          lastSavedAt: 0,
          saveError: null,
          viewMode: 'edit',
          scrollState: { editorRatio: 0, previewRatio: 0 },
          saveStatus: 'saved',
        },
      },
      settingsStore: {
        ...baseContext.settingsStore,
        contentTheme: 'slate',
        exportDefaults: {
          ...baseContext.settingsStore.exportDefaults,
          templateId: 'business',
          pdfPaper: 'letter',
          pdfMargin: 'wide',
          pdfPageNumbers: false,
          toc: true,
          pageHeaderFooter: true,
          pageHeaderText: '{title}',
          pageFooterText: '{filename}',
          defaultLocation: 'custom',
          docxCustomFontId: 'font-1',
        },
        pandoc: {
          path: '/opt/homebrew/bin/pandoc',
          detected: false,
          version: '',
          lastCheckedAt: 123,
          lastError: 'not installed',
        },
        citation: {
          bibliographyPath: '/tmp/library.bib',
          cslStylePath: '/tmp/chinese-gb7714.csl',
        },
        recordExportHistory,
      },
      requestExportPath,
      showToast,
    });

    await runCommand('exportPdf', context);
    window.removeEventListener('prism-export-failure', failureListener);
    window.removeEventListener('prism-export-progress', progressListener);

    expect(recordExportHistory).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith(expect.objectContaining({
      tone: 'warning',
      title: '导出提示',
      message: 'Pandoc 未检测成功；HTML 导出已回退内置管线',
    }));
    expect(showToast).toHaveBeenCalledWith(expect.objectContaining({
      tone: 'error',
      title: 'PDF 导出失败',
      message: '已生成诊断文本，可查看后重试。',
    }));
    const failureToast = showToast.mock.calls.find(([toast]) => typeof toast !== 'string' && toast.title === 'PDF 导出失败')?.[0] as any;
    expect(failureToast.actions.map((action: any) => action.label)).toEqual(['查看诊断', '重试']);
    expect(progressListener.mock.calls.map(([event]) => event.detail)).toEqual([
      { visible: true, message: '准备导出' },
      { visible: true, message: '正在写入 PDF 文件' },
      { visible: false },
    ]);
    expect(failureListener).toHaveBeenCalledTimes(1);
    const detail = failureListener.mock.calls[0][0].detail;
    expect(detail.title).toBe('PDF 导出失败');
    expect(detail.diagnostic).toContain('Prism 导出失败诊断');
    expect(detail.diagnostic).toContain('格式: PDF (pdf)');
    expect(detail.diagnostic).toContain('阶段: 正在写入 PDF 文件');
    expect(detail.diagnostic).toContain('文档路径: /tmp/report.md');
    expect(detail.diagnostic).toContain('输出路径: /tmp/report.pdf');
    expect(detail.diagnostic).toContain('内容主题: slate');
    expect(detail.diagnostic).toContain('导出模板: business');
    expect(detail.diagnostic).toContain('Front matter 覆盖: 已关闭');
    expect(detail.diagnostic).toContain('目录: 已开启');
    expect(detail.diagnostic).toContain('默认导出位置: custom');
    expect(detail.diagnostic).toContain('页码: 已关闭');
    expect(detail.diagnostic).toContain('页眉页脚: 已开启');
    expect(detail.diagnostic).toContain('页眉文本: {title}');
    expect(detail.diagnostic).toContain('页脚文本: {filename}');
    expect(detail.diagnostic).toContain('DOCX 自定义字体: font-1');
    expect(detail.diagnostic).toContain('参考文献文件: /tmp/library.bib');
    expect(detail.diagnostic).toContain('CSL 样式文件: /tmp/chinese-gb7714.csl');
    expect(detail.diagnostic).toContain('引用路径校验: 通过');
    expect(detail.diagnostic).toContain('Pandoc 引用条件: 未满足');
    expect(detail.diagnostic).toContain('Pandoc 状态: 不可用');
    expect(detail.diagnostic).toContain('Pandoc 路径: /opt/homebrew/bin/pandoc');
    expect(detail.diagnostic).toContain('Pandoc 错误: not installed');
    expect(detail.diagnostic).toContain('导出警告:');
    expect(detail.diagnostic).toContain('- Pandoc 未检测成功；HTML 导出已回退内置管线');
    expect(detail.diagnostic).toContain('- CSL 样式文件后缀需要是 .csl');
    expect(detail.diagnostic).toContain('错误: disk full');
  });

  it('keeps pandoc citation condition unmet when citation paths fail validation', async () => {
    exportMock.exportDocument.mockRejectedValueOnce(new Error('broken citation path'));
    const failureListener = vi.fn();
    window.addEventListener('prism-export-failure', failureListener);
    const requestExportPath = vi.fn(async () => '/tmp/report.html');
    const context = createCommandContext({
      documentStore: {
        ...createCommandContext().documentStore,
        currentDocument: {
          path: '/tmp/report.md',
          name: 'report.md',
          content: '引用 [@doe2024]',
          isDirty: false,
          lastKnownMtime: null,
          lastKnownSize: null,
          lastSavedAt: 0,
          saveError: null,
          viewMode: 'edit',
          scrollState: { editorRatio: 0, previewRatio: 0 },
          saveStatus: 'saved',
        },
      },
      settingsStore: {
        ...createCommandContext().settingsStore,
        pandoc: {
          path: '/opt/homebrew/bin/pandoc',
          detected: true,
          version: 'pandoc 3.2.1',
          lastCheckedAt: 123,
          lastError: '',
        },
        citation: {
          bibliographyPath: '/tmp/references.txt',
          cslStylePath: '/tmp/style.json',
        },
      },
      requestExportPath,
      showToast: vi.fn(),
    });

    await runCommand('exportHtml', context);
    window.removeEventListener('prism-export-failure', failureListener);

    expect(failureListener).toHaveBeenCalledTimes(1);
    const detail = failureListener.mock.calls[0][0].detail;
    expect(detail.diagnostic).toContain('Pandoc 状态: 可用');
    expect(detail.diagnostic).toContain('引用路径校验: 参考文献文件后缀需为 .bib / .bibtex / .json；CSL 样式文件后缀需为 .csl');
    expect(detail.diagnostic).toContain('Pandoc 引用条件: 未满足');
  });

  it('runs enabled commands and skips disabled commands', async () => {
    const createNewDocument = vi.fn();
    const requestSavePath = vi.fn();
    const context = createCommandContext({
      documentStore: {
        ...createCommandContext().documentStore,
        createNewDocument,
      },
      requestSavePath,
    });

    await runCommand('new', context);
    await runCommand('save', context);

    expect(createNewDocument).toHaveBeenCalledTimes(1);
    expect(requestSavePath).not.toHaveBeenCalled();
  });

  it('creates and clears recovery snapshots around manual save', async () => {
    const markSaving = vi.fn();
    const markSaved = vi.fn();
    const markSaveFailed = vi.fn();
    const context = createCommandContext({
      documentStore: {
        ...createCommandContext().documentStore,
        currentDocument: {
          path: '/tmp/a.md',
          name: 'a.md',
          content: '# B',
          isDirty: true,
          lastSavedAt: 0,
          lastKnownMtime: 1000,
          lastKnownSize: 3,
          saveStatus: 'dirty',
          saveError: null,
          viewMode: 'edit',
          scrollState: { editorRatio: 0, previewRatio: 0 },
        },
        markSaving,
        markSaved,
        markSaveFailed,
      },
    });

    await runCommand('save', context);

    expect(markSaving).toHaveBeenCalledWith('/tmp/a.md');
    expect(recoveryMock.createRecoverySnapshot).toHaveBeenCalledWith({
      documentPath: '/tmp/a.md',
      documentName: 'a.md',
      content: '# B',
      reason: 'manual-save',
    });
    expect(fsMock.writeTextFile).toHaveBeenCalledWith('/tmp/a.md', '# B');
    expect(markSaved).toHaveBeenCalledWith('/tmp/a.md', { mtimeMs: 1000, size: 3 });
    expect(recoveryMock.clearRecoverySnapshotsForDocument).toHaveBeenCalledWith('/tmp/a.md');
    expect(markSaveFailed).not.toHaveBeenCalled();
  });

  it('keeps recovery snapshots when manual save detects an external change', async () => {
    fsMock.stat.mockResolvedValue({ size: 9, mtime: new Date(2000) });
    const markSaveConflict = vi.fn();
    const markSaveFailed = vi.fn();
    const showToast = vi.fn();
    const context = createCommandContext({
      documentStore: {
        ...createCommandContext().documentStore,
        currentDocument: {
          path: '/tmp/a.md',
          name: 'a.md',
          content: '# B',
          isDirty: true,
          lastSavedAt: 0,
          lastKnownMtime: 1000,
          lastKnownSize: 3,
          saveStatus: 'dirty',
          saveError: null,
          viewMode: 'edit',
          scrollState: { editorRatio: 0, previewRatio: 0 },
        },
        markSaveConflict,
        markSaveFailed,
      },
      showToast,
    });

    await runCommand('save', context);

    expect(recoveryMock.createRecoverySnapshot).toHaveBeenCalledWith({
      documentPath: '/tmp/a.md',
      documentName: 'a.md',
      content: '# B',
      reason: 'manual-save',
    });
    expect(markSaveConflict).toHaveBeenCalledWith(
      '文件已在磁盘上被外部修改，请先重新加载或另存为。',
      '/tmp/a.md',
    );
    expect(fsMock.writeTextFile).not.toHaveBeenCalled();
    expect(recoveryMock.clearRecoverySnapshotsForDocument).not.toHaveBeenCalled();
    expect(markSaveFailed).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith('操作失败: 文件已在磁盘上被外部修改，请先重新加载或另存为。');
  });
});
