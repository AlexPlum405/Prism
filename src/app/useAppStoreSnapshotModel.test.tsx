import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useDocumentStore } from '../domains/document/store';
import { DEFAULT_SETTINGS } from '../domains/settings/types';
import { useSettingsStore } from '../domains/settings/store';
import { useWorkspaceStore } from '../domains/workspace/store';
import { useAppStoreSnapshotModel } from './useAppStoreSnapshotModel';

describe('useAppStoreSnapshotModel', () => {
  beforeEach(() => {
    useDocumentStore.setState({ currentDocument: null });
    useSettingsStore.setState({
      ...DEFAULT_SETTINGS,
      loadSettings: vi.fn().mockResolvedValue(undefined),
      saveSettings: vi.fn().mockResolvedValue(undefined),
      themeRegistryVersion: 0,
      themeRegistry: [],
    });
    useWorkspaceStore.setState({
      mode: 'single',
      rootPath: null,
      fileTree: [],
      fileTreeMode: 'tree',
      fileSortMode: 'name',
      sidebarVisible: true,
      sidebarTab: 'files',
      focusMode: false,
      statusBarVisible: true,
      typewriterMode: false,
      isFullscreen: false,
      isAlwaysOnTop: false,
    });
  });

  it('collects document, settings, workspace, and title state for App', () => {
    useDocumentStore.getState().createNewDocument('content', 'Draft.md');
    useSettingsStore.setState({
      wordWrap: false,
      themeRegistryVersion: 3,
      recentFiles: [{ path: '/workspace/Draft.md', name: 'Draft.md', lastOpened: 1 }],
    });
    useWorkspaceStore.setState({ rootPath: '/workspace' });

    const { result } = renderHook(() => useAppStoreSnapshotModel());

    expect(result.current.currentDocument?.name).toBe('Draft.md');
    expect(result.current.titleDocName).toBe('Draft.md');
    expect(result.current.titleDirty).toBe(true);
    expect(result.current.settings.wordWrap).toBe(false);
    expect(result.current.settings.themeRegistryVersion).toBe(3);
    expect(result.current.settings.recentFiles).toHaveLength(1);
    expect(result.current.workspace.rootPath).toBe('/workspace');
  });
});
