import { askDialog, openDialog } from '../../../platform/tauri/dialogs';
import {
  openPathWithDefaultApp,
  revealPathInFileManager,
} from '../../../platform/tauri/opener';
import { openPrismWindow } from '../../../lib/openWindow';
import { openSelectedDocument } from '../../../lib/openDocumentFlow';
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
import { MARKDOWN_FILE_FILTERS, addRecentFile, basename } from '../../workspace/services';
import type { CommandContext, CommandDefinition } from '../types';
import { t } from '../../i18n';
import { emitAppEvent } from '../../../platform/events/appEvents';

function formatError(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (err instanceof Event) return err.type || t('common.unknownEventError');
  return String(err);
}

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

async function handleNew(context: CommandContext): Promise<void> {
  if (!context.documentStore.currentDocument) {
    context.documentStore.createNewDocument();
    return;
  }

  await openPrismWindow({ newDocument: true });
}

function handleMarkdownTemplate(templateId: MarkdownTemplateId, context: CommandContext): void {
  const template = MARKDOWN_TEMPLATES[templateId];
  if (!context.documentStore.currentDocument) {
    context.documentStore.createNewDocument(resolveMarkdownTemplateContent(template.content, {
      title: template.label,
    }), template.filename);
    context.showToast?.(t('command.templateCreated', { label: template.label }));
    return;
  }

  emitEditorCommand('insertTemplate', { templateId });
}

async function handleOpen(context: CommandContext): Promise<void> {
  const selected = await openDialog({
    multiple: false,
    filters: MARKDOWN_FILE_FILTERS,
  });

  if (!selected || Array.isArray(selected)) return;

  try {
    await openSelectedDocument(selected, context, { entryPoint: 'file-command' });
  } catch (err) {
    console.error('[Command] Failed to open file:', err);
    const message = formatError(err);
    await askDialog(t('command.openFileFailedDialog', { message }), {
      title: t('command.openFileFailedTitle'),
      kind: 'error',
    });
  }
}

async function handleSave(context: CommandContext): Promise<void> {
  const doc = context.documentStore.currentDocument;
  if (!doc) return;

  let targetPath = doc.path;

  if (!targetPath) {
    if (!context.requestSavePath) {
      context.showToast?.(t('command.savePanelUnavailable'));
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
    if (!doc.path) {
      context.documentStore.openDocument(targetPath, basename(targetPath), doc.content, snapshot);
    }
    addRecentFile(targetPath, basename(targetPath));
    context.documentStore.markSaved(targetPath, snapshot);
    await recoverySnapshotStore.clearForDocument(targetPath).catch(() => undefined);
  } catch (err) {
    if (!isFileConflictError(err)) {
      context.documentStore.markSaveFailed(err, doc.path || undefined);
    }
    throw err;
  }
}

async function handleSaveAs(context: CommandContext): Promise<void> {
  const doc = context.documentStore.currentDocument;
  if (!doc) return;

  if (!context.requestSavePath) {
    context.showToast?.(t('command.savePanelUnavailable'));
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

  context.showToast?.(t('command.noLocationToReveal'));
}

async function handleCloseDocument(context: CommandContext): Promise<void> {
  const doc = context.documentStore.currentDocument;
  if (!doc) return;

  if (doc.isDirty) {
    let targetPath = doc.path;
    if (!targetPath) {
      if (!context.requestSavePath) {
        context.showToast?.(t('command.savePanelUnavailable'));
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
      run: () => openPrismWindow({ newDocument: true }),
    },
    {
      id: 'open',
      category: 'file',
      keywords: ['open', 'file'],
      shortcuts: [{ code: 'KeyO', mod: true }],
      run: handleOpen,
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
      run: () => window.print(),
    },
    {
      id: 'openCurrentLocation',
      category: 'file',
      enabled: (context) => hasSavedDocumentPath(context) || Boolean(context.workspaceStore.rootPath),
      run: handleOpenCurrentLocation,
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
