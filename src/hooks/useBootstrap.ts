import { useEffect } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { invokeNativeCommand } from '../platform/tauri/nativeCommands';
import { exists } from '../platform/tauri/fileSystem';
import { documentDir } from '../platform/tauri/path';
import { useDocumentStore } from '../domains/document/store';
import { useSettingsStore } from '../domains/settings/store';
import { useWorkspaceStore } from '../domains/workspace/store';
import { loadFolderTree } from '../domains/workspace/lib/loadFolderTree';
import { getRuntimePlatform, joinPath } from '../domains/workspace/services';
import { grantWorkspaceDirectoryScope } from '../lib/fileSystemScope';
import { openDocumentInCurrentWindow, openDocumentInNewWindow } from '../lib/openDocumentFlow';

const MACOS_PENDING_FILE_POLL_DELAYS = [0] as const;
const DEFAULT_PENDING_FILE_POLL_DELAYS = [0] as const;
const DEFAULT_INITIAL_WORKSPACE_NAME = 'Prism';
const DEFAULT_INITIAL_GUIDE_PARTS = ['Examples', 'Prism Markdown 语法指南.md'] as const;

function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function revealCurrentWindow() {
  try {
    await invokeNativeCommand('reveal_current_window');
    return;
  } catch {
    // Fall through to the JS API for browser tests or older development shells.
  }

  try {
    const currentWindow = getCurrentWindow();
    await currentWindow.show();
    await currentWindow.setFocus();
  } catch {
    // Browser tests and non-Tauri previews do not expose a native window.
  }
}

function getDefaultPendingFilePollDelays() {
  return getRuntimePlatform() === 'mac'
    ? MACOS_PENDING_FILE_POLL_DELAYS
    : DEFAULT_PENDING_FILE_POLL_DELAYS;
}

async function getDefaultInitialTarget() {
  const root = joinPath(await documentDir(), DEFAULT_INITIAL_WORKSPACE_NAME);
  const guide = DEFAULT_INITIAL_GUIDE_PARTS.reduce(
    (path, part) => joinPath(path, part),
    root,
  );

  return { guide, root };
}

export interface UseBootstrapOptions {
  enabled?: boolean;
  pendingFilePollDelays?: readonly number[];
  wait?: (ms: number) => Promise<unknown>;
}

function normalizeUseBootstrapInput(input: boolean | UseBootstrapOptions): Required<UseBootstrapOptions> {
  if (typeof input === 'boolean') {
    return {
      enabled: input,
      pendingFilePollDelays: getDefaultPendingFilePollDelays(),
      wait: delay,
    };
  }

  return {
    enabled: input.enabled ?? true,
    pendingFilePollDelays: input.pendingFilePollDelays ?? getDefaultPendingFilePollDelays(),
    wait: input.wait ?? delay,
  };
}

