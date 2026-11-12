import { createRef, forwardRef } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppWorkspaceViewController } from './AppWorkspaceViewController';
import type { EditorPaneHandle } from '../../domains/editor/components/EditorPane';
import type { OpenDocument } from '../../domains/document/types';
import type { WritingStats } from '../../domains/workspace/services';
import {
  buildWorkspaceIndex,
  MARKDOWN_DOCUMENT_PROFILE,
  TEXT_DOCUMENT_PROFILE,
} from '../../domains/workspace/services';

const sidebarMock = vi.hoisted(() => vi.fn((props: any) => (
  <div data-testid="sidebar">
    <span data-testid="sidebar-tab">{props.sidebarTab}</span>
    <button onClick={() => props.onOutlineClick(12)}>outline</button>
  </div>
)));

const statusBarMock = vi.hoisted(() => vi.fn((props: any) => (
  <div data-testid="status-bar" data-relations={String(props.hasDocumentRelations)}>
    <button onClick={() => props.onNewFile()}>new-file</button>
    <button onClick={() => props.onToggleFileTreeMode()}>toggle-file-tree-mode</button>
    {props.onCancelExport && <button onClick={() => props.onCancelExport()}>cancel-export</button>}
  </div>
)));

vi.mock('../../domains/workspace/components/Sidebar', () => ({ Sidebar: sidebarMock }));
vi.mock('../../domains/workspace/components/StatusBar', () => ({ StatusBar: statusBarMock }));

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
    profile: MARKDOWN_DOCUMENT_PROFILE,
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
    exportFeedback: null,
    exportProgress: null,
    exportProgressInBackground: false,
    firstActionableMessage: undefined,
    firstTypographyMessage: undefined,
    globalContextMenu: null,
    isSidebarHovered: false,
    selectionWritingStats: null,
    typographyIssueCount: 0,
    workspace: createWorkspaceState(),
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
    onShowExportFailure: vi.fn(),
    onShowExportProgress: vi.fn(),
    onTypographyDiagnosticsClick: vi.fn(),
    ...overrides,
  };

  render(<AppWorkspaceViewController {...props} />);
  return props;
}

function buildRelationIndex(documents: Array<{ content: string; path: string }>) {
  return buildWorkspaceIndex({
    fileTree: [
      { path: '/repo/current.md', name: 'current.md', kind: 'file', modifiedAt: 10, size: 100 },
      { path: '/repo/target.md', name: 'target.md', kind: 'file', modifiedAt: 20, size: 100 },
      { path: '/repo/source.md', name: 'source.md', kind: 'file', modifiedAt: 30, size: 100 },
      { path: '/repo/query.sql', name: 'query.sql', kind: 'file', modifiedAt: 40, size: 100 },
    ],
    workspaceRoot: '/repo',
    documents,
  });
}

function lastStatusBarProps() {
  const calls = statusBarMock.mock.calls;
  return calls[calls.length - 1]?.[0] as Record<string, any>;
}

describe('AppWorkspaceViewController', () => {
  beforeEach(() => {
    sidebarMock.mockClear();
    statusBarMock.mockClear();
  });

  it('renders the sidebar, document view and status bar in one layer', () => {
    const props = renderController();

    fireEvent.click(screen.getByText('document-view'));

    expect(screen.getByTestId('sidebar')).toBeInTheDocument();
    expect(screen.getByTestId('status-bar')).toBeInTheDocument();
    expect(props.onCursorChange).toHaveBeenCalledWith({ line: 4, column: 2 });
    expect(sidebarMock.mock.calls[0][0]).toMatchObject({
      activePath: '/repo/current.md',
      documentContent: '# Current',
      sidebarTab: 'files',
    });
  });

  it('skips the sidebar and status bar when they are hidden', () => {
    renderController({
      workspace: {
        ...createWorkspaceState(),
        sidebarVisible: false,
        statusBarVisible: false,
      },
    });

    expect(screen.queryByTestId('sidebar')).not.toBeInTheDocument();
    expect(screen.queryByTestId('status-bar')).not.toBeInTheDocument();
  });

  it('hides the status bar when no document is open', () => {
    renderController({ currentDocument: null });

    expect(screen.queryByTestId('status-bar')).not.toBeInTheDocument();
  });

  it('shows the graph entry for current markdown outgoing links', () => {
    const workspaceIndex = buildRelationIndex([
      { path: '/repo/current.md', content: '# Current\n\n[Target](target.md)' },
      { path: '/repo/target.md', content: '# Target' },
    ]);

    renderController({ workspaceIndex });

    expect(lastStatusBarProps().hasDocumentRelations).toBe(true);
  });

  it('shows the graph entry for backlinks to the current document', () => {
    const workspaceIndex = buildRelationIndex([
      { path: '/repo/current.md', content: '# Current' },
      { path: '/repo/source.md', content: '# Source\n\n[Current](current.md)' },
    ]);

    renderController({ workspaceIndex });

    expect(lastStatusBarProps().hasDocumentRelations).toBe(true);
  });

  it('hides the graph entry without resolved relations', () => {
    const workspaceIndex = buildRelationIndex([
      { path: '/repo/current.md', content: '# Current\n\n[Web](https://example.com)\n\n[Missing](missing.md)' },
      { path: '/repo/target.md', content: '# Target' },
    ]);

    renderController({ workspaceIndex });

    expect(lastStatusBarProps().hasDocumentRelations).toBe(false);
  });

  it('hides the graph entry for text documents', () => {
    const workspaceIndex = buildRelationIndex([
      { path: '/repo/query.sql', content: 'select "[[target]]";' },
      { path: '/repo/target.md', content: '# Target' },
    ]);

    renderController({
      activePath: '/repo/query.sql',
      currentDocument: createDocument({
        path: '/repo/query.sql',
        profile: TEXT_DOCUMENT_PROFILE,
        name: 'query.sql',
        content: 'select "[[target]]";',
      }),
      workspaceIndex,
    });

    expect(lastStatusBarProps()).toMatchObject({
      hasDocumentRelations: false,
      documentProfileKind: 'text',
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

  it('forwards export cancellation to the status bar', () => {
    const onCancelExport = vi.fn();
    renderController({ exportProgress: '导出中', onCancelExport });

    fireEvent.click(screen.getByText('cancel-export'));

    expect(onCancelExport).toHaveBeenCalledTimes(1);
  });
});

function createWorkspaceState() {
  return {
    fileTree: [],
    fileTreeMode: 'tree' as const,
    fileSortMode: 'name' as const,
    workspaceTreeScope: 'currentLevel' as const,
    focusMode: false,
    isAlwaysOnTop: false,
    isFullscreen: false,
    mode: 'folder' as const,
    rootPath: '/repo',
    sidebarTab: 'files' as const,
    sidebarVisible: true,
    statusBarVisible: true,
    typewriterMode: false,
    setAlwaysOnTop: vi.fn(),
    setFileSortMode: vi.fn(),
    setFileTree: vi.fn(),
    setFileTreeMode: vi.fn(),
    setFullscreen: vi.fn(),
    setRootPath: vi.fn(),
    setWorkspace: vi.fn(),
    setWorkspaceTreeScope: vi.fn(),
    setSidebarTab: vi.fn(),
    setSidebarVisible: vi.fn(),
    toggleFocusMode: vi.fn(),
    toggleSidebar: vi.fn(),
    toggleStatusBar: vi.fn(),
    toggleTypewriterMode: vi.fn(),
  };
}
