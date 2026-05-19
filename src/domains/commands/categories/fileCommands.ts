import { ask, open } from '@tauri-apps/plugin-dialog';
import { readTextFile, stat, writeTextFile } from '@tauri-apps/plugin-fs';
import { openPath, revealItemInDir } from '@tauri-apps/plugin-opener';
import { openPrismWindow } from '../../../lib/openWindow';
import { grantMarkdownFileScope } from '../../../lib/fileSystemScope';
import {
  getExternalChangeMessage,
  getFileSnapshot,
  getFileSnapshotOrNull,
  hasFileSnapshotChanged,
  snapshotFromFileInfo,
  type FileSnapshot,
} from '../../document/fileSnapshot';
import {
  clearRecoverySnapshotsForDocument,
  createRecoverySnapshot,
} from '../../document/services/recovery';
import {
  MARKDOWN_TEMPLATES,
  resolveMarkdownTemplateContent,
  type MarkdownTemplateId,
} from '../../editor/extensions/templates';
import { loadFolderTree } from '../../workspace/lib/loadFolderTree';
import { MARKDOWN_FILE_FILTERS, addRecentFile, basename, dirname } from '../../workspace/services';
import type { CommandContext, CommandDefinition } from '../types';

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

export function createFileCommands(): CommandDefinition[] {
  return [
    {
      id: 'new',
      label: '新建文稿',
      category: '文件',
      keywords: ['create', 'file'],
      shortcuts: [{ code: 'KeyN', mod: true }],
      run: handleNew,
    },
    {
      id: 'newWindow',
      label: '新建窗口',
      category: '文件',
      shortcuts: [{ code: 'KeyN', mod: true, shift: true }],
      run: () => openPrismWindow({}),
    },
    {
      id: 'open',
      label: '打开文件',
      category: '文件',
      keywords: ['open', 'file'],
      shortcuts: [{ code: 'KeyO', mod: true }],
      run: handleOpen,
    },
    {
      id: 'save',
      label: '保存',
      category: '文件',
      keywords: ['save'],
      shortcuts: [{ code: 'KeyS', mod: true }],
      enabled: hasDocument,
      run: handleSave,
    },
    {
      id: 'saveAs',
      label: '另存为',
      category: '文件',
      keywords: ['save as'],
      shortcuts: [{ code: 'KeyS', mod: true, shift: true }],
      enabled: hasDocument,
      run: handleSaveAs,
    },
    {
      id: 'templateReadme',
      label: 'README 模板',
      category: '文件',
      keywords: ['template', 'readme'],
      run: (context) => handleMarkdownTemplate('readme', context),
    },
    {
      id: 'templatePrd',
      label: 'PRD 模板',
      category: '文件',
      keywords: ['template', 'prd', 'product'],
      run: (context) => handleMarkdownTemplate('prd', context),
    },
    {
      id: 'templateMeeting',
      label: '会议纪要模板',
      category: '文件',
      keywords: ['template', 'meeting'],
      run: (context) => handleMarkdownTemplate('meeting', context),
    },
    {
      id: 'templateWeekly',
      label: '周报模板',
      category: '文件',
      keywords: ['template', 'weekly'],
      run: (context) => handleMarkdownTemplate('weekly', context),
    },
    {
      id: 'templateTechnicalPlan',
      label: '技术方案模板',
      category: '文件',
      keywords: ['template', 'technical', 'plan'],
      run: (context) => handleMarkdownTemplate('technicalPlan', context),
    },
    {
      id: 'templateArticle',
      label: '公众号长文模板',
      category: '文件',
      keywords: ['template', 'article'],
      run: (context) => handleMarkdownTemplate('article', context),
    },
    {
      id: 'templatePaperDraft',
      label: '论文草稿模板',
      category: '文件',
      keywords: ['template', 'paper', 'academic', '论文'],
      run: (context) => handleMarkdownTemplate('paperDraft', context),
    },
    {
      id: 'templateReadingNote',
      label: '读书笔记模板',
      category: '文件',
      keywords: ['template', 'reading', 'book', '读书笔记'],
      run: (context) => handleMarkdownTemplate('readingNote', context),
    },
    {
      id: 'templateResearchSummary',
      label: '研究摘要模板',
      category: '文件',
      keywords: ['template', 'research', 'summary', '研究摘要'],
      run: (context) => handleMarkdownTemplate('researchSummary', context),
    },
    {
      id: 'templateWhitePaper',
      label: '白皮书模板',
      category: '文件',
      keywords: ['template', 'whitepaper', '白皮书'],
      run: (context) => handleMarkdownTemplate('whitePaper', context),
    },
    {
      id: 'print',
      label: '打印',
      category: '文件',
      keywords: ['print'],
      run: () => window.print(),
    },
    {
      id: 'openCurrentLocation',
      label: '在文件管理器中显示',
      category: '文件',
      enabled: (context) => hasSavedDocumentPath(context) || Boolean(context.workspaceStore.rootPath),
      run: handleOpenCurrentLocation,
    },
    {
      id: 'closeDocument',
      label: '关闭文稿',
      category: '文件',
      shortcuts: [{ code: 'KeyW', mod: true }],
      enabled: hasDocument,
      run: handleCloseDocument,
    },
  ] satisfies CommandDefinition[];
}
