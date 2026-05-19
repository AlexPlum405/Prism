import { ask, open } from '@tauri-apps/plugin-dialog';
import { readTextFile, writeTextFile, stat } from '@tauri-apps/plugin-fs';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { getCurrentWebview } from '@tauri-apps/api/webview';
import { invoke } from '@tauri-apps/api/core';
import { openPath, openUrl, revealItemInDir } from '@tauri-apps/plugin-opener';
import { loadFolderTree } from '../workspace/lib/loadFolderTree';
import { openPrismWindow } from '../../lib/openWindow';
import { grantMarkdownFileScope, grantWorkspaceDirectoryScope } from '../../lib/fileSystemScope';
import { MARKDOWN_FILE_FILTERS, addRecentFile, basename, dirname } from '../workspace/services';
import { checkForAppUpdate } from '../update/updateService';
import {
  getExternalChangeMessage,
  getFileSnapshot,
  getFileSnapshotOrNull,
  hasFileSnapshotChanged,
  snapshotFromFileInfo,
  type FileSnapshot,
} from '../document/fileSnapshot';
import {
  clearRecoverySnapshotsForDocument,
  createRecoverySnapshot,
} from '../document/services/recovery';
import {
  MARKDOWN_TEMPLATES,
  resolveMarkdownTemplateContent,
  type MarkdownTemplateId,
} from '../editor/extensions/templates';
import {
  exportDocument,
  getExportFormatLabel,
  resolveExportOptions,
  type ExportFormat,
} from '../export';
import { normalizeExportQualityScale } from '../export/quality';
import type { ExportHistoryEntry, ExportHistorySettings, SettingsState } from '../settings/types';
import type {
  CommandContext,
  CommandDefinition,
  CommandId,
} from './types';
import {
  getCurrentPlatform,
  getShortcutDisplayPlatform,
  getShortcutLabel,
  shortcutMatchesEvent,
  type ShortcutDisplayStyle,
} from './platform';

function formatError(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (err instanceof Event) return err.type || '未知事件错误';
  return String(err);
}

function hasDocument(context: CommandContext): boolean {
  return Boolean(context.documentStore.currentDocument);
}

function hasSavedDocumentPath(context: CommandContext): boolean {
  return Boolean(context.documentStore.currentDocument?.path);
}

function getCurrentDocumentExportHistory(context: CommandContext): ExportHistoryEntry | null {
  const documentPath = context.documentStore.currentDocument?.path;
  if (!documentPath) return null;
  return context.settingsStore.exportHistory.find((entry) => entry.documentPath === documentPath) ?? null;
}

function hasCurrentDocumentExportHistory(context: CommandContext): boolean {
  return Boolean(getCurrentDocumentExportHistory(context));
}

function isExternalFileChangeError(error: unknown): boolean {
  return error instanceof Error && error.message === getExternalChangeMessage();
}

async function ensureDocumentNotChangedOnDisk(context: CommandContext, path: string): Promise<FileSnapshot | null> {
  const doc = context.documentStore.currentDocument;
  if (!doc) return null;

  const diskSnapshot = await getFileSnapshot(path);
  const knownSnapshot = {
    mtimeMs: doc.lastKnownMtime,
    size: doc.lastKnownSize,
  };

  if (hasFileSnapshotChanged(knownSnapshot, diskSnapshot)) {
    const message = getExternalChangeMessage();
    context.documentStore.markSaveConflict(message, path);
    throw new Error(message);
  }

  return diskSnapshot;
}

function emitEditorCommand(command: string, detail: Record<string, unknown> = {}): void {
  window.dispatchEvent(new CustomEvent('prism-editor-command', { detail: { command, ...detail } }));
}

function emitInlineFormat(format: string): void {
  window.dispatchEvent(new CustomEvent('prism-format', { detail: { format } }));
}

function waitForExportProgressPaint(timeoutMs = 250) {
  return new Promise<void>((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      resolve();
    };
    const timeout = window.setTimeout(finish, timeoutMs);
    if (typeof window.requestAnimationFrame !== 'function') {
      finish();
      return;
    }
    window.requestAnimationFrame(() => window.requestAnimationFrame(finish));
  });
}

function emitHeading(level: string): void {
  window.dispatchEvent(new CustomEvent('prism-heading', { detail: { level } }));
}

function emitBlockFormat(format: string): void {
  window.dispatchEvent(new CustomEvent('prism-block-format', { detail: { format } }));
}

async function handleNew(context: CommandContext): Promise<void> {
  if (!context.documentStore.currentDocument) {
    context.documentStore.createNewDocument();
    return;
  }

  await openPrismWindow({});
}

function handleMarkdownTemplate(templateId: MarkdownTemplateId, context: CommandContext): void {
  const template = MARKDOWN_TEMPLATES[templateId];
  if (!context.documentStore.currentDocument) {
    context.documentStore.createNewDocument(resolveMarkdownTemplateContent(template.content, {
      title: template.label,
    }), template.filename);
    context.showToast?.(`已创建 ${template.label} 模板`);
    return;
  }

  emitEditorCommand('insertTemplate', { templateId });
}

async function handleOpen(context: CommandContext): Promise<void> {
  const selected = await open({
    multiple: false,
    filters: MARKDOWN_FILE_FILTERS,
  });

  if (!selected || Array.isArray(selected)) return;
  await grantMarkdownFileScope(selected);

  try {
    const fileInfo = await stat(selected);
    const fileSizeMB = fileInfo.size / (1024 * 1024);

    if (fileSizeMB > 10) {
      const shouldContinue = await ask(
        `文件大小为 ${fileSizeMB.toFixed(2)} MB，可能影响性能。是否继续打开？`,
        { title: '大文件警告', kind: 'warning' },
      );
      if (!shouldContinue) return;
    }
  } catch (err) {
    console.error('[Command] Failed to check file size:', err);
  }

  if (context.documentStore.currentDocument) {
    await openPrismWindow({ filePath: selected });
    return;
  }

  try {
    const snapshot = snapshotFromFileInfo(await stat(selected));
    const content = await readTextFile(selected);
    const name = basename(selected);
    context.documentStore.openDocument(selected, name, content, snapshot);
    addRecentFile(selected, name);

    try {
      const parentDir = dirname(selected);
      context.workspaceStore.setRootPath(parentDir);
      const tree = await loadFolderTree(parentDir);
      context.workspaceStore.setFileTree(tree);
    } catch (err) {
      console.error('[Command] Failed to load parent folder tree:', err);
    }
  } catch (err) {
    console.error('[Command] Failed to open file:', err);
    const message = formatError(err);
    await ask(`无法打开文件：${message}`, { title: '打开文件失败', kind: 'error' });
  }
}

async function handleOpenFolder(context: CommandContext): Promise<void> {
  const selected = await open({ directory: true, multiple: false, recursive: true });
  if (!selected || Array.isArray(selected)) return;
  await grantWorkspaceDirectoryScope(selected);

  if (context.documentStore.currentDocument) {
    await openPrismWindow({ folderPath: selected });
    return;
  }

  context.workspaceStore.setRootPath(selected);
  try {
    const tree = await loadFolderTree(selected);
    context.workspaceStore.setFileTree(tree);
  } catch (err) {
    console.error('[Command] Failed to load folder tree:', err);
  }
}

