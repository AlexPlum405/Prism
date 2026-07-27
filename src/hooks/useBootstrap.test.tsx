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

const showWindowMock = vi.hoisted(() => vi.fn(async () => undefined));
const focusWindowMock = vi.hoisted(() => vi.fn(async () => undefined));

vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({
    setFocus: focusWindowMock,
    show: showWindowMock,
  }),
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

function nativeCommandCallCount(commandName: string) {
  return (invoke as ReturnType<typeof vi.fn>).mock.calls
    .filter(([command]) => command === commandName)
    .length;
}

function revealWindowCallCount() {
  return nativeCommandCallCount('reveal_current_window');
}

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

  it('reveals the native window when a startup listener already opened the document before bootstrap runs', async () => {
    window.history.replaceState({}, '', '/');
    useDocumentStore.getState().openDocument('C:/docs/from-system.json', 'from-system.json', '{"ok":true}');

    renderHook(() => useBootstrap(true));

    await waitFor(() => {
      expect(revealWindowCallCount()).toBe(1);
    });
    expect(readTextFile).not.toHaveBeenCalled();
    expect(useDocumentStore.getState().currentDocument?.profile?.kind).toBe('text');
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

  it('opens the pending initial workspace before the pending default guide file', async () => {
    window.history.replaceState({}, '', '/');
    const workspacePath = 'C:/Users/Alex/Documents/Prism';
    const guidePath = `${workspacePath}/Examples/Prism Markdown 语法指南.md`;
    const workspaceTree = [
      {
        name: 'Examples',
        path: `${workspacePath}/Examples`,
        children: [
          { name: 'Prism Markdown 语法指南.md', path: guidePath },
        ],
      },
    ];

    (invoke as ReturnType<typeof vi.fn>).mockImplementation(async (command: string) => {
      if (command === 'get_pending_files') return [guidePath];
      if (command === 'get_pending_workspace_path') return workspacePath;
      return undefined;
    });
    (readTextFile as ReturnType<typeof vi.fn>).mockResolvedValue('# guide content');
    (loadFolderTree as ReturnType<typeof vi.fn>).mockResolvedValue(workspaceTree);

    renderHook(() => useBootstrap(true));

    await waitFor(() => {
      expect(useDocumentStore.getState().currentDocument?.path).toBe(guidePath);
    });

    expect(useDocumentStore.getState().currentDocument?.content).toBe('# guide content');
    expect(loadFolderTree).toHaveBeenCalledWith(workspacePath);
    expect(useWorkspaceStore.getState().rootPath).toBe(workspacePath);
    expect(useWorkspaceStore.getState().fileTree).toEqual(workspaceTree);
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

  it('opens encoded explicit workspace folder before an explicit document when both are provided', async () => {
    const explicitFolder = 'C:/Users/Alex/Documents/Prism';
    const explicitPath = `${explicitFolder}/Examples/Prism Markdown 语法指南.md`;
    const explicitTree = [
      {
        name: 'Examples',
        path: `${explicitFolder}/Examples`,
        children: [
          { name: 'Prism Markdown 语法指南.md', path: explicitPath },
        ],
      },
    ];
    window.history.replaceState(
      {},
      '',
      `/?file=${encodeURIComponent(explicitPath)}&folder=${encodeURIComponent(explicitFolder)}`,
    );
    (invoke as ReturnType<typeof vi.fn>).mockResolvedValue(['C:/docs/opened.md']);
    (readTextFile as ReturnType<typeof vi.fn>).mockResolvedValue('# guide');
    (loadFolderTree as ReturnType<typeof vi.fn>).mockResolvedValue(explicitTree);

    renderHook(() => useBootstrap(true));

    await waitFor(() => {
      expect(useDocumentStore.getState().currentDocument?.path).toBe(explicitPath);
    });

    expect(useWorkspaceStore.getState().rootPath).toBe(explicitFolder);
    expect(useWorkspaceStore.getState().fileTree).toEqual(explicitTree);
    expect(loadFolderTree).toHaveBeenCalledWith(explicitFolder);
    expect(readTextFile).toHaveBeenCalledWith(explicitPath);
    expect(nativeCommandCallCount('grant_workspace_directory_scope')).toBe(1);
    expect(nativeCommandCallCount('grant_markdown_file_scope')).toBe(0);
    expect(invoke).not.toHaveBeenCalledWith('get_pending_files');
    expect(openPrismWindow).not.toHaveBeenCalled();
    expect(revealWindowCallCount()).toBe(1);
  });

  it('opens encoded explicit workspace folders before pending files and last session', async () => {
    const explicitFolder = 'C:/Users/Alex/Documents/Prism 测试';
    const explicitTree = [
      {
        name: 'Examples',
        path: `${explicitFolder}/Examples`,
        children: [
          { name: 'Prism Markdown 语法指南.md', path: `${explicitFolder}/Examples/Prism Markdown 语法指南.md` },
        ],
      },
    ];
    window.history.replaceState({}, '', `/?folder=${encodeURIComponent(explicitFolder)}`);
    useSettingsStore.setState({
      restoreLastSession: true,
      lastSession: {
        filePath: 'C:/docs/last.md',
        folderPath: 'C:/docs/last-workspace',
        viewMode: 'preview',
        updatedAt: 1,
      },
      recentFiles: [],
      saveSettings: vi.fn(),
    });
    (invoke as ReturnType<typeof vi.fn>).mockResolvedValue(['C:/docs/opened.md']);
    (loadFolderTree as ReturnType<typeof vi.fn>).mockResolvedValue(explicitTree);

    renderHook(() => useBootstrap(true));

    await waitFor(() => {
      expect(useWorkspaceStore.getState().rootPath).toBe(explicitFolder);
    });

    expect(useWorkspaceStore.getState().fileTree).toEqual(explicitTree);
    expect(loadFolderTree).toHaveBeenCalledWith(explicitFolder);
    expect(nativeCommandCallCount('grant_workspace_directory_scope')).toBe(1);
    expect(readTextFile).not.toHaveBeenCalledWith('C:/docs/last.md');
    expect(invoke).not.toHaveBeenCalledWith('get_pending_files');
    expect(openPrismWindow).not.toHaveBeenCalled();
    expect(revealWindowCallCount()).toBe(1);
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

  it('waits for delayed pending startup files by default on macOS', async () => {
    const originalPlatform = window.navigator.platform;
    Object.defineProperty(window.navigator, 'platform', {
      configurable: true,
      value: 'MacIntel',
    });

    try {
      window.history.replaceState({}, '', '/');
      const wait = vi.fn(async () => undefined);
      let pendingPollCount = 0;
      (invoke as ReturnType<typeof vi.fn>).mockImplementation(async (command: string) => {
        if (command === 'get_pending_files') {
          pendingPollCount += 1;
          return pendingPollCount === 1 ? [] : ['C:/docs/from-finder.md'];
        }
        return undefined;
      });
      (readTextFile as ReturnType<typeof vi.fn>).mockImplementation(async (path: string) => (
        path.endsWith('from-finder.md') ? '# from Finder' : '# guide'
      ));
      (loadFolderTree as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      renderHook(() => useBootstrap({
        enabled: true,
        wait,
      }));

      await waitFor(() => {
        expect(useDocumentStore.getState().currentDocument?.path).toBe('C:/docs/from-finder.md');
      });

      expect(wait).toHaveBeenCalledWith(200);
      expect(readTextFile).not.toHaveBeenCalledWith('C:/Users/Alex/Documents/Prism/Examples/Prism Markdown 语法指南.md');
    } finally {
      Object.defineProperty(window.navigator, 'platform', {
        configurable: true,
        value: originalPlatform,
      });
    }
  });

  it('restores the last session for plain window launches after pending files are checked', async () => {
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
    (invoke as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (readTextFile as ReturnType<typeof vi.fn>).mockResolvedValue('# last session');
    (loadFolderTree as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    renderHook(() => useBootstrap(true));

    await waitFor(() => {
      expect(useDocumentStore.getState().currentDocument?.path).toBe('C:/docs/last.md');
    });

    expect(readTextFile).toHaveBeenCalledWith('C:/docs/last.md');
    expect(nativeCommandCallCount('grant_markdown_file_scope')).toBe(1);
    expect(revealWindowCallCount()).toBe(1);
  });

  it('does not open the default guide for a plain window launch without a session', async () => {
    window.history.replaceState({}, '', '/');
    useSettingsStore.setState({
      restoreLastSession: true,
      lastSession: null,
      recentFiles: [],
      saveSettings: vi.fn(),
    });

    (invoke as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    renderHook(() => useBootstrap(true));

    await act(async () => {
      await Promise.resolve();
    });

    expect(readTextFile).not.toHaveBeenCalled();
    expect(useDocumentStore.getState().currentDocument).toBeNull();
  });
});
