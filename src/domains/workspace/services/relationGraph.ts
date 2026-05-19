import type { WorkspaceIndex, WorkspaceIndexedDocument } from './workspaceIndex';
import { normalizePathForCompare } from './path';

export type RelationGraphScope = 'current' | 'workspace';
export type RelationGraphDepth = 1 | 2;

export interface RelationGraphNode {
  active: boolean;
  backlinkCount: number;
  depth: number;
  id: string;
  linkCount: number;
  path: string;
  relativePath: string;
  title: string;
}

export interface RelationGraphEdge {
  id: string;
  source: string;
  target: string;
}

export interface RelationGraph {
  edges: RelationGraphEdge[];
  nodes: RelationGraphNode[];
}

export interface BuildRelationGraphInput {
  currentPath?: string | null;
  depth?: RelationGraphDepth;
  index: WorkspaceIndex;
  limit?: number;
  query?: string;
  scope?: RelationGraphScope;
}

interface RawEdge {
  sourceKey: string;
  targetKey: string;
}

function normalizeQuery(value: string | undefined) {
  return value?.trim().toLowerCase() ?? '';
}

function documentMatchesQuery(document: WorkspaceIndexedDocument, query: string) {
  if (!query) return true;
  return [
    document.title,
    document.name,
    document.relativePath,
    ...document.headings.map((heading) => heading.title),
  ].some((value) => value.toLowerCase().includes(query));
}

function collectRawEdges(index: WorkspaceIndex): RawEdge[] {
  const edges: RawEdge[] = [];
  index.documents.forEach((document) => {
    const sourceKey = normalizePathForCompare(document.path);
    document.links.forEach((link) => {
      if (!link.resolvedPath) return;
      const targetKey = normalizePathForCompare(link.resolvedPath);
      if (!index.documentByPath.has(targetKey) || sourceKey === targetKey) return;
      edges.push({ sourceKey, targetKey });
    });
  });
  return edges;
}

function buildAdjacency(edges: RawEdge[]) {
  const outgoing = new Map<string, Set<string>>();
  const incoming = new Map<string, Set<string>>();
  edges.forEach((edge) => {
    if (!outgoing.has(edge.sourceKey)) outgoing.set(edge.sourceKey, new Set());
    if (!incoming.has(edge.targetKey)) incoming.set(edge.targetKey, new Set());
    outgoing.get(edge.sourceKey)?.add(edge.targetKey);
    incoming.get(edge.targetKey)?.add(edge.sourceKey);
  });
  return { incoming, outgoing };
}

function collectCurrentScopeKeys(input: {
  currentKey: string;
  depth: RelationGraphDepth;
  incoming: Map<string, Set<string>>;
  outgoing: Map<string, Set<string>>;
}) {
  const depths = new Map<string, number>([[input.currentKey, 0]]);
  let frontier = new Set([input.currentKey]);

  for (let currentDepth = 1; currentDepth <= input.depth; currentDepth += 1) {
    const next = new Set<string>();
    frontier.forEach((key) => {
      const neighbors = new Set([
        ...(input.outgoing.get(key) ?? []),
        ...(input.incoming.get(key) ?? []),
      ]);
      neighbors.forEach((neighbor) => {
        if (!depths.has(neighbor)) {
          depths.set(neighbor, currentDepth);
          next.add(neighbor);
        }
      });
    });
    frontier = next;
  }

  return depths;
}

export function buildRelationGraph({
  currentPath,
  depth = 1,
  index,
  limit = 80,
  query,
  scope = 'current',
}: BuildRelationGraphInput): RelationGraph {
  const normalizedQuery = normalizeQuery(query);
  const currentKey = currentPath ? normalizePathForCompare(currentPath) : '';
  const rawEdges = collectRawEdges(index);
  const { incoming, outgoing } = buildAdjacency(rawEdges);
  const currentDocumentExists = currentKey && index.documentByPath.has(currentKey);

  const depthByKey = scope === 'current' && currentDocumentExists
    ? collectCurrentScopeKeys({ currentKey, depth, incoming, outgoing })
    : new Map(index.documents.map((document) => [normalizePathForCompare(document.path), 0]));

  const selectedKeys = new Set(depthByKey.keys());
  const filteredDocuments = index.documents
    .filter((document) => selectedKeys.has(normalizePathForCompare(document.path)))
    .filter((document) => documentMatchesQuery(document, normalizedQuery))
    .sort((a, b) => (
      (normalizePathForCompare(a.path) === currentKey ? -1 : 0) ||
      (normalizePathForCompare(b.path) === currentKey ? 1 : 0) ||
      (depthByKey.get(normalizePathForCompare(a.path)) ?? 0) - (depthByKey.get(normalizePathForCompare(b.path)) ?? 0) ||
      a.relativePath.localeCompare(b.relativePath, undefined, { numeric: true, sensitivity: 'base' })
    ))
    .slice(0, limit);
  const visibleKeys = new Set(filteredDocuments.map((document) => normalizePathForCompare(document.path)));

  const nodes = filteredDocuments.map((document) => {
    const key = normalizePathForCompare(document.path);
    return {
      active: key === currentKey,
      backlinkCount: incoming.get(key)?.size ?? 0,
      depth: depthByKey.get(key) ?? 0,
      id: key,
      linkCount: outgoing.get(key)?.size ?? 0,
      path: document.path,
      relativePath: document.relativePath,
      title: document.title,
    } satisfies RelationGraphNode;
  });

  const edgeIds = new Set<string>();
  const edges = rawEdges
    .filter((edge) => visibleKeys.has(edge.sourceKey) && visibleKeys.has(edge.targetKey))
    .flatMap((edge) => {
      const id = `${edge.sourceKey}->${edge.targetKey}`;
      if (edgeIds.has(id)) return [];
      edgeIds.add(id);
      return [{
        id,
        source: edge.sourceKey,
        target: edge.targetKey,
      }];
    });

  return { edges, nodes };
}