export function useBootstrap(input: boolean | UseBootstrapOptions = true) {
  const {
    enabled,
    pendingFilePollDelays,
    wait,
  } = normalizeUseBootstrapInput(input);
  const currentDocument = useDocumentStore((s) => s.currentDocument);
  const restoreLastSession = useSettingsStore((s) => s.restoreLastSession);
  const lastSession = useSettingsStore((s) => s.lastSession);
  const { setSidebarVisible, setSidebarTab, setWorkspace } = useWorkspaceStore();

  useEffect(() => {
    if (!enabled) return;
    if (currentDocument) {
      void revealCurrentWindow();
      return;
    }

    let cancelled = false;
    const params = new URLSearchParams(window.location.search);
    const filePath = params.get('file');
    const folderPath = params.get('folder');

    const openFile = async (
      path: string,
      restoreViewMode?: 'edit' | 'split' | 'preview',
      restoreScrollState?: { editorRatio: number; previewRatio: number },
      openOptions: { skipFileScopeGrant?: boolean; skipWorkspaceSync?: boolean } = {},
    ) => {
      const result = await openDocumentInCurrentWindow(path, {
        documentStore: useDocumentStore.getState(),
        workspaceStore: useWorkspaceStore.getState(),
      }, {
        confirmLargeDocument: false,
        entryPoint: 'startup',
        restoreScrollState,
        restoreViewMode,
        shouldAbort: () => cancelled || Boolean(useDocumentStore.getState().currentDocument),
        skipFileScopeGrant: openOptions.skipFileScopeGrant,
        skipWorkspaceSync: openOptions.skipWorkspaceSync,
      });
      return result.status !== 'cancelled-large-file';
    };

    const openFolder = async (path: string) => {
      await grantWorkspaceDirectoryScope(path);
      if (!(await exists(path))) return false;
      const tree = await loadFolderTree(path);
      if (cancelled) return true;
      setWorkspace(path, tree);
      return true;
    };

    const openDefaultInitialWorkspace = async () => {
      const target = await getDefaultInitialTarget();
      const openedGuide = await openFile(target.guide, undefined, undefined, {
        skipFileScopeGrant: true,
        skipWorkspaceSync: true,
      });
      if (!openedGuide || cancelled) return openedGuide;

      void openFolder(target.root).catch((err) => {
        console.error('[useBootstrap] Failed to load default Prism workspace tree:', err);
      });
      return true;
    };

    const openPendingStartupFile = async () => {
      const [pendingFiles, pendingWorkspacePath] = await Promise.all([
        invokeNativeCommand<string[]>('get_pending_files'),
        invokeNativeCommand<string | null>('get_pending_workspace_path').catch(() => null),
      ]);
      if (cancelled || useDocumentStore.getState().currentDocument) return true;
      const workspacePath = typeof pendingWorkspacePath === 'string' && pendingWorkspacePath.trim()
        ? pendingWorkspacePath
        : null;
      const openedWorkspace = workspacePath ? await openFolder(workspacePath) : false;
      if (cancelled || useDocumentStore.getState().currentDocument) return true;
      if (pendingFiles.length === 0) return openedWorkspace;

      const [firstFile, ...additionalFiles] = pendingFiles;
      const opened = await openFile(firstFile);
      if (!opened || cancelled) return opened;

      await Promise.all(additionalFiles.map(async (path) => {
        try {
          await openDocumentInNewWindow(path, {
            documentStore: useDocumentStore.getState(),
            workspaceStore: useWorkspaceStore.getState(),
          }, {
            confirmLargeDocument: false,
            entryPoint: 'startup',
          });
        } catch (err) {
          console.error('[useBootstrap] Failed to open additional startup file:', err);
        }
      }));

      return true;
    };

    const openPendingStartupFileBeforeSessionRestore = async () => {
      for (const waitMs of pendingFilePollDelays) {
        if (waitMs > 0) {
          await wait(waitMs);
        }
        if (cancelled || useDocumentStore.getState().currentDocument) return true;

        try {
          if (await openPendingStartupFile()) return true;
        } catch {
          // Pending file integration is best effort.
        }
      }
      return false;
    };

    (async () => {
      try {
        if (filePath) {
          try {
            await openFile(filePath);
          } catch (err) {
            console.error('[useBootstrap] Failed to load file:', err);
          }
          return;
        } else if (folderPath) {
          try {
            await openFolder(folderPath);
          } catch (err) {
            console.error('[useBootstrap] Failed to load folder:', err);
          }
          return;
        }

        if (await openPendingStartupFileBeforeSessionRestore()) return;

        try {
          if (await openDefaultInitialWorkspace()) return;
        } catch (err) {
          console.error('[useBootstrap] Failed to load default Prism workspace:', err);
        }

        if (!restoreLastSession || !lastSession) return;

        try {
          if (lastSession.sidebarVisible !== undefined) setSidebarVisible(lastSession.sidebarVisible);
          if (lastSession.sidebarTab) setSidebarTab(lastSession.sidebarTab);
          if (lastSession.filePath && await openFile(
            lastSession.filePath,
            lastSession.viewMode,
            lastSession.scrollState,
          )) return;
          if (lastSession.folderPath) await openFolder(lastSession.folderPath);
        } catch (err) {
          console.error('[useBootstrap] Failed to restore last session:', err);
        }
      } finally {
        const hasVisibleStartupTarget = Boolean(
          useDocumentStore.getState().currentDocument
          || useWorkspaceStore.getState().rootPath
          || filePath
          || folderPath,
        );
        if (!cancelled && hasVisibleStartupTarget) await revealCurrentWindow();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    enabled,
    lastSession,
    pendingFilePollDelays,
    restoreLastSession,
    setSidebarTab,
    setSidebarVisible,
    setWorkspace,
    wait,
  ]);
}
