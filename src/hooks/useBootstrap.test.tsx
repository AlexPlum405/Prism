import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useDocumentStore } from '../domains/document/store';
import { useWorkspaceStore } from '../domains/workspace/store';
import { useSettingsStore } from '../domains/settings/store';

vi.mock('@tauri-apps/plugin-fs', () => ({
  readTextFile: vi.fn(),
  exists: vi.fn(),
  stat: vi.fn(),
}));

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

vi.mock('../domains/workspace/lib/loadFolderTree', () => ({
  loadFolderTree: vi.fn(),
}));

vi.mock('../lib/openWindow', () => ({
  openPrismWindow: vi.fn(),
}));

import { invoke } from '@tauri-apps/api/core';
import { exists, readTextFile, stat } from '@tauri-apps/plugin-fs';
import { loadFolderTree } from '../domains/workspace/lib/loadFolderTree';
import { openPrismWindow } from '../lib/openWindow';
import { useBootstrap } from './useBootstrap';

beforeEach(() => {
  useDocumentStore.setState({ currentDocument: null });
  useWorkspaceStore.setState({ fileTree: [], rootPath: null });
  useSettingsStore.setState({
    restoreLastSession: true,
    lastSession: null,
    recentFiles: [],
    saveSettings: vi.fn(),
  });
  window.history.replaceState({}, '', '?file=C:/docs/bootstrap.md');
  vi.clearAllMocks();
  (exists as ReturnType<typeof vi.fn>).mockResolvedValue(true);
  (stat as ReturnType<typeof vi.fn>).mockResolvedValue({ size: 12, mtime: new Date(1000) });
  (invoke as ReturnType<typeof vi.fn>).mockResolvedValue([]);
});

