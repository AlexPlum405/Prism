import { askDialog, openDialog } from '../../../platform/tauri/dialogs';
import {
  openPathWithDefaultApp,
  revealPathInFileManager,
} from '../../../platform/tauri/opener';
import { openPrismWindow } from '../../../lib/openWindow';
import { executeFileAction } from '../../../lib/fileActions';
import { openSelectedDocument } from '../../../lib/openDocumentFlow';
import { importDocumentFromPath } from '../../../lib/importDocumentFlow';
import { IMPORT_FILE_FILTERS } from '../../import/importFormat';
import { loadFolderTree } from '../../workspace/lib/loadFolderTree';
import {
  createDocumentFileSession,
  fileConflictDetector,
  isFileConflictError,
  recoverySnapshotStore,
  writeDocumentFileSession,
} from '../../document/services/fileSafety';
import {
  MARKDOWN_TEMPLATES,
  resolveMarkdownTemplateContent,
  type MarkdownTemplateId,
} from '../../editor/extensions/templates';
import {
  DOCUMENT_FILE_FILTERS,
  addRecentFile,
  basename,
  dirname,
} from '../../workspace/services';
import type { CommandContext, CommandDefinition } from '../types';
import { t } from '../../i18n';
import { emitAppEvent } from '../../../platform/events/appEvents';
import { grantWorkspaceDirectoryScope } from '../../../lib/fileSystemScope';
import { formatUnknownError } from '../../../lib/errorMessage';

function hasDocument(context: CommandContext): boolean {
  return Boolean(context.documentStore.currentDocument);
}

function hasSavedDocumentPath(context: CommandContext): boolean {
  return Boolean(context.documentStore.currentDocument?.path);
}

async function ensureDocumentNotChangedOnDisk(context: CommandContext, path: string) {
  const session = createDocumentFileSession(context.documentStore.currentDocument);
  if (!session) return null;

  try {
    return await fileConflictDetector.ensureUnchanged(path, session.knownSnapshot);
  } catch (error) {
    if (isFileConflictError(error)) {
      context.documentStore.markSaveConflict(error.message, path);
    }
    throw error;
  }
}

function emitEditorCommand(command: string, detail: Record<string, unknown> = {}): void {
  emitAppEvent('editor.command', { command, ...detail });
}

async function setWorkspaceToDocumentDirectoryIfNeeded(context: CommandContext, path: string): Promise<void> {
  if (context.workspaceStore.rootPath) return;

  const rootPath = dirname(path);
  try {
    await grantWorkspaceDirectoryScope(rootPath);
    const tree = await loadFolderTree(rootPath);
    context.workspaceStore.setWorkspace(rootPath, tree);
  } catch (err) {
    console.error('[fileCommands] Failed to set workspace after save:', err);
    context.showToast?.(t('command.operationFailed', { message: formatUnknownError(err) }), 'error');
  }
}

async function handleNew(context: CommandContext): Promise<void> {
  const doc = context.documentStore.currentDocument;
  if (doc?.isDirty && !doc.path && !context.requestSavePath) {
    context.showToast?.(t('command.savePanelUnavailable'), 'warning');
    return;
  }

  const savedPath = doc?.isDirty ? await saveCurrentDocument(context) : null;
  if (doc?.isDirty && !savedPath) return;

  const currentDocumentDir = savedPath ? dirname(savedPath) : doc?.path ? dirname(doc.path) : null;
  const targetDir = currentDocumentDir || context.workspaceStore.rootPath;
  if (!targetDir) {
    context.documentStore.createNewDocument();
    return;
  }

  await executeFileAction({
    action: 'newFile',
    path: targetDir,
  }, {
    documentStore: context.documentStore,
    showToast: context.showToast,
    workspaceStore: context.workspaceStore,
  });
}

function handleMarkdownTemplate(templateId: MarkdownTemplateId, context: CommandContext): void {
  const template = MARKDOWN_TEMPLATES[templateId];
  if (!context.documentStore.currentDocument) {
    context.documentStore.createNewDocument(resolveMarkdownTemplateContent(template.content, {
      title: template.label,
    }), template.filename);
    context.showToast?.(t('command.templateCreated', { label: template.label }), 'success');
    return;
  }

  emitEditorCommand('insertTemplate', { templateId });
}

async function handleOpen(context: CommandContext): Promise<void> {
  const selected = await openDialog({
    multiple: false,
    filters: DOCUMENT_FILE_FILTERS,
  });

  if (!selected || Array.isArray(selected)) return;

  try {
    await openSelectedDocument(selected, context, { entryPoint: 'file-command' });
  } catch (err) {
    console.error('[Command] Failed to open file:', err);
    const message = formatUnknownError(err);
    await askDialog(t('command.openFileFailedDialog', { message }), {
      title: t('command.openFileFailedTitle'),
      kind: 'error',
    });
  }
}

