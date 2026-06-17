import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { WorkspaceController } from './WorkspaceController';
import type { WritingStats } from '../../domains/workspace/services';

const writingStats: WritingStats = {
  characters: 32,
  chineseChars: 18,
  englishWords: 4,
  readingMinutes: 1,
  wordCount: 22,
};

function renderController(overrides: Partial<Parameters<typeof WorkspaceController>[0]> = {}) {
  const props: Parameters<typeof WorkspaceController>[0] = {
    actionableIssueCount: 0,
    activePath: '/repo/readme.md',
    backlinkCount: 0,
    cursor: { line: 2, column: 4 },
    documentContent: '# Readme',
    documentView: <div data-testid="document-view">Document view</div>,
    exportProgress: null,
    exportProgressInBackground: false,
    fileTree: [{ path: '/repo/readme.md', name: 'readme.md', kind: 'file' }],
    firstActionableMessage: undefined,
    firstTypographyMessage: undefined,
    globalContextMenu: null,
    hasDocumentRelations: true,
    isSidebarHovered: false,
    selectionWritingStats: null,
    sidebarTab: 'files',
    sidebarVisible: true,
    statusBarVisible: true,
    typographyIssueCount: 0,
    workspaceIndex: null,
    writingStats,
    onBacklinksClick: vi.fn(),
    onCloseContextMenu: vi.fn(),
    onContextMenuAction: vi.fn(),
    onCursorChange: vi.fn(),
    onExportMenu: vi.fn(),
    onFileClick: vi.fn(),
    onFolderContextMenu: vi.fn(),
    onLinkDiagnosticsClick: vi.fn(),
    onNewFile: vi.fn(),
    onNotice: vi.fn(),
    onOpenDocumentLink: vi.fn(),
    onOutlineClick: vi.fn(),
    onRelationGraphClick: vi.fn(),
    onSelectionTextChange: vi.fn(),
    onSetSidebarHovered: vi.fn(),
    onSetSidebarTab: vi.fn(),
    onShowExportProgress: vi.fn(),
    onToggleFileTreeMode: vi.fn(),
    onToggleFocusMode: vi.fn(),
    onToggleSidebar: vi.fn(),
    onTypographyDiagnosticsClick: vi.fn(),
    ...overrides,
  };

  render(<WorkspaceController {...props} />);
  return props;
}

describe('WorkspaceController', () => {
  it('renders the sidebar, document view and status bar wiring', () => {
    const props = renderController();

    expect(screen.getByTitle('/repo/readme.md')).toBeInTheDocument();
    expect(screen.getByTestId('document-view')).toHaveTextContent('Document view');
    expect(screen.getByText('22 字 · 2:4')).toBeInTheDocument();

    fireEvent.click(screen.getByTitle('新建文件'));

    expect(props.onNewFile).toHaveBeenCalledTimes(1);
  });

  it('routes global context menu actions with their source kind', () => {
    const props = renderController({
      globalContextMenu: {
        x: 12,
        y: 24,
        kind: 'file',
        items: [{ label: 'Open File', action: 'open' }],
      },
    });

    fireEvent.click(screen.getByText('Open File'));

    expect(props.onContextMenuAction).toHaveBeenCalledWith('open', 'file');
    expect(props.onCloseContextMenu).toHaveBeenCalledTimes(1);
  });
});
