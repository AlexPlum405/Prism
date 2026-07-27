import { useCallback, useState, type MouseEvent } from 'react';
import type { ContextMenuItem } from '../components/shell/ContextMenu';
import {
  type WorkspaceContextMenuState,
} from './controllers/WorkspaceController';
import { getCommandMenuItems, type CommandContext } from '../domains/commands';
import { createFileTreeContextMenuItems } from '../domains/workspace/components/fileTreeContextMenu';
import type { FileSortMode, FileTreeMode, WorkspaceTreeScope } from '../domains/workspace/types';
import type { FileActionInput } from '../lib/fileActions';

type WorkspaceContextMenuKind = WorkspaceContextMenuState['kind'];

interface UseAppWorkspaceContextMenuInput {
  createCommandContext: () => CommandContext;
  fileSortMode: FileSortMode;
  fileTreeMode: FileTreeMode;
  workspaceTreeScope: WorkspaceTreeScope;
  handleCommandAction: (commandId: string) => void | Promise<void>;
  handleFileAction: (input: FileActionInput) => void | Promise<void>;
}

export function useAppWorkspaceContextMenu({
  createCommandContext,
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

  const handleExportContextMenu = useCallback((event: MouseEvent) => {
    event.preventDefault();
    const items = getCommandMenuItems(
      ['exportWithPrevious', 'exportOverwritePrevious', 'exportPdf', 'exportDocx', 'exportHtml', 'exportPng'],
      createCommandContext(),
    ) as ContextMenuItem[];
    setGlobalContextMenu({ x: event.clientX, y: event.clientY, items, kind: 'menu' });
  }, [createCommandContext]);

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
    handleExportContextMenu,
    handleFolderContextMenu,
  };
}
