import { createRef, forwardRef } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppWorkspaceViewController } from './AppWorkspaceViewController';
import type { EditorPaneHandle } from '../../domains/editor/components/EditorPane';
import type { OpenDocument } from '../../domains/document/types';
import type { WritingStats } from '../../domains/workspace/services';

const workspaceControllerMock = vi.hoisted(() => vi.fn((props: any) => (
  <div>
    <div data-testid="document-slot">{props.documentView}</div>
    <button onClick={props.onNewFile}>new-file</button>
    <button onClick={props.onToggleFileTreeMode}>toggle-file-tree-mode</button>
    <button onClick={() => props.onOutlineClick(12)}>outline</button>
  </div>
)));

vi.mock('./WorkspaceController', () => ({
  WorkspaceController: workspaceControllerMock,
}));

vi.mock('../../domains/document/components/DocumentView', () => ({
  DocumentView: forwardRef(({ onCursorChange }: { onCursorChange: (cursor: { line: number; column: number }) => void }, _ref) => (
    <button onClick={() => onCursorChange({ line: 4, column: 2 })}>document-view</button>
  )),
}));

const writingStats: WritingStats = {
  characters: 12,
  chineseChars: 8,
  englishWords: 2,
  readingMinutes: 1,
  wordCount: 10,
};

function createDocument(overrides: Partial<OpenDocument> = {}): OpenDocument {
  return {
    path: '/repo/current.md',
    name: 'current.md',
    content: '# Current',
    isDirty: false,
    lastSavedAt: 0,
    lastKnownMtime: null,
    lastKnownSize: null,
    saveStatus: 'saved',
    saveError: null,
    viewMode: 'split',
    scrollState: { editorRatio: 0, previewRatio: 0 },
    ...overrides,
  };
}

function renderController(overrides: Partial<Parameters<typeof AppWorkspaceViewController>[0]> = {}) {
  const editorRef = createRef<EditorPaneHandle>();
  const props: Parameters<typeof AppWorkspaceViewController>[0] = {
    activePath: '/repo/current.md',
    actionableIssueCount: 0,
    backlinkCount: 0,
    currentDocument: createDocument(),
    cursor: { line: 1, column: 1 },
    editorRef,
    exportProgress: null,
    exportProgressInBackground: false,
    firstActionableMessage: undefined,
    firstTypographyMessage: undefined,
    globalContextMenu: null,
    isSidebarHovered: false,
    selectionWritingStats: null,
    typographyIssueCount: 0,
    workspace: {
      fileTree: [],
      fileTreeMode: 'tree',
      fileSortMode: 'name',
      focusMode: false,
      isAlwaysOnTop: false,
      isFullscreen: false,
      mode: 'folder',
      rootPath: '/repo',
      sidebarTab: 'files',
      sidebarVisible: true,
      statusBarVisible: true,
      typewriterMode: false,
      setAlwaysOnTop: vi.fn(),
      setFileSortMode: vi.fn(),
      setFileTree: vi.fn(),
      setFileTreeMode: vi.fn(),
      setFullscreen: vi.fn(),
      setRootPath: vi.fn(),
      setSidebarTab: vi.fn(),
      setSidebarVisible: vi.fn(),
      toggleFocusMode: vi.fn(),
      toggleSidebar: vi.fn(),
      toggleStatusBar: vi.fn(),
      toggleTypewriterMode: vi.fn(),
    },
    workspaceIndex: null,
    writingStats,
    onBacklinksClick: vi.fn(),
    onCloseContextMenu: vi.fn(),
    onContextMenuAction: vi.fn(),
    onCursorChange: vi.fn(),
    onExportMenu: vi.fn(),
    onFileAction: vi.fn(),
    onFileClick: vi.fn(),
    onFolderContextMenu: vi.fn(),
    onLinkDiagnosticsClick: vi.fn(),
    onNotice: vi.fn(),
    onOpenDocumentLink: vi.fn(),
    onRelationGraphClick: vi.fn(),
    onSelectionTextChange: vi.fn(),
    onSetSidebarHovered: vi.fn(),
    onShowExportProgress: vi.fn(),
    onTypographyDiagnosticsClick: vi.fn(),
    ...overrides,
  };

  render(<AppWorkspaceViewController {...props} />);
  return props;
}

describe('AppWorkspaceViewController', () => {
  beforeEach(() => {
    workspaceControllerMock.mockClear();
  });

  it('renders DocumentView inside WorkspaceController and forwards cursor changes', () => {
    const props = renderController();

    fireEvent.click(screen.getByText('document-view'));

    expect(screen.getByTestId('document-slot')).toBeInTheDocument();
    expect(props.onCursorChange).toHaveBeenCalledWith({ line: 4, column: 2 });
    expect(workspaceControllerMock.mock.calls[0][0]).toMatchObject({
      activePath: '/repo/current.md',
      documentContent: '# Current',
      hasSavedPath: true,
      statusBarVisible: true,
    });
  });

  it('routes workspace actions through the app file and editor bridges', () => {
    const jumpToLine = vi.fn();
    const editorRef = {
      current: {
        focus: vi.fn(),
        jumpToLine,
        scrollToLine: vi.fn(),
        setScrollRatio: vi.fn(),
      },
    };
    const props = renderController({ editorRef });

    fireEvent.click(screen.getByText('new-file'));
    fireEvent.click(screen.getByText('toggle-file-tree-mode'));
    fireEvent.click(screen.getByText('outline'));

    expect(props.onFileAction).toHaveBeenCalledWith('newFile');
    expect(props.onFileAction).toHaveBeenCalledWith('viewList');
    expect(jumpToLine).toHaveBeenCalledWith(12);
  });
});
