import { beforeEach, describe, expect, it, vi } from 'vitest';
import { exists, readTextFile, remove, rename, stat, writeTextFile } from '@tauri-apps/plugin-fs';
import { invoke } from '@tauri-apps/api/core';
import { ask, confirm, message } from '@tauri-apps/plugin-dialog';
import { openPath, revealItemInDir } from '@tauri-apps/plugin-opener';
import { useDocumentStore } from '../domains/document/store';
import { useWorkspaceStore } from '../domains/workspace/store';
import { loadFolderTree } from '../domains/workspace/lib/loadFolderTree';
import { deletePathWithTrashFallback, executeFileAction } from './fileActions';
import { openPrismWindow } from './openWindow';

vi.mock('@tauri-apps/plugin-fs', () => ({
  copyFile: vi.fn(),
  exists: vi.fn(),
  mkdir: vi.fn(),
  readTextFile: vi.fn(),
  remove: vi.fn(),
  rename: vi.fn(),
  stat: vi.fn(),
  writeTextFile: vi.fn(),
}));

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

vi.mock('@tauri-apps/plugin-dialog', () => ({
  ask: vi.fn(),
  confirm: vi.fn(),
  message: vi.fn(),
}));

vi.mock('@tauri-apps/plugin-opener', () => ({
  openPath: vi.fn(),
  revealItemInDir: vi.fn(),
}));

vi.mock('../domains/workspace/lib/loadFolderTree', () => ({
  loadFolderTree: vi.fn(),
}));

vi.mock('./fileSystemScope', () => ({
  grantMarkdownFileScope: vi.fn(),
  grantWorkspaceDirectoryScope: vi.fn(),
}));

vi.mock('./openWindow', () => ({
  openPrismWindow: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  useDocumentStore.setState({ currentDocument: null });
  useWorkspaceStore.setState({
    fileTree: [],
    fileSortMode: 'name',
    fileTreeMode: 'tree',
    mode: 'single',
    rootPath: null,
    sidebarTab: 'files',
    sidebarVisible: true,
    workspaceTreeScope: 'currentLevel',
  });
  (readTextFile as ReturnType<typeof vi.fn>).mockResolvedValue('# Opened from Finder');
  (ask as ReturnType<typeof vi.fn>).mockResolvedValue(true);
  (stat as ReturnType<typeof vi.fn>).mockResolvedValue({ size: 20, mtimeMs: 1000 });
  (loadFolderTree as ReturnType<typeof vi.fn>).mockResolvedValue([
    { kind: 'file', name: 'opened.md', path: '/new/project/opened.md' },
  ]);
});

function fileActionContext(overrides = {}) {
  return {
    documentStore: useDocumentStore.getState(),
    workspaceStore: useWorkspaceStore.getState(),
    showToast: vi.fn(),
    ...overrides,
  };
}

describe('deletePathWithTrashFallback', () => {
  it('does not delete anything when the initial trash confirmation is cancelled', async () => {
    const confirmDialog = vi.fn().mockResolvedValue(false);
    const moveToTrash = vi.fn();
    const permanentDelete = vi.fn();

    const result = await deletePathWithTrashFallback({
      confirmDialog,
      displayName: 'draft.md',
      isDirectory: false,
      moveToTrash,
      path: '/notes/draft.md',
      permanentDelete,
    });

    expect(result).toEqual({ deleted: false, mode: 'cancelled' });
    expect(confirmDialog).toHaveBeenCalledTimes(1);
    expect(moveToTrash).not.toHaveBeenCalled();
    expect(permanentDelete).not.toHaveBeenCalled();
  });

  it('moves files to system trash before using permanent deletion', async () => {
    const confirmDialog = vi.fn().mockResolvedValue(true);
    const moveToTrash = vi.fn().mockResolvedValue(undefined);
    const permanentDelete = vi.fn();

    const result = await deletePathWithTrashFallback({
      confirmDialog,
      displayName: 'draft.md',
      isDirectory: false,
      moveToTrash,
      path: '/notes/draft.md',
      permanentDelete,
    });

    expect(result).toEqual({ deleted: true, mode: 'trash' });
    expect(confirmDialog).toHaveBeenCalledWith(
      '确定要将“draft.md”移到系统废纸篓吗？',
      expect.objectContaining({ okLabel: '移到废纸篓', title: '移到废纸篓' }),
    );
    expect(moveToTrash).toHaveBeenCalledWith('/notes/draft.md');
    expect(permanentDelete).not.toHaveBeenCalled();
  });

  it('requires a second irreversible confirmation when trash fails', async () => {
    const confirmDialog = vi.fn()
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);
    const moveToTrash = vi.fn().mockRejectedValue(new Error('trash unavailable'));
    const permanentDelete = vi.fn();

    const result = await deletePathWithTrashFallback({
      confirmDialog,
      displayName: 'draft.md',
      isDirectory: false,
      moveToTrash,
      path: '/notes/draft.md',
      permanentDelete,
    });

    expect(result).toEqual({
      deleted: false,
      error: 'trash unavailable',
      mode: 'cancelled',
    });
    expect(confirmDialog).toHaveBeenNthCalledWith(
      2,
      '无法移到系统废纸篓：trash unavailable\n\n是否永久删除“draft.md”？此操作不可撤销。',
      expect.objectContaining({ okLabel: '永久删除', title: '永久删除确认' }),
    );
    expect(permanentDelete).not.toHaveBeenCalled();
  });

  it('keeps permanent deletion behind the fallback confirmation', async () => {
    const confirmDialog = vi.fn()
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(true);
    const moveToTrash = vi.fn().mockRejectedValue('not supported');
    const permanentDelete = vi.fn().mockResolvedValue(undefined);

    const result = await deletePathWithTrashFallback({
      confirmDialog,
      displayName: 'Projects',
      isDirectory: true,
      moveToTrash,
      path: '/notes/Projects',
      permanentDelete,
    });

    expect(result).toEqual({
      deleted: true,
      error: 'not supported',
      mode: 'permanent',
    });
    expect(permanentDelete).toHaveBeenCalledWith('/notes/Projects', { recursive: true });
  });
});

