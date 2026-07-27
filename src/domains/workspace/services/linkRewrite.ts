import {
  extractMarkdownDocumentLinks,
  extractMarkdownDocumentImages,
} from '../../markdown/links';
import { resolveDocumentLinkTarget, type DocumentLinkFile } from './documentLinks';
import {
  basename,
  dirname,
  isSamePath,
  joinPath,
  normalizePathForCompare,
} from './path';

const MARKDOWN_FILE_RE = /\.(md|markdown)$/i;
const URL_SCHEME_RE = /^[a-z][a-z0-9+.-]*:/i;

export interface LinkRewriteReference {
  /** 1-based column of the link opener in the source line. */
  column: number;
  kind: 'markdown' | 'wiki';
  /** 1-based line number in the source document. */
  line: number;
  nextTarget: string;
  target: string;
}

export interface LinkRewriteResult {
  content: string;
  references: LinkRewriteReference[];
}

export interface RewriteDocumentLinksInput {
  content: string;
  /** Absolute path of the document being rewritten. */
  documentPath: string;
  /** Absolute path the renamed/moved file now lives at. */
  nextPath: string;
  /** Absolute path the renamed/moved file used to live at. */
  previousPath: string;
  /** Workspace files as seen *before* the rename, used to resolve link targets. */
  workspaceFiles: DocumentLinkFile[];
  workspaceRoot?: string | null;
}

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

function stripMarkdownExtension(value: string) {
  return value.replace(MARKDOWN_FILE_RE, '');
}

function splitTargetMetadata(target: string) {
  const hashIndex = target.indexOf('#');
  const queryIndex = target.indexOf('?');
  const cutIndex = [hashIndex, queryIndex].filter((index) => index >= 0).sort((a, b) => a - b)[0];
  return cutIndex === undefined
    ? { path: target, suffix: '' }
    : { path: target.slice(0, cutIndex), suffix: target.slice(cutIndex) };
}

function isExternalTarget(target: string) {
  return URL_SCHEME_RE.test(target) || target.startsWith('//');
}

function relativePathBetween(fromDir: string, toPath: string) {
  const fromParts = normalizePathParts(fromDir).split('/').filter(Boolean);
  const toParts = normalizePathParts(toPath).split('/').filter(Boolean);

  let shared = 0;
  while (
    shared < fromParts.length
    && shared < toParts.length
    && normalizePathForCompare(fromParts[shared]) === normalizePathForCompare(toParts[shared])
  ) {
    shared += 1;
  }

  const upward = fromParts.length - shared;
  const segments = [...Array.from({ length: upward }, () => '..'), ...toParts.slice(shared)];
  const joined = segments.join('/');
  return joined || basename(toPath);
}

/**
 * Preserve the author's original spelling style: if the old target had no
 * markdown extension (wiki-style or extension-less markdown link), keep it off.
 */
function applyTargetStyle(nextTarget: string, previousTarget: string) {
  const hadExtension = MARKDOWN_FILE_RE.test(previousTarget);
  if (hadExtension) return nextTarget;
  return stripMarkdownExtension(nextTarget);
}

function encodeTargetLikeOriginal(nextTarget: string, previousTarget: string) {
  const wasEncoded = previousTarget !== decodeURIComponentSafe(previousTarget);
  if (!wasEncoded) return nextTarget;
  return nextTarget.split('/').map((segment) => encodeURIComponent(segment)).join('/');
}

