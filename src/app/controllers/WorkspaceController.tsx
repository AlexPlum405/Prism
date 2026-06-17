import type { MouseEvent, ReactNode } from 'react';
import { DocumentView } from '../../domains/document/components/DocumentView';
import { Sidebar } from '../../domains/workspace/components/Sidebar';
import { StatusBar } from '../../domains/workspace/components/StatusBar';
import type { FileNode, SidebarTab } from '../../domains/workspace/types';
import type { WorkspaceIndex, WritingStats } from '../../domains/workspace/services';
import { ContextMenu, type ContextMenuItem } from '../../components/shell/ContextMenu';
import type { ExportFeedbackState } from '../../hooks/useExportTaskUi';

export interface WorkspaceContextMenuState {
  items: ContextMenuItem[];
  kind: 'file' | 'menu';
  x: number;
  y: number;
}

interface WorkspaceControllerProps {
  activePath?: string | null;
  actionableIssueCount: number;
  backlinkCount: number;
  cursor: { line: number; column: number };
  documentContent: string;
  documentView?: ReactNode;
  exportFeedback: ExportFeedbackState | null;
  exportProgress: string | null;
  exportProgressInBackground: boolean;
  fileTree: FileNode[];
  firstActionableMessage?: string;
  firstTypographyMessage?: string;
  globalContextMenu: WorkspaceContextMenuState | null;
  hasDocumentRelations: boolean;
  isSidebarHovered: boolean;
  selectionWritingStats: WritingStats | null;
  sidebarTab: SidebarTab;
  sidebarVisible: boolean;
  statusBarVisible: boolean;
  typographyIssueCount: number;
  workspaceIndex: WorkspaceIndex | null;
  writingStats: WritingStats;
  onBacklinksClick: () => void;
  onCloseContextMenu: () => void;
  onContextMenuAction: (action: string, kind: WorkspaceContextMenuState['kind']) => void;
  onCursorChange: (cursor: { line: number; column: number }) => void;
  onExportMenu: (event: MouseEvent) => void;
  onFileClick: (path: string) => void | Promise<void>;
  onFolderContextMenu: (event: MouseEvent) => void;
  onLinkDiagnosticsClick: () => void;
  onNewFile: () => void | Promise<void>;
  onNotice: (message: string) => void;
  onOpenDocumentLink: Parameters<typeof DocumentView>[0]['onOpenDocumentLink'];
  onOutlineClick: (line: number) => void;
  onRelationGraphClick: () => void;
  onSelectionTextChange: (text: string) => void;
  onSetSidebarHovered: (hovered: boolean) => void;
  onSetSidebarTab: (tab: SidebarTab) => void;
  onShowExportFailure: () => void;
  onShowExportProgress: () => void;
  onToggleFileTreeMode: () => void | Promise<void>;
  onToggleFocusMode: () => void;
  onToggleSidebar: () => void;
  onTypographyDiagnosticsClick: () => void;
}

export function WorkspaceController({
  activePath,
  actionableIssueCount,
  backlinkCount,
  cursor,
  documentContent,
  documentView,
  exportFeedback,
  exportProgress,
  exportProgressInBackground,
  fileTree,
  firstActionableMessage,
  firstTypographyMessage,
  globalContextMenu,
  hasDocumentRelations,
  isSidebarHovered,
  selectionWritingStats,
  sidebarTab,
  sidebarVisible,
  statusBarVisible,
  typographyIssueCount,
  workspaceIndex,
  writingStats,
  onBacklinksClick,
  onCloseContextMenu,
  onContextMenuAction,
  onCursorChange,
  onExportMenu,
  onFileClick,
  onFolderContextMenu,
  onLinkDiagnosticsClick,
  onNewFile,
  onNotice,
  onOpenDocumentLink,
  onOutlineClick,
  onRelationGraphClick,
  onSelectionTextChange,
  onSetSidebarHovered,
  onSetSidebarTab,
  onShowExportFailure,
  onShowExportProgress,
  onToggleFileTreeMode,
  onToggleFocusMode,
  onToggleSidebar,
  onTypographyDiagnosticsClick,
}: WorkspaceControllerProps) {
  return (
    <>
      <div className="app-main" style={{ flex: 1, display: 'flex', minHeight: 0, minWidth: 0 }}>
        {sidebarVisible && (
          <div
            className="app-sidebar"
            onMouseEnter={() => onSetSidebarHovered(true)}
            onMouseLeave={() => onSetSidebarHovered(false)}
            style={{ display: 'flex', flexDirection: 'column' }}
          >
            <Sidebar
              fileTree={fileTree}
              sidebarTab={sidebarTab}
              setSidebarTab={onSetSidebarTab}
              documentContent={documentContent}
              activePath={activePath}
              onFileClick={onFileClick}
              onOutlineClick={onOutlineClick}
            />
          </div>
        )}
        {documentView ?? (
          <DocumentView
            onCursorChange={onCursorChange}
            onOpenDocumentLink={onOpenDocumentLink}
            onSelectionTextChange={onSelectionTextChange}
            onNotice={onNotice}
            workspaceIndex={workspaceIndex}
          />
        )}
      </div>

      {statusBarVisible && (
        <div className="app-statusbar">
          <StatusBar
            writingStats={writingStats}
            selectionStats={selectionWritingStats}
            cursor={cursor}
            sidebarVisible={sidebarVisible}
            isSidebarHovered={isSidebarHovered}
            onMouseEnter={() => onSetSidebarHovered(true)}
            onMouseLeave={() => onSetSidebarHovered(false)}
            onExportMenu={onExportMenu}
            onToggleFocusMode={onToggleFocusMode}
            onToggleSidebar={onToggleSidebar}
            onFolderContextMenu={onFolderContextMenu}
            onNewFile={onNewFile}
            onToggleFileTreeMode={onToggleFileTreeMode}
            linkIssueCount={actionableIssueCount}
            linkIssueTitle={firstActionableMessage}
            onLinkDiagnosticsClick={onLinkDiagnosticsClick}
            backlinkCount={backlinkCount}
            onBacklinksClick={onBacklinksClick}
            typographyIssueCount={typographyIssueCount}
            typographyIssueTitle={firstTypographyMessage}
            onTypographyDiagnosticsClick={onTypographyDiagnosticsClick}
            onRelationGraphClick={onRelationGraphClick}
            hasDocumentRelations={hasDocumentRelations}
            exportFeedback={exportFeedback}
            exportProgress={exportProgress}
            exportProgressInBackground={exportProgressInBackground}
            onShowExportFailure={onShowExportFailure}
            onShowExportProgress={onShowExportProgress}
          />
        </div>
      )}

      {globalContextMenu && (
        <ContextMenu
          x={globalContextMenu.x}
          y={globalContextMenu.y}
          items={globalContextMenu.items}
          onAction={(action) => onContextMenuAction(action, globalContextMenu.kind)}
          onClose={onCloseContextMenu}
        />
      )}
    </>
  );
}
