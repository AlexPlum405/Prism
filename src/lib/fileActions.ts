import {
  exists,
  mkdir,
  readTextFile,
  remove,
  rename,
  stat,
  writeTextFile,
} from '@tauri-apps/plugin-fs';
import { invoke } from '@tauri-apps/api/core';
import { confirm, message } from '@tauri-apps/plugin-dialog';
import { openPath, revealItemInDir } from '@tauri-apps/plugin-opener';
import { useDocumentStore } from '../domains/document/store';
import { useWorkspaceStore } from '../domains/workspace/store';
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
import { getFileSnapshotOrNull } from '../domains/document/fileSnapshot';
import { openPrismWindow } from './openWindow';
import { grantMarkdownFileScope, grantWorkspaceDirectoryScope } from './fileSystemScope';
import {
  getUnsupportedFileActionMessage,
  parseFileAction,
  type FileActionInput,
} from './fileActionCommands';

export type { FileActionInput } from './fileActionCommands';

interface FileActionContext {
  documentStore: ReturnType<typeof useDocumentStore.getState>;
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
  await invoke('move_path_to_trash', { path });
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
    `确定要将“${displayName}”移到系统废纸篓吗？`,
    {
      title: '移到废纸篓',
      kind: 'warning',
      okLabel: '移到废纸篓',
      cancelLabel: '取消',
    },
  );

  if (!confirmed) return { deleted: false, mode: 'cancelled' };

  try {
    await moveToTrash(path);
    return { deleted: true, mode: 'trash' };
  } catch (err) {
    const error = formatError(err);
    const permanentConfirmed = await confirmDialog(
      `无法移到系统废纸篓：${error}\n\n是否永久删除“${displayName}”？此操作不可撤销。`,
      {
        title: '永久删除确认',
        kind: 'warning',
        okLabel: '永久删除',
        cancelLabel: '取消',
      },
    );

    if (!permanentConfirmed) return { deleted: false, mode: 'cancelled', error };

    await permanentDelete(path, { recursive: isDirectory });
    return { deleted: true, mode: 'permanent', error };
  }
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes)) return '未知';
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
  return date ? date.toLocaleString() : '不可用';
}

function requestInlineRename(path: string): void {
  window.dispatchEvent(new CustomEvent('prism-file-rename-request', { detail: { path } }));
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
    throw new Error('无法写入系统剪贴板');
  }
}

async function refreshWorkspace(context: FileActionContext, rootPath = context.workspaceStore.rootPath): Promise<void> {
  if (!rootPath) return;
  const tree = await loadFolderTree(rootPath);
  context.workspaceStore.setFileTree(tree);
}

async function getUniquePath(parentDir: string, stem: string, ext = ''): Promise<string> {
  for (let index = 0; index < 1000; index += 1) {
    const suffix = index === 0 ? '' : ` (${index})`;
    const candidate = joinPath(parentDir, `${stem}${suffix}${ext}`);
    if (!(await exists(candidate))) return candidate;
  }

  throw new Error(`无法生成不重名的路径: ${stem}${ext}`);
}

async function getUniqueCopyPath(originalPath: string): Promise<string> {
  const parentDir = dirname(originalPath);
  const { stem, ext } = splitName(basename(originalPath));

  for (let index = 0; index < 1000; index += 1) {
    const suffix = index === 0 ? ' (副本)' : ` (副本 ${index})`;
    const candidate = joinPath(parentDir, `${stem}${suffix}${ext}`);
    if (!(await exists(candidate))) return candidate;
  }

  throw new Error(`无法生成副本路径: ${basename(originalPath)}`);
}

function getWorkspaceTargetDir(context: FileActionContext, requestedPath?: string): string | null {
  if (requestedPath) return requestedPath;
  if (context.workspaceStore.rootPath) return context.workspaceStore.rootPath;

  context.showToast?.('请先打开一个工作区文件夹');
  return null;
}

async function handleOpenFile(path: string, context: FileActionContext): Promise<void> {
  await grantMarkdownFileScope(path);
  const snapshot = await getFileSnapshotOrNull(path);
  const content = await readTextFile(path);
  context.documentStore.openDocument(path, basename(path), content, snapshot);
  addRecentFile(path, basename(path));

  const rootPath = context.workspaceStore.rootPath;
  if (!rootPath || !isPathInside(path, rootPath)) {
    const parentDir = dirname(path);
    context.workspaceStore.setRootPath(parentDir);
    await refreshWorkspace(context, parentDir);
  }
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
    throw new Error('当前没有打开的工作区');
  }

  await openPrismWindow({ folderPath: context.workspaceStore.rootPath });
}

async function handleNewFile(parentPath: string | undefined, context: FileActionContext): Promise<void> {
  const targetDir = getWorkspaceTargetDir(context, parentPath);
  if (!targetDir) return;

  const filePath = await getUniquePath(targetDir, '未命名', '.md');
  await writeTextFile(filePath, '', { createNew: true });
  const snapshot = await getFileSnapshotOrNull(filePath);
  const content = await readTextFile(filePath);
  context.documentStore.openDocument(filePath, basename(filePath), content, snapshot);
  addRecentFile(filePath, basename(filePath));
  await refreshWorkspace(context);
  requestInlineRename(filePath);
  context.showToast?.('已创建新文件');
}