async function handleSave(context: CommandContext): Promise<void> {
  const doc = context.documentStore.currentDocument;
  if (!doc) return;

  let targetPath = doc.path;

  if (!targetPath) {
    if (!context.requestSavePath) {
      context.showToast?.('保存面板未就绪');
      return;
    }
    const chosen = await context.requestSavePath({
      filename: doc.name,
      documentPath: doc.path,
    });
    if (!chosen) return;
    targetPath = chosen;
  }

  context.documentStore.markSaving(doc.path || undefined);

  try {
    if (doc.path) {
      await createRecoverySnapshot({
        documentPath: doc.path,
        documentName: doc.name,
        content: doc.content,
        reason: 'manual-save',
      }).catch(() => undefined);
    }
    if (doc.path) await ensureDocumentNotChangedOnDisk(context, targetPath);
    await writeTextFile(targetPath, doc.content);
    const snapshot = await getFileSnapshotOrNull(targetPath);
    if (!doc.path) {
      context.documentStore.openDocument(targetPath, basename(targetPath), doc.content, snapshot);
    }
    addRecentFile(targetPath, basename(targetPath));
    context.documentStore.markSaved(targetPath, snapshot);
    await clearRecoverySnapshotsForDocument(targetPath).catch(() => undefined);
  } catch (err) {
    if (!isExternalFileChangeError(err)) {
      context.documentStore.markSaveFailed(err, doc.path || undefined);
    }
    throw err;
  }
}

async function handleSaveAs(context: CommandContext): Promise<void> {
  const doc = context.documentStore.currentDocument;
  if (!doc) return;

  if (!context.requestSavePath) {
    context.showToast?.('保存面板未就绪');
    return;
  }

  const chosen = await context.requestSavePath({
    filename: doc.name,
    documentPath: doc.path,
  });
  if (!chosen) return;

  context.documentStore.markSaving();
  try {
    if (doc.path) {
      await createRecoverySnapshot({
        documentPath: doc.path,
        documentName: doc.name,
        content: doc.content,
        reason: 'manual-save',
      }).catch(() => undefined);
    }
    await writeTextFile(chosen, doc.content);
    const snapshot = await getFileSnapshotOrNull(chosen);
    context.documentStore.openDocument(chosen, basename(chosen), doc.content, snapshot);
    addRecentFile(chosen, basename(chosen));
    context.documentStore.markSaved(chosen, snapshot);
    if (doc.path) await clearRecoverySnapshotsForDocument(doc.path).catch(() => undefined);
    await clearRecoverySnapshotsForDocument(chosen).catch(() => undefined);
  } catch (err) {
    context.documentStore.markSaveFailed(err);
    throw err;
  }
}

function createExportHistorySettings(settings: SettingsState): ExportHistorySettings {
  return {
    contentTheme: settings.contentTheme,
    htmlIncludeTheme: settings.exportDefaults.htmlIncludeTheme,
    pngScale: settings.exportDefaults.pngScale,
    pdfPaper: settings.exportDefaults.pdfPaper,
    pdfMargin: settings.exportDefaults.pdfMargin,
    pdfPageNumbers: settings.exportDefaults.pdfPageNumbers,
    pageHeaderFooter: settings.exportDefaults.pageHeaderFooter,
    pageHeaderText: settings.exportDefaults.pageHeaderText,
    pageFooterText: settings.exportDefaults.pageFooterText,
    templateId: settings.exportDefaults.templateId,
    frontMatterOverrides: settings.exportDefaults.frontMatterOverrides,
    toc: settings.exportDefaults.toc,
    defaultLocation: settings.exportDefaults.defaultLocation,
    docxFontPolicy: settings.exportDefaults.docxFontPolicy,
    docxCustomFontId: settings.exportDefaults.docxCustomFontId,
  };
}

function applyExportQualityScale(settings: SettingsState, qualityScale?: number): SettingsState {
  if (!qualityScale) return settings;
  return {
    ...settings,
    exportDefaults: {
      ...settings.exportDefaults,
      pngScale: normalizeExportQualityScale(qualityScale, settings.exportDefaults.pngScale),
    },
  };
}

function applyExportHistorySettings(
  baseSettings: SettingsState,
  historySettings: ExportHistorySettings,
): SettingsState {
  return {
    ...baseSettings,
    contentTheme: historySettings.contentTheme,
    exportDefaults: {
      ...baseSettings.exportDefaults,
      htmlIncludeTheme: historySettings.htmlIncludeTheme,
      pngScale: historySettings.pngScale,
      pdfPaper: historySettings.pdfPaper,
      pdfMargin: historySettings.pdfMargin,
      pdfPageNumbers: historySettings.pdfPageNumbers,
      pageHeaderFooter: historySettings.pageHeaderFooter,
      pageHeaderText: historySettings.pageHeaderText,
      pageFooterText: historySettings.pageFooterText,
      templateId: historySettings.templateId,
      frontMatterOverrides: historySettings.frontMatterOverrides,
      toc: historySettings.toc,
      defaultLocation: historySettings.defaultLocation,
      docxFontPolicy: historySettings.docxFontPolicy,
      docxCustomFontId: historySettings.docxCustomFontId,
    },
  };
}

function hasSupportedCitationPathExtension(path: string, extensions: string[]) {
  const normalized = path.trim().toLowerCase();
  return normalized.length === 0 || extensions.some((extension) => normalized.endsWith(extension));
}

function getCitationPathValidation(citation: SettingsState['citation']) {
  const issues: string[] = [];
  if (!hasSupportedCitationPathExtension(citation.bibliographyPath, ['.bib', '.bibtex', '.json'])) {
    issues.push('参考文献文件后缀需为 .bib / .bibtex / .json');
  }
  if (!hasSupportedCitationPathExtension(citation.cslStylePath, ['.csl'])) {
    issues.push('CSL 样式文件后缀需为 .csl');
  }
  if (!citation.bibliographyPath.trim() && citation.cslStylePath.trim()) {
    issues.push('缺少参考文献文件');
  }
  return issues.length > 0 ? issues.join('；') : '通过';
}