describe('executeFileAction openFile workspace sync', () => {
  it('shows file system properties for a selected path', async () => {
    (stat as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      atime: new Date('2026-06-20T10:00:00Z'),
      birthtime: new Date('2026-06-18T08:30:00Z'),
      isDirectory: false,
      isFile: true,
      mtime: new Date('2026-06-19T09:15:00Z'),
      readonly: false,
      size: 2048,
    });

    await executeFileAction(
      { action: 'properties', path: '/repo/docs/report.md' },
      fileActionContext(),
    );

    expect(message).toHaveBeenCalledWith(
      expect.stringContaining('名称: report.md'),
      expect.objectContaining({ kind: 'info', title: '属性' }),
    );
    const details = (message as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as string;
    expect(details).toContain('路径: /repo/docs/report.md');
    expect(details).toContain('类型: 文件');
    expect(details).toContain('大小: 2.00 KB');
    expect(details).toContain('创建时间:');
    expect(details).toContain('修改时间:');
  });

  it('switches the left file tree when a Finder-opened file is outside the current workspace', async () => {
    useWorkspaceStore.setState({
      fileTree: [{ kind: 'file', name: 'old.md', path: '/old/workspace/old.md' }],
      mode: 'folder',
      rootPath: '/old/workspace',
    });

    await executeFileAction(
      { action: 'openFile', path: '/new/project/opened.md' },
      fileActionContext(),
    );

    expect(useDocumentStore.getState().currentDocument).toMatchObject({
      content: '# Opened from Finder',
      name: 'opened.md',
      path: '/new/project/opened.md',
    });
    expect(useWorkspaceStore.getState().rootPath).toBe('/new/project');
    expect(loadFolderTree).toHaveBeenCalledWith('/new/project');
    expect(useWorkspaceStore.getState().fileTree).toEqual([
      { kind: 'file', name: 'opened.md', path: '/new/project/opened.md' },
    ]);
    expect(invoke).not.toHaveBeenCalledWith('move_path_to_trash', expect.anything());
    expect(remove).not.toHaveBeenCalled();
    expect(rename).not.toHaveBeenCalled();
    expect(writeTextFile).not.toHaveBeenCalled();
  });

  it('switches current-level workspace to the opened file directory when the file is hidden by the current tree', async () => {
    useWorkspaceStore.setState({
      fileTree: [{ kind: 'file', name: 'index.md', path: '/repo/index.md' }],
      mode: 'folder',
      rootPath: '/repo',
    });
    (loadFolderTree as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      { kind: 'file', name: 'opened.md', path: '/repo/docs/opened.md' },
    ]);

    await executeFileAction(
      { action: 'openFile', path: '/repo/docs/opened.md' },
      fileActionContext(),
    );

    expect(useDocumentStore.getState().currentDocument?.path).toBe('/repo/docs/opened.md');
    expect(useWorkspaceStore.getState().rootPath).toBe('/repo/docs');
    expect(loadFolderTree).toHaveBeenCalledWith('/repo/docs');
    expect(useWorkspaceStore.getState().fileTree).toEqual([
      { kind: 'file', name: 'opened.md', path: '/repo/docs/opened.md' },
    ]);
  });

  it('keeps recursive workspace root when the opened file is missing from the current tree', async () => {
    useWorkspaceStore.setState({
      fileTree: [{ kind: 'file', name: 'index.md', path: '/repo/index.md' }],
      mode: 'folder',
      rootPath: '/repo',
      workspaceTreeScope: 'recursive',
    });
    (loadFolderTree as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      {
        kind: 'directory',
        name: 'docs',
        path: '/repo/docs',
        children: [{ kind: 'file', name: 'opened.md', path: '/repo/docs/opened.md' }],
      },
    ]);

    await executeFileAction(
      { action: 'openFile', path: '/repo/docs/opened.md' },
      fileActionContext(),
    );

    expect(useDocumentStore.getState().currentDocument?.path).toBe('/repo/docs/opened.md');
    expect(useWorkspaceStore.getState().rootPath).toBe('/repo');
    expect(loadFolderTree).toHaveBeenCalledWith('/repo', { scope: 'recursive' });
  });

  it('keeps the current workspace without refreshing when the opened file is already visible', async () => {
    useWorkspaceStore.setState({
      fileTree: [{
        kind: 'directory',
        name: 'docs',
        path: '/repo/docs',
        children: [{ kind: 'file', name: 'opened.md', path: '/repo/docs/opened.md' }],
      }],
      mode: 'folder',
      rootPath: '/repo',
    });

    await executeFileAction(
      { action: 'openFile', path: '/repo/docs/opened.md' },
      fileActionContext(),
    );

    expect(useDocumentStore.getState().currentDocument?.path).toBe('/repo/docs/opened.md');
    expect(useWorkspaceStore.getState().rootPath).toBe('/repo');
    expect(loadFolderTree).not.toHaveBeenCalled();
    expect(useWorkspaceStore.getState().fileTree).toEqual([
      {
        kind: 'directory',
        name: 'docs',
        path: '/repo/docs',
        children: [{ kind: 'file', name: 'opened.md', path: '/repo/docs/opened.md' }],
      },
    ]);
  });

  it('does not open a large file when the shared large-file confirmation is cancelled', async () => {
    (stat as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ size: 11 * 1024 * 1024 });
    (ask as ReturnType<typeof vi.fn>).mockResolvedValueOnce(false);

    await executeFileAction(
      { action: 'openFile', path: '/repo/docs/large.md' },
      fileActionContext(),
    );

    expect(ask).toHaveBeenCalledWith(
      '文件大小为 11.00 MB，可能影响性能。是否继续打开？',
      expect.objectContaining({ title: '大文件警告' }),
    );
    expect(readTextFile).not.toHaveBeenCalled();
    expect(useDocumentStore.getState().currentDocument).toBeNull();
  });

  it('rejects unsupported document types before granting or reading the file', async () => {
    const showToast = vi.fn();

    await executeFileAction(
      { action: 'openFile', path: '/repo/docs/app.ts' },
      fileActionContext({ showToast }),
    );

    expect(readTextFile).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith(
      expect.stringContaining('.sql'),
    );
    const message = showToast.mock.calls[0]?.[0] ?? '';
    expect(message).not.toContain('.tsx');
    expect(message).not.toContain('.py');
  });

  it('does not reload the current dirty document when the same file is selected again', async () => {
    useDocumentStore.getState().openDocument('/repo/docs/opened.md', 'opened.md', '# Original', { mtimeMs: 1000, size: 10 });
    useDocumentStore.getState().updateContent('# Unsaved edit');
    useWorkspaceStore.setState({
      fileTree: [{
        kind: 'directory',
        name: 'docs',
        path: '/repo/docs',
        children: [{ kind: 'file', name: 'opened.md', path: '/repo/docs/opened.md' }],
      }],
      mode: 'folder',
      rootPath: '/repo',
    });

    await executeFileAction(
      { action: 'openFile', path: '/repo/docs/opened.md' },
      fileActionContext(),
    );

    expect(readTextFile).not.toHaveBeenCalled();
    expect(useDocumentStore.getState().currentDocument).toMatchObject({
      content: '# Unsaved edit',
      isDirty: true,
      path: '/repo/docs/opened.md',
    });
  });

  it('cancels opening a different file when dirty-document switch is cancelled', async () => {
    const requestDirtyDocumentAction = vi.fn().mockResolvedValue('cancel');
    useDocumentStore.getState().openDocument('/repo/current.md', 'current.md', '# Original', { mtimeMs: 1000, size: 10 });
    useDocumentStore.getState().updateContent('# Unsaved edit');

    await executeFileAction(
      { action: 'openFile', path: '/repo/next.md' },
      fileActionContext({ requestDirtyDocumentAction }),
    );

    expect(requestDirtyDocumentAction).toHaveBeenCalledWith({
      currentName: 'current.md',
      targetName: 'next.md',
      targetPath: '/repo/next.md',
    });
    expect(readTextFile).not.toHaveBeenCalled();
    expect(useDocumentStore.getState().currentDocument?.path).toBe('/repo/current.md');
  });

  it('discards dirty edits before opening a different file when requested', async () => {
    const requestDirtyDocumentAction = vi.fn().mockResolvedValue('discard');
    useDocumentStore.getState().openDocument('/repo/current.md', 'current.md', '# Original', { mtimeMs: 1000, size: 10 });
    useDocumentStore.getState().updateContent('# Unsaved edit');
    (readTextFile as ReturnType<typeof vi.fn>).mockResolvedValueOnce('# Next file');

    await executeFileAction(
      { action: 'openFile', path: '/repo/next.md' },
      fileActionContext({ requestDirtyDocumentAction }),
    );

    expect(writeTextFile).not.toHaveBeenCalled();
    expect(readTextFile).toHaveBeenCalledWith('/repo/next.md');
    expect(useDocumentStore.getState().currentDocument).toMatchObject({
      content: '# Next file',
      isDirty: false,
      path: '/repo/next.md',
    });
  });

  it('saves the dirty current document before opening a different file', async () => {
    const requestDirtyDocumentAction = vi.fn().mockResolvedValue('save');
    useDocumentStore.getState().openDocument('/repo/current.md', 'current.md', '# Original', { mtimeMs: 1000, size: 10 });
    useDocumentStore.getState().updateContent('# Unsaved edit');
    (stat as ReturnType<typeof vi.fn>).mockResolvedValue({ size: 10, mtime: new Date(1000) });
    (readTextFile as ReturnType<typeof vi.fn>).mockResolvedValueOnce('# Next file');

    await executeFileAction(
      { action: 'openFile', path: '/repo/next.md' },
      fileActionContext({ requestDirtyDocumentAction }),
    );

    expect(writeTextFile).toHaveBeenCalledWith('/repo/current.md', '# Unsaved edit');
    expect(readTextFile).toHaveBeenCalledWith('/repo/next.md');
    expect(useDocumentStore.getState().currentDocument).toMatchObject({
      content: '# Next file',
      isDirty: false,
      path: '/repo/next.md',
    });
  });

  it('saves dirty edits to a new path before opening a different file when save as is requested', async () => {
    const requestDirtyDocumentAction = vi.fn().mockResolvedValue('saveAs');
    const requestSavePath = vi.fn().mockResolvedValue('/repo/current-copy.md');
    useDocumentStore.getState().openDocument('/repo/current.md', 'current.md', '# Original', { mtimeMs: 1000, size: 10 });
    useDocumentStore.getState().updateContent('# Unsaved edit');
    (readTextFile as ReturnType<typeof vi.fn>).mockResolvedValueOnce('# Next file');

    await executeFileAction(
      { action: 'openFile', path: '/repo/next.md' },
      fileActionContext({ requestDirtyDocumentAction, requestSavePath }),
    );

    expect(requestSavePath).toHaveBeenCalledWith({
      documentPath: '/repo/current.md',
      filename: 'current.md',
    });
    expect(writeTextFile).toHaveBeenCalledWith('/repo/current-copy.md', '# Unsaved edit');
    expect(readTextFile).toHaveBeenCalledWith('/repo/next.md');
    expect(useDocumentStore.getState().currentDocument).toMatchObject({
      content: '# Next file',
      isDirty: false,
      path: '/repo/next.md',
    });
  });

  it('blocks saving an untitled dirty document over the file being opened', async () => {
    const requestDirtyDocumentAction = vi.fn().mockResolvedValue('save');
    const requestSavePath = vi.fn().mockResolvedValue('/repo/next.md');
    const showToast = vi.fn();
    useDocumentStore.getState().createNewDocument('# Unsaved draft', 'Draft.md');

    await executeFileAction(
      { action: 'openFile', path: '/repo/next.md' },
      fileActionContext({ requestDirtyDocumentAction, requestSavePath, showToast }),
    );

    expect(requestSavePath).toHaveBeenCalledWith({
      documentPath: '',
      filename: 'Draft.md',
    });
    expect(writeTextFile).not.toHaveBeenCalled();
    expect(readTextFile).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith('为保护文件，不能把当前改动保存到正在打开的目标文件。请选择其他位置，或放弃当前改动后再打开。');
    expect(useDocumentStore.getState().currentDocument).toMatchObject({
      content: '# Unsaved draft',
      isDirty: true,
      path: '',
    });
  });

  it('blocks save-as from overwriting the file being opened during dirty document switching', async () => {
    const requestDirtyDocumentAction = vi.fn().mockResolvedValue('saveAs');
    const requestSavePath = vi.fn().mockResolvedValue('/repo/next.md');
    const showToast = vi.fn();
    useDocumentStore.getState().openDocument('/repo/current.md', 'current.md', '# Original', { mtimeMs: 1000, size: 10 });
    useDocumentStore.getState().updateContent('# Unsaved edit');

    await executeFileAction(
      { action: 'openFile', path: '/repo/next.md' },
      fileActionContext({ requestDirtyDocumentAction, requestSavePath, showToast }),
    );

    expect(writeTextFile).not.toHaveBeenCalled();
    expect(readTextFile).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith('为保护文件，不能把当前改动保存到正在打开的目标文件。请选择其他位置，或放弃当前改动后再打开。');
    expect(useDocumentStore.getState().currentDocument).toMatchObject({
      content: '# Unsaved edit',
      isDirty: true,
      path: '/repo/current.md',
    });
  });

  it('keeps the current document when saving before switch detects an external disk change', async () => {
    const requestDirtyDocumentAction = vi.fn().mockResolvedValue('save');
    const showToast = vi.fn();
    useDocumentStore.getState().openDocument('/repo/current.md', 'current.md', '# Original', { mtimeMs: 1000, size: 10 });
    useDocumentStore.getState().updateContent('# Unsaved edit');
    (stat as ReturnType<typeof vi.fn>).mockResolvedValue({ size: 99, mtime: new Date(2000) });

    await executeFileAction(
      { action: 'openFile', path: '/repo/next.md' },
      fileActionContext({ requestDirtyDocumentAction, showToast }),
    );

    expect(writeTextFile).not.toHaveBeenCalled();
    expect(readTextFile).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith('文件已在磁盘上被外部修改，请先重新加载或另存为。');
    expect(useDocumentStore.getState().currentDocument).toMatchObject({
      isDirty: true,
      path: '/repo/current.md',
      saveStatus: 'conflict',
    });
  });

  it('does not recreate a missing current file while saving before switching documents', async () => {
    const requestDirtyDocumentAction = vi.fn().mockResolvedValue('save');
    const showToast = vi.fn();
    useDocumentStore.getState().openDocument('/repo/missing.md', 'missing.md', '# Original', { mtimeMs: 1000, size: 10 });
    useDocumentStore.getState().updateContent('# Unsaved edit');
    (stat as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('No such file or directory (os error 2)'),
    );

    await executeFileAction(
      { action: 'openFile', path: '/repo/next.md' },
      fileActionContext({ requestDirtyDocumentAction, showToast }),
    );

    expect(writeTextFile).not.toHaveBeenCalled();
    expect(readTextFile).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith('原文件不存在：/repo/missing.md');
    expect(useDocumentStore.getState().currentDocument).toMatchObject({
      isDirty: true,
      path: '/repo/missing.md',
      saveStatus: 'conflict',
      saveIssue: 'missing',
    });
  });

  it('moves the currently open file to trash, closes it, and refreshes the workspace', async () => {
    const showToast = vi.fn();
    useDocumentStore.getState().openDocument('/repo/current.md', 'current.md', '# Current', { mtimeMs: 1000, size: 10 });
    useWorkspaceStore.setState({
      fileTree: [{ kind: 'file', name: 'current.md', path: '/repo/current.md' }],
      mode: 'folder',
      rootPath: '/repo',
    });
    (stat as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      isDirectory: false,
      isFile: true,
      size: 10,
      mtime: new Date(1000),
    });
    (confirm as ReturnType<typeof vi.fn>).mockResolvedValueOnce(true);
    (invoke as ReturnType<typeof vi.fn>).mockResolvedValueOnce(undefined);
    (loadFolderTree as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      { kind: 'file', name: 'other.md', path: '/repo/other.md' },
    ]);

    await executeFileAction('delete:/repo/current.md', fileActionContext({ showToast }));

    expect(invoke).toHaveBeenCalledWith('move_path_to_trash', { path: '/repo/current.md' });
    expect(remove).not.toHaveBeenCalled();
    expect(useDocumentStore.getState().currentDocument).toBeNull();
    expect(loadFolderTree).toHaveBeenCalledWith('/repo', { scope: 'currentLevel' });
    expect(useWorkspaceStore.getState().fileTree).toEqual([
      { kind: 'file', name: 'other.md', path: '/repo/other.md' },
    ]);
    expect(showToast).toHaveBeenCalledWith('已移到系统废纸篓');
  });

  it('renames the current document parent folder and updates the open document path', async () => {
    const showToast = vi.fn();
    useDocumentStore.getState().openDocument('/repo/docs/current.md', 'current.md', '# Current', { mtimeMs: 1000, size: 10 });
    useWorkspaceStore.setState({
      fileTree: [{
        kind: 'directory',
        name: 'docs',
        path: '/repo/docs',
        children: [{ kind: 'file', name: 'current.md', path: '/repo/docs/current.md' }],
      }],
      mode: 'folder',
      rootPath: '/repo',
    });
    (stat as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      isDirectory: true,
      isFile: false,
      size: 10,
      mtime: new Date(1000),
    });
    (exists as ReturnType<typeof vi.fn>).mockResolvedValueOnce(false);
    (loadFolderTree as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      {
        kind: 'directory',
        name: 'renamed',
        path: '/repo/renamed',
        children: [{ kind: 'file', name: 'current.md', path: '/repo/renamed/current.md' }],
      },
    ]);

    await executeFileAction(
      { action: 'commitRename', path: '/repo/docs', name: 'renamed' },
      fileActionContext({ showToast }),
    );

    expect(rename).toHaveBeenCalledWith('/repo/docs', '/repo/renamed');
    expect(useDocumentStore.getState().currentDocument).toMatchObject({
      name: 'current.md',
      path: '/repo/renamed/current.md',
    });
    expect(loadFolderTree).toHaveBeenCalledWith('/repo', { scope: 'currentLevel' });
    expect(useWorkspaceStore.getState().fileTree).toEqual([
      {
        kind: 'directory',
        name: 'renamed',
        path: '/repo/renamed',
        children: [{ kind: 'file', name: 'current.md', path: '/repo/renamed/current.md' }],
      },
    ]);
    expect(showToast).toHaveBeenCalledWith('重命名完成');
  });
});