async function handleImport(context: CommandContext): Promise<void> {
  const selected = await openDialog({
    multiple: false,
    filters: IMPORT_FILE_FILTERS,
    title: t('import.pickTitle'),
  });

  if (!selected || Array.isArray(selected)) return;

  try {
    const result = await importDocumentFromPath(selected, {
      documentStore: context.documentStore,
      showToast: context.showToast,
      workspaceStore: context.workspaceStore,
    });
    const name = basename(result.path);

    context.showToast?.(
      result.assetCount > 0
        ? t('import.doneWithAssets', { name, count: result.assetCount })
        : t('import.done', { name }),
      'success',
    );

    if (result.warnings.length > 0) {
      context.showToast?.(t('import.warnings', { message: result.warnings.join(' ') }), 'warning');
    }
  } catch (err) {
    console.error('[Command] Failed to import document:', err);
    context.showToast?.(t('import.failed', { message: formatUnknownError(err) }), 'error');
  }
}

async function saveCurrentDocument(context: CommandContext): Promise<string | null> {
  const doc = context.documentStore.currentDocument;
  if (!doc) return null;

  let targetPath = doc.path;

  if (!targetPath) {
    if (!context.requestSavePath) {
      context.showToast?.(t('command.savePanelUnavailable'), 'warning');
      return null;
    }
    const chosen = await context.requestSavePath({
      filename: doc.name,
      documentPath: doc.path,
    });
    if (!chosen) return null;
    targetPath = chosen;
  }

  context.documentStore.markSaving(doc.path || undefined);

  try {
    if (doc.path) {
      await recoverySnapshotStore.create({
        documentPath: doc.path,
        documentName: doc.name,
        content: doc.content,
        reason: 'manual-save',
      }).catch(() => undefined);
    }
    const expectedSnapshot = doc.path ? await ensureDocumentNotChangedOnDisk(context, targetPath) : null;
    const snapshot = await writeDocumentFileSession({
      path: targetPath,
      content: doc.content,
      expectedSnapshot,
    });
    if (!doc.path) {
      context.documentStore.openDocument(targetPath, basename(targetPath), doc.content, snapshot);
    }
    addRecentFile(targetPath, basename(targetPath));
    context.documentStore.markSaved(targetPath, snapshot);
    await setWorkspaceToDocumentDirectoryIfNeeded(context, targetPath);
    await recoverySnapshotStore.clearForDocument(targetPath).catch(() => undefined);
    return targetPath;
  } catch (err) {
    if (!isFileConflictError(err)) {
      context.documentStore.markSaveFailed(err, doc.path || undefined);
    }
    throw err;
  }
}

async function handleSave(context: CommandContext): Promise<void> {
  await saveCurrentDocument(context);
}

async function handleSaveAs(context: CommandContext): Promise<void> {
  const doc = context.documentStore.currentDocument;
  if (!doc) return;

  if (!context.requestSavePath) {
    context.showToast?.(t('command.savePanelUnavailable'), 'warning');
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
      await recoverySnapshotStore.create({
        documentPath: doc.path,
        documentName: doc.name,
        content: doc.content,
        reason: 'manual-save',
      }).catch(() => undefined);
    }
    const snapshot = await writeDocumentFileSession({ path: chosen, content: doc.content });
    context.documentStore.openDocument(chosen, basename(chosen), doc.content, snapshot);
    addRecentFile(chosen, basename(chosen));
    context.documentStore.markSaved(chosen, snapshot);
    await setWorkspaceToDocumentDirectoryIfNeeded(context, chosen);
    if (doc.path) await recoverySnapshotStore.clearForDocument(doc.path).catch(() => undefined);
    await recoverySnapshotStore.clearForDocument(chosen).catch(() => undefined);
  } catch (err) {
    context.documentStore.markSaveFailed(err);
    throw err;
  }
}

async function handleOpenCurrentLocation(context: CommandContext): Promise<void> {
  const docPath = context.documentStore.currentDocument?.path;
  if (docPath) {
    await revealPathInFileManager(docPath);
    return;
  }

  const rootPath = context.workspaceStore.rootPath;
  if (rootPath) {
    await openPathWithDefaultApp(rootPath);
    return;
  }

  context.showToast?.(t('command.noLocationToReveal'), 'warning');
}

async function handleCopyCurrentFilePath(context: CommandContext): Promise<void> {
  const docPath = context.documentStore.currentDocument?.path;
  if (!docPath) {
    context.showToast?.(t('file.missingCopyPath'), 'warning');
    return;
  }

  await executeFileAction({
    action: 'copyPath',
    path: docPath,
  }, {
    documentStore: context.documentStore,
    showToast: context.showToast,
    workspaceStore: context.workspaceStore,
  });
}

async function handleFileProperties(context: CommandContext): Promise<void> {
  const docPath = context.documentStore.currentDocument?.path;
  if (!docPath) {
    context.showToast?.(t('file.missingPropertiesPath'), 'warning');
    return;
  }

  await executeFileAction({
    action: 'properties',
    path: docPath,
  }, {
    documentStore: context.documentStore,
    showToast: context.showToast,
    workspaceStore: context.workspaceStore,
  });
}

