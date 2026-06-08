import { describe, expect, it } from 'vitest';
import type { FileNode } from '../types';
import {
  collectAncestorDirectoryPaths,
  flattenFiles,
  pruneExpandedDirectoryPaths,
  searchWorkspaceNodes,
  sortFileNodes,
} from './fileTree';
import { rankQuickOpenFiles } from './quickOpen';

const nodes: FileNode[] = [
  {
    path: '/notes/b',
    name: 'b',
    kind: 'directory',
    modifiedAt: 10,
    children: [
      { path: '/notes/b/z.md', name: 'z.md', kind: 'file', modifiedAt: 20, createdAt: 2, size: 20, preview: 'Zeta' },
      { path: '/notes/b/a.md', name: 'a.md', kind: 'file', modifiedAt: 40, createdAt: 4, size: 5, preview: 'Alpha' },
    ],
  },
  { path: '/notes/root.md', name: 'root.md', kind: 'file', modifiedAt: 30, createdAt: 3, size: 10, preview: 'Root file' },
];

describe('workspace file tree services', () => {
  it('sorts folders first and files by the selected mode', () => {
    const sorted = sortFileNodes(nodes, 'modified');

    expect(sorted[0].name).toBe('b');
    expect(sorted[1].name).toBe('root.md');
    expect(sorted[0].children?.map((node) => node.name)).toEqual(['a.md', 'z.md']);
  });

  it('flattens and searches markdown files', () => {
    const flat = flattenFiles(nodes, '/notes');

    expect(flat.map((item) => item.node.name)).toEqual(['z.md', 'a.md', 'root.md']);
    expect(flat[0].folderLabel).toBe('b');
    expect(searchWorkspaceNodes(nodes, 'alpha').map((node) => node.name)).toEqual(['a.md']);
  });

  it('ranks quick-open results by name relevance first', () => {
    expect(rankQuickOpenFiles(nodes, 'root')[0].node.name).toBe('root.md');
    expect(rankQuickOpenFiles(nodes, 'zeta')[0].node.name).toBe('z.md');
  });

  it('shows recently modified files when quick-open query is empty', () => {
    const results = rankQuickOpenFiles(nodes, '', 20, '/notes');

    expect(results.map((result) => result.node.name)).toEqual(['a.md', 'root.md', 'z.md']);
    expect(results[0].folderLabel).toBe('b');
  });

  it('boosts recently opened files in quick-open ranking', () => {
    const recent = [{ path: '/notes/b/z.md', lastOpened: 100 }];

    expect(rankQuickOpenFiles(nodes, '', 20, '/notes', recent)[0].node.name).toBe('z.md');
    expect(rankQuickOpenFiles(nodes, 'md', 20, '/notes', recent)[0].node.name).toBe('z.md');
  });

  it('collects only directory ancestors for a target path', () => {
    const nestedNodes: FileNode[] = [
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
    ];

    expect([...collectAncestorDirectoryPaths(nestedNodes, '/notes/projects/archive/old.md')]).toEqual([
      '/notes/projects',
      '/notes/projects/archive',
    ]);
    expect([...collectAncestorDirectoryPaths(nestedNodes, '/notes/projects/archive')]).toEqual([
      '/notes/projects',
    ]);
  });

  it('keeps only expanded paths that still exist in the file tree', () => {
    const expandedPaths = new Set(['/notes/b', '/notes/missing']);

    expect([...pruneExpandedDirectoryPaths(nodes, expandedPaths)]).toEqual(['/notes/b']);
  });
});