describe('useBootstrap', () => {
  it('does not overwrite a user-selected document when bootstrap finishes late', async () => {
    let resolveRead!: (v: string) => void;
    (readTextFile as ReturnType<typeof vi.fn>).mockReturnValue(
      new Promise<string>((res) => { resolveRead = res; })
    );

    renderHook(() => useBootstrap());

    act(() => {
      useDocumentStore.getState().openDocument('C:/docs/user-file.md', 'user-file.md', 'user content');
    });

    await act(async () => {
      resolveRead('bootstrap content');
      await Promise.resolve();
    });

    const doc = useDocumentStore.getState().currentDocument;
    expect(doc?.path).toBe('C:/docs/user-file.md');
    expect(doc?.content).toBe('user content');
  });

  it('loads file tree after opening the bootstrap file', async () => {
    const mockTree = [{ name: 'test.md', path: 'C:/docs/test.md' }];
    let resolveTree!: (value: typeof mockTree) => void;

    (readTextFile as ReturnType<typeof vi.fn>).mockResolvedValue('file content');
    (loadFolderTree as ReturnType<typeof vi.fn>).mockReturnValue(
      new Promise<typeof mockTree>((res) => {
        resolveTree = res;
      })
    );

    renderHook(() => useBootstrap());

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(useWorkspaceStore.getState().rootPath).toBeNull();
    expect(useWorkspaceStore.getState().fileTree).toEqual([]);

    await act(async () => {
      resolveTree(mockTree);
      await Promise.resolve();
      await Promise.resolve();
    });

    const ws = useWorkspaceStore.getState();
    expect(ws.rootPath).toBe('C:/docs');
    expect(ws.fileTree).toEqual(mockTree);
  });

  it('does not bootstrap before settings are loaded', async () => {
    (readTextFile as ReturnType<typeof vi.fn>).mockResolvedValue('file content');

    const { rerender } = renderHook(
      ({ enabled }) => useBootstrap(enabled),
      { initialProps: { enabled: false } },
    );

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(readTextFile).not.toHaveBeenCalled();

    rerender({ enabled: true });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(readTextFile).toHaveBeenCalledWith('C:/docs/bootstrap.md');
  });

  it('does not require a pre-grant fs exists check before opening an explicit file', async () => {
    const explicitPath = 'C:/external/妙言 Markdown 语法指南.md';
    window.history.replaceState({}, '', `/?file=${encodeURIComponent(explicitPath)}`);
    (exists as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('path not allowed'));
    (readTextFile as ReturnType<typeof vi.fn>).mockResolvedValue('# external content');
    (loadFolderTree as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    renderHook(() => useBootstrap(true));

    await waitFor(() => {
      expect(useDocumentStore.getState().currentDocument?.path).toBe(explicitPath);
    });

    expect(useDocumentStore.getState().currentDocument?.content).toBe('# external content');
    expect(exists).not.toHaveBeenCalledWith(explicitPath);
  });

  it('opens pending files before last session once bootstrap is enabled', async () => {
    window.history.replaceState({}, '', '/');
    useSettingsStore.setState({
      restoreLastSession: true,
      lastSession: {
        filePath: 'C:/docs/last.md',
        viewMode: 'preview',
        updatedAt: 1,
      },
      recentFiles: [],
      saveSettings: vi.fn(),
    });

    (invoke as ReturnType<typeof vi.fn>).mockImplementation(async (command: string) => {
      if (command === 'get_pending_files') return ['C:/docs/opened.md'];
      return undefined;
    });
    (readTextFile as ReturnType<typeof vi.fn>).mockImplementation(async (path: string) => {
      return path.endsWith('opened.md') ? 'opened content' : 'last session content';
    });
    (loadFolderTree as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    renderHook(() => useBootstrap(true));

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const doc = useDocumentStore.getState().currentDocument;
    expect(doc?.path).toBe('C:/docs/opened.md');
    expect(doc?.content).toBe('opened content');
  });

  it('opens additional pending startup files in new windows', async () => {
    window.history.replaceState({}, '', '/');
    (invoke as ReturnType<typeof vi.fn>).mockImplementation(async (command: string) => {
      if (command === 'get_pending_files') {
        return [
          'C:/docs/first.sql',
          'C:/docs/second file.json',
          'C:/docs/第三.markdown',
        ];
      }
      return undefined;
    });
    (readTextFile as ReturnType<typeof vi.fn>).mockResolvedValue('first content');
    (loadFolderTree as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    renderHook(() => useBootstrap(true));

    await waitFor(() => {
      expect(useDocumentStore.getState().currentDocument?.path).toBe('C:/docs/first.sql');
    });

    expect(useDocumentStore.getState().currentDocument?.content).toBe('first content');
    expect(useDocumentStore.getState().currentDocument?.profile?.kind).toBe('text');
    expect(openPrismWindow).toHaveBeenCalledWith({ filePath: 'C:/docs/second file.json' });
    expect(openPrismWindow).toHaveBeenCalledWith({ filePath: 'C:/docs/第三.markdown' });
  });

  it('opens encoded explicit supported document paths before pending files and last session', async () => {
    const explicitPath = 'C:/docs/中文 文档.json';
    window.history.replaceState({}, '', `/?file=${encodeURIComponent(explicitPath)}`);
    useSettingsStore.setState({
      restoreLastSession: true,
      lastSession: {
        filePath: 'C:/docs/last.md',
        viewMode: 'preview',
        updatedAt: 1,
      },
      recentFiles: [],
      saveSettings: vi.fn(),
    });
    (invoke as ReturnType<typeof vi.fn>).mockResolvedValue(['C:/docs/opened.md']);
    (readTextFile as ReturnType<typeof vi.fn>).mockImplementation(async (path: string) => (
      path === explicitPath ? 'explicit content' : 'unexpected content'
    ));
    (loadFolderTree as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    renderHook(() => useBootstrap(true));

    await waitFor(() => {
      expect(useDocumentStore.getState().currentDocument?.path).toBe(explicitPath);
    });

    expect(useDocumentStore.getState().currentDocument?.content).toBe('explicit content');
    expect(useDocumentStore.getState().currentDocument?.profile?.kind).toBe('text');
    expect(readTextFile).not.toHaveBeenCalledWith('C:/docs/last.md');
    expect(invoke).not.toHaveBeenCalledWith('get_pending_files');
    expect(openPrismWindow).not.toHaveBeenCalled();
  });

  it('waits for delayed pending startup files before restoring the last session', async () => {
    window.history.replaceState({}, '', '/');
    const wait = vi.fn(async () => undefined);
    useSettingsStore.setState({
      restoreLastSession: true,
      lastSession: {
        filePath: 'C:/docs/last.md',
        viewMode: 'preview',
        updatedAt: 1,
      },
      recentFiles: [],
      saveSettings: vi.fn(),
    });

    let pendingPollCount = 0;
    (invoke as ReturnType<typeof vi.fn>).mockImplementation(async (command: string) => {
      if (command === 'get_pending_files') {
        pendingPollCount += 1;
        return pendingPollCount === 1 ? [] : ['C:/docs/opened.md'];
      }
      return undefined;
    });
    (readTextFile as ReturnType<typeof vi.fn>).mockImplementation(async (path: string) => (
      path.endsWith('opened.md') ? 'opened content' : 'last session content'
    ));
    (loadFolderTree as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    renderHook(() => useBootstrap({
      enabled: true,
      pendingFilePollDelays: [0, 200],
      wait,
    }));

    await waitFor(() => {
      expect(useDocumentStore.getState().currentDocument?.path).toBe('C:/docs/opened.md');
    });
    expect(useDocumentStore.getState().currentDocument?.content).toBe('opened content');
    expect(readTextFile).not.toHaveBeenCalledWith('C:/docs/last.md');
    expect(wait).toHaveBeenCalledWith(200);
  });

  it('creates a blank document for explicit new windows without restoring last session', async () => {
    window.history.replaceState({}, '', '/?new=1');
    useSettingsStore.setState({
      restoreLastSession: true,
      lastSession: {
        filePath: 'C:/docs/last.md',
        viewMode: 'preview',
        updatedAt: 1,
      },
      recentFiles: [],
      saveSettings: vi.fn(),
    });
    (invoke as ReturnType<typeof vi.fn>).mockResolvedValue(['C:/docs/opened.md']);
    (readTextFile as ReturnType<typeof vi.fn>).mockResolvedValue('should not load');

    renderHook(() => useBootstrap(true));

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const doc = useDocumentStore.getState().currentDocument;
    expect(doc).toMatchObject({
      path: '',
      name: 'Untitled.md',
      content: '',
      isDirty: false,
    });
    expect(invoke).not.toHaveBeenCalledWith('get_pending_files');
    expect(readTextFile).not.toHaveBeenCalled();
  });

  it('keeps explicit empty windows empty without restoring last session', async () => {
    window.history.replaceState({}, '', '/?empty=1');
    useSettingsStore.setState({
      restoreLastSession: true,
      lastSession: {
        filePath: 'C:/docs/last.md',
        viewMode: 'preview',
        updatedAt: 1,
      },
      recentFiles: [],
      saveSettings: vi.fn(),
    });
    (invoke as ReturnType<typeof vi.fn>).mockResolvedValue(['C:/docs/opened.md']);
    (readTextFile as ReturnType<typeof vi.fn>).mockResolvedValue('should not load');

    renderHook(() => useBootstrap(true));

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(useDocumentStore.getState().currentDocument).toBeNull();
    expect(invoke).not.toHaveBeenCalledWith('get_pending_files');
    expect(readTextFile).not.toHaveBeenCalled();
  });

  it('restores last session view mode and scroll state when no explicit file is requested', async () => {
    window.history.replaceState({}, '', '/');
    useSettingsStore.setState({
      restoreLastSession: true,
      lastSession: {
        filePath: 'C:/docs/last.md',
        viewMode: 'split',
        scrollState: { editorRatio: 0.35, previewRatio: 0.6 },
        updatedAt: 1,
      },
      recentFiles: [],
      saveSettings: vi.fn(),
    });
    (readTextFile as ReturnType<typeof vi.fn>).mockResolvedValue('last session content');
    (loadFolderTree as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    renderHook(() => useBootstrap(true));

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(useDocumentStore.getState().currentDocument).toMatchObject({
      path: 'C:/docs/last.md',
      viewMode: 'split',
      scrollState: { editorRatio: 0.35, previewRatio: 0.6 },
    });
  });
});
