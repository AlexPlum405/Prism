import type { MouseEventHandler, RefObject } from 'react';
import { useMemo } from 'react';
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
import { IslandGhost, IslandGutter } from '../../domains/workspace/components/IslandGutter';
import { useIslandLayout } from '../../domains/workspace/layout/useIslandLayout';
import type { DocumentPaneCount } from '../../domains/workspace/layout/islandLayout';

/**
 * 工作区视图控制器。
 *
 * 这里曾经套了两层：AppWorkspaceViewController 把 36 个 props 透给
 * WorkspaceController，后者再把 45 个 props 铺给 Sidebar / DocumentView /
 * StatusBar，两层加起来 884 行、156 个 props、零业务逻辑。合并成一层后只剩
 * 必要的派生（documentContent、hasDocumentRelations、statusBarVisible），
 * 新增一个状态栏字段从改三个文件变成改一个。
 *
 * 布局上它是「浮岛」外壳的唯一入口：三块岛与两条可拖拽的缝都在这里摆，
 * 宽度由 useIslandLayout 统一维护，避免岛自己 flex 导致读数与实际不符。
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

  const paneCount: DocumentPaneCount = currentDocument
    ? (currentDocument.viewMode === 'split' ? 2 : 1)
    : 0;
  const sidebarVisible = Boolean(workspace.sidebarVisible) && Boolean(currentDocument);

  const layout = useIslandLayout({ paneCount, sidebarVisible });

  const workspaceLabel = useMemo(() => {
    const root = workspace.rootPath;
    if (!root) return 'Examples';
    return root.split(/[\\/]/).filter(Boolean).pop() || 'Examples';
  }, [workspace.rootPath]);

  return (
    <>
      <div className="island-main" ref={layout.containerRef}>
        {sidebarVisible && (
          <>
            <aside
              className="island island--sidebar"
              style={{ width: layout.widths.sidebar }}
            >
              <Sidebar
                fileTree={workspace.fileTree}
                sidebarTab={workspace.sidebarTab}
                setSidebarTab={workspace.setSidebarTab}
                documentContent={currentDocument?.content ?? ''}
                activePath={activePath}
                onFileClick={onFileClick}
                onOutlineClick={(line) => editorRef.current?.jumpToLine(line)}
                onNewFile={() => onFileAction('newFile')}
                onFolderContextMenu={onFolderContextMenu}
                onToggleFileTreeMode={() => onFileAction(workspace.fileTreeMode === 'tree' ? 'viewList' : 'viewTree')}
                fileTreeMode={workspace.fileTreeMode}
                onCollapse={() => workspace.toggleSidebar()}
                footerLabel={workspaceLabel}
              />
            </aside>
            <IslandGutter
              label="调整侧栏宽度"
              value={layout.widths.sidebar}
              valueMin={layout.limits.sidebar.min}
              valueMax={layout.limits.sidebar.max}
              startName="侧栏"
              endName="源文"
              partnerValue={layout.widths.editor}
              onResizeStart={layout.startSidebarDrag}
              onResize={layout.resizeSidebarTo}
              onResizeEnd={layout.endDrag}
              onReset={layout.reset}
            />
          </>
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
          island={{
            editorWidth: layout.widths.editor,
            previewWidth: layout.widths.preview,
            onResizeStart: layout.startDocumentDrag,
            onResize: layout.resizeEditorTo,
            onResizeEnd: layout.endDrag,
            onReset: layout.reset,
          }}
        />

        {layout.ghost && <IslandGhost x={layout.ghost.x} label={layout.ghost.label} />}
      </div>

      {currentDocument && workspace.statusBarVisible && (
        <div className="app-statusbar">
          <StatusBar
            writingStats={writingStats}
            selectionStats={selectionWritingStats}
            cursor={cursor}
            onExportMenu={onExportMenu}
            onToggleFocusMode={() => workspace.toggleFocusMode()}
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
