import type {
  WorkspaceIndex,
  WorkspaceIndexBacklink,
  WorkspaceIndexLink,
  WorkspaceIndexedDocument,
  WorkspaceIndexSearchResult,
} from './workspaceIndex';
import { normalizePathForCompare } from './path';

interface WorkspaceDocumentSearchCache {
  content: string;
  headings: Array<{ normalizedTitle: string; title: string }>;
  name: string;
  relativePath: string;
  title: string;
}

const workspaceDocumentSearchCache = new WeakMap<WorkspaceIndexedDocument, WorkspaceDocumentSearchCache>();

function getWorkspaceDocumentSearchCache(document: WorkspaceIndexedDocument): WorkspaceDocumentSearchCache {
  const cached = workspaceDocumentSearchCache.get(document);
  if (cached) return cached;

  const next = {
    content: document.content.toLowerCase(),
    headings: document.headings.map((item) => ({
      normalizedTitle: item.title.toLowerCase(),
      title: item.title,
    })),
    name: document.name.toLowerCase(),
    relativePath: document.relativePath.toLowerCase(),
    title: document.title.toLowerCase(),
  };
  workspaceDocumentSearchCache.set(document, next);
  return next;
}

function contentSnippet(content: string, normalizedContent: string, query: string) {
  const normalizedQuery = query.toLowerCase();
  const index = normalizedContent.indexOf(normalizedQuery);
  if (index < 0) return '';
  const start = Math.max(0, index - 48);
  return content.slice(start, index + query.length + 80).replace(/\s+/g, ' ').trim();
}

export function searchWorkspaceIndex(
  index: WorkspaceIndex,
  query: string,
  limit = 30,
): WorkspaceIndexSearchResult[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return index.recentDocuments.slice(0, limit).map((document) => ({
      document,
      match: 'name',
      score: 1,
      snippet: document.relativePath,
    }));
  }

  return index.documents
    .map((document): WorkspaceIndexSearchResult | null => {
      const search = getWorkspaceDocumentSearchCache(document);
      const heading = search.headings.find((item) => item.normalizedTitle.includes(normalizedQuery));
      const contentMatch = search.content.includes(normalizedQuery);
      const recentBoost = document.recentRank === undefined ? 0 : Math.max(1, 12 - document.recentRank);

      if (search.title === normalizedQuery) {
        return { document, match: 'title' as const, score: 120 + recentBoost, snippet: document.title };
      }
      if (search.name === normalizedQuery) {
        return { document, match: 'name' as const, score: 110 + recentBoost, snippet: document.name };
      }
      if (search.title.includes(normalizedQuery)) {
        return { document, match: 'title' as const, score: 90 + recentBoost, snippet: document.title };
      }
      if (search.name.includes(normalizedQuery)) {
        return { document, match: 'name' as const, score: 80 + recentBoost, snippet: document.name };
      }
      if (search.relativePath.includes(normalizedQuery)) {
        return { document, match: 'path' as const, score: 55 + recentBoost, snippet: document.relativePath };
      }
      if (heading) {
        return { document, match: 'heading' as const, score: 45 + recentBoost, snippet: heading.title };
      }
      if (contentMatch) {
        return {
          document,
          match: 'content' as const,
          score: 25 + recentBoost,
          snippet: contentSnippet(document.content, search.content, query),
        };
      }
      return null;
    })
    .filter((result): result is WorkspaceIndexSearchResult => Boolean(result))
    .sort((a, b) => b.score - a.score || a.document.relativePath.localeCompare(b.document.relativePath))
    .slice(0, limit);
}