function buildExportFailureDiagnostic(input: {
  format: ExportFormat;
  documentName: string;
  documentPath: string;
  outputPath?: string | null;
  stage: string;
  settings: SettingsState;
  warnings?: string[];
  error: unknown;
}) {
  const errorMessage = formatError(input.error);
  const stack = input.error instanceof Error && input.error.stack
    ? input.error.stack
    : '';
  const pandoc = input.settings.pandoc;
  const pandocStatus = pandoc.lastCheckedAt === null
    ? '未检测'
    : pandoc.detected
      ? '可用'
      : '不可用';
  const citation = input.settings.citation;
  const citationPathValidation = getCitationPathValidation(citation);
  const citationPandocReady = pandoc.detected && Boolean(citation.bibliographyPath) && citationPathValidation === '通过';
  return [
    'Prism 导出失败诊断',
    `时间: ${new Date().toISOString()}`,
    `格式: ${getExportFormatLabel(input.format)} (${input.format})`,
    `阶段: ${input.stage}`,
    `文档: ${input.documentName}`,
    `文档路径: ${input.documentPath || '(未保存)'}`,
    `输出路径: ${input.outputPath || '(未选择)'}`,
    `内容主题: ${input.settings.contentTheme}`,
    `导出模板: ${input.settings.exportDefaults.templateId}`,
    `Front matter 覆盖: ${input.settings.exportDefaults.frontMatterOverrides ? '开启' : '关闭'}`,
    `目录: ${input.settings.exportDefaults.toc ? '开启' : '关闭'}`,
    `默认导出位置: ${input.settings.exportDefaults.defaultLocation}`,
    `PDF 纸张: ${input.settings.exportDefaults.pdfPaper}`,
    `PDF 边距: ${input.settings.exportDefaults.pdfMargin}`,
    `页码: ${input.settings.exportDefaults.pdfPageNumbers ? '开启' : '关闭'}`,
    `页眉页脚: ${input.settings.exportDefaults.pageHeaderFooter ? '开启' : '关闭'}`,
    `页眉文本: ${input.settings.exportDefaults.pageHeaderText || '(空)'}`,
    `页脚文本: ${input.settings.exportDefaults.pageFooterText || '(空)'}`,
    `导出清晰度: ${input.settings.exportDefaults.pngScale}x`,
    `HTML 内联主题: ${input.settings.exportDefaults.htmlIncludeTheme ? '是' : '否'}`,
    `DOCX 字体策略: ${input.settings.exportDefaults.docxFontPolicy}`,
    `DOCX 自定义字体: ${input.settings.exportDefaults.docxCustomFontId || '(未指定)'}`,
    `参考文献文件: ${citation.bibliographyPath || '(未配置)'}`,
    `CSL 样式文件: ${citation.cslStylePath || '(未配置)'}`,
    `引用路径校验: ${citationPathValidation}`,
    `Pandoc 引用条件: ${citationPandocReady ? '满足' : '未满足'}`,
    `Pandoc 状态: ${pandocStatus}`,
    `Pandoc 路径: ${pandoc.path || '(系统 pandoc)'}`,
    pandoc.version ? `Pandoc 版本: ${pandoc.version}` : '',
    pandoc.lastError ? `Pandoc 错误: ${pandoc.lastError}` : '',
    input.warnings?.length
      ? `导出警告:\n${input.warnings.map((message) => `- ${message}`).join('\n')}`
      : '',
    `错误: ${errorMessage}`,
    stack ? `堆栈:\n${stack}` : '',
  ].filter(Boolean).join('\n');
}

function emitExportFailure(input: {
  format: ExportFormat;
  diagnostic: string;
}) {
  window.dispatchEvent(new CustomEvent('prism-export-failure', {
    detail: {
      title: `${getExportFormatLabel(input.format)} 导出失败`,
      diagnostic: input.diagnostic,
    },
  }));
}

function showExportPathActionError(context: CommandContext, title: string, error: unknown) {
  context.showToast?.({
    tone: 'error',
    title,
    message: formatError(error),
    durationMs: 5200,
  });
}

async function openExportedPath(path: string) {
  try {
    await invoke('open_path_with_system', { path });
  } catch (nativeError) {
    try {
      await openPath(path);
    } catch (pluginError) {
      throw new Error(`系统打开失败: ${formatError(nativeError)}；备用打开失败: ${formatError(pluginError)}`);
    }
  }
}

async function handleExport(
  format: ExportFormat,
  context: CommandContext,
  options: {
    outputPath?: string;
    suggestedPath?: string;
    settings?: SettingsState;
  } = {},
): Promise<void> {
  const doc = context.documentStore.currentDocument;
  if (!doc) {
    context.showToast?.('没有可导出的文档');
    return;
  }

  const setExportProgress = (message: string | null) => {
    window.dispatchEvent(new CustomEvent('prism-export-progress', {
      detail: message ? { visible: true, message } : { visible: false },
    }));
  };
  let outputPath: string | null | undefined;
  let lastProgress = '准备导出';
  const exportSettings = options.settings ?? context.settingsStore;
  let resolvedExportSettings = exportSettings;
  const exportWarnings: string[] = [];
  const formatLabel = getExportFormatLabel(format);

  try {
    if (!options.outputPath && !context.requestExportPath) {
      context.showToast?.('导出保存面板未就绪');
      return;
    }

    const requestedOutput = options.outputPath ?? await context.requestExportPath?.({
      format,
      filename: doc.name,
      documentPath: doc.path,
      suggestedPath: options.suggestedPath,
    });
    const selectedQualityScale = typeof requestedOutput === 'object' && requestedOutput
      ? requestedOutput.qualityScale
      : undefined;
    outputPath = typeof requestedOutput === 'string' ? requestedOutput : requestedOutput?.path;
    if (!outputPath) return;
    resolvedExportSettings = applyExportQualityScale(exportSettings, selectedQualityScale);

    setExportProgress(lastProgress);
    await waitForExportProgressPaint();

    const exported = await exportDocument(resolveExportOptions({
      content: doc.content,
      filename: doc.name,
      documentPath: doc.path,
      settings: resolvedExportSettings,
      onProgress: (message) => {
        lastProgress = message;
        setExportProgress(message);
      },
      onWarning: (message) => {
        exportWarnings.push(message);
        context.showToast?.({
          tone: 'warning',
          title: '导出提示',
          message,
          durationMs: 7200,
        });
      },
    }), format, outputPath);

    if (exported) {
      const completedOutputPath = outputPath;
      if (!completedOutputPath) return;

      if (doc.path) {
        context.settingsStore.recordExportHistory({
          documentPath: doc.path,
          documentName: doc.name,
          format,
          outputPath: completedOutputPath,
          settings: createExportHistorySettings(resolvedExportSettings),
        });
      }
      context.showToast?.({
        tone: 'success',
        title: `${formatLabel} 导出完成`,
        message: basename(completedOutputPath),
        durationMs: 7200,
        actions: [
          {
            label: '打开',
            onClick: async () => {
              try {
                await openExportedPath(completedOutputPath);
              } catch (error) {
                showExportPathActionError(context, '打开导出文件失败', error);
              }
            },
          },
          {
            label: '显示位置',
            onClick: async () => {
              try {
                await revealItemInDir(completedOutputPath);
              } catch (error) {
                showExportPathActionError(context, '显示导出位置失败', error);
              }
            },
          },
        ],
      });
    }
  } catch (err) {
    const diagnostic = buildExportFailureDiagnostic({
      format,
      documentName: doc.name,
      documentPath: doc.path,
      outputPath,
      stage: lastProgress,
      settings: resolvedExportSettings,
      warnings: exportWarnings,
      error: err,
    });
    emitExportFailure({ format, diagnostic });
    context.showToast?.({
      tone: 'error',
      title: `${formatLabel} 导出失败`,
      message: '已生成诊断文本，可查看后重试。',
      durationMs: 9000,
      actions: [
        {
          label: '查看诊断',
          dismissOnClick: false,
          onClick: () => emitExportFailure({ format, diagnostic }),
        },
        {
          label: '重试',
          onClick: () => handleExport(format, context, {
            ...options,
            outputPath: outputPath ?? options.outputPath,
            settings: resolvedExportSettings,
          }),
        },
      ],
    });
  } finally {
    setExportProgress(null);
  }
}

