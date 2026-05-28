import {
  exists,
  mkdir,
  readTextFile,
  remove,
  rename,
  stat,
  writeTextFile,
} from '../platform/tauri/fileSystem';
import { invokeNativeCommand } from '../platform/tauri/nativeCommands';
import { confirmDialog as confirm, messageDialog as message } from '../platform/tauri/dialogs';
import {
  openPathWithDefaultApp as openPath,
  revealPathInFileManager as revealItemInDir,
} from '../platform/tauri/opener';
import { useDocumentStore } from '../domains/document/store';
import { useWorkspaceStore } from '../domains/workspace/store';
import { loadFolderTree } from '../domains/workspace/lib/loadFolderTree';
import {
  addRecentFile,
  basename,
  dirname,
  flattenFiles,
  isPathInside,
  isSamePath,
  joinPath,
  replacePathPrefix,
} from '../domains/workspace/services';
import { openPrismWindow } from './openWindow';
import { grantMarkdownFileScope, grantWorkspaceDirectoryScope } from './fileSystemScope';
import {
  getUnsupportedFileActionMessage,
  parseFileAction,
  type FileActionInput,
} from './fileActionCommands';
import { t } from '../domains/i18n';
import { emitAppEvent } from '../platform/events/appEvents';
import type { OpenDocument } from '../domains/document/types';
import {
  createKnownFileSnapshot,
  fileConflictDetector,
  readDocumentFileSession,
  writeDocumentFileSession,
  type WriteDocumentFileSessionInput,
} from '../domains/document/services/fileSafety';

export type { FileActionInput } from './fileActionCommands';

export type DirtyDocumentSwitchAction = 'save' | 'saveAs' | 'discard' | 'cancel';

interface FileActionContext {
  documentStore: ReturnType<typeof useDocumentStore.getState>;
  requestDirtyDocumentAction?: (input: {
    currentName: string;
    targetName: string;
    targetPath: string;
  }) => Promise<DirtyDocumentSwitchAction>;
  requestSavePath?: (input: { filename: string; documentPath?: string }) => Promise<string | null>;
  workspaceStore: ReturnType<typeof useWorkspaceStore.getState>;
  showToast?: (message: string) => void;
}

type DeletePathMode = 'cancelled' | 'permanent' | 'trash';

interface DeletePathWithTrashFallbackInput {
  confirmDialog: typeof confirm;
  displayName: string;
  isDirectory: boolean;
  moveToTrash: (path: string) => Promise<void>;
  path: string;
  permanentDelete: (path: string, options: { recursive: boolean }) => Promise<void>;
}

interface DeletePathWithTrashFallbackResult {
  deleted: boolean;
  error?: string;
  mode: DeletePathMode;
}

function splitName(name: string): { stem: string; ext: string } {
  const index = name.lastIndexOf('.');
  if (index <= 0) return { stem: name, ext: '' };
  return { stem: name.slice(0, index), ext: name.slice(index) };
}

