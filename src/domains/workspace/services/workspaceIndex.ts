import {
  parseMarkdownDocumentModel,
  type MarkdownDocumentHeading,
} from '../../markdown/documentModel';
import type { FileNode } from '../types';
import { resolveDocumentLinkTarget, type DocumentLinkKind } from './documentLinks';
import { flattenFiles } from './fileTree';
import { isSupportedMarkdownPath } from './fileAssociation';
import { basename, isSamePath, normalizePathForCompare } from './path';

export interface WorkspaceIndexSourceDocument {
  content: string;
  path: string;
}

export interface WorkspaceIndexRecentFile {
  lastOpened: number;
  name?: string;
  path: string;
}

export interface WorkspaceIndexBuildInput {
  documents?: WorkspaceIndexSourceDocument[];
  fileTree: FileNode[];
  previousIndex?: WorkspaceIndex | null;
  recentFiles?: WorkspaceIndexRecentFile[];
  workspaceRoot?: string | null;
}

export type WorkspaceIndexHeading = MarkdownDocumentHeading;

export interface WorkspaceIndexFrontMatter {
  author: string;
  date: string;
  description: string;
  error: string | null;
  exportRaw: string;
  hasFrontMatter: boolean;
  status: string;
  tags: string[];
  title: string;
}

export interface WorkspaceIndexLink {
  column: number;
  kind: DocumentLinkKind;
  label: string;
  line: number;
  resolvedPath: string | null;
  target: string;
}

export interface WorkspaceIndexedDocument {
  content: string;
  frontMatter: WorkspaceIndexFrontMatter;
  headings: WorkspaceIndexHeading[];
  hasContent: boolean;
  lastOpened?: number;
  links: WorkspaceIndexLink[];
  modifiedAt?: number;
  name: string;
  path: string;
  recentRank?: number;
  relativePath: string;
  size?: number;
  title: string;
}

export interface WorkspaceIndexBacklink {
  column: number;
  excerpt: string;
  line: number;
  path: string;
  title: string;
}

export interface WorkspaceIndex {
  backlinksByPath: Map<string, WorkspaceIndexBacklink[]>;
  documentByPath: Map<string, WorkspaceIndexedDocument>;
  documents: WorkspaceIndexedDocument[];
  generatedAt: number;
  recentDocuments: WorkspaceIndexedDocument[];
  rootPath: string | null;
}

export interface WorkspaceIndexSearchResult {
  document: WorkspaceIndexedDocument;
  match: 'title' | 'name' | 'path' | 'heading' | 'content';
  score: number;
  snippet: string;
}

interface WorkspaceDocumentSearchCache {
  content: string;
  headings: Array<{ normalizedTitle: string; title: string }>;
  name: string;
  relativePath: string;
  title: string;
}

const MARKDOWN_EXTENSION_RE = /\.(md|markdown|txt)$/i;
const workspaceDocumentSearchCache = new WeakMap<WorkspaceIndexedDocument, WorkspaceDocumentSearchCache>();

type WorkspaceIndexFile = Pick<FileNode, 'modifiedAt' | 'name' | 'path' | 'preview' | 'size'>;

function stripMarkdownExtension(value: string) {
  return value.replace(MARKDOWN_EXTENSION_RE, '');
}

function normalizeSeparators(value: string) {
  return value.replace(/\\/g, '/');
}

function getWorkspaceRelativePath(path: string, rootPath?: string | null) {
  const normalizedPath = normalizeSeparators(path);
  const normalizedRoot = rootPath ? normalizeSeparators(rootPath).replace(/\/+$/, '') : '';
  if (!normalizedRoot) return normalizedPath;
  return normalizedPath.startsWith(`${normalizedRoot}/`)
    ? normalizedPath.slice(normalizedRoot.length + 1)
    : normalizedPath;
}

function excerptForLine(lines: string[], line: number) {
  return lines[line - 1]?.trim().slice(0, 160) ?? '';
}

function buildContentMap(documents: WorkspaceIndexSourceDocument[] = []) {
  return new Map(documents.map((document) => [
    normalizePathForCompare(document.path),
    document.content,
  ]));
}

function buildRecentRankMap(recentFiles: WorkspaceIndexRecentFile[] = []) {
  return new Map(recentFiles.map((file, index) => [
    normalizePathForCompare(file.path),
    { lastOpened: file.lastOpened, rank: index },
  ]));
}