async function handleExportWithPrevious(context: CommandContext, overwrite: boolean): Promise<void> {
  const history = getCurrentDocumentExportHistory(context);
  if (!history) {
    context.showToast?.('当前文档没有上次导出记录');
    return;
  }

  const settings = applyExportHistorySettings(context.settingsStore, history.settings);
  await handleExport(history.format, context, {
    settings,
    outputPath: overwrite ? history.outputPath : undefined,
    suggestedPath: history.outputPath,
  });
}

async function handleOpenCurrentLocation(context: CommandContext): Promise<void> {
  const docPath = context.documentStore.currentDocument?.path;
  if (docPath) {
    await revealItemInDir(docPath);
    return;
  }

  const rootPath = context.workspaceStore.rootPath;
  if (rootPath) {
    await openPath(rootPath);
    return;
  }

  context.showToast?.('当前没有可显示的位置');
}

async function handleCloseDocument(context: CommandContext): Promise<void> {
  const doc = context.documentStore.currentDocument;
  if (!doc) return;

  if (doc.isDirty) {
    let targetPath = doc.path;
    if (!targetPath) {
      if (!context.requestSavePath) {
        context.showToast?.('保存面板未就绪');
        return;
      }
      const chosen = await context.requestSavePath({
        filename: doc.name,
        documentPath: doc.path,
      });
      if (!chosen) return;
      targetPath = chosen;
    }
    context.documentStore.markSaving(doc.path || undefined);
    try {
      if (doc.path) {
        await createRecoverySnapshot({
          documentPath: doc.path,
          documentName: doc.name,
          content: doc.content,
          reason: 'manual-save',
        }).catch(() => undefined);
      }
      if (doc.path) await ensureDocumentNotChangedOnDisk(context, targetPath);
      await writeTextFile(targetPath, doc.content);
      context.documentStore.markSaved(targetPath, await getFileSnapshotOrNull(targetPath));
      await clearRecoverySnapshotsForDocument(targetPath).catch(() => undefined);
    } catch (err) {
      if (!isExternalFileChangeError(err)) {
        context.documentStore.markSaveFailed(err, doc.path || undefined);
      }
      throw err;
    }
  }

  context.documentStore.closeDocument();
}

async function handleFullscreen(context: CommandContext): Promise<void> {
  const win = getCurrentWindow();
  const isFull = await win.isFullscreen();
  await win.setFullscreen(!isFull);
  context.workspaceStore.setFullscreen(!isFull);
}

async function handleAlwaysOnTop(context: CommandContext): Promise<void> {
  const win = getCurrentWindow();
  const isOnTop = await win.isAlwaysOnTop?.();
  if (isOnTop !== undefined) {
    await win.setAlwaysOnTop(!isOnTop);
    context.workspaceStore.setAlwaysOnTop(!isOnTop);
  }
}

const ZOOM_STEP = 0.1;
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 3.0;
let currentZoom = 1;

async function handleZoom(direction: 'in' | 'out' | 'reset', context: CommandContext): Promise<void> {
  const next =
    direction === 'reset'
      ? 1
      : direction === 'in'
        ? Math.min(currentZoom + ZOOM_STEP, ZOOM_MAX)
        : Math.max(currentZoom - ZOOM_STEP, ZOOM_MIN);

  currentZoom = Math.round(next * 100) / 100;

  try {
    await getCurrentWebview().setZoom(currentZoom);
    document.documentElement.style.setProperty('--app-zoom', '1');
  } catch (error) {
    document.documentElement.style.setProperty('--app-zoom', String(currentZoom));
    console.warn('[Command] Webview zoom unavailable, falling back to CSS zoom', error);
  }

  context.showToast?.(`缩放 ${Math.round(currentZoom * 100)}%`);
}

async function handleDevTools(context: CommandContext): Promise<void> {
  try {
    await invoke('plugin:webview|internal_toggle_devtools');
  } catch (error) {
    console.error('[Command] DevTools toggle failed', error);
    context.showToast?.('开发者工具暂不可用');
  }
}

async function handleHelpLink(command: CommandId): Promise<void> {
  const urls: Partial<Record<CommandId, string>> = {
    mdReference: 'https://www.markdownguide.org/basic-syntax/',
    github: 'https://github.com/AlexPlum405/Prism',
    feedback: 'https://github.com/AlexPlum405/Prism/issues',
  };

  const url = urls[command];
  if (url) await openUrl(url);
}

async function handleCheckUpdate(context: CommandContext): Promise<void> {
  context.showToast?.('正在检查更新...');

  try {
    const result = await checkForAppUpdate();
    if (result.status === 'none') {
      context.showToast?.('当前已是最新版本');
      return;
    }
    if (result.status === 'unavailable') {
      context.showToast?.(`检查更新暂不可用: ${result.reason}`);
      return;
    }

    const shouldOpen = await ask(
      `发现新版本 ${result.version}（当前 ${result.currentVersion}）。是否打开 GitHub Releases？`,
      { title: '检查更新', kind: 'info' },
    );
    if (shouldOpen) {
      await openUrl('https://github.com/AlexPlum405/Prism/releases/latest');
    }
  } catch (error) {
    context.showToast?.(`检查更新失败: ${formatError(error)}`);
  }
}

function command(definition: CommandDefinition): CommandDefinition {
  return definition;
}

