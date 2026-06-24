import { useEffect } from 'react';
import { invokeNativeCommand } from '../platform/tauri/nativeCommands';
import { exists } from '../platform/tauri/fileSystem';
import { useDocumentStore } from '../domains/document/store';
import { useSettingsStore } from '../domains/settings/store';
import { useWorkspaceStore } from '../domains/workspace/store';
import { loadFolderTree } from '../domains/workspace/lib/loadFolderTree';
import { getRuntimePlatform } from '../domains/workspace/services';
import { grantWorkspaceDirectoryScope } from '../lib/fileSystemScope';
import { openDocumentInCurrentWindow, openDocumentInNewWindow } from '../lib/openDocumentFlow';

const MACOS_PENDING_FILE_POLL_DELAYS = [0, 200, 800] as const;
const DEFAULT_PENDING_FILE_POLL_DELAYS = [0] as const;

function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function getDefaultPendingFilePollDelays() {
  return getRuntimePlatform() === 'mac'
    ? MACOS_PENDING_FILE_POLL_DELAYS
    : DEFAULT_PENDING_FILE_POLL_DELAYS;
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
  const createNewDocument = useDocumentStore((s) => s.createNewDocument);
  const restoreLastSession = useSettingsStore((s) => s.restoreLastSession);
  const lastSession = useSettingsStore((s) => s.lastSession);
  const { setSidebarVisible, setSidebarTab, setWorkspace } = useWorkspaceStore();

  useEffect(() => {
    if (!enabled) return;
    if (currentDocument) return;

    let cancelled = false;
    const params = new URLSearchParams(window.location.search);
    const filePath = params.get('file');
    const folderPath = params.get('folder');
    const shouldCreateNewDocument = params.get('new') === '1';

    const openFile = async (
      path: string,
      restoreViewMode?: 'edit' | 'split' | 'preview',
      restoreScrollState?: { editorRatio: number; previewRatio: number },
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

    const openPendingStartupFile = async () => {
      const pendingFiles = await invokeNativeCommand<string[]>('get_pending_files');
      if (cancelled || useDocumentStore.getState().currentDocument) return true;
      if (pendingFiles.length === 0) return false;

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

      if (shouldCreateNewDocument) {
        createNewDocument();
        return;
      }

      if (await openPendingStartupFileBeforeSessionRestore()) return;

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
    })();

    return () => {
      cancelled = true;
    };
  }, [
    enabled,
    createNewDocument,
    lastSession,
    pendingFilePollDelays,
    restoreLastSession,
    setSidebarTab,
    setSidebarVisible,
    setWorkspace,
    wait,
  ]);
}
