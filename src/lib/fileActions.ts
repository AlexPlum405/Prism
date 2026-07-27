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
import { revealPathInFileManager as revealItemInDir } from '../platform/tauri/opener';
import { loadFolderTree } from '../domains/workspace/lib/loadFolderTree';
import {
  addRecentFile,
  basename,
  dirname,
  isPathInside,
  isSamePath,
  joinPath,
  replacePathPrefix,
} from '../domains/workspace/services';
import { openPrismWindow } from './openWindow';
import { grantWorkspaceDirectoryScope } from './fileSystemScope';
import {
  openDocumentInCurrentWindow,
  openDocumentInNewWindow,
  type OpenDocumentFlowContext,
} from './openDocumentFlow';
import {
  getUnsupportedFileActionMessage,
  parseFileAction,
  type FileActionInput,
} from './fileActionCommands';
import { t } from '../domains/i18n';
import { emitAppEvent } from '../platform/events/appEvents';
import {
  readDocumentFileSession,
  writeDocumentFileSession,
} from '../domains/document/services/fileSafety';
import {
  applyLinkRewrites,
  scanLinkRewritesForMovedPath,
} from './linkRewriteFlow';

export type { FileActionInput } from './fileActionCommands';
export type { DirtyDocumentSwitchAction } from './openDocumentFlow';

interface FileActionContext extends OpenDocumentFlowContext {}

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

async function refreshWorkspace(
  context: FileActionContext,
  rootPath = context.workspaceStore.rootPath,
  scope = context.workspaceStore.workspaceTreeScope,
): Promise<void> {
  if (!rootPath) return;
  const tree = await loadFolderTree(rootPath, { scope: scope ?? 'currentLevel' });
  context.workspaceStore.setFileTree(tree);
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
  await openDocumentInCurrentWindow(path, context, { entryPoint: 'workspace-navigation' });
}

async function handleOpenNewWindow(path: string | undefined, context: FileActionContext): Promise<void> {
  if (path) {
    const info = await stat(path);
    if (info.isDirectory) {
      await grantWorkspaceDirectoryScope(path);
      await openPrismWindow({ folderPath: path });
    } else {
      await openDocumentInNewWindow(path, context, { entryPoint: 'new-window' });
    }
    return;
  }

  await openPrismWindow();
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

  if (oldInfo.isFile) {
    await updateIncomingLinksAfterMove(path, targetPath, context);
  }
}

/**
 * A rename silently breaks every link pointing at the old path, so offer to
 * rewrite them. Runs after the rename succeeded and never blocks it: a failure
 * here leaves the file renamed and the stale links visible to link diagnostics.
 */
async function updateIncomingLinksAfterMove(
  previousPath: string,
  nextPath: string,
  context: FileActionContext,
): Promise<void> {
  const { rootPath, fileTree } = context.workspaceStore;
  if (!rootPath || fileTree.length === 0) return;

  try {
    const doc = context.documentStore.currentDocument;
    const overlay = doc?.path && doc.isDirty
      ? new Map([[doc.path, doc.content]])
      : undefined;

    const plans = await scanLinkRewritesForMovedPath({
      fileTree,
      nextPath,
      overlay,
      previousPath,
      workspaceRoot: rootPath,
    });
    if (plans.length === 0) return;

    const confirmed = await confirm(
      t('file.linkRewriteConfirm', { count: plans.length, name: basename(nextPath) }),
      {
        title: t('file.linkRewriteConfirmTitle'),
        okLabel: t('file.linkRewriteUpdate'),
        cancelLabel: t('file.linkRewriteKeep'),
      },
    );
    if (!confirmed) return;

    const result = await applyLinkRewrites({ plans });

    // Reload the open document if its own content was rewritten on disk, so the
    // editor buffer does not overwrite the rewrite on the next save.
    const rewrittenCurrent = doc?.path
      ? plans.find((plan) => isSamePath(plan.path, doc.path as string))
      : undefined;
    if (rewrittenCurrent && result.written.some((written) => isSamePath(written, rewrittenCurrent.path))) {
      const session = await readDocumentFileSession(rewrittenCurrent.path);
      context.documentStore.openDocument(
        session.path,
        session.name,
        session.content,
        session.knownSnapshot,
      );
    }

    if (result.written.length > 0) {
      context.showToast?.(t('file.linkRewriteDone', { count: result.written.length }));
    }
    if (result.failed.length > 0) {
      context.showToast?.(t('file.linkRewriteFailed', {
        count: result.failed.length,
        error: result.failed[0].error,
      }));
    }
  } catch (err) {
    context.showToast?.(t('file.linkRewriteFailed', { count: 0, error: formatError(err) }));
  }
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

async function handleWorkspaceTreeScope(
  scope: 'currentLevel' | 'recursive',
  context: FileActionContext,
): Promise<void> {
  context.workspaceStore.setWorkspaceTreeScope(scope);
  await refreshWorkspace(context, context.workspaceStore.rootPath, scope);
  context.showToast?.(scope === 'recursive'
    ? t('file.treeScopeRecursive')
    : t('file.treeScopeCurrentLevel'));
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
        await revealItemInDir(context.workspaceStore.rootPath);
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

      case 'viewCurrentLevel':
        await handleWorkspaceTreeScope('currentLevel', context);
        return;

      case 'viewRecursive':
        await handleWorkspaceTreeScope('recursive', context);
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
        emitAppEvent('search.open', { action: 'workspace', rootPath: context.workspaceStore.rootPath });
        return;

      default:
        context.showToast?.(getUnsupportedFileActionMessage(command));
    }
  } catch (err) {
    console.error(`[FileAction] ${command} failed:`, err);
    context.showToast?.(t('command.operationFailed', { message: formatError(err) }));
  }
}
