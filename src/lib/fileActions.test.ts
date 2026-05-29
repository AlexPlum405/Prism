import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readTextFile, stat, writeTextFile } from '@tauri-apps/plugin-fs';
import { openPath, revealItemInDir } from '@tauri-apps/plugin-opener';
import { useDocumentStore } from '../domains/document/store';
import { useWorkspaceStore } from '../domains/workspace/store';
import { loadFolderTree } from '../domains/workspace/lib/loadFolderTree';
import { deletePathWithTrashFallback, executeFileAction } from './fileActions';

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
    mode: 'single',
    rootPath: null,
    sidebarTab: 'files',
    sidebarVisible: true,
  });
  (readTextFile as ReturnType<typeof vi.fn>).mockResolvedValue('# Opened from Finder');
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
  });

  it('refreshes the current workspace when the Finder-opened file is missing from the tree', async () => {
    useWorkspaceStore.setState({
      fileTree: [{ kind: 'file', name: 'index.md', path: '/repo/index.md' }],
      mode: 'folder',
      rootPath: '/repo',
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
    expect(loadFolderTree).toHaveBeenCalledWith('/repo');
    expect(useWorkspaceStore.getState().fileTree).toEqual([
      {
        kind: 'directory',
        name: 'docs',
        path: '/repo/docs',
        children: [{ kind: 'file', name: 'opened.md', path: '/repo/docs/opened.md' }],
      },
    ]);
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
