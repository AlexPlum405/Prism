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
import { createEditorCommands } from './categories/editorCommands';
import { createExportCommands } from './categories/exportCommands';
import { createHelpCommands } from './categories/helpCommands';
import { createThemeCommands } from './categories/themeCommands';
import { createViewCommands } from './categories/viewCommands';
import { createWindowCommands } from './categories/windowCommands';

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
  ...createExportCommands({ hasDocument }),

  ...createEditorCommands({
    hasDocument,
    emitEditorCommand,
    emitInlineFormat,
    emitBlockFormat,
    emitHeading,
  }),

  ...createViewCommands({
    hasDocument,
    handleZoom,
    handleDevTools,
  }),
  ...createThemeCommands(),
  ...createWindowCommands({
    handleFullscreen,
    handleAlwaysOnTop,
    minimize: () => getCurrentWindow().minimize(),
  }),
  ...createHelpCommands({
    handleHelpLink,
    handleCheckUpdate,
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
