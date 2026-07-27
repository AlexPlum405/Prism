import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadFolderTree } from '../lib/loadFolderTree';
import { useWorkspaceStore } from '../store';
import { useWorkspaceFocusRefresh } from './useWorkspaceFocusRefresh';

vi.mock('../lib/loadFolderTree', () => ({
  loadFolderTree: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  useWorkspaceStore.setState({
    mode: 'single',
    rootPath: null,
    fileTree: [],
    fileTreeMode: 'tree',
    fileSortMode: 'name',
    workspaceTreeScope: 'currentLevel',
    sidebarVisible: true,
    sidebarTab: 'files',
    focusMode: false,
    statusBarVisible: true,
    typewriterMode: false,
    isFullscreen: false,
    isAlwaysOnTop: false,
  });
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    value: 'visible',
  });
});

describe('useWorkspaceFocusRefresh', () => {
  it('refreshes the current workspace when the window regains focus', async () => {
    useWorkspaceStore.getState().setRootPath('/workspace');
    (loadFolderTree as ReturnType<typeof vi.fn>).mockResolvedValue([
      { name: 'note.md', path: '/workspace/note.md', isDirectory: false },
    ]);

    renderHook(() => useWorkspaceFocusRefresh(true));

    await act(async () => {
      window.dispatchEvent(new Event('focus'));
      await Promise.resolve();
    });

    expect(loadFolderTree).toHaveBeenCalledWith('/workspace', { scope: 'currentLevel' });
    expect(useWorkspaceStore.getState().fileTree).toEqual([
      { name: 'note.md', path: '/workspace/note.md', isDirectory: false },
    ]);
  });

  it('does not refresh when no workspace is open', async () => {
    renderHook(() => useWorkspaceFocusRefresh(true));

    await act(async () => {
      window.dispatchEvent(new Event('focus'));
      await Promise.resolve();
    });

    expect(loadFolderTree).not.toHaveBeenCalled();
  });

  it('ignores stale focus refresh results after the root path changes', async () => {
    useWorkspaceStore.getState().setRootPath('/old');
    let resolveTree: (value: unknown) => void = () => {};
    (loadFolderTree as ReturnType<typeof vi.fn>).mockImplementation(
      () => new Promise((resolve) => {
        resolveTree = resolve;
      }),
    );

    renderHook(() => useWorkspaceFocusRefresh(true));

    await act(async () => {
      window.dispatchEvent(new Event('focus'));
      useWorkspaceStore.getState().setRootPath('/new');
      resolveTree([{ name: 'old.md', path: '/old/old.md', isDirectory: false }]);
      await Promise.resolve();
    });

    expect(loadFolderTree).toHaveBeenCalledWith('/old', { scope: 'currentLevel' });
    expect(useWorkspaceStore.getState().fileTree).toEqual([]);
  });

  it('refreshes when the document becomes visible again', async () => {
    useWorkspaceStore.getState().setRootPath('/workspace');
    (loadFolderTree as ReturnType<typeof vi.fn>).mockResolvedValue([
      { name: 'visible.md', path: '/workspace/visible.md', isDirectory: false },
    ]);
    renderHook(() => useWorkspaceFocusRefresh(true));

    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
      await Promise.resolve();
    });

    expect(loadFolderTree).toHaveBeenCalledWith('/workspace', { scope: 'currentLevel' });
    expect(useWorkspaceStore.getState().fileTree).toEqual([
      { name: 'visible.md', path: '/workspace/visible.md', isDirectory: false },
    ]);
  });

  it('uses the recursive scope when focus refreshing recursive workspace trees', async () => {
    useWorkspaceStore.getState().setRootPath('/workspace');
    useWorkspaceStore.getState().setWorkspaceTreeScope('recursive');
    (loadFolderTree as ReturnType<typeof vi.fn>).mockResolvedValue([
      { name: 'nested.md', path: '/workspace/docs/nested.md', isDirectory: false },
    ]);

    renderHook(() => useWorkspaceFocusRefresh(true));

    await act(async () => {
      window.dispatchEvent(new Event('focus'));
      await Promise.resolve();
    });

    expect(loadFolderTree).toHaveBeenCalledWith('/workspace', { scope: 'recursive' });
  });
});
