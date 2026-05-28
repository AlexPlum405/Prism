import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppCommandContext } from './useAppCommandContext';
import { useAppCommandWiringModel } from './useAppCommandWiringModel';
import { useAppShortcuts } from './useAppShortcuts';

vi.mock('./useAppCommandContext', () => ({
  useAppCommandContext: vi.fn(),
}));

vi.mock('./useAppShortcuts', () => ({
  useAppShortcuts: vi.fn(),
}));

function createInput(overrides: Partial<Parameters<typeof useAppCommandWiringModel>[0]> = {}) {
  return {
    closeAbout: vi.fn(),
    contentTheme: 'miaoyan',
    currentDocument: null,
    exportDefaults: {},
    focusMode: false,
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
    toggleFocusMode: vi.fn(),
    wordWrap: true,
    workspace: {},
    workspaceIndex: null,
    ...overrides,
  } as Parameters<typeof useAppCommandWiringModel>[0];
}

describe('useAppCommandWiringModel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAppCommandContext).mockReturnValue({
      commandContext: {} as never,
      createCommandContext: vi.fn(() => ({} as never)),
      handleCommandAction: vi.fn(),
      menuSections: {},
    });
  });

  it('wires command context into app shortcuts', () => {
    const input = createInput();
    const { result } = renderHook(() => useAppCommandWiringModel(input));

    expect(useAppShortcuts).toHaveBeenCalledWith({
      createCommandContext: result.current.createCommandContext,
      focusMode: false,
      toggleFocusMode: input.toggleFocusMode,
    });
  });

  it('closes the about modal before running check update', () => {
    const handleCommandAction = vi.fn();
    vi.mocked(useAppCommandContext).mockReturnValue({
      commandContext: {} as never,
      createCommandContext: vi.fn(() => ({} as never)),
      handleCommandAction,
      menuSections: {},
    });
    const input = createInput();
    const { result } = renderHook(() => useAppCommandWiringModel(input));

    result.current.handleAboutCheckUpdate();

    expect(input.closeAbout).toHaveBeenCalledTimes(1);
    expect(handleCommandAction).toHaveBeenCalledWith('checkUpdate');
  });
});
