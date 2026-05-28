import { useEffect, useState } from 'react';
import { useAutoSave } from '../domains/document/hooks/useAutoSave';
import { useExternalFileChangeMonitor } from '../domains/document/hooks/useExternalFileChangeMonitor';
import { useDocumentStore } from '../domains/document/store';
import type { OpenDocument } from '../domains/document/types';
import { useSettingsStore } from '../domains/settings/store';
import { useWorkspaceFocusRefresh } from '../domains/workspace/hooks/useWorkspaceFocusRefresh';
import { useWorkspaceStore } from '../domains/workspace/store';
import type { SidebarTab } from '../domains/workspace/types';
import { getRuntimePlatform } from '../domains/workspace/services';
import { useBootstrap } from '../hooks/useBootstrap';

interface AppLifecycleInput {
  autoSaveEnabled: boolean;
  autoSaveInterval: number;
  currentDocument: OpenDocument | null;
  loadSettings: () => Promise<void>;
  workspace: {
    focusMode: boolean;
    rootPath: string | null;
    sidebarTab: SidebarTab;
    sidebarVisible: boolean;
    typewriterMode: boolean;
  };
}

export function useAppLifecycleModel({
  autoSaveEnabled,
  autoSaveInterval,
  currentDocument,
  loadSettings,
  workspace,
}: AppLifecycleInput) {
  const [settingsReady, setSettingsReady] = useState(false);

  useBootstrap(settingsReady);
  useAutoSave(autoSaveInterval, autoSaveEnabled);
  useExternalFileChangeMonitor();
  useWorkspaceFocusRefresh(settingsReady);

  useEffect(() => {
    const platform = getRuntimePlatform();
    document.documentElement.setAttribute('data-platform', platform);
    document.body.classList.add(`platform-${platform}`);

    return () => {
      if (document.documentElement.getAttribute('data-platform') === platform) {
        document.documentElement.removeAttribute('data-platform');
      }
      document.body.classList.remove(`platform-${platform}`);
    };
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    let changed = false;
    if (currentDocument?.path) {
      if (params.get('file') !== currentDocument.path) {
        params.set('file', currentDocument.path);
        changed = true;
      }
    }
    if (workspace.rootPath) {
      if (params.get('folder') !== workspace.rootPath) {
        params.set('folder', workspace.rootPath);
        changed = true;
      }
    }
    if (changed) {
      const newUrl = `${window.location.pathname}?${params.toString()}`;
      window.history.replaceState({ path: newUrl }, '', newUrl);
    }
  }, [currentDocument?.path, workspace.rootPath]);

  useEffect(() => {
    let cancelled = false;
    setSettingsReady(false);
    loadSettings()
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setSettingsReady(true);
      });

    return () => {
      cancelled = true;
    };
  }, [loadSettings]);

  useEffect(() => {
    document.body.classList.toggle('focus-mode', workspace.focusMode);
  }, [workspace.focusMode]);

  useEffect(() => {
    document.body.classList.toggle('typewriter-mode', workspace.typewriterMode);
  }, [workspace.typewriterMode]);

  useEffect(() => {
    if (!settingsReady) return;

    const timer = window.setTimeout(() => {
      const doc = useDocumentStore.getState().currentDocument;
      const ws = useWorkspaceStore.getState();
      useSettingsStore.getState().setLastSession(
        doc?.path || ws.rootPath
          ? {
              filePath: doc?.path || undefined,
              folderPath: ws.rootPath || undefined,
              viewMode: doc?.viewMode,
              scrollState: doc?.scrollState,
              sidebarVisible: ws.sidebarVisible,
              sidebarTab: ws.sidebarTab,
              updatedAt: Date.now(),
            }
          : null,
      );
    }, 500);

    return () => window.clearTimeout(timer);
  }, [
    currentDocument?.path,
    currentDocument?.scrollState?.editorRatio,
    currentDocument?.scrollState?.previewRatio,
    currentDocument?.viewMode,
    settingsReady,
    workspace.rootPath,
    workspace.sidebarTab,
    workspace.sidebarVisible,
  ]);

  return { settingsReady };
}