function decodeURIComponentSafe(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/**
 * Ranges of the document that must not be touched: fenced code blocks and
 * inline code spans. Link syntax inside them is sample text, not a reference.
 */
function protectedRanges(content: string): Array<[number, number]> {
  const ranges: Array<[number, number]> = [];
  const fenceRe = /^([ \t]*)(`{3,}|~{3,})[^\n]*$/gm;
  let openFence: { indent: string; marker: string; start: number } | null = null;

  for (const match of content.matchAll(fenceRe)) {
    const start = match.index ?? 0;
    const marker = match[2];
    if (!openFence) {
      openFence = { indent: match[1], marker, start };
      continue;
    }
    if (marker[0] === openFence.marker[0] && marker.length >= openFence.marker.length) {
      ranges.push([openFence.start, start + match[0].length]);
      openFence = null;
    }
  }
  if (openFence) ranges.push([openFence.start, content.length]);

  const inlineRe = /(`+)(?:[^`]|(?!\1)`)*\1/g;
  for (const match of content.matchAll(inlineRe)) {
    const start = match.index ?? 0;
    if (ranges.some(([from, to]) => start >= from && start < to)) continue;
    ranges.push([start, start + match[0].length]);
  }

  return ranges;
}

function createOffsetReader(content: string) {
  const lineStarts = [0];
  for (let index = 0; index < content.length; index += 1) {
    if (content.charCodeAt(index) === 10) lineStarts.push(index + 1);
  }
  return (line: number, column: number) => (lineStarts[line - 1] ?? 0) + (column - 1);
}

interface TargetReplacement {
  end: number;
  reference: LinkRewriteReference;
  start: number;
  text: string;
}

function applyReplacements(content: string, replacements: TargetReplacement[]): LinkRewriteResult {
  if (replacements.length === 0) return { content, references: [] };

  const sorted = [...replacements].sort((a, b) => a.start - b.start);
  const applied: TargetReplacement[] = [];
  let nextContent = '';
  let cursor = 0;

  sorted.forEach((replacement) => {
    if (replacement.start < cursor) return;
    nextContent += content.slice(cursor, replacement.start) + replacement.text;
    cursor = replacement.end;
    applied.push(replacement);
  });
  nextContent += content.slice(cursor);

  return { content: nextContent, references: applied.map((item) => item.reference) };
}

/**
 * Locate the exact span of the target inside a link, so a label that repeats
 * the target text is never rewritten by mistake.
 */
function findTargetSpan(
  content: string,
  openerOffset: number,
  kind: 'markdown' | 'wiki',
  target: string,
): { end: number; start: number } | null {
  if (kind === 'wiki') {
    // `[[target]]` / `[[target|label]]` — the target follows the `[[` opener.
    const start = openerOffset + 2;
    return content.startsWith(target, start) ? { end: start + target.length, start } : null;
  }

  // `[label](target)` — labels cannot contain `]`, so the first `](` after the
  // opener delimits the target.
  const labelEnd = content.indexOf('](', openerOffset);
  if (labelEnd < 0) return null;
  const start = labelEnd + 2;
  return content.startsWith(target, start) ? { end: start + target.length, start } : null;
}

/**
 * Rewrite every link in `content` that resolves to `previousPath` so it points
 * at `nextPath` instead. Targets are resolved through the same resolver the
 * link diagnostics use, so relative paths, wiki aliases, extension-less links
 * and percent-encoded targets are all recognised.
 */
export function rewriteDocumentLinksForMovedPath(
  input: RewriteDocumentLinksInput,
): LinkRewriteResult {
  const {
    content,
    documentPath,
    nextPath,
    previousPath,
    workspaceFiles,
    workspaceRoot,
  } = input;

  if (isSamePath(previousPath, nextPath)) return { content, references: [] };

  const ranges = protectedRanges(content);
  const offsetAt = createOffsetReader(content);
  const isProtected = (offset: number) => ranges.some(([from, to]) => offset >= from && offset < to);

  const links = extractMarkdownDocumentLinks(content);
  const images = extractMarkdownDocumentImages(content);
  const replacements: TargetReplacement[] = [];

  const collect = (
    kind: 'markdown' | 'wiki',
    reference: { column: number; line: number; target: string },
  ) => {
    const openerOffset = offsetAt(reference.line, reference.column);
    if (isProtected(openerOffset)) return;

    const { path: targetPath, suffix } = splitTargetMetadata(reference.target);
    if (!targetPath.trim() || isExternalTarget(targetPath)) return;

    const resolved = resolveDocumentLinkTarget({
      kind,
      sourcePath: documentPath,
      target: reference.target,
      workspaceFiles,
      workspaceRoot,
    });
    if (!resolved || !isSamePath(resolved.path, previousPath)) return;

    const nextTargetPath = kind === 'wiki'
      ? nextWikiTarget(nextPath, targetPath, workspaceRoot)
      : nextMarkdownTarget(nextPath, targetPath, documentPath);
    const nextTarget = `${nextTargetPath}${suffix}`;
    if (nextTarget === reference.target) return;

    const span = findTargetSpan(content, openerOffset, kind, reference.target);
    if (!span) return;

    replacements.push({
      end: span.end,
      reference: {
        column: reference.column,
        kind,
        line: reference.line,
        nextTarget,
        target: reference.target,
      },
      start: span.start,
      text: nextTarget,
    });
  };

  links.forEach((link) => collect(link.kind, link));
  images.forEach((image) => collect('markdown', image));

  return applyReplacements(content, replacements);
}

function nextMarkdownTarget(nextPath: string, previousTarget: string, documentPath: string) {
  const wasAbsolute = previousTarget.startsWith('/');
  const raw = wasAbsolute
    ? normalizePathParts(nextPath)
    : relativePathBetween(dirname(documentPath), nextPath);
  const styled = applyTargetStyle(raw, previousTarget);
  return encodeTargetLikeOriginal(styled, previousTarget);
}

function nextWikiTarget(nextPath: string, previousTarget: string, workspaceRoot?: string | null) {
  // Wiki links resolve by alias, so keep the shortest form the author used:
  // a bare name stays a bare name, a workspace-relative path stays relative.
  const usedPathForm = previousTarget.includes('/');
  if (!usedPathForm) return stripMarkdownExtension(basename(nextPath));

  const root = workspaceRoot ? normalizePathParts(workspaceRoot).replace(/\/+$/, '') : '';
  const normalized = normalizePathParts(nextPath);
  const relative = root && normalized.startsWith(`${root}/`)
    ? normalized.slice(root.length + 1)
    : normalized;
  return applyTargetStyle(relative, previousTarget);
}

export interface PlanLinkRewriteInput {
  documents: Array<{ content: string; path: string }>;
  nextPath: string;
  previousPath: string;
  workspaceFiles: DocumentLinkFile[];
  workspaceRoot?: string | null;
}

export interface PlannedLinkRewrite {
  content: string;
  path: string;
  references: LinkRewriteReference[];
}

/**
 * Compute the rewrite for every document that references the moved path.
 * Documents without references are omitted, so callers only write what changed.
 */
export function planLinkRewrites(input: PlanLinkRewriteInput): PlannedLinkRewrite[] {
  const { documents, nextPath, previousPath, workspaceFiles, workspaceRoot } = input;

  return documents
    .map((document) => {
      const result = rewriteDocumentLinksForMovedPath({
        content: document.content,
        documentPath: document.path,
        nextPath,
        previousPath,
        workspaceFiles,
        workspaceRoot,
      });
      return { content: result.content, path: document.path, references: result.references };
    })
    .filter((plan) => plan.references.length > 0);
}

/**
 * Rebase links inside a document that itself moved: its relative targets were
 * written against the old directory and must be re-anchored to the new one.
 */
export function rebaseMovedDocumentLinks(input: {
  content: string;
  nextPath: string;
  previousPath: string;
}): LinkRewriteResult {
  const { content, nextPath, previousPath } = input;
  if (normalizePathForCompare(dirname(previousPath)) === normalizePathForCompare(dirname(nextPath))) {
    return { content, references: [] };
  }

  const ranges = protectedRanges(content);
  const offsetAt = createOffsetReader(content);
  const isProtected = (offset: number) => ranges.some(([from, to]) => offset >= from && offset < to);
  const replacements: TargetReplacement[] = [];

  const collect = (
    reference: { column: number; line: number; target: string },
  ) => {
    const openerOffset = offsetAt(reference.line, reference.column);
    if (isProtected(openerOffset)) return;

    const { path: targetPath, suffix } = splitTargetMetadata(reference.target);
    if (!targetPath.trim() || isExternalTarget(targetPath) || targetPath.startsWith('/')) return;

    const resolvedAbsolute = normalizePathParts(
      joinPath(dirname(previousPath), decodeURIComponentSafe(targetPath)),
    );
    const nextTargetPath = encodeTargetLikeOriginal(
      relativePathBetween(dirname(nextPath), resolvedAbsolute),
      targetPath,
    );
    const nextTarget = `${nextTargetPath}${suffix}`;
    if (nextTarget === reference.target) return;

    const span = findTargetSpan(content, openerOffset, 'markdown', reference.target);
    if (!span) return;

    replacements.push({
      end: span.end,
      reference: {
        column: reference.column,
        kind: 'markdown',
        line: reference.line,
        nextTarget,
        target: reference.target,
      },
      start: span.start,
      text: nextTarget,
    });
  };

  // Only markdown-style targets are directory-relative; wiki links resolve by
  // alias and therefore survive a move untouched.
  extractMarkdownDocumentLinks(content)
    .filter((link) => link.kind === 'markdown')
    .forEach((link) => collect(link));
  extractMarkdownDocumentImages(content).forEach((image) => collect(image));

  return applyReplacements(content, replacements);
}
