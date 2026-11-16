import { act, fireEvent, render, screen, within } from '@testing-library/react';
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

    const graphImage = screen.getByRole('img', { name: '文档关系图' });
    expect(within(graphImage).getAllByText('Gamma').length).toBeGreaterThan(0);
    // 搜索只收窄画布，右栏仍然列出当前文档的真实关系。
    expect(within(graphImage).queryByText('Alpha')).not.toBeInTheDocument();

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

  it('places backlinks left of the current document and outgoing links right', () => {
    render(
      <RelationGraphPanel
        visible
        index={createIndex()}
        currentPath="/repo/b.md"
        onClose={vi.fn()}
        onSelect={vi.fn()}
      />,
    );

    const translateX = (element: HTMLElement) => {
      const match = /translate\((-?[\d.]+)/.exec(element.getAttribute('transform') ?? '');
      return Number(match?.[1] ?? 0);
    };

    const alpha = screen.getByRole('button', { name: '打开 Alpha' });
    const gamma = screen.getByRole('button', { name: '打开 Gamma' });

    expect(translateX(alpha)).toBeLessThan(translateX(gamma));

    const graphImage = screen.getByRole('img', { name: '文档关系图' });
    expect(within(graphImage).getByText('被引用 · 1')).toBeInTheDocument();
    expect(within(graphImage).getByText('引用了 · 1')).toBeInTheDocument();
  });

  it('explains an isolated document instead of showing a blank canvas', () => {
    const isolatedIndex = buildWorkspaceIndex({
      fileTree: [{ path: '/repo/solo.md', name: 'solo.md', kind: 'file' }],
      workspaceRoot: '/repo',
      documents: [{ path: '/repo/solo.md', content: '# Solo\n\n没有链接。' }],
    });

    render(
      <RelationGraphPanel
        visible
        index={isolatedIndex}
        currentPath="/repo/solo.md"
        onClose={vi.fn()}
        onSelect={vi.fn()}
      />,
    );

    expect(screen.getByText('这篇文档还没有互链')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '在工作区找一篇' })).toBeInTheDocument();
  });

  it('re-centers on a clicked node and clears the search', () => {
    vi.useFakeTimers();
    try {
      render(
        <RelationGraphPanel
          visible
          index={createIndex()}
          currentPath="/repo/b.md"
          onClose={vi.fn()}
          onSelect={vi.fn()}
        />,
      );

      fireEvent.change(screen.getByLabelText('搜索图谱节点'), { target: { value: 'Gamma' } });
      expect((screen.getByLabelText('搜索图谱节点') as HTMLInputElement).value).toBe('Gamma');

      fireEvent.click(screen.getByRole('button', { name: '打开 Gamma' }));
      act(() => {
        vi.advanceTimersByTime(220);
      });

      expect((screen.getByLabelText('搜索图谱节点') as HTMLInputElement).value).toBe('');
      expect(document.querySelector('.prism-relation-graph-meta')?.textContent).toContain('Gamma');
    } finally {
      vi.useRealTimers();
    }
  });

  it('reorders a column with ⌥↑/⌥↓ and remembers the order', () => {
    window.localStorage.clear();
    const hubIndex = buildWorkspaceIndex({
      fileTree: [
        { path: '/repo/hub.md', name: 'hub.md', kind: 'file' },
        { path: '/repo/x.md', name: 'x.md', kind: 'file' },
        { path: '/repo/y.md', name: 'y.md', kind: 'file' },
      ],
      workspaceRoot: '/repo',
      documents: [
        { path: '/repo/hub.md', content: '# Hub\n' },
        { path: '/repo/x.md', content: '# X\n[hub](hub.md)' },
        { path: '/repo/y.md', content: '# Y\n[hub](hub.md)' },
      ],
    });

    render(
      <RelationGraphPanel
        visible
        index={hubIndex}
        currentPath="/repo/hub.md"
        onClose={vi.fn()}
        onSelect={vi.fn()}
      />,
    );

    const x = screen.getByRole('button', { name: '打开 X' });
    fireEvent.keyDown(x, { key: 'ArrowDown', altKey: true });

    const stored = JSON.parse(window.localStorage.getItem('prism.relation-graph.order.v1') ?? '{}');
    expect(stored['current:/repo/hub.md']).toEqual(['/repo/y.md', '/repo/x.md']);

    const columnLabels = screen.getByRole('img', { name: '文档关系图' });
    const order = [...columnLabels.querySelectorAll('.prism-relation-graph-node')]
      .map((node) => node.getAttribute('data-node-id'));
    expect(order).toEqual(['/repo/y.md', '/repo/x.md', '/repo/hub.md']);
  });

  it('tells the reader how many documents were cut by the node limit', async () => {
    const manyDocs = Array.from({ length: 85 }, (_, index) => ({
      path: `/repo/bulk/doc-${index}.md`,
      content: `# Doc ${index}\n\n[next](./doc-${(index + 1) % 85}.md)`,
    }));
    const bigIndex = buildWorkspaceIndex({
      fileTree: manyDocs.map((doc) => ({ path: doc.path, name: doc.path.split('/').pop() ?? doc.path, kind: 'file' })),
      workspaceRoot: '/repo',
      documents: manyDocs,
    });

    render(
      <RelationGraphPanel
        visible
        index={bigIndex}
        currentPath="/repo/bulk/doc-0.md"
        onClose={vi.fn()}
        onSelect={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '工作区' }));

    expect(await screen.findByText('还有 5 篇未显示')).toBeInTheDocument();
  });
});
