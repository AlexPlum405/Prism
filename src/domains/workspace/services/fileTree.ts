import type { FileNode, FileSortMode } from '../types';
import { dirname, isSamePath } from './path';

export interface FlatFileNode {
  node: FileNode;
  folderLabel: string;
}

export function isDirectoryNode(node: FileNode): boolean {
  return node.kind === 'directory' || Array.isArray(node.children);
}

export function collectDirectoryPaths(nodes: FileNode[], out = new Set<string>()): Set<string> {
  for (const node of nodes) {
    if (isDirectoryNode(node)) {
      out.add(node.path);
      collectDirectoryPaths(node.children ?? [], out);
    }
  }
  return out;
}

export function pruneExpandedDirectoryPaths(nodes: FileNode[], expandedPaths: Set<string>): Set<string> {
  const directoryPaths = collectDirectoryPaths(nodes);
  return new Set([...expandedPaths].filter((path) => directoryPaths.has(path)));
}

export function collectAncestorDirectoryPaths(nodes: FileNode[], targetPath: string): Set<string> {
  const ancestorPaths = new Set<string>();

  const walk = (currentNodes: FileNode[], ancestors: string[]): boolean => {
    for (const node of currentNodes) {
      if (isSamePath(node.path, targetPath)) {
        ancestors.forEach((path) => ancestorPaths.add(path));
        return true;
      }

      if (isDirectoryNode(node) && walk(node.children ?? [], [...ancestors, node.path])) {
        return true;
      }
    }

    return false;
  };

  walk(nodes, []);
  return ancestorPaths;
}

function compareNumberDesc(a: number | undefined, b: number | undefined): number {
  return (b ?? 0) - (a ?? 0);
}

function compareFileNodes(a: FileNode, b: FileNode, mode: FileSortMode): number {
  const aDirectory = isDirectoryNode(a);
  const bDirectory = isDirectoryNode(b);
  if (aDirectory !== bDirectory) return aDirectory ? -1 : 1;

  if (mode === 'modified') {
    const result = compareNumberDesc(a.modifiedAt, b.modifiedAt);
    if (result !== 0) return result;
  }

  if (mode === 'created') {
    const result = compareNumberDesc(a.createdAt, b.createdAt);
    if (result !== 0) return result;
  }

  if (mode === 'size') {
    const result = compareNumberDesc(a.size, b.size);
    if (result !== 0) return result;
  }

  return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
}

export function sortFileNodes(nodes: FileNode[], mode: FileSortMode): FileNode[] {
  return [...nodes]
    .sort((a, b) => compareFileNodes(a, b, mode))
    .map((node) => (
      node.children
        ? { ...node, children: sortFileNodes(node.children, mode) }
        : node
    ));
}

export function flattenFiles(nodes: FileNode[], rootPath: string | null, out: FlatFileNode[] = []): FlatFileNode[] {
  for (const node of nodes) {
    if (isDirectoryNode(node)) {
      flattenFiles(node.children ?? [], rootPath, out);
      continue;
    }

    const parent = dirname(node.path);
    const folderLabel = rootPath && parent !== rootPath
      ? parent.replace(rootPath, '').replace(/^[\\/]/, '')
      : '';

    out.push({ node, folderLabel });
  }

  return out;
}

export function searchWorkspaceNodes(nodes: FileNode[], query: string): FileNode[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return [];

  return flattenFiles(nodes, null).map(({ node }) => node).filter((node) => {
    const haystack = `${node.name} ${node.path} ${node.preview ?? ''}`.toLowerCase();
    return haystack.includes(normalizedQuery);
  });
}
