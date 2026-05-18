import { basename, dirname, joinPath, normalizePathForCompare } from './path';

export interface BacklinkSourceDocument {
  content: string;
  name: string;
  path: string;
}

export interface BacklinkReference {
  column: number;
  excerpt: string;
  line: number;
  path: string;
  title: string;
}

interface BacklinkScanInput {
  currentPath: string;
  documents: BacklinkSourceDocument[];
  workspaceRoot?: string | null;
}

const MARKDOWN_LINK_RE = /!?\[[^\]\n]*\]\(([^)\n]*)\)/g;
const WIKI_LINK_RE = /\[\[([^\]\n|#]+)(?:#[^\]\n|]*)?(?:\|[^\]\n]*)?\]\]/g;
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
  return parts.join('/');
}

function stripMarkdownExtension(path: string) {
  return path.replace(/\.(md|markdown|txt)$/i, '');
}

function stripTargetMetadata(target: string) {
  const [withoutHash] = target.split('#');
  const [withoutQuery] = withoutHash.split('?');
  return withoutQuery.trim();
}

function isExternalTarget(target: string) {
  return URL_SCHEME_RE.test(target) || target.startsWith('//');
}

function resolveMarkdownTarget(sourcePath: string, rawTarget: string) {
  const target = stripTargetMetadata(rawTarget);
  if (!target || isExternalTarget(target)) return null;
  if (target.startsWith('/')) return normalizePathParts(target);
  return normalizePathParts(joinPath(dirname(sourcePath), target));
}

function getWorkspaceRelativePath(path: string, rootPath?: string | null) {
  const normalizedPath = normalizePathParts(path);
  const normalizedRoot = rootPath ? normalizePathParts(rootPath).replace(/\/+$/, '') : '';
  if (!normalizedRoot) return normalizedPath;
  return normalizedPath.startsWith(`${normalizedRoot}/`)
    ? normalizedPath.slice(normalizedRoot.length + 1)
    : normalizedPath;
}

function getWikiAliases(currentPath: string, workspaceRoot?: string | null) {
  const relative = getWorkspaceRelativePath(currentPath, workspaceRoot);
  return new Set([
    stripMarkdownExtension(relative),
    stripMarkdownExtension(basename(currentPath)),
    relative,
  ].map((value) => normalizePathForCompare(value)));
}

function lineColumnFromIndex(content: string, index: number) {
  const prefix = content.slice(0, index);
  const lines = prefix.split('\n');
  return {
    line: lines.length,
    column: lines[lines.length - 1].length + 1,
  };
}

function excerptForLine(content: string, line: number) {
  return content.split('\n')[line - 1]?.trim().slice(0, 160) ?? '';
}

function pushReference(
  references: BacklinkReference[],
  document: BacklinkSourceDocument,
  content: string,
  index: number,
) {
  const { line, column } = lineColumnFromIndex(content, index);
  references.push({
    path: document.path,
    title: document.name,
    line,
    column,
    excerpt: excerptForLine(content, line),
  });
}

export function scanBacklinks({
  currentPath,
  documents,
  workspaceRoot,
}: BacklinkScanInput): BacklinkReference[] {
  const normalizedCurrentPath = normalizePathForCompare(normalizePathParts(currentPath));
  const wikiAliases = getWikiAliases(currentPath, workspaceRoot);
  const references: BacklinkReference[] = [];

  documents.forEach((document) => {
    if (normalizePathForCompare(normalizePathParts(document.path)) === normalizedCurrentPath) return;

    for (const match of document.content.matchAll(MARKDOWN_LINK_RE)) {
      if (document.content[match.index ?? 0] === '!') continue;
      const rawTarget = match[1]?.trim() ?? '';
      const resolved = resolveMarkdownTarget(document.path, rawTarget);
      if (!resolved) continue;
      if (normalizePathForCompare(resolved) === normalizedCurrentPath) {
        pushReference(references, document, document.content, match.index ?? 0);
      }
    }

    for (const match of document.content.matchAll(WIKI_LINK_RE)) {
      const target = stripTargetMetadata(match[1] ?? '');
      if (wikiAliases.has(normalizePathForCompare(target))) {
        pushReference(references, document, document.content, match.index ?? 0);
      }
    }
  });

  return references.sort((a, b) => (
    a.title.localeCompare(b.title, undefined, { numeric: true, sensitivity: 'base' }) ||
    a.line - b.line ||
    a.column - b.column
  ));
}
