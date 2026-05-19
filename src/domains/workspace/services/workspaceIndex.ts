import { parseDocumentFrontMatter } from '../../editor/extensions/frontMatterProperties';
import { getMarkdownHeadingSlug } from '../../editor/extensions/headingSlug';
import type { FileNode } from '../types';
import { extractDocumentLinks, resolveDocumentLinkTarget, type DocumentLinkKind } from './documentLinks';
import { flattenFiles } from './fileTree';
import { isSupportedMarkdownPath } from './fileAssociation';
import { basename, normalizePathForCompare } from './path';

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
  recentFiles?: WorkspaceIndexRecentFile[];
  workspaceRoot?: string | null;
}

export interface WorkspaceIndexHeading {
  level: number;
  line: number;
  slug: string;
  title: string;
}

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

const MARKDOWN_EXTENSION_RE = /\.(md|markdown|txt)$/i;

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

function splitTags(value: string) {
  return value
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function getFrontMatterLineOffset(content: string, body: string) {
  if (body === content) return 0;
  return content.slice(0, content.length - body.length).split(/\r?\n/).length - 1;
}

function extractMarkdownHeadings(content: string, lineOffset = 0): WorkspaceIndexHeading[] {
  return content.split(/\r?\n/).flatMap((line, index) => {
    const match = line.match(/^(#{1,6})[ \t]+(.+?)[ \t#]*$/);
    if (!match) return [];
    const title = match[2].replace(/`([^`]+)`/g, '$1').trim();
    const slug = getMarkdownHeadingSlug(title);
    if (!title || !slug) return [];
    return [{
      level: match[1].length,
      line: lineOffset + index + 1,
      slug,
      title,
    }];
  });
}

function excerptForLine(content: string, line: number) {
  return content.split(/\r?\n/)[line - 1]?.trim().slice(0, 160) ?? '';
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

function normalizeFrontMatter(content: string): {
  body: string;
  frontMatter: WorkspaceIndexFrontMatter;
  lineOffset: number;
} {
  const parsed = parseDocumentFrontMatter(content);
  return {
    body: parsed.body,
    frontMatter: {
      author: parsed.properties.author,
      date: parsed.properties.date,
      description: parsed.properties.description,
      error: parsed.error,
      exportRaw: parsed.properties.exportRaw,
      hasFrontMatter: parsed.hasFrontMatter,
      status: parsed.properties.status,
      tags: splitTags(parsed.properties.tags),
      title: parsed.properties.title,
    },
    lineOffset: getFrontMatterLineOffset(content, parsed.body),
  };
}

function fallbackTitleForDocument(name: string, headings: WorkspaceIndexHeading[]) {
  return headings[0]?.title || stripMarkdownExtension(basename(name));
}

export function buildWorkspaceIndex(input: WorkspaceIndexBuildInput): WorkspaceIndex {
  const rootPath = input.workspaceRoot ?? null;
  const contentByPath = buildContentMap(input.documents);
  const recentByPath = buildRecentRankMap(input.recentFiles);
  const files = flattenFiles(input.fileTree, rootPath)
    .map(({ node }) => node)
    .filter((node) => isSupportedMarkdownPath(node.path));
  const workspaceFiles = files.map((file) => ({ name: file.name, path: file.path }));

  const documents = files.map((file) => {
    const normalizedPath = normalizePathForCompare(file.path);
    const hasContent = contentByPath.has(normalizedPath);
    const content = contentByPath.get(normalizedPath) ?? file.preview ?? '';
    const { body, frontMatter, lineOffset } = normalizeFrontMatter(content);
    const headings = extractMarkdownHeadings(body, lineOffset);
    const links = extractDocumentLinks(content).map((link) => ({
      ...link,
      resolvedPath: resolveDocumentLinkTarget({
        kind: link.kind,
        sourcePath: file.path,
        target: link.target,
        workspaceFiles,
        workspaceRoot: rootPath,
      })?.path ?? null,
    }));
    const recent = recentByPath.get(normalizedPath);
    const title = frontMatter.title || fallbackTitleForDocument(file.name, headings);

    return {
      content,
      frontMatter,
      headings,
      hasContent,
      lastOpened: recent?.lastOpened,
      links,
      modifiedAt: file.modifiedAt,
      name: file.name,
      path: file.path,
      recentRank: recent?.rank,
      relativePath: getWorkspaceRelativePath(file.path, rootPath),
      size: file.size,
      title,
    } satisfies WorkspaceIndexedDocument;
  }).sort((a, b) => a.relativePath.localeCompare(b.relativePath, undefined, {
    numeric: true,
    sensitivity: 'base',
  }));

  const documentByPath = new Map(documents.map((document) => [
    normalizePathForCompare(document.path),
    document,
  ]));
  const backlinksByPath = new Map<string, WorkspaceIndexBacklink[]>();

  documents.forEach((document) => {
    document.links.forEach((link) => {
      if (!link.resolvedPath) return;
      const targetKey = normalizePathForCompare(link.resolvedPath);
      if (targetKey === normalizePathForCompare(document.path)) return;
      const backlinks = backlinksByPath.get(targetKey) ?? [];
      backlinks.push({
        column: link.column,
        excerpt: excerptForLine(document.content, link.line),
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

  const recentDocuments = documents
    .filter((document) => document.recentRank !== undefined)
    .sort((a, b) => (a.recentRank ?? 0) - (b.recentRank ?? 0));

  return {
    backlinksByPath,
    documentByPath,
    documents,
    generatedAt: Date.now(),
    recentDocuments,
    rootPath,
  };
}

function contentSnippet(content: string, query: string) {
  const normalizedContent = content.toLowerCase();
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
    .map((document) => {
      const name = document.name.toLowerCase();
      const title = document.title.toLowerCase();
      const relativePath = document.relativePath.toLowerCase();
      const heading = document.headings.find((item) => item.title.toLowerCase().includes(normalizedQuery));
      const contentMatch = document.content.toLowerCase().includes(normalizedQuery);
      const recentBoost = document.recentRank === undefined ? 0 : Math.max(1, 12 - document.recentRank);

      if (title === normalizedQuery) {
        return { document, match: 'title' as const, score: 120 + recentBoost, snippet: document.title };
      }
      if (name === normalizedQuery) {
        return { document, match: 'name' as const, score: 110 + recentBoost, snippet: document.name };
      }
      if (title.includes(normalizedQuery)) {
        return { document, match: 'title' as const, score: 90 + recentBoost, snippet: document.title };
      }
      if (name.includes(normalizedQuery)) {
        return { document, match: 'name' as const, score: 80 + recentBoost, snippet: document.name };
      }
      if (relativePath.includes(normalizedQuery)) {
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
          snippet: contentSnippet(document.content, query),
        };
      }
      return null;
    })
    .filter((result): result is WorkspaceIndexSearchResult => Boolean(result))
    .sort((a, b) => b.score - a.score || a.document.relativePath.localeCompare(b.document.relativePath))
    .slice(0, limit);
}