describe('executeFileAction workspace tree scope', () => {
  it('switches to recursive scope and refreshes the current workspace', async () => {
    const showToast = vi.fn();
    const recursiveTree = [{
      kind: 'directory' as const,
      name: 'docs',
      path: '/repo/docs',
      children: [{ kind: 'file' as const, name: 'nested.md', path: '/repo/docs/nested.md' }],
    }];
    useWorkspaceStore.setState({
      fileTree: [{ kind: 'file', name: 'root.md', path: '/repo/root.md' }],
      mode: 'folder',
      rootPath: '/repo',
      workspaceTreeScope: 'currentLevel',
    });
    (loadFolderTree as ReturnType<typeof vi.fn>).mockResolvedValueOnce(recursiveTree);

    await executeFileAction('viewRecursive', fileActionContext({ showToast }));

    expect(useWorkspaceStore.getState().workspaceTreeScope).toBe('recursive');
    expect(loadFolderTree).toHaveBeenCalledWith('/repo', { scope: 'recursive' });
    expect(useWorkspaceStore.getState().fileTree).toEqual(recursiveTree);
    expect(showToast).toHaveBeenCalledWith('已递归显示子目录');
  });

  it('switches back to current-level scope and refreshes only that level', async () => {
    const showToast = vi.fn();
    const currentLevelTree = [{ kind: 'file' as const, name: 'root.md', path: '/repo/root.md' }];
    useWorkspaceStore.setState({
      fileTree: [{
        kind: 'directory',
        name: 'docs',
        path: '/repo/docs',
        children: [{ kind: 'file', name: 'nested.md', path: '/repo/docs/nested.md' }],
      }],
      mode: 'folder',
      rootPath: '/repo',
      workspaceTreeScope: 'recursive',
    });
    (loadFolderTree as ReturnType<typeof vi.fn>).mockResolvedValueOnce(currentLevelTree);

    await executeFileAction('viewCurrentLevel', fileActionContext({ showToast }));

    expect(useWorkspaceStore.getState().workspaceTreeScope).toBe('currentLevel');
    expect(loadFolderTree).toHaveBeenCalledWith('/repo', { scope: 'currentLevel' });
    expect(useWorkspaceStore.getState().fileTree).toEqual(currentLevelTree);
    expect(showToast).toHaveBeenCalledWith('已切换为当前层级');
  });
});

