import { createRef, forwardRef } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppWorkspaceViewController } from './AppWorkspaceViewController';
import type { EditorPaneHandle } from '../../domains/editor/components/EditorPane';
import type { OpenDocument } from '../../domains/document/types';
import { MARKDOWN_DOCUMENT_PROFILE } from '../../domains/workspace/services';

const sidebarMock = vi.hoisted(() => vi.fn((props: any) => (
  <div data-testid="sidebar">
    <span data-testid="sidebar-tab">{props.sidebarTab}</span>
    <button onClick={() => props.onOutlineClick(12)}>outline</button>
    <button onClick={() => props.onNewFile()}>new-file</button>
    <button onClick={() => props.onToggleFileTreeMode()}>toggle-file-tree-mode</button>
  </div>
)));

vi.mock('../../domains/workspace/components/Sidebar', () => ({ Sidebar: sidebarMock }));

vi.mock('../../domains/document/components/DocumentView', () => ({
  DocumentView: forwardRef(({ onCursorChange }: { onCursorChange: (cursor: { line: number; column: number }) => void }, _ref) => (
    <button onClick={() => onCursorChange({ line: 4, column: 2 })}>document-view</button>
  )),
}));

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
    currentDocument: createDocument(),
    editorRef,
    globalContextMenu: null,
    workspace: createWorkspaceState(),
    workspaceIndex: null,
    onCloseContextMenu: vi.fn(),
    onContextMenuAction: vi.fn(),
    onCursorChange: vi.fn(),
    onFileAction: vi.fn(),
    onFileClick: vi.fn(),
    onFolderContextMenu: vi.fn(),
    onNotice: vi.fn(),
    onOpenDocumentLink: vi.fn(),
    onSelectionTextChange: vi.fn(),
    ...overrides,
  };

  render(<AppWorkspaceViewController {...props} />);
  return props;
}


describe('AppWorkspaceViewController', () => {
  beforeEach(() => {
    sidebarMock.mockClear();
  });

  it('renders the sidebar and document view in one layer', () => {
    const props = renderController();

    fireEvent.click(screen.getByText('document-view'));

    expect(screen.getByTestId('sidebar')).toBeInTheDocument();
    expect(props.onCursorChange).toHaveBeenCalledWith({ line: 4, column: 2 });
    expect(sidebarMock.mock.calls[0][0]).toMatchObject({
      activePath: '/repo/current.md',
      documentContent: '# Current',
      sidebarTab: 'files',
    });
  });

  it('skips the sidebar when it is hidden', () => {
    renderController({
      workspace: {
        ...createWorkspaceState(),
        sidebarVisible: false,
        statusBarVisible: false,
      },
    });

    expect(screen.queryByTestId('sidebar')).not.toBeInTheDocument();
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