export function rankWorkspaceIndexDocuments(
  index: WorkspaceIndex,
  query: string,
  limit = 30,
): WorkspaceIndexSearchResult[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    const recentPaths = new Set(index.recentDocuments.map((document) => normalizePathForCompare(document.path)));
    const rest = index.documents
      .filter((document) => !recentPaths.has(normalizePathForCompare(document.path)))
      .sort((a, b) => (
        (b.modifiedAt ?? 0) - (a.modifiedAt ?? 0) ||
        a.relativePath.localeCompare(b.relativePath, undefined, { numeric: true, sensitivity: 'base' })
      ));
    return [...index.recentDocuments, ...rest].slice(0, limit).map((document) => ({
      document,
      match: 'name',
      score: document.recentRank === undefined ? 1 : 20 - document.recentRank,
      snippet: document.relativePath,
    }));
  }

  return index.documents
    .map((document): WorkspaceIndexSearchResult | null => {
      const search = getWorkspaceDocumentSearchCache(document);
      const heading = search.headings.find((item) => item.normalizedTitle.includes(normalizedQuery));
      const recentBoost = document.recentRank === undefined ? 0 : Math.max(1, 12 - document.recentRank);

      if (search.title === normalizedQuery) {
        return { document, match: 'title' as const, score: 120 + recentBoost, snippet: document.relativePath };
      }
      if (search.name === normalizedQuery) {
        return { document, match: 'name' as const, score: 110 + recentBoost, snippet: document.relativePath };
      }
      if (search.title.includes(normalizedQuery)) {
        return { document, match: 'title' as const, score: 90 + recentBoost, snippet: document.relativePath };
      }
      if (search.name.includes(normalizedQuery)) {
        return { document, match: 'name' as const, score: 80 + recentBoost, snippet: document.relativePath };
      }
      if (search.relativePath.includes(normalizedQuery)) {
        return { document, match: 'path' as const, score: 55 + recentBoost, snippet: document.relativePath };
      }
      if (heading) {
        return { document, match: 'heading' as const, score: 45 + recentBoost, snippet: heading.title };
      }
      return null;
    })
    .filter((result): result is WorkspaceIndexSearchResult => Boolean(result))
    .sort((a, b) => b.score - a.score || a.document.relativePath.localeCompare(b.document.relativePath))
    .slice(0, limit);
}

export function getWorkspaceIndexBacklinks(index: WorkspaceIndex, path: string): WorkspaceIndexBacklink[] {
  return index.backlinksByPath.get(normalizePathForCompare(path)) ?? [];
}

export interface WorkspaceIndexDocumentRelations {
  backlinks: WorkspaceIndexBacklink[];
  hasRelations: boolean;
  outgoingLinks: WorkspaceIndexLink[];
}

function getMarkdownDocumentKeys(index: WorkspaceIndex) {
  return new Set(
    index.documents
      .filter((document) => document.profile === 'markdown')
      .map((document) => normalizePathForCompare(document.path)),
  );
}

export function getWorkspaceIndexDocumentRelations(
  index: WorkspaceIndex,
  path: string,
): WorkspaceIndexDocumentRelations {
  const documentKey = normalizePathForCompare(path);
  const document = index.documentByPath.get(documentKey);
  if (!document || document.profile !== 'markdown') {
    return { backlinks: [], hasRelations: false, outgoingLinks: [] };
  }

  const markdownDocumentKeys = getMarkdownDocumentKeys(index);
  const outgoingLinks = document.links.filter((link) => {
    if (!link.resolvedPath) return false;
    const targetKey = normalizePathForCompare(link.resolvedPath);
    return targetKey !== documentKey && markdownDocumentKeys.has(targetKey);
  });
  const backlinks = getWorkspaceIndexBacklinks(index, path);

  return {
    backlinks,
    hasRelations: outgoingLinks.length > 0 || backlinks.length > 0,
    outgoingLinks,
  };
}

export function hasWorkspaceIndexDocumentRelations(index: WorkspaceIndex, path: string): boolean {
  return getWorkspaceIndexDocumentRelations(index, path).hasRelations;
}

export function getWorkspaceIndexLinkFiles(index: WorkspaceIndex) {
  return index.documents
    .filter((document) => document.profile === 'markdown')
    .map((document) => ({
      headings: document.headings.map((heading) => ({ slug: heading.slug, title: heading.title })),
      name: document.name,
      path: document.path,
      title: document.title,
    }));
}

export type {
  WorkspaceIndex,
  WorkspaceIndexBacklink,
  WorkspaceIndexedDocument,
  WorkspaceIndexSearchResult,
} from './workspaceIndex';
