import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { runCommand } from '../domains/commands';
import { listenForNativeCommands } from '../platform/tauri/nativeMenuEvents';
import { useAppCommandContext } from './useAppCommandContext';

vi.mock('../domains/commands', () => ({
  getMenuSections: vi.fn(() => ({})),
  isCommandId: vi.fn(() => true),
  runCommand: vi.fn(),
}));

vi.mock('../platform/tauri/nativeMenuEvents', () => ({
  listenForNativeCommands: vi.fn(),
}));

function createInput(overrides: Partial<Parameters<typeof useAppCommandContext>[0]> = {}) {
  return {
    contentTheme: 'miaoyan',
    currentDocument: null,
    exportDefaults: {},
    handleFileAction: vi.fn(),
    locale: 'zh-CN',
    localePreference: 'system',
    openAbout: vi.fn(),
    openBacklinks: vi.fn(),
    openDocumentLinks: vi.fn(),
    openDocumentProperties: vi.fn(),
    openQuickOpen: vi.fn(),
    openRelationGraph: vi.fn(),
    openSettings: vi.fn(),
    openShortcuts: vi.fn(),
    openWorkspaceSearch: vi.fn(),
    recentFiles: [],
    requestExportPath: vi.fn(),
    requestSavePath: vi.fn(),
    settingsLocale: 'system',
    shortcutStyle: 'auto',
    showToast: vi.fn(),
    themeRegistryVersion: 1,
    wordWrap: true,
    workspace: {
      fileTree: [],
      focusMode: false,
      isAlwaysOnTop: false,
      isFullscreen: false,
      rootPath: null,
      sidebarTab: 'files',
      sidebarVisible: true,
      statusBarVisible: true,
      typewriterMode: false,
    },
    workspaceIndex: null,
    ...overrides,
  } as Parameters<typeof useAppCommandContext>[0];
}

describe('useAppCommandContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('routes native menu command events through the command registry', async () => {
    let nativeHandler: ((action: string) => void | Promise<void>) | null = null;
    const unlisten = vi.fn();
    vi.mocked(listenForNativeCommands).mockImplementation(async (handler) => {
      nativeHandler = handler;
      return unlisten;
    });

    const { unmount } = renderHook(() => useAppCommandContext(createInput()));

    await act(async () => {
      await Promise.resolve();
    });
    await act(async () => {
      await nativeHandler?.('save');
    });

    expect(runCommand).toHaveBeenCalledWith('save', expect.any(Object));

    unmount();
    expect(unlisten).toHaveBeenCalledTimes(1);
  });
});