async function handleNewFolder(parentPath: string | undefined, context: FileActionContext): Promise<void> {
  const targetDir = getWorkspaceTargetDir(context, parentPath);
  if (!targetDir) return;

  const folderPath = await getUniquePath(targetDir, '新建文件夹');
  await mkdir(folderPath);
  context.workspaceStore.setFileTreeMode('tree');
  await refreshWorkspace(context);
  requestInlineRename(folderPath);
  context.showToast?.('已创建新文件夹');
}

async function handleCommitRename(path: string, newName: string, context: FileActionContext): Promise<void> {
  const safeName = newName.trim();
  if (!safeName) {
    context.showToast?.('名称不能为空');
    return;
  }
  if (/[\\/]/.test(safeName)) {
    context.showToast?.('名称不能包含路径分隔符');
    return;
  }

  const oldInfo = await stat(path);
  const targetPath = joinPath(dirname(path), safeName);
  if (isSamePath(path, targetPath)) return;

  if ((await exists(targetPath)) && !isSamePath(path, targetPath)) {
    context.showToast?.(`“${safeName}” 已存在`);
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
  context.showToast?.('重命名完成');
}

async function handleDuplicate(path: string, context: FileActionContext): Promise<void> {
  const info = await stat(path);
  if (!info.isFile) {
    context.showToast?.('只能为文件创建副本');
    return;
  }

  const content = await readTextFile(path);
  const targetPath = await getUniqueCopyPath(path);
  await writeTextFile(targetPath, content, { createNew: true });
  await refreshWorkspace(context);
  context.showToast?.(`已创建副本: ${basename(targetPath)}`);
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
    if (result.error) context.showToast?.('已取消删除');
    return;
  }

  const doc = context.documentStore.currentDocument;
  if (doc?.path && (isSamePath(doc.path, path) || (info.isDirectory && isPathInside(doc.path, path)))) {
    context.documentStore.closeDocument();
  }

  await refreshWorkspace(context);
  context.showToast?.(result.mode === 'trash' ? '已移到系统废纸篓' : '已永久删除');
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
  context.showToast?.('路径已复制到剪贴板');
}

async function handleProperties(path: string): Promise<void> {
  const info = await stat(path);
  const details = [
    `名称: ${basename(path)}`,
    `路径: ${path}`,
    `类型: ${info.isDirectory ? '文件夹' : info.isFile ? '文件' : '符号链接'}`,
    `大小: ${formatBytes(info.size)}`,
    `创建时间: ${formatDate(info.birthtime)}`,
    `修改时间: ${formatDate(info.mtime)}`,
    `访问时间: ${formatDate(info.atime)}`,
    `只读: ${info.readonly ? '是' : '否'}`,
  ].join('\n');

  await message(details, { title: '属性', kind: 'info' });
}

async function handleRefresh(context: FileActionContext): Promise<void> {
  if (!context.workspaceStore.rootPath) {
    context.showToast?.('当前没有打开的工作区');
    return;
  }

  await refreshWorkspace(context);
  context.showToast?.('文件树已刷新');
}

export async function executeFileAction(
  input: FileActionInput,
  context: FileActionContext,
): Promise<void> {
  const { command, path, name } = parseFileAction(input);

  try {
    switch (command) {
      case 'openFile':
        if (!path) throw new Error('缺少文件路径');
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
        if (!path) throw new Error('缺少重命名路径');
        requestInlineRename(path);
        return;

      case 'commitRename':
        if (!path || name === undefined) throw new Error('缺少重命名参数');
        await handleCommitRename(path, name, context);
        return;

      case 'duplicate':
        if (!path) throw new Error('缺少副本路径');
        await handleDuplicate(path, context);
        return;

      case 'delete':
        if (!path) throw new Error('缺少删除路径');
        await handleDelete(path, context);
        return;

      case 'openRootLocation':
        if (!context.workspaceStore.rootPath) throw new Error('当前没有打开的工作区');
        await openPath(context.workspaceStore.rootPath);
        return;

      case 'openLocation':
        if (!path) throw new Error('缺少打开位置路径');
        await handleOpenLocation(path);
        return;

      case 'copyRootPath':
        if (!context.workspaceStore.rootPath) throw new Error('当前没有打开的工作区');
        await handleCopyPath(context.workspaceStore.rootPath, context);
        return;

      case 'copyPath':
        if (!path) throw new Error('缺少复制路径');
        await handleCopyPath(path, context);
        return;

      case 'properties':
        if (!path) throw new Error('缺少属性路径');
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
        if (!context.workspaceStore.rootPath) throw new Error('当前没有打开的工作区');
        window.dispatchEvent(new CustomEvent('prism-search', {
          detail: { action: 'open', rootPath: context.workspaceStore.rootPath },
        }));
        return;

      default:
        context.showToast?.(getUnsupportedFileActionMessage(command));
    }
  } catch (err) {
    console.error(`[FileAction] ${command} failed:`, err);
    context.showToast?.(`操作失败: ${formatError(err)}`);
  }
}
