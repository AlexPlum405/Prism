import type { MouseEventHandler, RefObject } from 'react';
import { ContextMenu } from '../../components/shell/ContextMenu';
import { DocumentView } from '../../domains/document/components/DocumentView';
import type { EditorPaneHandle } from '../../domains/editor/components/EditorPane';
import type { OpenDocument } from '../../domains/document/types';
import type { WorkspaceContextMenuState } from './workspaceContextMenu';
import type { FileActionInput } from '../../lib/fileActions';
import type { ExportFeedbackState } from '../../hooks/useExportTaskUi';
import {
  hasWorkspaceIndexDocumentRelations,
  type WorkspaceIndex,
  type WritingStats,
} from '../../domains/workspace/services';
import type { useWorkspaceStore } from '../../domains/workspace/store';
import { Sidebar } from '../../domains/workspace/components/Sidebar';
import { StatusBar } from '../../domains/workspace/components/StatusBar';

/**
 * 工作区视图控制器。
 *
 * 这里曾经套了两层：AppWorkspaceViewController 把 36 个 props 透给
 * WorkspaceController，后者再把 45 个 props 铺给 Sidebar / DocumentView /
 * StatusBar，两层加起来 884 行、156 个 props、零业务逻辑。合并成一层后只剩
 * 必要的派生（documentContent、hasDocumentRelations、statusBarVisible），
 * 新增一个状态栏字段从改三个文件变成改一个。
 */
interface AppWorkspaceViewControllerProps {
  activePath?: string | null;
  actionableIssueCount: number;
  backlinkCount: number;
  currentDocument: OpenDocument | null;
  cursor: { line: number; column: number };
  editorRef: RefObject<EditorPaneHandle>;
  exportFeedback: ExportFeedbackState | null;
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
  onShowExportFailure: () => void;
  onShowExportProgress: () => void;
  onCancelExport?: () => void;
  onTypographyDiagnosticsClick: () => void;
}

export function AppWorkspaceViewController({
  activePath,
  actionableIssueCount,
  backlinkCount,
  currentDocument,
  cursor,
  editorRef,
  exportFeedback,
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
  onShowExportFailure,
  onShowExportProgress,
  onCancelExport,
  onTypographyDiagnosticsClick,
}: AppWorkspaceViewControllerProps) {
  const hasDocumentRelations = Boolean(
    currentDocument?.path
    && currentDocument.profile?.supportsRelationGraph !== false
    && workspaceIndex
    && hasWorkspaceIndexDocumentRelations(workspaceIndex, currentDocument.path),
  );

  return (
    <>
      <div className="app-main" style={{ flex: 1, display: 'flex', minHeight: 0, minWidth: 0 }}>
        {workspace.sidebarVisible && (
          <div
            className="app-sidebar"
            onMouseEnter={() => onSetSidebarHovered(true)}
            onMouseLeave={() => onSetSidebarHovered(false)}
            style={{ display: 'flex', flexDirection: 'column' }}
          >
            <Sidebar
              fileTree={workspace.fileTree}
              sidebarTab={workspace.sidebarTab}
              setSidebarTab={workspace.setSidebarTab}
              documentContent={currentDocument?.content ?? ''}
              activePath={activePath}
              onFileClick={onFileClick}
              onOutlineClick={(line) => editorRef.current?.jumpToLine(line)}
            />
          </div>
        )}
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
      </div>

      {currentDocument && workspace.statusBarVisible && (
        <div className="app-statusbar">
          <StatusBar
            writingStats={writingStats}
            selectionStats={selectionWritingStats}
            cursor={cursor}
            sidebarVisible={workspace.sidebarVisible}
            isSidebarHovered={isSidebarHovered}
            onMouseEnter={() => onSetSidebarHovered(true)}
            onMouseLeave={() => onSetSidebarHovered(false)}
            onExportMenu={onExportMenu}
            onToggleFocusMode={() => workspace.toggleFocusMode()}
            onToggleSidebar={() => workspace.toggleSidebar()}
            onFolderContextMenu={onFolderContextMenu}
            onNewFile={() => onFileAction('newFile')}
            onToggleFileTreeMode={() => onFileAction(workspace.fileTreeMode === 'tree' ? 'viewList' : 'viewTree')}
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
            documentProfileKind={currentDocument.profile?.kind}
            onShowExportFailure={onShowExportFailure}
            onShowExportProgress={onShowExportProgress}
            onCancelExport={onCancelExport}
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