async function handleCloseDocument(context: CommandContext): Promise<void> {
  const doc = context.documentStore.currentDocument;
  if (!doc) return;

  if (doc.isDirty) {
    let targetPath = doc.path;
    if (!targetPath) {
      if (!context.requestSavePath) {
        context.showToast?.(t('command.savePanelUnavailable'), 'warning');
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
        await recoverySnapshotStore.create({
          documentPath: doc.path,
          documentName: doc.name,
          content: doc.content,
          reason: 'manual-save',
        }).catch(() => undefined);
      }
      const expectedSnapshot = doc.path ? await ensureDocumentNotChangedOnDisk(context, targetPath) : null;
      const snapshot = await writeDocumentFileSession({
        path: targetPath,
        content: doc.content,
        expectedSnapshot,
      });
      context.documentStore.markSaved(targetPath, snapshot);
      await recoverySnapshotStore.clearForDocument(targetPath).catch(() => undefined);
    } catch (err) {
      if (!isFileConflictError(err)) {
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
      category: 'file',
      keywords: ['create', 'file'],
      shortcuts: [{ code: 'KeyN', mod: true }],
      run: handleNew,
    },
    {
      id: 'newWindow',
      category: 'file',
      shortcuts: [{ code: 'KeyN', mod: true, shift: true }],
      run: () => openPrismWindow(),
    },
    {
      id: 'open',
      category: 'file',
      keywords: ['open', 'file'],
      shortcuts: [{ code: 'KeyO', mod: true }],
      run: handleOpen,
    },
    {
      id: 'importDocument',
      category: 'file',
      keywords: ['import', 'html', 'docx', 'word', 'web', '导入', '转换', 'word 转 markdown'],
      run: handleImport,
    },
    {
      id: 'save',
      category: 'file',
      keywords: ['save'],
      shortcuts: [{ code: 'KeyS', mod: true }],
      enabled: hasDocument,
      run: handleSave,
    },
    {
      id: 'saveAs',
      category: 'file',
      keywords: ['save as'],
      shortcuts: [{ code: 'KeyS', mod: true, shift: true }],
      enabled: hasDocument,
      run: handleSaveAs,
    },
    {
      id: 'templateReadme',
      category: 'file',
      keywords: ['template', 'readme'],
      run: (context) => handleMarkdownTemplate('readme', context),
    },
    {
      id: 'templatePrd',
      category: 'file',
      keywords: ['template', 'prd', 'product'],
      run: (context) => handleMarkdownTemplate('prd', context),
    },
    {
      id: 'templateMeeting',
      category: 'file',
      keywords: ['template', 'meeting'],
      run: (context) => handleMarkdownTemplate('meeting', context),
    },
    {
      id: 'templateWeekly',
      category: 'file',
      keywords: ['template', 'weekly'],
      run: (context) => handleMarkdownTemplate('weekly', context),
    },
    {
      id: 'templateTechnicalPlan',
      category: 'file',
      keywords: ['template', 'technical', 'plan'],
      run: (context) => handleMarkdownTemplate('technicalPlan', context),
    },
    {
      id: 'templateArticle',
      category: 'file',
      keywords: ['template', 'article'],
      run: (context) => handleMarkdownTemplate('article', context),
    },
    {
      id: 'templatePaperDraft',
      category: 'file',
      keywords: ['template', 'paper', 'academic', '论文'],
      run: (context) => handleMarkdownTemplate('paperDraft', context),
    },
    {
      id: 'templateReadingNote',
      category: 'file',
      keywords: ['template', 'reading', 'book', '读书笔记'],
      run: (context) => handleMarkdownTemplate('readingNote', context),
    },
    {
      id: 'templateResearchSummary',
      category: 'file',
      keywords: ['template', 'research', 'summary', '研究摘要'],
      run: (context) => handleMarkdownTemplate('researchSummary', context),
    },
    {
      id: 'templateWhitePaper',
      category: 'file',
      keywords: ['template', 'whitepaper', '白皮书'],
      run: (context) => handleMarkdownTemplate('whitePaper', context),
    },
    {
      id: 'print',
      category: 'file',
      keywords: ['print'],
      shortcuts: [{ code: 'KeyP', mod: true }],
      run: () => window.print(),
    },
    {
      id: 'openCurrentLocation',
      category: 'file',
      enabled: (context) => hasSavedDocumentPath(context) || Boolean(context.workspaceStore.rootPath),
      run: handleOpenCurrentLocation,
    },
    {
      id: 'copyCurrentFilePath',
      category: 'file',
      keywords: ['copy', 'path', 'file', 'location', '复制', '路径'],
      // 原生菜单项无法随文档状态实时置灰，若在此按 enabled 拦截，未保存文稿下点击会静默无响应；
      // 改为始终可执行，由 handler 用 toast 说明为什么没有可复制的路径。
      run: handleCopyCurrentFilePath,
    },
    {
      id: 'fileProperties',
      category: 'file',
      keywords: ['file', 'properties', 'info', 'metadata', '简介', '属性'],
      enabled: hasSavedDocumentPath,
      run: handleFileProperties,
    },
    {
      id: 'closeDocument',
      category: 'file',
      shortcuts: [{ code: 'KeyW', mod: true }],
      enabled: hasDocument,
      run: handleCloseDocument,
    },
  ] satisfies CommandDefinition[];
}
