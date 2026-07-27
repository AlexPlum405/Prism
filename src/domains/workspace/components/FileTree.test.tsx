import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { emitAppEvent } from '../../../platform/events/appEvents';
import { useWorkspaceStore } from '../store';
import type { FileNode } from '../types';
import { FileTree } from './FileTree';

const nodes: FileNode[] = [
  {
    path: '/notes/projects',
    name: 'projects',
    kind: 'directory',
    children: [
      {
        path: '/notes/projects/archive',
        name: 'archive',
        kind: 'directory',
        children: [
          { path: '/notes/projects/archive/old.md', name: 'old.md', kind: 'file' },
        ],
      },
      { path: '/notes/projects/plan.md', name: 'plan.md', kind: 'file' },
    ],
  },
  {
    path: '/notes/ideas',
    name: 'ideas',
    kind: 'directory',
    children: [
      { path: '/notes/ideas/raw.md', name: 'raw.md', kind: 'file' },
    ],
  },
  { path: '/notes/root.md', name: 'root.md', kind: 'file' },
];

function renderTree() {
  const onFileClick = vi.fn();
  render(<FileTree nodes={nodes} activePath={null} onFileClick={onFileClick} />);
  return { onFileClick };
}

describe('FileTree', () => {
  beforeEach(() => {
    useWorkspaceStore.setState({
      mode: 'folder',
      rootPath: '/notes',
      fileTree: nodes,
      fileTreeMode: 'tree',
      fileSortMode: 'name',
      workspaceTreeScope: 'currentLevel',
      sidebarVisible: true,
      sidebarTab: 'files',
      focusMode: false,
      statusBarVisible: true,
      typewriterMode: false,
      isFullscreen: false,
      isAlwaysOnTop: false,
    });
  });

  it('keeps nested workspace folders collapsed on initial render', () => {
    renderTree();

    expect(screen.getByTitle('/notes/projects')).toBeInTheDocument();
    expect(screen.getByTitle('/notes/ideas')).toBeInTheDocument();
    expect(screen.getByTitle('/notes/root.md')).toBeInTheDocument();
    expect(screen.queryByTitle('/notes/projects/plan.md')).not.toBeInTheDocument();
    expect(screen.queryByTitle('/notes/projects/archive')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('projects'));

    expect(screen.getByTitle('/notes/projects/plan.md')).toBeInTheDocument();
    expect(screen.getByTitle('/notes/projects/archive')).toBeInTheDocument();
    expect(screen.queryByTitle('/notes/projects/archive/old.md')).not.toBeInTheDocument();
    expect(screen.queryByTitle('/notes/ideas/raw.md')).not.toBeInTheDocument();
  });

  it('expands only the target ancestors for inline rename requests', () => {
    renderTree();

    act(() => {
      emitAppEvent('file.renameRequest', { path: '/notes/projects/archive/old.md' });
    });

    expect(screen.getByTitle('/notes/projects/archive')).toBeInTheDocument();
    expect(screen.getByDisplayValue('old.md')).toBeInTheDocument();
    expect(screen.queryByTitle('/notes/ideas/raw.md')).not.toBeInTheDocument();
  });

  it('does not render the removed workspace guide copy while empty', () => {
    useWorkspaceStore.setState({
      rootPath: null,
      fileTree: [],
      fileTreeMode: 'tree',
    });

    render(<FileTree nodes={[]} activePath={null} onFileClick={vi.fn()} />);

    expect(screen.queryByText('PRISM')).not.toBeInTheDocument();
    expect(screen.queryByText('本地写作、完整预览、可信导出。')).not.toBeInTheDocument();
    expect(screen.queryByText(/AI|云同步|实时协作/)).not.toBeInTheDocument();
  });
});
