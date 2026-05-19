import { describe, expect, it } from 'vitest';
import type { FileNode } from '../types';
import { buildWorkspaceIndex } from './workspaceIndex';
import { buildRelationGraph } from './relationGraph';

const fileTree: FileNode[] = [
  { path: '/repo/a.md', name: 'a.md', kind: 'file' },
  { path: '/repo/b.md', name: 'b.md', kind: 'file' },
  { path: '/repo/c.md', name: 'c.md', kind: 'file' },
  { path: '/repo/d.md', name: 'd.md', kind: 'file' },
];

function createIndex() {
  return buildWorkspaceIndex({
    fileTree,
    workspaceRoot: '/repo',
    documents: [
      { path: '/repo/a.md', content: '---\ntitle: Alpha\n---\n[Beta](b.md)' },
      { path: '/repo/b.md', content: '# Beta\n[Gamma](c.md)' },
      { path: '/repo/c.md', content: '# Gamma\n[[d]]' },
      { path: '/repo/d.md', content: '# Delta\n' },
    ],
  });
}

describe('relation graph service', () => {
  it('builds a one-hop current document graph from outgoing and incoming links', () => {
    const graph = buildRelationGraph({
      index: createIndex(),
      currentPath: '/repo/b.md',
      scope: 'current',
      depth: 1,
    });

    expect(graph.nodes.map((node) => node.relativePath)).toEqual(['b.md', 'a.md', 'c.md']);
    expect(graph.nodes.find((node) => node.relativePath === 'b.md')).toMatchObject({
      active: true,
      backlinkCount: 1,
      linkCount: 1,
    });
    expect(graph.edges.map((edge) => edge.id)).toEqual([
      '/repo/a.md->/repo/b.md',
      '/repo/b.md->/repo/c.md',
    ]);
  });

  it('expands to two hops and filters nodes by query', () => {
    const graph = buildRelationGraph({
      index: createIndex(),
      currentPath: '/repo/b.md',
      scope: 'current',
      depth: 2,
      query: 'Delta',
    });

    expect(graph.nodes.map((node) => node.relativePath)).toEqual(['d.md']);
    expect(graph.edges).toEqual([]);
  });

  it('builds workspace graphs without a current document', () => {
    const graph = buildRelationGraph({
      index: createIndex(),
      scope: 'workspace',
      query: 'a',
    });

    expect(graph.nodes.map((node) => node.relativePath)).toEqual(expect.arrayContaining(['a.md', 'b.md', 'c.md', 'd.md']));
    expect(graph.edges.length).toBeGreaterThan(0);
  });
});