function fallbackTitleForDocument(name: string, headings: WorkspaceIndexHeading[]) {
  return headings[0]?.title || stripMarkdownExtension(basename(name));
}

function getWorkspaceIndexFiles(fileTree: FileNode[], rootPath: string | null) {
  return flattenFiles(fileTree, rootPath)
    .map(({ node }) => node)
    .filter((node) => isSupportedMarkdownPath(node.path));
}

function hasStableMetadata(file: WorkspaceIndexFile) {
  return file.modifiedAt !== undefined || file.size !== undefined;
}

function canReuseIndexedDocument(file: WorkspaceIndexFile, document: WorkspaceIndexedDocument, content?: string) {
  if (!hasStableMetadata(file)) return false;
  if (!isSamePath(file.path, document.path)) return false;
  if (file.modifiedAt !== document.modifiedAt || file.size !== document.size) return false;
  return content === undefined || content === document.content;
}

function applyRecentMetadata(
  document: WorkspaceIndexedDocument,
  recent: { lastOpened: number; rank: number } | undefined,
): WorkspaceIndexedDocument {
  if (document.lastOpened === recent?.lastOpened && document.recentRank === recent?.rank) {
    return document;
  }

  return {
    ...document,
    lastOpened: recent?.lastOpened,
    recentRank: recent?.rank,
  };
}

function buildUnresolvedDocument(input: {
  content: string;
  file: WorkspaceIndexFile;
  hasContent: boolean;
  recent?: { lastOpened: number; rank: number };
  rootPath: string | null;
}): WorkspaceIndexedDocument {
  const {
    content,
    file,
    hasContent,
    recent,
    rootPath,
  } = input;
  const model = parseMarkdownDocumentModel(content);
  const title = model.frontMatter.title || fallbackTitleForDocument(file.name, model.headings);

  return {
    content,
    frontMatter: model.frontMatter,
    headings: model.headings,
    hasContent,
    lastOpened: recent?.lastOpened,
    links: model.links.map((link) => ({
      ...link,
      resolvedPath: null,
    })),
    modifiedAt: file.modifiedAt,
    name: file.name,
    path: file.path,
    recentRank: recent?.rank,
    relativePath: getWorkspaceRelativePath(file.path, rootPath),
    size: file.size,
    title,
  };
}

function sortWorkspaceDocuments(documents: WorkspaceIndexedDocument[]) {
  return [...documents].sort((a, b) => a.relativePath.localeCompare(b.relativePath, undefined, {
    numeric: true,
    sensitivity: 'base',
  }));
}

function resolveWorkspaceDocumentLinks(
  documents: WorkspaceIndexedDocument[],
  rootPath: string | null,
) {
  const workspaceFiles = documents.map((document) => ({
    headings: document.headings.map((heading) => ({ slug: heading.slug, title: heading.title })),
    name: document.name,
    path: document.path,
    title: document.title,
  }));

  return documents.map((document) => ({
    ...document,
    links: document.links.map((link) => ({
      ...link,
      resolvedPath: resolveDocumentLinkTarget({
        kind: link.kind,
        sourcePath: document.path,
        target: link.target,
        workspaceFiles,
        workspaceRoot: rootPath,
      })?.path ?? null,
    })),
  }));
}

function createWorkspaceIndexFromDocuments(
  documents: WorkspaceIndexedDocument[],
  rootPath: string | null,
  generatedAt = Date.now(),
): WorkspaceIndex {
  const sortedDocuments = sortWorkspaceDocuments(documents);
  const resolvedDocuments = resolveWorkspaceDocumentLinks(sortedDocuments, rootPath);

  const documentByPath = new Map(resolvedDocuments.map((document) => [
    normalizePathForCompare(document.path),
    document,
  ]));
  const backlinksByPath = new Map<string, WorkspaceIndexBacklink[]>();

  resolvedDocuments.forEach((document) => {
    const lines = document.links.length > 0 ? document.content.split(/\r?\n/) : [];
    document.links.forEach((link) => {
      if (!link.resolvedPath) return;
      const targetKey = normalizePathForCompare(link.resolvedPath);
      if (targetKey === normalizePathForCompare(document.path)) return;
      const backlinks = backlinksByPath.get(targetKey) ?? [];
      backlinks.push({
        column: link.column,
        excerpt: excerptForLine(lines, link.line),
        line: link.line,
        path: document.path,
        title: document.title,
      });
      backlinksByPath.set(targetKey, backlinks);
    });
  });

  backlinksByPath.forEach((backlinks) => {
    backlinks.sort((a, b) => (
      a.title.localeCompare(b.title, undefined, { numeric: true, sensitivity: 'base' }) ||
      a.line - b.line ||
      a.column - b.column
    ));
  });

  const recentDocuments = resolvedDocuments
    .filter((document) => document.recentRank !== undefined)
    .sort((a, b) => (a.recentRank ?? 0) - (b.recentRank ?? 0));

  return {
    backlinksByPath,
    documentByPath,
    documents: resolvedDocuments,
    generatedAt,
    recentDocuments,
    rootPath,
  };
}