function formatError(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

async function movePathToTrash(path: string): Promise<void> {
  await invokeNativeCommand('move_path_to_trash', { path });
}

export async function deletePathWithTrashFallback({
  confirmDialog,
  displayName,
  isDirectory,
  moveToTrash,
  path,
  permanentDelete,
}: DeletePathWithTrashFallbackInput): Promise<DeletePathWithTrashFallbackResult> {
  const confirmed = await confirmDialog(
    t('file.confirmMoveToTrash', { name: displayName }),
    {
      title: t('file.moveToTrash'),
      kind: 'warning',
      okLabel: t('file.moveToTrash'),
      cancelLabel: t('common.cancel'),
    },
  );

  if (!confirmed) return { deleted: false, mode: 'cancelled' };

  try {
    await moveToTrash(path);
    return { deleted: true, mode: 'trash' };
  } catch (err) {
    const error = formatError(err);
    const permanentConfirmed = await confirmDialog(
      t('file.confirmPermanentDelete', { error, name: displayName }),
      {
        title: t('file.permanentDeleteTitle'),
        kind: 'warning',
        okLabel: t('file.permanentDelete'),
        cancelLabel: t('common.cancel'),
      },
    );

    if (!permanentConfirmed) return { deleted: false, mode: 'cancelled', error };

    await permanentDelete(path, { recursive: isDirectory });
    return { deleted: true, mode: 'permanent', error };
  }
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes)) return t('common.unknown');
  if (bytes < 1024) return `${bytes} B`;

  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value.toFixed(value >= 10 ? 1 : 2)} ${units[unitIndex]}`;
}

function formatDate(date: Date | null): string {
  return date ? date.toLocaleString() : t('common.unavailable');
}

function requestInlineRename(path: string): void {
  emitAppEvent('file.renameRequest', { path });
}

async function copyText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  textarea.style.top = '0';
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  const copied = document.execCommand('copy');
  document.body.removeChild(textarea);

  if (!copied) {
    throw new Error(t('file.clipboardWriteFailed'));
  }
}

async function refreshWorkspace(context: FileActionContext, rootPath = context.workspaceStore.rootPath): Promise<void> {
  if (!rootPath) return;
  const tree = await loadFolderTree(rootPath);
  context.workspaceStore.setFileTree(tree);
}

function fileTreeContainsPath(context: FileActionContext, path: string): boolean {
  return flattenFiles(context.workspaceStore.fileTree, context.workspaceStore.rootPath)
    .some(({ node }) => isSamePath(node.path, path));
}

async function syncWorkspaceForOpenedFile(path: string, context: FileActionContext): Promise<void> {
  const rootPath = context.workspaceStore.rootPath;
  if (!rootPath || !isPathInside(path, rootPath)) {
    const parentDir = dirname(path);
    context.workspaceStore.setRootPath(parentDir);
    await refreshWorkspace(context, parentDir);
    return;
  }

  if (!fileTreeContainsPath(context, path)) {
    await refreshWorkspace(context, rootPath);
  }
}

async function saveDirtyDocumentBeforeSwitch(
  document: OpenDocument,
  action: Extract<DirtyDocumentSwitchAction, 'save' | 'saveAs'>,
  context: FileActionContext,
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

async function ensureCanSwitchDocument(path: string, context: FileActionContext): Promise<boolean> {
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
  return saveDirtyDocumentBeforeSwitch(document, action, context);
}

async function getUniquePath(parentDir: string, stem: string, ext = ''): Promise<string> {
  for (let index = 0; index < 1000; index += 1) {
    const suffix = index === 0 ? '' : ` (${index})`;
    const candidate = joinPath(parentDir, `${stem}${suffix}${ext}`);
    if (!(await exists(candidate))) return candidate;
  }

  throw new Error(t('file.uniquePathFailed', { name: `${stem}${ext}` }));
}

async function getUniqueCopyPath(originalPath: string): Promise<string> {
  const parentDir = dirname(originalPath);
  const { stem, ext } = splitName(basename(originalPath));

  for (let index = 0; index < 1000; index += 1) {
    const suffix = index === 0 ? t('file.copySuffix') : t('file.copySuffixNumbered', { index });
    const candidate = joinPath(parentDir, `${stem}${suffix}${ext}`);
    if (!(await exists(candidate))) return candidate;
  }

  throw new Error(t('file.uniqueCopyPathFailed', { name: basename(originalPath) }));
}

function getWorkspaceTargetDir(context: FileActionContext, requestedPath?: string): string | null {
  if (requestedPath) return requestedPath;
  if (context.workspaceStore.rootPath) return context.workspaceStore.rootPath;

  context.showToast?.(t('app.openWorkspaceFirst'));
  return null;
}

async function handleOpenFile(path: string, context: FileActionContext): Promise<void> {
  await grantMarkdownFileScope(path);

  const currentDocument = context.documentStore.currentDocument;
  if (currentDocument?.path && isSamePath(currentDocument.path, path)) {
    await syncWorkspaceForOpenedFile(path, context);
    return;
  }

  if (!(await ensureCanSwitchDocument(path, context))) return;

  const session = await readDocumentFileSession(path);
  context.documentStore.openDocument(session.path, session.name, session.content, session.knownSnapshot);
  addRecentFile(session.path, session.name);
  await syncWorkspaceForOpenedFile(path, context);
}

async function handleOpenNewWindow(path: string | undefined, context: FileActionContext): Promise<void> {
  if (path) {
    const info = await stat(path);
    if (info.isDirectory) {
      await grantWorkspaceDirectoryScope(path);
    } else {
      await grantMarkdownFileScope(path);
    }
    await openPrismWindow(info.isDirectory ? { folderPath: path } : { filePath: path });
    return;
  }

  if (!context.workspaceStore.rootPath) {
    throw new Error(t('file.noWorkspace'));
  }

  await openPrismWindow({ folderPath: context.workspaceStore.rootPath });
}

async function handleNewFile(parentPath: string | undefined, context: FileActionContext): Promise<void> {
  const targetDir = getWorkspaceTargetDir(context, parentPath);
  if (!targetDir) return;

  const filePath = await getUniquePath(targetDir, t('file.newUntitledStem'), '.md');
  const snapshot = await writeDocumentFileSession({ path: filePath, content: '', createNew: true });
  context.documentStore.openDocument(filePath, basename(filePath), '', snapshot);
  addRecentFile(filePath, basename(filePath));
  await refreshWorkspace(context);
  requestInlineRename(filePath);
  context.showToast?.(t('file.createdNewFile'));
}

async function handleNewFolder(parentPath: string | undefined, context: FileActionContext): Promise<void> {
  const targetDir = getWorkspaceTargetDir(context, parentPath);
  if (!targetDir) return;

  const folderPath = await getUniquePath(targetDir, t('file.newFolderStem'));
  await mkdir(folderPath);
  context.workspaceStore.setFileTreeMode('tree');
  await refreshWorkspace(context);
  requestInlineRename(folderPath);
  context.showToast?.(t('file.createdNewFolder'));
}

async function handleCommitRename(path: string, newName: string, context: FileActionContext): Promise<void> {
  const safeName = newName.trim();
  if (!safeName) {
    context.showToast?.(t('file.nameRequired'));
    return;
  }
  if (/[\\/]/.test(safeName)) {
    context.showToast?.(t('file.nameCannotContainSeparator'));
    return;
  }

  const oldInfo = await stat(path);
  const targetPath = joinPath(dirname(path), safeName);
  if (isSamePath(path, targetPath)) return;

  if ((await exists(targetPath)) && !isSamePath(path, targetPath)) {
    context.showToast?.(t('file.nameAlreadyExists', { name: safeName }));
    return;
  }

  await rename(path, targetPath);

  const doc = context.documentStore.currentDocument;
  if (doc?.path) {
    if (isSamePath(doc.path, path)) {
      context.documentStore.updateDocumentPath(doc.path, targetPath, basename(targetPath));
    } else if (oldInfo.isDirectory && isPathInside(doc.path, path)) {
      const nextDocumentPath = replacePathPrefix(doc.path, path, targetPath);
      context.documentStore.updateDocumentPath(doc.path, nextDocumentPath, basename(nextDocumentPath));
    }
  }

  await refreshWorkspace(context);
  context.showToast?.(t('file.renameDone'));
}

async function handleDuplicate(path: string, context: FileActionContext): Promise<void> {
  const info = await stat(path);
  if (!info.isFile) {
    context.showToast?.(t('file.duplicateFileOnly'));
    return;
  }

  const content = await readTextFile(path);
  const targetPath = await getUniqueCopyPath(path);
  await writeTextFile(targetPath, content, { createNew: true });
  await refreshWorkspace(context);
  context.showToast?.(t('file.duplicateDone', { name: basename(targetPath) }));
}

async function handleDelete(path: string, context: FileActionContext): Promise<void> {
  const info = await stat(path);
  const result = await deletePathWithTrashFallback({
    confirmDialog: confirm,
    displayName: basename(path),
    isDirectory: info.isDirectory,
    moveToTrash: movePathToTrash,
    path,
    permanentDelete: remove,
  });

  if (!result.deleted) {
    if (result.error) context.showToast?.(t('file.deleteCancelled'));
    return;
  }

  const doc = context.documentStore.currentDocument;
  if (doc?.path && (isSamePath(doc.path, path) || (info.isDirectory && isPathInside(doc.path, path)))) {
    context.documentStore.closeDocument();
  }

  await refreshWorkspace(context);
  context.showToast?.(result.mode === 'trash' ? t('file.movedToTrash') : t('file.permanentlyDeleted'));
}

async function handleOpenLocation(path: string): Promise<void> {
  const info = await stat(path);
  if (info.isDirectory) {
    await openPath(path);
    return;
  }

  await revealItemInDir(path);
}

async function handleCopyPath(path: string, context: FileActionContext): Promise<void> {
  await copyText(path);
  context.showToast?.(t('file.pathCopied'));
}

async function handleProperties(path: string): Promise<void> {
  const info = await stat(path);
  const details = [
    `${t('file.property.name')}: ${basename(path)}`,
    `${t('file.property.path')}: ${path}`,
    `${t('file.property.type')}: ${info.isDirectory ? t('file.type.folder') : info.isFile ? t('file.type.file') : t('file.type.symlink')}`,
    `${t('file.property.size')}: ${formatBytes(info.size)}`,
    `${t('file.property.created')}: ${formatDate(info.birthtime)}`,
    `${t('file.property.modified')}: ${formatDate(info.mtime)}`,
    `${t('file.property.accessed')}: ${formatDate(info.atime)}`,
    `${t('file.property.readonly')}: ${info.readonly ? t('common.yes') : t('common.no')}`,
  ].join('\n');

  await message(details, { title: t('file.properties'), kind: 'info' });
}

async function handleRefresh(context: FileActionContext): Promise<void> {
  if (!context.workspaceStore.rootPath) {
    context.showToast?.(t('file.noWorkspace'));
    return;
  }

  await refreshWorkspace(context);
  context.showToast?.(t('file.treeRefreshed'));
}

export async function executeFileAction(
  input: FileActionInput,
  context: FileActionContext,
): Promise<void> {
  const { command, path, name } = parseFileAction(input);

  try {
    switch (command) {
      case 'openFile':
        if (!path) throw new Error(t('file.missingPath'));
        await handleOpenFile(path, context);
        return;

      case 'openNewWindow':
        await handleOpenNewWindow(path, context);
        return;

      case 'newFile':
        await handleNewFile(path, context);
        return;

      case 'newFolder':
        await handleNewFolder(path, context);
        return;

      case 'rename':
        if (!path) throw new Error(t('file.missingRenamePath'));
        requestInlineRename(path);
        return;

      case 'commitRename':
        if (!path || name === undefined) throw new Error(t('file.missingRenameArgs'));
        await handleCommitRename(path, name, context);
        return;

      case 'duplicate':
        if (!path) throw new Error(t('file.missingDuplicatePath'));
        await handleDuplicate(path, context);
        return;

      case 'delete':
        if (!path) throw new Error(t('file.missingDeletePath'));
        await handleDelete(path, context);
        return;

      case 'openRootLocation':
        if (!context.workspaceStore.rootPath) throw new Error(t('file.noWorkspace'));
        await openPath(context.workspaceStore.rootPath);
        return;

      case 'openLocation':
        if (!path) throw new Error(t('file.missingOpenLocationPath'));
        await handleOpenLocation(path);
        return;

      case 'copyRootPath':
        if (!context.workspaceStore.rootPath) throw new Error(t('file.noWorkspace'));
        await handleCopyPath(context.workspaceStore.rootPath, context);
        return;

      case 'copyPath':
        if (!path) throw new Error(t('file.missingCopyPath'));
        await handleCopyPath(path, context);
        return;

      case 'properties':
        if (!path) throw new Error(t('file.missingPropertiesPath'));
        await handleProperties(path);
        return;

      case 'refreshFolder':
        await handleRefresh(context);
        return;

      case 'viewList':
        context.workspaceStore.setFileTreeMode('list');
        return;

      case 'viewTree':
        context.workspaceStore.setFileTreeMode('tree');
        return;

      case 'sortByName':
        context.workspaceStore.setFileSortMode('name');
        return;

      case 'sortByModified':
        context.workspaceStore.setFileSortMode('modified');
        return;

      case 'sortByCreated':
        context.workspaceStore.setFileSortMode('created');
        return;

      case 'sortBySize':
        context.workspaceStore.setFileSortMode('size');
        return;

      case 'searchInFolder':
        if (!context.workspaceStore.rootPath) throw new Error(t('file.noWorkspace'));
        emitAppEvent('search.open', { action: 'open', rootPath: context.workspaceStore.rootPath });
        return;

      default:
        context.showToast?.(getUnsupportedFileActionMessage(command));
    }
  } catch (err) {
    console.error(`[FileAction] ${command} failed:`, err);
    context.showToast?.(t('command.operationFailed', { message: formatError(err) }));
  }
}
