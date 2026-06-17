import type { MouseEventHandler, RefObject } from 'react';
import { DocumentView } from '../../domains/document/components/DocumentView';
import type { EditorPaneHandle } from '../../domains/editor/components/EditorPane';
import type { OpenDocument } from '../../domains/document/types';
import type { WorkspaceContextMenuState } from './WorkspaceController';
import { WorkspaceController } from './WorkspaceController';
import type { FileActionInput } from '../../lib/fileActions';
import {
  hasWorkspaceIndexDocumentRelations,
  type WorkspaceIndex,
  type WritingStats,
} from '../../domains/workspace/services';
import type { useWorkspaceStore } from '../../domains/workspace/store';

interface AppWorkspaceViewControllerProps {
  activePath?: string | null;
  actionableIssueCount: number;
  backlinkCount: number;
  currentDocument: OpenDocument | null;
  cursor: { line: number; column: number };
  editorRef: RefObject<EditorPaneHandle>;
  exportProgress: string | null;
  exportProgressInBackground: boolean;
  firstActionableMessage?: string;
  firstTypographyMessage?: string;
  globalContextMenu: WorkspaceContextMenuState | null;
  isSidebarHovered: boolean;
  selectionWritingStats: WritingStats | null;
  typographyIssueCount: number;
  workspace: ReturnType<typeof useWorkspaceStore.getState>;
  workspaceIndex: WorkspaceIndex | null;
  workspaceIndexJobId?: string | null;
  writingStats: WritingStats;
  onBacklinksClick: () => void;
  onCloseContextMenu: () => void;
  onContextMenuAction: (action: string, kind: WorkspaceContextMenuState['kind']) => void;
  onCursorChange: (cursor: { line: number; column: number }) => void;
  onExportMenu: MouseEventHandler;
  onFileAction: (input: FileActionInput) => void | Promise<void>;
  onFileClick: (path: string) => void | Promise<void>;
  onFolderContextMenu: MouseEventHandler;
  onLinkDiagnosticsClick: () => void;
  onNotice: (message: string) => void;
  onOpenDocumentLink: Parameters<typeof DocumentView>[0]['onOpenDocumentLink'];
  onRelationGraphClick: () => void;
  onSelectionTextChange: (text: string) => void;
  onSetSidebarHovered: (hovered: boolean) => void;
  onShowExportProgress: () => void;
  onTypographyDiagnosticsClick: () => void;
}

export function AppWorkspaceViewController({
  activePath,
  actionableIssueCount,
  backlinkCount,
  currentDocument,
  cursor,
  editorRef,
  exportProgress,
  exportProgressInBackground,
  firstActionableMessage,
  firstTypographyMessage,
  globalContextMenu,
  isSidebarHovered,
  selectionWritingStats,
  typographyIssueCount,
  workspace,
  workspaceIndex,
  workspaceIndexJobId,
  writingStats,
  onBacklinksClick,
  onCloseContextMenu,
  onContextMenuAction,
  onCursorChange,
  onExportMenu,
  onFileAction,
  onFileClick,
  onFolderContextMenu,
  onLinkDiagnosticsClick,
  onNotice,
  onOpenDocumentLink,
  onRelationGraphClick,
  onSelectionTextChange,
  onSetSidebarHovered,
  onShowExportProgress,
  onTypographyDiagnosticsClick,
}: AppWorkspaceViewControllerProps) {
  const hasDocumentRelations = Boolean(
    currentDocument?.path
    && currentDocument.profile?.supportsRelationGraph !== false
    && workspaceIndex
    && hasWorkspaceIndexDocumentRelations(workspaceIndex, currentDocument.path),
  );

  return (
    <WorkspaceController
      activePath={activePath}
      actionableIssueCount={actionableIssueCount}
      backlinkCount={backlinkCount}
      cursor={cursor}
      documentContent={currentDocument?.content ?? ''}
      documentView={(
        <DocumentView
          key={currentDocument?.path || 'new-doc'}
          ref={editorRef}
          onCursorChange={onCursorChange}
          onOpenDocumentLink={onOpenDocumentLink}
          onSelectionTextChange={onSelectionTextChange}
          onNotice={onNotice}
          workspaceIndex={workspaceIndex}
          workspaceIndexJobId={workspaceIndexJobId}
        />
      )}
      exportProgress={exportProgress}
      exportProgressInBackground={exportProgressInBackground}
      fileTree={workspace.fileTree}
      firstActionableMessage={firstActionableMessage}
      firstTypographyMessage={firstTypographyMessage}
      globalContextMenu={globalContextMenu}
      hasDocumentRelations={hasDocumentRelations}
      isSidebarHovered={isSidebarHovered}
      selectionWritingStats={selectionWritingStats}
      sidebarTab={workspace.sidebarTab}
      sidebarVisible={workspace.sidebarVisible}
      statusBarVisible={Boolean(currentDocument && workspace.statusBarVisible)}
      typographyIssueCount={typographyIssueCount}
      workspaceIndex={workspaceIndex}
      writingStats={writingStats}
      onBacklinksClick={onBacklinksClick}
      onCloseContextMenu={onCloseContextMenu}
      onContextMenuAction={onContextMenuAction}
      onCursorChange={onCursorChange}
      onExportMenu={onExportMenu}
      onFileClick={onFileClick}
      onFolderContextMenu={onFolderContextMenu}
      onLinkDiagnosticsClick={onLinkDiagnosticsClick}
      onNewFile={() => onFileAction('newFile')}
      onNotice={onNotice}
      onOpenDocumentLink={onOpenDocumentLink}
      onOutlineClick={(line) => editorRef.current?.jumpToLine(line)}
      onRelationGraphClick={onRelationGraphClick}
      onSelectionTextChange={onSelectionTextChange}
      onSetSidebarHovered={onSetSidebarHovered}
      onSetSidebarTab={workspace.setSidebarTab}
      onShowExportProgress={onShowExportProgress}
      onToggleFileTreeMode={() => onFileAction(workspace.fileTreeMode === 'tree' ? 'viewList' : 'viewTree')}
      onToggleFocusMode={() => workspace.toggleFocusMode()}
      onToggleSidebar={() => workspace.toggleSidebar()}
      onTypographyDiagnosticsClick={onTypographyDiagnosticsClick}
    />
  );
}