export function buildWorkspaceIndex(input: WorkspaceIndexBuildInput): WorkspaceIndex {
  const rootPath = input.workspaceRoot ?? null;
  const contentByPath = buildContentMap(input.documents);
  const recentByPath = buildRecentRankMap(input.recentFiles);
  const files = getWorkspaceIndexFiles(input.fileTree, rootPath);
  const documents = files.map((file) => {
    const normalizedPath = normalizePathForCompare(file.path);
    const hasContent = contentByPath.has(normalizedPath);
    const content = contentByPath.get(normalizedPath) ?? file.preview ?? '';
    const recent = recentByPath.get(normalizedPath);

    return buildUnresolvedDocument({
      content,
      file,
      hasContent,
      recent,
      rootPath,
    });
  });

  return createWorkspaceIndexFromDocuments(documents, rootPath);
}

export function buildWorkspaceIndexIncremental(input: WorkspaceIndexBuildInput): WorkspaceIndex {
  const rootPath = input.workspaceRoot ?? null;
  const contentByPath = buildContentMap(input.documents);
  const recentByPath = buildRecentRankMap(input.recentFiles);
  const files = getWorkspaceIndexFiles(input.fileTree, rootPath);
  const previousIndex = input.previousIndex ?? null;
  const documents = files.map((file) => {
    const normalizedPath = normalizePathForCompare(file.path);
    const hasContent = contentByPath.has(normalizedPath);
    const content = contentByPath.get(normalizedPath);
    const recent = recentByPath.get(normalizedPath);
    const previousDocument = previousIndex?.documentByPath.get(normalizedPath);

    if (previousDocument && canReuseIndexedDocument(file, previousDocument, content)) {
      return applyRecentMetadata(previousDocument, recent);
    }

    return buildUnresolvedDocument({
      content: content ?? file.preview ?? '',
      file,
      hasContent,
      recent,
      rootPath,
    });
  });

  return createWorkspaceIndexFromDocuments(documents, rootPath);
}

export function applyWorkspaceIndexOverlay(
  baseIndex: WorkspaceIndex,
  input: {
    currentDocument?: WorkspaceIndexSourceDocument | null;
    recentFiles?: WorkspaceIndexRecentFile[];
  },
): WorkspaceIndex {
  const recentByPath = buildRecentRankMap(input.recentFiles);
  const currentDocument = input.currentDocument?.path && MARKDOWN_EXTENSION_RE.test(input.currentDocument.path)
    ? input.currentDocument
    : null;
  const currentDocumentKey = currentDocument
    ? normalizePathForCompare(currentDocument.path)
    : null;

  const documents = baseIndex.documents.map((document) => {
    const normalizedPath = normalizePathForCompare(document.path);
    const recent = recentByPath.get(normalizedPath);

    if (currentDocumentKey && normalizedPath === currentDocumentKey) {
      return buildUnresolvedDocument({
        content: currentDocument?.content ?? '',
        file: {
          modifiedAt: document.modifiedAt,
          name: document.name,
          path: document.path,
          size: document.size,
        },
        hasContent: true,
        recent,
        rootPath: baseIndex.rootPath,
      });
    }

    return applyRecentMetadata(document, recent);
  });

  return createWorkspaceIndexFromDocuments(documents, baseIndex.rootPath, baseIndex.generatedAt);
}

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

export function getWorkspaceIndexLinkFiles(index: WorkspaceIndex) {
  return index.documents.map((document) => ({
    headings: document.headings.map((heading) => ({ slug: heading.slug, title: heading.title })),
    name: document.name,
    path: document.path,
    title: document.title,
  }));
}
