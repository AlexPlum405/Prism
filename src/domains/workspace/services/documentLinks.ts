import {
  basename,
  dirname,
  isSamePath,
  joinPath,
  normalizePathForCompare,
} from './path';

export type DocumentLinkKind = 'markdown' | 'wiki';

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

export interface DocumentLinkReference {
  column: number;
  kind: DocumentLinkKind;
  label: string;
  line: number;
  target: string;
}

const MARKDOWN_FILE_RE = /\.(md|markdown|txt)$/i;
const MARKDOWN_LINK_RE = /!?\[([^\]\n]*)\]\(([^)\n]*)\)/g;
const WIKI_LINK_RE = /\[\[([^\]\n|#]+)(?:#[^\]\n|]*)?(?:\|([^\]\n]*))?\]\]/g;
const URL_SCHEME_RE = /^[a-z][a-z0-9+.-]*:/i;

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

function isExternalTarget(target: string) {
  return URL_SCHEME_RE.test(target) || target.startsWith('//');
}

function lineColumnFromIndex(content: string, index: number) {
  const prefix = content.slice(0, index);
  const lines = prefix.split('\n');
  return {
    line: lines.length,
    column: lines[lines.length - 1].length + 1,
  };
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
  const target = stripTargetMetadata(input.target);
  if (!target || isExternalTarget(target)) return [];

  const baseDir = input.sourcePath
    ? dirname(input.sourcePath)
    : input.workspaceRoot ?? '';
  const resolved = target.startsWith('/')
    ? normalizePathParts(target)
    : normalizePathParts(joinPath(baseDir, target));
  const candidates = [resolved];

  if (!MARKDOWN_FILE_RE.test(resolved)) {
    candidates.push(`${resolved}.md`, `${resolved}.markdown`);
  }

  return candidates;
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

function resolveMarkdownLink(input: ResolveDocumentLinkInput): ResolvedDocumentLink | null {
  const candidates = markdownCandidates(input);
  const match = input.workspaceFiles.find((file) => (
    candidates.some((candidate) => isSamePath(file.path, candidate))
  ));
  return match ? { path: match.path } : null;
}

function resolveWikiLink(input: ResolveDocumentLinkInput): ResolvedDocumentLink | null {
  const target = stripTargetMetadata(input.target);
  if (!target || isExternalTarget(target)) return null;

  const normalizedTarget = normalizePathForCompare(normalizePathParts(stripMarkdownExtension(target)));
  const match = input.workspaceFiles.find((file) => wikiAliases(file, input.workspaceRoot).has(normalizedTarget));
  return match ? { path: match.path } : null;
}

export function resolveDocumentLinkTarget(input: ResolveDocumentLinkInput): ResolvedDocumentLink | null {
  return input.kind === 'wiki'
    ? resolveWikiLink(input)
    : resolveMarkdownLink(input);
}

export function extractDocumentLinks(content: string): DocumentLinkReference[] {
  const links: DocumentLinkReference[] = [];

  for (const match of content.matchAll(MARKDOWN_LINK_RE)) {
    if (content[match.index ?? 0] === '!') continue;
    const target = match[2]?.trim() ?? '';
    if (!target) continue;
    const { line, column } = lineColumnFromIndex(content, match.index ?? 0);
    links.push({
      kind: 'markdown',
      target,
      label: match[1]?.trim() || target,
      line,
      column,
    });
  }

  for (const match of content.matchAll(WIKI_LINK_RE)) {
    const target = match[1]?.trim() ?? '';
    if (!target) continue;
    const { line, column } = lineColumnFromIndex(content, match.index ?? 0);
    links.push({
      kind: 'wiki',
      target,
      label: match[2]?.trim() || target,
      line,
      column,
    });
  }

  return links.sort((a, b) => a.line - b.line || a.column - b.column);
}
