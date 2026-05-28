import { useEffect } from 'react';
import { invokeNativeCommand } from '../platform/tauri/nativeCommands';
import { exists } from '../platform/tauri/fileSystem';
import { useDocumentStore } from '../domains/document/store';
import { useSettingsStore } from '../domains/settings/store';
import { useWorkspaceStore } from '../domains/workspace/store';
import { loadFolderTree } from '../domains/workspace/lib/loadFolderTree';
import { addRecentFile, dirname } from '../domains/workspace/services';
import { grantMarkdownFileScope, grantWorkspaceDirectoryScope } from '../lib/fileSystemScope';
import { readDocumentFileSession } from '../domains/document/services/fileSafety';

export function useBootstrap(enabled = true) {
  const currentDocument = useDocumentStore((s) => s.currentDocument);
  const createNewDocument = useDocumentStore((s) => s.createNewDocument);
  const openDocument = useDocumentStore((s) => s.openDocument);
  const setViewMode = useDocumentStore((s) => s.setViewMode);
  const updateScrollState = useDocumentStore((s) => s.updateScrollState);
  const restoreLastSession = useSettingsStore((s) => s.restoreLastSession);
  const lastSession = useSettingsStore((s) => s.lastSession);
  const { setRootPath, setFileTree, setSidebarVisible, setSidebarTab } = useWorkspaceStore();

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
      setRootPath(parentDir);
      const tree = await loadFolderTree(parentDir);
      if (cancelled) return true;
      setFileTree(tree);
      return true;
    };

    const openFolder = async (path: string) => {
      await grantWorkspaceDirectoryScope(path);
      if (!(await exists(path))) return false;
      setRootPath(path);
      const tree = await loadFolderTree(path);
      if (cancelled) return true;
      setFileTree(tree);
      return true;
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

      try {
        const pendingFiles = await invokeNativeCommand<string[]>('get_pending_files');
        if (cancelled || useDocumentStore.getState().currentDocument) return;
        if (pendingFiles.length > 0 && await openFile(pendingFiles[0])) return;
      } catch {
        // Pending file integration is best effort.
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
    })();

    return () => {
      cancelled = true;
    };
  }, [
    enabled,
    createNewDocument,
    lastSession,
    openDocument,
    restoreLastSession,
    setFileTree,
    setRootPath,
    setSidebarTab,
    setSidebarVisible,
    setViewMode,
    updateScrollState,
  ]);
}
