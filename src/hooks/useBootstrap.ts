import { useEffect } from 'react';
import { invokeNativeCommand } from '../platform/tauri/nativeCommands';
import { exists } from '../platform/tauri/fileSystem';
import { useDocumentStore } from '../domains/document/store';
import { useSettingsStore } from '../domains/settings/store';
import { useWorkspaceStore } from '../domains/workspace/store';
import { loadFolderTree } from '../domains/workspace/lib/loadFolderTree';
import { addRecentFile, dirname, getRuntimePlatform } from '../domains/workspace/services';
import { grantMarkdownFileScope, grantWorkspaceDirectoryScope } from '../lib/fileSystemScope';
import { readDocumentFileSession } from '../domains/document/services/fileSafety';

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
  const openDocument = useDocumentStore((s) => s.openDocument);
  const setViewMode = useDocumentStore((s) => s.setViewMode);
  const updateScrollState = useDocumentStore((s) => s.updateScrollState);
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
      await grantMarkdownFileScope(path);
      if (!(await exists(path))) return false;
      const session = await readDocumentFileSession(path);
      if (cancelled || useDocumentStore.getState().currentDocument) return true;

      openDocument(session.path, session.name, session.content, session.knownSnapshot);
      if (restoreViewMode) setViewMode(restoreViewMode);
      if (restoreScrollState) updateScrollState(restoreScrollState);
      addRecentFile(session.path, session.name);

      const parentDir = dirname(session.path);
      const tree = await loadFolderTree(parentDir);
      if (cancelled) return true;
      setWorkspace(parentDir, tree);
      return true;
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
      return pendingFiles.length > 0 && await openFile(pendingFiles[0]);
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
    openDocument,
    pendingFilePollDelays,
    restoreLastSession,
    setSidebarTab,
    setSidebarVisible,
    setWorkspace,
    setViewMode,
    updateScrollState,
    wait,
  ]);
}
