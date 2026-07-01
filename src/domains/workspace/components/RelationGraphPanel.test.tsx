import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FileNode } from '../types';
import { buildWorkspaceIndex } from '../services';
import { RelationGraphPanel } from './RelationGraphPanel';

const nativeWorkspaceIndexMock = vi.hoisted(() => ({
  queryWorkspaceRelationGraphNativeModel: vi.fn(),
}));

vi.mock('../services/workspaceIndexNative', () => nativeWorkspaceIndexMock);

const fileTree: FileNode[] = [
  { path: '/repo/a.md', name: 'a.md', kind: 'file' },
  { path: '/repo/b.md', name: 'b.md', kind: 'file' },
  { path: '/repo/c.md', name: 'c.md', kind: 'file' },
];

function createIndex() {
  return buildWorkspaceIndex({
    fileTree,
    workspaceRoot: '/repo',
    documents: [
      { path: '/repo/a.md', content: '---\ntitle: Alpha\n---\n[Beta](b.md)' },
      { path: '/repo/b.md', content: '# Beta\n[[c]]' },
      { path: '/repo/c.md', content: '# Gamma\n' },
    ],
  });
}

describe('RelationGraphPanel', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    nativeWorkspaceIndexMock.queryWorkspaceRelationGraphNativeModel.mockReset();
    nativeWorkspaceIndexMock.queryWorkspaceRelationGraphNativeModel.mockResolvedValue(null);
  });

  it('renders current document graph nodes and opens selected nodes', () => {
    const onSelect = vi.fn();

    render(
      <RelationGraphPanel
        visible
        index={createIndex()}
        currentPath="/repo/b.md"
        onClose={vi.fn()}
        onSelect={onSelect}
      />,
    );

    expect(screen.getByRole('dialog', { name: '关系图谱' })).toBeInTheDocument();
    expect(screen.getAllByText('Beta').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Alpha').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Gamma').length).toBeGreaterThan(0);

    fireEvent.doubleClick(screen.getByRole('button', { name: '打开 Alpha' }));

    expect(onSelect).toHaveBeenCalledWith('/repo/a.md');
  });

  it('filters nodes and closes with Escape', () => {
    const onClose = vi.fn();

    render(
      <RelationGraphPanel
        visible
        index={createIndex()}
        currentPath="/repo/b.md"
        onClose={onClose}
        onSelect={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText('搜索图谱节点'), {
      target: { value: 'Gamma' },
    });

    expect(screen.getAllByText('Gamma').length).toBeGreaterThan(0);
    expect(screen.queryByText('Alpha')).not.toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('uses native relation graph results when a workspace index job id is available', async () => {
    nativeWorkspaceIndexMock.queryWorkspaceRelationGraphNativeModel.mockResolvedValue({
      nodes: [{
        id: '/repo/native.md',
        path: '/repo/native.md',
        relativePath: 'native.md',
        title: 'Native Node',
        active: false,
        depth: 1,
        linkCount: 0,
        backlinkCount: 1,
      }],
      edges: [],
    });

    render(
      <RelationGraphPanel
        visible
        index={createIndex()}
        workspaceIndexJobId="workspace-index-1"
        currentPath="/repo/b.md"
        onClose={vi.fn()}
        onSelect={vi.fn()}
      />,
    );

    expect((await screen.findAllByText('Native Node')).length).toBeGreaterThan(0);
    expect(nativeWorkspaceIndexMock.queryWorkspaceRelationGraphNativeModel).toHaveBeenCalledWith({
      jobId: 'workspace-index-1',
      currentPath: '/repo/b.md',
      scope: 'current',
      depth: 1,
      query: '',
      limit: 80,
    });
  });

  it('falls back to the TypeScript graph when native relation graph query fails', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    nativeWorkspaceIndexMock.queryWorkspaceRelationGraphNativeModel
      .mockRejectedValueOnce(new Error('native graph unavailable'));

    render(
      <RelationGraphPanel
        visible
        index={createIndex()}
        workspaceIndexJobId="workspace-index-1"
        currentPath="/repo/b.md"
        onClose={vi.fn()}
        onSelect={vi.fn()}
      />,
    );

    expect((await screen.findAllByText('Beta')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Alpha').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Gamma').length).toBeGreaterThan(0);
    expect(screen.queryByText('Native Node')).not.toBeInTheDocument();
    expect(console.warn).toHaveBeenCalledWith(
      '[RelationGraphPanel] Native relation graph query unavailable, using TypeScript fallback:',
      expect.any(Error),
    );
  });
});