export const commandRegistry = [
  command({
    id: 'new',
    label: '新建文稿',
    category: '文件',
    keywords: ['create', 'file'],
    shortcuts: [{ code: 'KeyN', mod: true }],
    run: handleNew,
  }),
  command({
    id: 'newWindow',
    label: '新建窗口',
    category: '文件',
    shortcuts: [{ code: 'KeyN', mod: true, shift: true }],
    run: () => openPrismWindow({}),
  }),
  command({
    id: 'open',
    label: '打开文件',
    category: '文件',
    keywords: ['open', 'file'],
    shortcuts: [{ code: 'KeyO', mod: true }],
    run: handleOpen,
  }),
  command({
    id: 'openFolder',
    label: '打开文件夹',
    category: '文件',
    keywords: ['folder'],
    shortcuts: [{ code: 'KeyO', mod: true, shift: true }],
    run: handleOpenFolder,
  }),
  command({
    id: 'quickOpen',
    label: '快速打开文件',
    category: '文件',
    keywords: ['quick', 'open', 'file', 'workspace'],
    shortcuts: [{ code: 'KeyP', mod: true }],
    enabled: (context) => Boolean(context.workspaceStore.rootPath && context.workspaceStore.fileTree.length > 0),
    run: (context) => context.openQuickOpen?.(),
  }),
  command({
    id: 'save',
    label: '保存',
    category: '文件',
    keywords: ['save'],
    shortcuts: [{ code: 'KeyS', mod: true }],
    enabled: hasDocument,
    run: handleSave,
  }),
  command({
    id: 'saveAs',
    label: '另存为',
    category: '文件',
    keywords: ['save as'],
    shortcuts: [{ code: 'KeyS', mod: true, shift: true }],
    enabled: hasDocument,
    run: handleSaveAs,
  }),
  command({
    id: 'openDocumentProperties',
    label: '打开文档属性',
    category: '文件',
    keywords: ['front matter', 'yaml', 'metadata', 'properties', 'meta'],
    enabled: hasDocument,
    run: (context) => context.openDocumentProperties?.(),
  }),
  command({
    id: 'showDocumentLinks',
    label: '查看当前文档链接',
    category: '视图',
    keywords: ['links', 'outlinks', 'document links', '当前链接'],
    enabled: hasDocument,
    run: (context) => context.openDocumentLinks?.(),
  }),
  command({
    id: 'showBacklinks',
    label: '查看反向链接',
    category: '视图',
    keywords: ['backlinks', 'references', '反链'],
    enabled: hasSavedDocumentPath,
    run: (context) => context.openBacklinks?.(),
  }),
  command({
    id: 'showRelationGraph',
    label: '查看关系图谱',
    category: '视图',
    keywords: ['graph', 'relation', '关系', '图谱'],
    enabled: hasSavedDocumentPath,
    run: (context) => context.openRelationGraph?.(),
  }),
  command({
    id: 'templateReadme',
    label: 'README 模板',
    category: '文件',
    keywords: ['template', 'readme'],
    run: (context) => handleMarkdownTemplate('readme', context),
  }),
  command({
    id: 'templatePrd',
    label: 'PRD 模板',
    category: '文件',
    keywords: ['template', 'prd', 'product'],
    run: (context) => handleMarkdownTemplate('prd', context),
  }),
  command({
    id: 'templateMeeting',
    label: '会议纪要模板',
    category: '文件',
    keywords: ['template', 'meeting'],
    run: (context) => handleMarkdownTemplate('meeting', context),
  }),
  command({
    id: 'templateWeekly',
    label: '周报模板',
    category: '文件',
    keywords: ['template', 'weekly'],
    run: (context) => handleMarkdownTemplate('weekly', context),
  }),
  command({
    id: 'templateTechnicalPlan',
    label: '技术方案模板',
    category: '文件',
    keywords: ['template', 'technical', 'plan'],
    run: (context) => handleMarkdownTemplate('technicalPlan', context),
  }),
  command({
    id: 'templateArticle',
    label: '公众号长文模板',
    category: '文件',
    keywords: ['template', 'article'],
    run: (context) => handleMarkdownTemplate('article', context),
  }),
  command({
    id: 'templatePaperDraft',
    label: '论文草稿模板',
    category: '文件',
    keywords: ['template', 'paper', 'academic', '论文'],
    run: (context) => handleMarkdownTemplate('paperDraft', context),
  }),
  command({
    id: 'templateReadingNote',
    label: '读书笔记模板',
    category: '文件',
    keywords: ['template', 'reading', 'book', '读书笔记'],
    run: (context) => handleMarkdownTemplate('readingNote', context),
  }),
  command({
    id: 'templateResearchSummary',
    label: '研究摘要模板',
    category: '文件',
    keywords: ['template', 'research', 'summary', '研究摘要'],
    run: (context) => handleMarkdownTemplate('researchSummary', context),
  }),
  command({
    id: 'templateWhitePaper',
    label: '白皮书模板',
    category: '文件',
    keywords: ['template', 'whitepaper', '白皮书'],
    run: (context) => handleMarkdownTemplate('whitePaper', context),
  }),
  command({
    id: 'print',
    label: '打印',
    category: '文件',
    keywords: ['print'],
    run: () => window.print(),
  }),
  command({
    id: 'openCurrentLocation',
    label: '在文件管理器中显示',
    category: '文件',
    enabled: (context) => hasSavedDocumentPath(context) || Boolean(context.workspaceStore.rootPath),
    run: handleOpenCurrentLocation,
  }),
  command({
    id: 'closeDocument',
    label: '关闭文稿',
    category: '文件',
    shortcuts: [{ code: 'KeyW', mod: true }],
    enabled: hasDocument,
    run: handleCloseDocument,
  }),
  command({
    id: 'exportPdf',
    label: '导出为 PDF',
    category: '文件',
    keywords: ['export', 'pdf'],
    enabled: hasDocument,
    run: (context) => handleExport('pdf', context),
  }),
  command({
    id: 'exportDocx',
    label: '导出为 Word (.docx)',
    category: '文件',
    keywords: ['export', 'word', 'docx'],
    enabled: hasDocument,
    run: (context) => handleExport('docx', context),
  }),
  command({
    id: 'exportHtml',
    label: '导出为 HTML',
    category: '文件',
    keywords: ['export', 'html'],
    enabled: hasDocument,
    run: (context) => handleExport('html', context),
  }),
  command({
    id: 'exportPng',
    label: '导出为 PNG 图像',
    category: '文件',
    keywords: ['export', 'png', 'image'],
    enabled: hasDocument,
    run: (context) => handleExport('png', context),
  }),
  command({
    id: 'exportWithPrevious',
    label: '按上次设置导出',
    category: '文件',
    keywords: ['export', 'last', 'previous'],
    enabled: hasCurrentDocumentExportHistory,
    run: (context) => handleExportWithPrevious(context, false),
  }),
  command({
    id: 'exportOverwritePrevious',
    label: '覆盖上次导出文件',
    category: '文件',
    keywords: ['export', 'overwrite', 'last'],
    enabled: hasCurrentDocumentExportHistory,
    run: (context) => handleExportWithPrevious(context, true),
  }),

  command({
    id: 'undo',
    label: '撤销',
    category: '编辑',
    keywords: ['undo'],
    shortcuts: [{ code: 'KeyZ', mod: true }],
    enabled: hasDocument,
    run: () => emitEditorCommand('undo'),
  }),
  command({
    id: 'redo',
    label: '重做',
    category: '编辑',
    keywords: ['redo'],
    shortcuts: [
      { code: 'KeyZ', mod: true, shift: true },
      { code: 'KeyY', mod: true, platforms: ['windows', 'linux'] },
    ],
    enabled: hasDocument,
    run: () => emitEditorCommand('redo'),
  }),
  command({
    id: 'cut',
    label: '剪切',
    category: '编辑',
    keywords: ['cut'],
    shortcuts: [{ code: 'KeyX', mod: true }],
    enabled: hasDocument,
    run: () => emitEditorCommand('cut'),
  }),
  command({
    id: 'copy',
    label: '复制',
    category: '编辑',
    keywords: ['copy'],
    shortcuts: [{ code: 'KeyC', mod: true }],
    enabled: hasDocument,
    run: () => emitEditorCommand('copy'),
  }),
  command({
    id: 'paste',
    label: '粘贴',
    category: '编辑',
    keywords: ['paste'],
    shortcuts: [{ code: 'KeyV', mod: true }],
    enabled: hasDocument,
    run: () => emitEditorCommand('paste'),
  }),
  command({
    id: 'pastePlain',
    label: '粘贴并匹配样式',
    category: '编辑',
    shortcuts: [{ code: 'KeyV', mod: true, shift: true }],
    enabled: hasDocument,
    run: () => emitEditorCommand('pastePlain'),
  }),
  command({
    id: 'selectAll',
    label: '全选',
    category: '编辑',
    shortcuts: [{ code: 'KeyA', mod: true }],
    enabled: hasDocument,
    run: () => emitEditorCommand('selectAll'),
  }),
  command({
    id: 'showSearch',
    label: '查找',
    category: '编辑',
    keywords: ['find', 'search'],
    shortcuts: [{ code: 'KeyF', mod: true }],
    enabled: hasDocument,
    run: () => {
      window.dispatchEvent(new CustomEvent('prism-search', { detail: { action: 'open' } }));
    },
  }),
  command({
    id: 'workspaceSearch',
    label: '全文搜索工作区',
    category: '编辑',
    keywords: ['search', 'workspace', 'full text', '全文', '工作区'],
    shortcuts: [{ code: 'KeyF', mod: true, shift: true }],
    enabled: (context) => Boolean(context.workspaceStore.rootPath && context.workspaceStore.fileTree.length > 0),
    run: (context) => context.openWorkspaceSearch?.(),
  }),
  command({
    id: 'showReplace',
    label: '替换',
    category: '编辑',
    keywords: ['replace', 'find'],
    shortcuts: [{ code: 'KeyH', mod: true }],
    enabled: hasDocument,
    run: () => {
      window.dispatchEvent(new CustomEvent('prism-search', { detail: { action: 'replace' } }));
    },
  }),
  command({
    id: 'copyPlain',
    label: '复制为纯文本',
    category: '编辑',
    enabled: hasDocument,
    run: () => emitEditorCommand('copyPlain'),
  }),
  command({
    id: 'copyMd',
    label: '复制为 Markdown',
    category: '编辑',
    shortcuts: [{ code: 'KeyC', mod: true, shift: true }],
    enabled: hasDocument,
    run: () => emitEditorCommand('copyMd'),
  }),
  command({
    id: 'copyHtml',
    label: '复制为 HTML',
    category: '编辑',
    enabled: hasDocument,
    run: () => emitEditorCommand('copyHtml'),
  }),

  command({
    id: 'link',
    label: '链接',
    category: '插入',
    keywords: ['link'],
    shortcuts: [{ code: 'KeyK', mod: true }],
    enabled: hasDocument,
    run: () => emitInlineFormat('link'),
  }),
  command({
    id: 'codeBlock',
    label: '代码块',
    category: '插入',
    keywords: ['code', 'block'],
    shortcuts: [{ code: 'KeyK', mod: true, shift: true }],
    enabled: hasDocument,
    run: () => emitBlockFormat('codeBlock'),
  }),
  command({
    id: 'mathBlock',
    label: '公式块',
    category: '插入',
    shortcuts: [{ code: 'KeyM', mod: true, shift: true }],
    enabled: hasDocument,
    run: () => emitBlockFormat('mathBlock'),
  }),
  command({
    id: 'quote',
    label: '引用',
    category: '插入',
    shortcuts: [{ code: 'KeyQ', mod: true, shift: true }],
    enabled: hasDocument,
    run: () => emitBlockFormat('quote'),
  }),
  command({
    id: 'orderedList',
    label: '有序列表',
    category: '插入',
    shortcuts: [{ code: 'BracketLeft', mod: true, shift: true }],
    enabled: hasDocument,
    run: () => emitBlockFormat('orderedList'),
  }),
  command({
    id: 'unorderedList',
    label: '无序列表',
    category: '插入',
    shortcuts: [{ code: 'BracketRight', mod: true, shift: true }],
    enabled: hasDocument,
    run: () => emitBlockFormat('unorderedList'),
  }),
  command({
    id: 'taskList',
    label: '任务列表',
    category: '插入',
    shortcuts: [{ code: 'KeyX', mod: true, shift: true }],
    enabled: hasDocument,
    run: () => emitBlockFormat('taskList'),
  }),
  command({
    id: 'insertTable',
    label: '插入表格',
    category: '插入',
    keywords: ['table'],
    enabled: hasDocument,
    run: () => emitEditorCommand('insertTable'),
  }),
  command({
    id: 'formatTable',
    label: '格式化当前表格',
    category: '插入',
    keywords: ['table', 'format'],
    enabled: hasDocument,
    run: () => emitEditorCommand('formatTable'),
  }),
  command({
    id: 'addTableRow',
    label: '添加表格行',
    category: '插入',
    keywords: ['table', 'row'],
    enabled: hasDocument,
    run: () => emitEditorCommand('addTableRow'),
  }),
  command({
    id: 'addTableColumn',
    label: '添加表格列',
    category: '插入',
    keywords: ['table', 'column'],
    enabled: hasDocument,
    run: () => emitEditorCommand('addTableColumn'),
  }),
  command({
    id: 'deleteTableRow',
    label: '删除表格行',
    category: '插入',
    keywords: ['table', 'row', 'delete'],
    enabled: hasDocument,
    run: () => emitEditorCommand('deleteTableRow'),
  }),
  command({
    id: 'deleteTableColumn',
    label: '删除表格列',
    category: '插入',
    keywords: ['table', 'column', 'delete'],
    enabled: hasDocument,
    run: () => emitEditorCommand('deleteTableColumn'),
  }),
  command({
    id: 'hr',
    label: '水平分割线',
    category: '插入',
    enabled: hasDocument,
    run: () => emitBlockFormat('hr'),
  }),
  command({
    id: 'footnote',
    label: '脚注',
    category: '插入',
    enabled: hasDocument,
    run: () => emitBlockFormat('footnote'),
  }),
  command({
    id: 'linkReference',
    label: '链接引用',
    category: '插入',
    enabled: hasDocument,
    run: () => emitBlockFormat('linkReference'),
  }),
  command({
    id: 'toc',
    label: '内容目录',
    category: '插入',
    enabled: hasDocument,
    run: () => emitBlockFormat('toc'),
  }),
  command({
    id: 'yaml',
    label: 'YAML Front Matter',
    category: '插入',
    enabled: hasDocument,
    run: () => emitBlockFormat('yaml'),
  }),

  command({
    id: 'bold',
    label: '粗体',
    category: '格式',
    keywords: ['bold'],
    shortcuts: [{ code: 'KeyB', mod: true }],
    enabled: hasDocument,
    run: () => emitInlineFormat('bold'),
  }),
  command({
    id: 'italic',
    label: '斜体',
    category: '格式',
    keywords: ['italic'],
    shortcuts: [{ code: 'KeyI', mod: true }],
    enabled: hasDocument,
    run: () => emitInlineFormat('italic'),
  }),
  command({
    id: 'underline',
    label: '下划线',
    category: '格式',
    keywords: ['underline'],
    shortcuts: [{ code: 'KeyU', mod: true }],
    enabled: hasDocument,
    run: () => emitInlineFormat('underline'),
  }),
  command({
    id: 'strikethrough',
    label: '删除线',
    category: '格式',
    keywords: ['strikethrough'],
    shortcuts: [{ code: 'Digit5', alt: true, shift: true }],
    enabled: hasDocument,
    run: () => emitInlineFormat('strikethrough'),
  }),
  command({
    id: 'inlineCode',
    label: '行内代码',
    category: '格式',
    keywords: ['code'],
    shortcuts: [{ code: 'Backquote', mod: true, shift: true }],
    enabled: hasDocument,
    run: () => emitInlineFormat('code'),
  }),
  command({
    id: 'paragraph',
    label: '正文',
    category: '格式',
    keywords: ['paragraph'],
    shortcuts: [{ code: 'Digit0', mod: true }],
    enabled: hasDocument,
    run: () => emitBlockFormat('paragraph'),
  }),
  ...([1, 2, 3, 4, 5, 6] as const).map((level) => command({
    id: `h${level}` as CommandId,
    label: `${['一', '二', '三', '四', '五', '六'][level - 1]}级标题`,
    category: '格式',
    keywords: [`h${level}`, 'heading'],
    shortcuts: [{ code: `Digit${level}`, mod: true }],
    enabled: hasDocument,
    run: () => emitHeading(`h${level}`),
  })),
  command({
    id: 'increaseHeading',
    label: '提升标题级别',
    category: '格式',
    shortcuts: [{ code: 'Equal', mod: true }],
    enabled: hasDocument,
    run: () => emitBlockFormat('increaseHeading'),
  }),
  command({
    id: 'decreaseHeading',
    label: '降低标题级别',
    category: '格式',
    shortcuts: [{ code: 'Minus', mod: true }],
    enabled: hasDocument,
    run: () => emitBlockFormat('decreaseHeading'),
  }),
  command({
    id: 'clearFormat',
    label: '清除格式',
    category: '格式',
    shortcuts: [{ code: 'Backslash', mod: true }],
    enabled: hasDocument,
    run: () => emitEditorCommand('clearFormat'),
  }),
  command({
    id: 'moveParagraphUp',
    label: '段落上移',
    category: '格式',
    keywords: ['block', 'paragraph', 'move', 'up'],
    enabled: hasDocument,
    run: () => emitEditorCommand('moveParagraphUp'),
  }),
  command({
    id: 'moveParagraphDown',
    label: '段落下移',
    category: '格式',
    keywords: ['block', 'paragraph', 'move', 'down'],
    enabled: hasDocument,
    run: () => emitEditorCommand('moveParagraphDown'),
  }),
  command({
    id: 'duplicateParagraph',
    label: '复制当前段落',
    category: '格式',
    keywords: ['block', 'paragraph', 'duplicate', 'copy'],
    enabled: hasDocument,
    run: () => emitEditorCommand('duplicateParagraph'),
  }),
  command({
    id: 'deleteParagraph',
    label: '删除当前段落',
    category: '格式',
    keywords: ['block', 'paragraph', 'delete', 'remove'],
    enabled: hasDocument,
    run: () => emitEditorCommand('deleteParagraph'),
  }),
  command({
    id: 'moveSectionUp',
    label: '章节上移',
    category: '格式',
    keywords: ['block', 'section', 'heading', 'move', 'up'],
    enabled: hasDocument,
    run: () => emitEditorCommand('moveSectionUp'),
  }),
  command({
    id: 'moveSectionDown',
    label: '章节下移',
    category: '格式',
    keywords: ['block', 'section', 'heading', 'move', 'down'],
    enabled: hasDocument,
    run: () => emitEditorCommand('moveSectionDown'),
  }),
  command({
    id: 'duplicateSection',
    label: '复制当前章节',
    category: '格式',
    keywords: ['block', 'section', 'heading', 'duplicate', 'copy'],
    enabled: hasDocument,
    run: () => emitEditorCommand('duplicateSection'),
  }),
  command({
    id: 'foldCurrentHeading',
    label: '折叠当前标题',
    category: '格式',
    keywords: ['block', 'section', 'heading', 'fold'],
    enabled: hasDocument,
    run: () => emitEditorCommand('foldCurrentHeading'),
  }),
  command({
    id: 'selectionQuote',
    label: '选区转引用',
    category: '格式',
    keywords: ['block', 'selection', 'quote'],
    enabled: hasDocument,
    run: () => emitEditorCommand('selectionQuote'),
  }),
  command({
    id: 'selectionCalloutNote',
    label: '选区转 Note Callout',
    category: '格式',
    keywords: ['block', 'selection', 'callout', 'note'],
    enabled: hasDocument,
    run: () => emitEditorCommand('selectionCalloutNote'),
  }),
  command({
    id: 'selectionCalloutWarning',
    label: '选区转 Warning Callout',
    category: '格式',
    keywords: ['block', 'selection', 'callout', 'warning'],
    enabled: hasDocument,
    run: () => emitEditorCommand('selectionCalloutWarning'),
  }),
  command({
    id: 'selectionCalloutTip',
    label: '选区转 Tip Callout',
    category: '格式',
    keywords: ['block', 'selection', 'callout', 'tip'],
    enabled: hasDocument,
    run: () => emitEditorCommand('selectionCalloutTip'),
  }),
  command({
    id: 'selectionUnorderedList',
    label: '选区转无序列表',
    category: '格式',
    keywords: ['block', 'selection', 'list', 'unordered'],
    enabled: hasDocument,
    run: () => emitEditorCommand('selectionUnorderedList'),
  }),
  command({
    id: 'selectionOrderedList',
    label: '选区转有序列表',
    category: '格式',
    keywords: ['block', 'selection', 'list', 'ordered'],
    enabled: hasDocument,
    run: () => emitEditorCommand('selectionOrderedList'),
  }),
  command({
    id: 'selectionTaskList',
    label: '选区转任务列表',
    category: '格式',
    keywords: ['block', 'selection', 'task', 'list'],
    enabled: hasDocument,
    run: () => emitEditorCommand('selectionTaskList'),
  }),

  command({
    id: 'sourceMode',
    label: '编辑模式',
    category: '视图',
    keywords: ['edit', 'source'],
    shortcuts: [{ code: 'Slash', mod: true }],
    enabled: hasDocument,
    checked: (context) => context.documentStore.currentDocument?.viewMode === 'edit',
    run: (context) => context.documentStore.setViewMode('edit'),
  }),
  command({
    id: 'splitMode',
    label: '分栏模式',
    category: '视图',
    keywords: ['split'],
    enabled: hasDocument,
    checked: (context) => context.documentStore.currentDocument?.viewMode === 'split',
    run: (context) => context.documentStore.setViewMode('split'),
  }),
  command({
    id: 'previewMode',
    label: '预览模式',
    category: '视图',
    keywords: ['preview'],
    enabled: hasDocument,
    checked: (context) => context.documentStore.currentDocument?.viewMode === 'preview',
    run: (context) => context.documentStore.setViewMode('preview'),
  }),
  command({
    id: 'toggleSidebar',
    label: '显示侧边栏',
    category: '视图',
    keywords: ['sidebar'],
    shortcuts: [{ code: 'KeyL', mod: true, shift: true }],
    checked: (context) => context.workspaceStore.sidebarVisible,
    run: (context) => context.workspaceStore.toggleSidebar(),
  }),
  command({
    id: 'showFiles',
    label: '文件',
    category: '视图',
    keywords: ['files'],
    checked: (context) => context.workspaceStore.sidebarVisible && context.workspaceStore.sidebarTab === 'files',
    run: (context) => context.workspaceStore.setSidebarTab('files'),
  }),
  command({
    id: 'showDocs',
    label: '文件',
    category: '视图',
    palette: false,
    checked: (context) => context.workspaceStore.sidebarVisible && context.workspaceStore.sidebarTab === 'files',
    run: (context) => context.workspaceStore.setSidebarTab('files'),
  }),
  command({
    id: 'showOutline',
    label: '大纲',
    category: '视图',
    keywords: ['outline'],
    checked: (context) => context.workspaceStore.sidebarVisible && context.workspaceStore.sidebarTab === 'outline',
    run: (context) => context.workspaceStore.setSidebarTab('outline'),
  }),
  command({
    id: 'focusMode',
    label: '专注模式',
    category: '视图',
    keywords: ['focus'],
    shortcuts: [{ code: 'F8' }],
    checked: (context) => context.workspaceStore.focusMode,
    run: (context) => context.workspaceStore.toggleFocusMode(),
  }),
  command({
    id: 'typewriterMode',
    label: '打字机模式',
    category: '视图',
    keywords: ['typewriter'],
    shortcuts: [{ code: 'F9' }],
    checked: (context) => context.workspaceStore.typewriterMode,
    run: (context) => context.workspaceStore.toggleTypewriterMode(),
  }),
  command({
    id: 'wordWrap',
    label: '自动换行',
    category: '视图',
    keywords: ['wrap', 'line wrap'],
    checked: (context) => context.settingsStore.wordWrap,
    run: (context) => context.settingsStore.setWordWrap(!context.settingsStore.wordWrap),
  }),
  command({
    id: 'statusBar',
    label: '显示状态栏',
    category: '视图',
    keywords: ['status'],
    checked: (context) => context.workspaceStore.statusBarVisible,
    run: (context) => context.workspaceStore.toggleStatusBar(),
  }),
  command({
    id: 'actualSize',
    label: '实际大小',
    category: '视图',
    keywords: ['zoom', 'reset'],
    shortcuts: [{ code: 'Digit9', mod: true, shift: true }],
    run: (context) => handleZoom('reset', context),
  }),
  command({
    id: 'zoomIn',
    label: '放大',
    category: '视图',
    keywords: ['zoom', 'in'],
    shortcuts: [{ code: 'Equal', mod: true, shift: true }],
    run: (context) => handleZoom('in', context),
  }),
  command({
    id: 'zoomOut',
    label: '缩小',
    category: '视图',
    keywords: ['zoom', 'out'],
    shortcuts: [{ code: 'Minus', mod: true, shift: true }],
    run: (context) => handleZoom('out', context),
  }),
  command({
    id: 'devTools',
    label: '开发者工具',
    category: '视图',
    keywords: ['dev', 'debug'],
    shortcuts: [{ code: 'F12', shift: true }],
    run: handleDevTools,
  }),

  command({
    id: 'themeMiaoyan',
    label: 'MiaoYan（妙言）',
    category: '主题',
    checked: (context) => context.settingsStore.contentTheme === 'miaoyan',
    run: (context) => context.settingsStore.setContentTheme('miaoyan'),
  }),
  command({
    id: 'themeInkstone',
    label: 'Inkstone Light',
    category: '主题',
    checked: (context) => context.settingsStore.contentTheme === 'inkstone',
    run: (context) => context.settingsStore.setContentTheme('inkstone'),
  }),
  command({
    id: 'themeSlate',
    label: 'Slate Manual',
    category: '主题',
    checked: (context) => context.settingsStore.contentTheme === 'slate',
    run: (context) => context.settingsStore.setContentTheme('slate'),
  }),
  command({
    id: 'themeMono',
    label: 'Mono Lab',
    category: '主题',
    checked: (context) => context.settingsStore.contentTheme === 'mono',
    run: (context) => context.settingsStore.setContentTheme('mono'),
  }),
  command({
    id: 'themeNocturne',
    label: 'Nocturne Dark',
    category: '主题',
    checked: (context) => context.settingsStore.contentTheme === 'nocturne',
    run: (context) => context.settingsStore.setContentTheme('nocturne'),
  }),

  command({
    id: 'minimize',
    label: '最小化',
    category: '窗口',
    shortcuts: [{ code: 'KeyM', mod: true }],
    run: () => getCurrentWindow().minimize(),
  }),
  command({
    id: 'fullscreen',
    label: '切换全屏',
    category: '窗口',
    shortcuts: [{ code: 'F11' }],
    checked: (context) => context.workspaceStore.isFullscreen,
    run: handleFullscreen,
  }),
  command({
    id: 'alwaysOnTop',
    label: '保持窗口在最前端',
    category: '窗口',
    keywords: ['top', 'pin'],
    checked: (context) => context.workspaceStore.isAlwaysOnTop,
    run: handleAlwaysOnTop,
  }),

  command({
    id: 'preferences',
    label: '设置中心',
    category: '文件',
    shortcuts: [{ code: 'Comma', mod: true }],
    run: (context) => context.openSettings?.(),
  }),
  command({
    id: 'mdReference',
    label: 'Markdown 参考',
    category: '帮助',
    run: () => handleHelpLink('mdReference'),
  }),
  command({
    id: 'showShortcuts',
    label: '键盘快捷键',
    category: '帮助',
    keywords: ['shortcut', 'keyboard'],
    run: (context) => context.openShortcuts?.(),
  }),
  command({
    id: 'checkUpdate',
    label: '检查更新',
    category: '帮助',
    keywords: ['update', 'release', 'version'],
    run: handleCheckUpdate,
  }),
  command({
    id: 'github',
    label: 'GitHub 仓库',
    category: '帮助',
    keywords: ['github'],
    run: () => handleHelpLink('github'),
  }),
  command({
    id: 'feedback',
    label: '反馈问题',
    category: '帮助',
    keywords: ['feedback', 'issue'],
    run: () => handleHelpLink('feedback'),
  }),
  command({
    id: 'about',
    label: '关于 Prism',
    category: '帮助',
    keywords: ['about', 'info'],
    run: (context) => context.openAbout?.(),
  }),
] satisfies CommandDefinition[];

