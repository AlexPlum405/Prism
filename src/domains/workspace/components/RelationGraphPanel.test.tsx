import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { FileNode } from '../types';
import { buildWorkspaceIndex } from '../services';
import { RelationGraphPanel } from './RelationGraphPanel';

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

    fireEvent.click(screen.getByRole('button', { name: '打开 Alpha' }));

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
});
