import { askDialog } from '../platform/tauri/dialogs';
import { stat } from '../platform/tauri/fileSystem';
import { loadFolderTree } from '../domains/workspace/lib/loadFolderTree';
import {
  addRecentFile,
  basename,
  dirname,
  flattenFiles,
  isPathInside,
  isSamePath,
  SUPPORTED_DOCUMENT_EXTENSIONS,
} from '../domains/workspace/services';
import type { OpenDocument } from '../domains/document/types';
import { useDocumentStore } from '../domains/document/store';
import { useWorkspaceStore } from '../domains/workspace/store';
import {
  createKnownFileSnapshot,
  fileConflictDetector,
  readDocumentFileSession,
  writeDocumentFileSession,
  type WriteDocumentFileSessionInput,
} from '../domains/document/services/fileSafety';
import { isSupportedDocumentPath } from '../domains/workspace/services/fileAssociation';
import { t } from '../domains/i18n';
import { grantMarkdownFileScope } from './fileSystemScope';
import { openPrismWindow } from './openWindow';

export const LARGE_DOCUMENT_WARNING_BYTES = 10 * 1024 * 1024;

export type DirtyDocumentSwitchAction = 'save' | 'saveAs' | 'discard' | 'cancel';

export type OpenDocumentEntryPoint =
  | 'document-open-button'
  | 'file-command'
  | 'new-window'
  | 'startup'
  | 'system'
  | 'workspace-navigation';

export interface OpenDocumentFlowContext {
  documentStore: ReturnType<typeof useDocumentStore.getState>;
  requestDirtyDocumentAction?: (input: {
    currentName: string;
    targetName: string;
    targetPath: string;
  }) => Promise<DirtyDocumentSwitchAction>;
  requestLargeFileConfirmation?: (input: {
    path: string;
    sizeBytes: number;
    sizeMB: string;
  }) => Promise<boolean>;
  requestSavePath?: (input: { filename: string; documentPath?: string }) => Promise<string | null>;
  showToast?: (message: string) => void;
  workspaceStore: ReturnType<typeof useWorkspaceStore.getState>;
}

export interface OpenDocumentPolicy {
  dirtyGuard: boolean;
  reason: 'current-document' | 'entry-prefers-new-window' | 'entry-prefers-current-window';
  syncWorkspace: boolean;
  target: 'current-window' | 'new-window';
}

export interface OpenDocumentResult {
  reason?: string;
  status:
    | 'aborted'
    | 'cancelled-dirty-document'
    | 'cancelled-large-file'
    | 'current-document'
    | 'opened-current-window'
    | 'opened-new-window';
}

interface OpenDocumentOptions {
  confirmLargeDocument?: boolean;
  entryPoint: OpenDocumentEntryPoint;
  restoreScrollState?: { editorRatio: number; previewRatio: number };
  restoreViewMode?: 'edit' | 'split' | 'preview';
  shouldAbort?: () => boolean;
  skipFileScopeGrant?: boolean;
  skipWorkspaceSync?: boolean;
}

