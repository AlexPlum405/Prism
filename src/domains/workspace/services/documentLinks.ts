import {
  extractMarkdownDocumentLinks,
  type MarkdownDocumentLinkKind,
  type MarkdownDocumentLinkReference,
} from '../../markdown/links';
import {
  basename,
  dirname,
  joinPath,
  normalizePathForCompare,
} from './path';

export type DocumentLinkKind = MarkdownDocumentLinkKind;

export interface DocumentLinkFile {
  headings?: Array<{ slug: string; title: string }>;
  name: string;
  path: string;
  title?: string;
}

export interface ResolveDocumentLinkInput {
  kind: DocumentLinkKind;
  sourcePath?: string;
  target: string;
  workspaceFiles: DocumentLinkFile[];
  workspaceRoot?: string | null;
}

export interface ResolvedDocumentLink {
  path: string;
}

export type DocumentLinkReference = MarkdownDocumentLinkReference;

interface DocumentLinkLookup {
  byAlias: Map<string, DocumentLinkFile>;
  byPath: Map<string, DocumentLinkFile>;
}

const MARKDOWN_FILE_RE = /\.(md|markdown)$/i;
const URL_SCHEME_RE = /^[a-z][a-z0-9+.-]*:/i;
const lookupCache = new WeakMap<DocumentLinkFile[], Map<string, DocumentLinkLookup>>();

function normalizePathParts(path: string) {
  const parts: string[] = [];
  path.replace(/\\/g, '/').split('/').forEach((part) => {
    if (!part || part === '.') return;
    if (part === '..') {
      parts.pop();
      return;
    }
    parts.push(part);
  });
  return path.startsWith('/') ? `/${parts.join('/')}` : parts.join('/');
}

function stripMarkdownExtension(path: string) {
  return path.replace(MARKDOWN_FILE_RE, '');
}

function stripTargetMetadata(target: string) {
  const [withoutHash] = target.split('#');
  const [withoutQuery] = withoutHash.split('?');
  return withoutQuery.trim();
}

function decodeTargetPath(target: string) {
  try {
    return decodeURIComponent(target);
  } catch {
    return target;
  }
}

function targetPathVariants(target: string) {
  const stripped = stripTargetMetadata(target);
  const decoded = decodeTargetPath(stripped);
  return [...new Set([stripped, decoded])].filter(Boolean);
}

function isExternalTarget(target: string) {
  return URL_SCHEME_RE.test(target) || target.startsWith('//');
}

function getWorkspaceRelativePath(path: string, rootPath?: string | null) {
  const normalizedPath = normalizePathParts(path);
  const normalizedRoot = rootPath ? normalizePathParts(rootPath).replace(/\/+$/, '') : '';
  if (!normalizedRoot) return normalizedPath;
  return normalizedPath.startsWith(`${normalizedRoot}/`)
    ? normalizedPath.slice(normalizedRoot.length + 1)
    : normalizedPath;
}

function markdownCandidates(input: ResolveDocumentLinkInput) {
  if (!stripTargetMetadata(input.target) || isExternalTarget(input.target)) return [];

  const baseDir = input.sourcePath
    ? dirname(input.sourcePath)
    : input.workspaceRoot ?? '';
  const candidates = targetPathVariants(input.target).flatMap((target) => {
    const resolved = target.startsWith('/')
      ? normalizePathParts(target)
      : normalizePathParts(joinPath(baseDir, target));
    return MARKDOWN_FILE_RE.test(resolved)
      ? [resolved]
      : [resolved, `${resolved}.md`, `${resolved}.markdown`];
  });

  return [...new Set(candidates)];
}

function wikiAliases(file: DocumentLinkFile, rootPath?: string | null) {
  const relative = getWorkspaceRelativePath(file.path, rootPath);
  const aliases = [
    relative,
    stripMarkdownExtension(relative),
    file.title ?? '',
    file.name,
    stripMarkdownExtension(file.name),
    basename(file.path),
    stripMarkdownExtension(basename(file.path)),
  ];
  return new Set(aliases
    .filter(Boolean)
    .map((value) => normalizePathForCompare(normalizePathParts(value))));
}

function normalizedLookupKey(path: string) {
  return normalizePathForCompare(normalizePathParts(path));
}

function getDocumentLinkLookup(
  workspaceFiles: DocumentLinkFile[],
  rootPath?: string | null,
): DocumentLinkLookup {
  const rootKey = rootPath ?? '';
  const cachedByRoot = lookupCache.get(workspaceFiles);
  const cached = cachedByRoot?.get(rootKey);
  if (cached) return cached;

  const lookup: DocumentLinkLookup = {
    byAlias: new Map(),
    byPath: new Map(),
  };

  workspaceFiles.forEach((file) => {
    lookup.byPath.set(normalizedLookupKey(file.path), file);
    wikiAliases(file, rootPath).forEach((alias) => {
      if (!lookup.byAlias.has(alias)) {
        lookup.byAlias.set(alias, file);
      }
    });
  });

  const nextByRoot = cachedByRoot ?? new Map<string, DocumentLinkLookup>();
  nextByRoot.set(rootKey, lookup);
  if (!cachedByRoot) lookupCache.set(workspaceFiles, nextByRoot);
  return lookup;
}

function resolveMarkdownLink(input: ResolveDocumentLinkInput): ResolvedDocumentLink | null {
  const candidates = markdownCandidates(input);
  if (candidates.length === 0) return null;
  const lookup = getDocumentLinkLookup(input.workspaceFiles, input.workspaceRoot);
  const match = candidates
    .map((candidate) => lookup.byPath.get(normalizedLookupKey(candidate)))
    .find(Boolean);
  return match ? { path: match.path } : null;
}

function resolveWikiLink(input: ResolveDocumentLinkInput): ResolvedDocumentLink | null {
  if (!stripTargetMetadata(input.target) || isExternalTarget(input.target)) return null;

  const lookup = getDocumentLinkLookup(input.workspaceFiles, input.workspaceRoot);
  const match = targetPathVariants(input.target)
    .map((target) => normalizePathForCompare(normalizePathParts(stripMarkdownExtension(target))))
    .map((target) => lookup.byAlias.get(target))
    .find(Boolean);
  return match ? { path: match.path } : null;
}

export function resolveDocumentLinkTarget(input: ResolveDocumentLinkInput): ResolvedDocumentLink | null {
  return input.kind === 'wiki'
    ? resolveWikiLink(input)
    : resolveMarkdownLink(input);
}

export const extractDocumentLinks = extractMarkdownDocumentLinks;
