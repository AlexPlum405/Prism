import { useCallback, useState, type MouseEvent } from 'react';
import type {
  WorkspaceContextMenuState,
} from './controllers/workspaceContextMenu';
import { createFileTreeContextMenuItems } from '../domains/workspace/components/fileTreeContextMenu';
import type { FileSortMode, FileTreeMode, WorkspaceTreeScope } from '../domains/workspace/types';
import type { FileActionInput } from '../lib/fileActions';

type WorkspaceContextMenuKind = WorkspaceContextMenuState['kind'];

interface UseAppWorkspaceContextMenuInput {
  fileSortMode: FileSortMode;
  fileTreeMode: FileTreeMode;
  workspaceTreeScope: WorkspaceTreeScope;
  handleCommandAction: (commandId: string) => void | Promise<void>;
  handleFileAction: (input: FileActionInput) => void | Promise<void>;
}

export function useAppWorkspaceContextMenu({
  fileSortMode,
  fileTreeMode,
  workspaceTreeScope,
  handleCommandAction,
  handleFileAction,
}: UseAppWorkspaceContextMenuInput) {
  const [globalContextMenu, setGlobalContextMenu] = useState<WorkspaceContextMenuState | null>(null);

  const closeGlobalContextMenu = useCallback(() => {
    setGlobalContextMenu(null);
  }, []);

  const handleFolderContextMenu = useCallback((event: MouseEvent) => {
    event.preventDefault();
    const items = createFileTreeContextMenuItems({
      fileTreeMode,
      fileSortMode,
      workspaceTreeScope,
      includeOpenNewWindow: true,
    });
    setGlobalContextMenu({ x: event.clientX, y: event.clientY, items, kind: 'file' });
  }, [fileSortMode, fileTreeMode, workspaceTreeScope]);

  const handleContextMenuAction = useCallback((action: string, kind: WorkspaceContextMenuKind) => {
    if (kind === 'file') {
      void handleFileAction(action);
      return;
    }
    void handleCommandAction(action);
  }, [handleCommandAction, handleFileAction]);

  return {
    closeGlobalContextMenu,
    globalContextMenu,
    handleContextMenuAction,
    handleFolderContextMenu,
  };
}