describe('executeFileAction openNewWindow', () => {
  it('opens a default Prism window without pinning the current workspace to an empty folder shell', async () => {
    useWorkspaceStore.setState({
      fileTree: [{ kind: 'file', name: 'current.md', path: '/repo/current.md' }],
      mode: 'folder',
      rootPath: '/repo',
    });

    await executeFileAction('openNewWindow', fileActionContext());

    expect(openPrismWindow).toHaveBeenCalledWith();
  });
});

describe('executeFileAction reveal location', () => {
  it('reveals a file from the file tree context menu', async () => {
    await executeFileAction('openLocation:/notes/draft.md', fileActionContext());

    expect(stat).not.toHaveBeenCalled();
    expect(revealItemInDir).toHaveBeenCalledWith('/notes/draft.md');
    expect(openPath).not.toHaveBeenCalled();
  });

  it('reveals a directory instead of opening it as a default app path', async () => {
    await executeFileAction('openLocation:/Users/Alex/hermes-test/spark/prompt3', fileActionContext());

    expect(stat).not.toHaveBeenCalled();
    expect(revealItemInDir).toHaveBeenCalledWith('/Users/Alex/hermes-test/spark/prompt3');
    expect(openPath).not.toHaveBeenCalled();
  });

  it('reveals the workspace root from the sidebar background menu', async () => {
    useWorkspaceStore.setState({
      fileTree: [],
      mode: 'folder',
      rootPath: '/Users/Alex/hermes-test/spark/prompt3',
    });

    await executeFileAction('openRootLocation', fileActionContext());

    expect(revealItemInDir).toHaveBeenCalledWith('/Users/Alex/hermes-test/spark/prompt3');
    expect(openPath).not.toHaveBeenCalled();
  });
});