export const commandRegistryById = new Map<CommandId, CommandDefinition>(
  commandRegistry.map((definition) => [definition.id, definition]),
);

export function getCommandDefinition(id: CommandId): CommandDefinition {
  const definition = commandRegistryById.get(id);
  if (!definition) throw new Error(`未知命令: ${id}`);
  return definition;
}

export function isCommandId(value: string): value is CommandId {
  return commandRegistryById.has(value as CommandId);
}

export function isCommandEnabled(id: CommandId, context: CommandContext): boolean {
  const definition = getCommandDefinition(id);
  return definition.enabled ? definition.enabled(context) : true;
}

export async function runCommand(id: CommandId, context: CommandContext): Promise<void> {
  const definition = getCommandDefinition(id);
  if (!isCommandEnabled(id, context)) return;

  try {
    await definition.run(context);
  } catch (err) {
    console.error(`[Command] ${id} failed:`, err);
    context.showToast?.(`操作失败: ${formatError(err)}`);
  }
}

export function findCommandByKeyboardEvent(event: KeyboardEvent): CommandDefinition | null {
  const platform = getCurrentPlatform();

  for (const definition of commandRegistry) {
    if (!definition.shortcuts?.length) continue;
    if (definition.shortcuts.some((shortcut) => shortcutMatchesEvent(shortcut, event, platform))) {
      return definition;
    }
  }

  return null;
}

export function getPrimaryShortcutLabel(
  id: CommandId,
  displayStyle: ShortcutDisplayStyle = 'auto',
): string | undefined {
  const shortcut = getCommandDefinition(id).shortcuts?.[0];
  return getShortcutLabel(shortcut, getShortcutDisplayPlatform(displayStyle));
}