function formatError(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

function supportedDocumentExtensionsLabel(): string {
  return SUPPORTED_DOCUMENT_EXTENSIONS.map((extension) => `.${extension}`).join(' / ');
}

export function isSupportedOpenDocumentPath(path: string): boolean {
  return isSupportedDocumentPath(path);
}

export function assertSupportedOpenDocumentPath(path: string): void {
  if (isSupportedOpenDocumentPath(path)) return;
  throw new Error(t('file.unsupportedDocumentType', {
    extensions: supportedDocumentExtensionsLabel(),
  }));
}

export function shouldWarnBeforeOpeningLargeDocument(sizeBytes: number): boolean {
  return Number.isFinite(sizeBytes) && sizeBytes > LARGE_DOCUMENT_WARNING_BYTES;
}

export function resolveOpenDocumentPolicy(input: {
  currentDocumentPath?: string | null;
  entryPoint: OpenDocumentEntryPoint;
  hasCurrentDocument: boolean;
  targetPath: string;
}): OpenDocumentPolicy {
  if (input.currentDocumentPath && isSamePath(input.currentDocumentPath, input.targetPath)) {
    return {
      dirtyGuard: false,
      reason: 'current-document',
      syncWorkspace: true,
      target: 'current-window',
    };
  }

  const prefersNewWindow =
    input.entryPoint === 'document-open-button' ||
    input.entryPoint === 'file-command' ||
    input.entryPoint === 'new-window' ||
    input.entryPoint === 'system';

  if (input.hasCurrentDocument && prefersNewWindow) {
    return {
      dirtyGuard: false,
      reason: 'entry-prefers-new-window',
      syncWorkspace: false,
      target: 'new-window',
    };
  }

  return {
    dirtyGuard: input.hasCurrentDocument,
    reason: 'entry-prefers-current-window',
    syncWorkspace: true,
    target: 'current-window',
  };
}

async function defaultLargeFileConfirmation(input: {
  sizeMB: string;
}): Promise<boolean> {
  return askDialog(
    t('command.largeFileWarning', { size: input.sizeMB }),
    { title: t('command.largeFileTitle'), kind: 'warning' },
  );
}

async function confirmLargeDocumentIfNeeded(
  path: string,
  context: OpenDocumentFlowContext,
): Promise<boolean> {
  try {
    const fileInfo = await stat(path);
    if (!shouldWarnBeforeOpeningLargeDocument(fileInfo.size)) return true;
    const sizeMB = (fileInfo.size / (1024 * 1024)).toFixed(2);
    return context.requestLargeFileConfirmation
      ? context.requestLargeFileConfirmation({ path, sizeBytes: fileInfo.size, sizeMB })
      : defaultLargeFileConfirmation({ sizeMB });
  } catch (err) {
    console.error('[openDocumentFlow] Failed to check file size:', err);
    return true;
  }
}

function fileTreeContainsPath(context: OpenDocumentFlowContext, path: string): boolean {
  return flattenFiles(context.workspaceStore.fileTree, context.workspaceStore.rootPath)
    .some(({ node }) => isSamePath(node.path, path));
}

export async function syncWorkspaceForOpenedDocument(
  path: string,
  context: OpenDocumentFlowContext,
): Promise<void> {
  const rootPath = context.workspaceStore.rootPath;
  if (!rootPath || !isPathInside(path, rootPath)) {
    const parentDir = dirname(path);
    const tree = await loadFolderTree(parentDir);
    context.workspaceStore.setWorkspace(parentDir, tree);
    return;
  }

  if (!fileTreeContainsPath(context, path)) {
    if (context.workspaceStore.workspaceTreeScope !== 'recursive') {
      const parentDir = dirname(path);
      const tree = await loadFolderTree(parentDir);
      context.workspaceStore.setWorkspace(parentDir, tree);
      return;
    }

    const tree = await loadFolderTree(rootPath, {
      scope: context.workspaceStore.workspaceTreeScope ?? 'currentLevel',
    });
    context.workspaceStore.setFileTree(tree);
  }
}

async function saveDirtyDocumentBeforeSwitch(
  document: OpenDocument,
  action: Extract<DirtyDocumentSwitchAction, 'save' | 'saveAs'>,
  context: OpenDocumentFlowContext,
  openingTargetPath: string,
): Promise<boolean> {
  let targetPath = action === 'save' ? document.path : '';

  if (!targetPath) {
    if (!context.requestSavePath) {
      context.showToast?.(t('command.savePanelUnavailable'));
      return false;
    }
    const chosen = await context.requestSavePath({
      filename: document.name,
      documentPath: document.path,
    });
    if (!chosen) return false;
    targetPath = chosen;
  }

  if (!document.path || !isSamePath(document.path, targetPath)) {
    if (isSamePath(targetPath, openingTargetPath)) {
      context.showToast?.(t('file.cannotSaveOverOpeningTarget'));
      return false;
    }
  }

  context.documentStore.markSaving(document.path || undefined);
  try {
    let expectedSnapshot: WriteDocumentFileSessionInput['expectedSnapshot'];
    if (document.path && action === 'save') {
      const result = await fileConflictDetector.inspect(
        document.path,
        createKnownFileSnapshot(document.lastKnownMtime, document.lastKnownSize),
      );
      if (result.kind !== 'ok') {
        context.documentStore.markSaveConflict(result.message, document.path, result.kind);
        context.showToast?.(result.message);
        return false;
      }
      if (result.changed) {
        context.documentStore.markSaveConflict(fileConflictDetector.message, document.path);
        context.showToast?.(fileConflictDetector.message);
        return false;
      }
      expectedSnapshot = result.currentSnapshot;
    }

    const snapshot = await writeDocumentFileSession({
      path: targetPath,
      content: document.content,
      expectedSnapshot,
    });
    if (!document.path || !isSamePath(document.path, targetPath)) {
      context.documentStore.openDocument(targetPath, basename(targetPath), document.content, snapshot);
    }
    addRecentFile(targetPath, basename(targetPath));
    context.documentStore.markSaved(targetPath, snapshot);
    return true;
  } catch (error) {
    context.documentStore.markSaveFailed(error, document.path || undefined);
    context.showToast?.(formatError(error));
    return false;
  }
}

async function ensureCanSwitchDocument(path: string, context: OpenDocumentFlowContext): Promise<boolean> {
  const document = context.documentStore.currentDocument;
  if (!document?.isDirty) return true;
  if (document.path && isSamePath(document.path, path)) return false;

  if (!context.requestDirtyDocumentAction) {
    context.showToast?.(t('file.unsavedSwitchBlocked'));
    return false;
  }

  const action = await context.requestDirtyDocumentAction({
    currentName: document.name,
    targetName: basename(path),
    targetPath: path,
  });

  if (action === 'cancel') return false;
  if (action === 'discard') return true;
  return saveDirtyDocumentBeforeSwitch(document, action, context, path);
}

export async function openDocumentInCurrentWindow(
  path: string,
  context: OpenDocumentFlowContext,
  options: OpenDocumentOptions,
): Promise<OpenDocumentResult> {
  assertSupportedOpenDocumentPath(path);
  if (!options.skipFileScopeGrant) {
    await grantMarkdownFileScope(path);
  }
  if (options.shouldAbort?.()) return { status: 'aborted' };

  const currentDocument = context.documentStore.currentDocument;
  if (currentDocument?.path && isSamePath(currentDocument.path, path)) {
    if (!options.skipWorkspaceSync) {
      await syncWorkspaceForOpenedDocument(path, context);
    }
    return { status: 'current-document' };
  }

  if (options.confirmLargeDocument !== false && !(await confirmLargeDocumentIfNeeded(path, context))) {
    return { status: 'cancelled-large-file' };
  }
  if (options.shouldAbort?.()) return { status: 'aborted' };

  const policy = resolveOpenDocumentPolicy({
    currentDocumentPath: currentDocument?.path,
    entryPoint: options.entryPoint,
    hasCurrentDocument: Boolean(currentDocument),
    targetPath: path,
  });
  if (policy.dirtyGuard && !(await ensureCanSwitchDocument(path, context))) {
    return { status: 'cancelled-dirty-document' };
  }

  const session = await readDocumentFileSession(path);
  if (options.shouldAbort?.()) return { status: 'aborted' };
  context.documentStore.openDocument(session.path, session.name, session.content, session.knownSnapshot);
  if (options.restoreViewMode) context.documentStore.setViewMode(options.restoreViewMode);
  if (options.restoreScrollState) context.documentStore.updateScrollState(options.restoreScrollState);
  addRecentFile(session.path, session.name);
  if (!options.skipWorkspaceSync) {
    await syncWorkspaceForOpenedDocument(path, context);
  }
  return { status: 'opened-current-window' };
}

export async function openDocumentInNewWindow(
  path: string,
  context: OpenDocumentFlowContext,
  options: OpenDocumentOptions,
): Promise<OpenDocumentResult> {
  assertSupportedOpenDocumentPath(path);
  await grantMarkdownFileScope(path);
  if (options.confirmLargeDocument !== false && !(await confirmLargeDocumentIfNeeded(path, context))) {
    return { status: 'cancelled-large-file' };
  }
  await openPrismWindow({ filePath: path });
  return {
    reason: options.entryPoint,
    status: 'opened-new-window',
  };
}

export async function openSelectedDocument(
  path: string,
  context: OpenDocumentFlowContext,
  options: OpenDocumentOptions,
): Promise<OpenDocumentResult> {
  const currentDocument = context.documentStore.currentDocument;
  const policy = resolveOpenDocumentPolicy({
    currentDocumentPath: currentDocument?.path,
    entryPoint: options.entryPoint,
    hasCurrentDocument: Boolean(currentDocument),
    targetPath: path,
  });

  if (policy.target === 'new-window') {
    return openDocumentInNewWindow(path, context, options);
  }

  return openDocumentInCurrentWindow(path, context, options);
}
