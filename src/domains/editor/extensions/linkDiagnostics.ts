import { getMarkdownHeadingSlug } from './headingSlug';
import { t } from '../../i18n';
import { extractMarkdownDocumentHeadings } from '../../markdown/headings';

export type LinkDiagnosticKind = 'empty-target' | 'missing-heading' | 'missing-file';

export interface LinkDiagnostic {
  column: number;
  kind: LinkDiagnosticKind;
  line: number;
  message: string;
  target: string;
}

interface LinkScanContext {
  currentPath?: string;
  normalizedWorkspaceFiles?: ReadonlySet<string>;
  validateImageTargets?: boolean;
  workspaceFiles?: string[];
  workspaceRoot?: string | null;
}

interface NormalizedLinkScanContext extends LinkScanContext {
  normalizedWorkspaceFiles?: ReadonlySet<string>;
}

const MARKDOWN_LINK_RE = /!?\[[^\]\n]*\]\(([^)\n]*)\)/g;
const URL_SCHEME_RE = /^[a-z][a-z0-9+.-]*:/i;

function dirname(path: string): string {
  const parts = path.split(/[\\/]/);
  parts.pop();
  return parts.join(path.includes('\\') ? '\\' : '/');
}

function joinPath(base: string, target: string): string {
  const trimmedBase = base.replace(/[\\/]+$/, '');
  const sep = base.includes('\\') ? '\\' : '/';
  return `${trimmedBase}${sep}${target}`;
}

function normalizePath(path: string): string {
  const parts: string[] = [];
  path.replace(/\\/g, '/').split('/').forEach((part) => {
    if (!part || part === '.') return;
    if (part === '..') {
      parts.pop();
      return;
    }
    parts.push(part);
  });
  return parts.join('/').toLowerCase();
}

export { getMarkdownHeadingSlug };

export function createMarkdownLinkWorkspaceFileSet(workspaceFiles: readonly string[]) {
  return new Set(workspaceFiles.map(normalizePath));
}

function collectHeadingSlugs(content: string): Set<string> {
  return new Set(extractMarkdownDocumentHeadings(content).map((heading) => heading.slug));
}

function extractTarget(rawTarget: string): string {
  const trimmed = rawTarget.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('<') && trimmed.includes('>')) {
    return trimmed.slice(1, trimmed.indexOf('>'));
  }
  return trimmed.split(/\s+/)[0];
}

function stripTargetMetadata(target: string) {
  const [withoutHash, hash = ''] = target.split('#');
  const [path] = withoutHash.split('?');
  return {
    path,
    hash,
  };
}

function safeDecodeURIComponent(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function isExternalTarget(target: string): boolean {
  return URL_SCHEME_RE.test(target) || target.startsWith('//');
}

function normalizeLinkScanContext(context: LinkScanContext): NormalizedLinkScanContext {
  if (context.normalizedWorkspaceFiles) return context;
  if (!context.workspaceFiles?.length) return context;
  return {
    ...context,
    normalizedWorkspaceFiles: createMarkdownLinkWorkspaceFileSet(context.workspaceFiles),
  };
}

function targetExists(targetPath: string, context: NormalizedLinkScanContext): boolean {
  if (!context.normalizedWorkspaceFiles?.size) return true;

  const candidates = new Set<string>();
  candidates.add(normalizePath(targetPath));
  if (context.currentPath) candidates.add(normalizePath(joinPath(dirname(context.currentPath), targetPath)));
  if (context.workspaceRoot) candidates.add(normalizePath(joinPath(context.workspaceRoot, targetPath)));

  return [...candidates].some((candidate) => context.normalizedWorkspaceFiles?.has(candidate));
}

export function scanMarkdownLinks(content: string, context: LinkScanContext = {}): LinkDiagnostic[] {
  const diagnostics: LinkDiagnostic[] = [];
  const normalizedContext = normalizeLinkScanContext(context);
  const headingSlugs = collectHeadingSlugs(content);
  const lines = content.split('\n');

  lines.forEach((lineText, lineIndex) => {
    for (const match of lineText.matchAll(MARKDOWN_LINK_RE)) {
      const target = extractTarget(match[1]);
      const column = (match.index ?? 0) + 1;

      if (!target) {
        diagnostics.push({
          column,
          kind: 'empty-target',
          line: lineIndex + 1,
          message: t('diagnostics.link.emptyTarget.message'),
          target,
        });
        continue;
      }

      if (isExternalTarget(target)) continue;

      const isImageLink = lineText.slice(match.index ?? 0).startsWith('!');
      const { path, hash } = stripTargetMetadata(target);
      if (!path && hash) {
        const slug = safeDecodeURIComponent(hash).replace(/^#/, '');
        if (!headingSlugs.has(slug)) {
          diagnostics.push({
            column,
            kind: 'missing-heading',
            line: lineIndex + 1,
            message: t('diagnostics.link.missingHeading.message', { slug }),
            target,
          });
        }
        continue;
      }

      if (isImageLink && !context.validateImageTargets) continue;

      if (path && !targetExists(safeDecodeURIComponent(path), normalizedContext)) {
        diagnostics.push({
          column,
          kind: 'missing-file',
          line: lineIndex + 1,
          message: t('diagnostics.link.missingFile.message', { path }),
          target,
        });
      }
    }
  });

  return diagnostics;
}
