import { markdownToHtml } from '../../lib/markdownToHtml';
import katex from 'katex';
import {
  headingDiagnosticsToPrismDiagnostics,
  imageDiagnosticsToPrismDiagnostics,
  linkDiagnosticsToPrismDiagnostics,
  tableDiagnosticsToPrismDiagnostics,
} from '../diagnostics/adapters';
import { createPrismDiagnosticId, type PrismDiagnostic } from '../diagnostics/types';
import { scanHeadingAnchorDiagnostics } from '../editor/extensions/headingDiagnostics';
import { scanMarkdownImageDiagnostics } from '../editor/extensions/imageDiagnostics';
import { scanMarkdownLinks } from '../editor/extensions/linkDiagnostics';
import { scanMarkdownTableDiagnostics } from '../editor/extensions/tables';
import { t } from '../i18n';
import { exportResourceExists } from './resources/exportResourceClient';
import type { ExportFormat } from './types';

interface ExportPreflightInput {
  content: string;
  documentPath?: string;
  format: ExportFormat;
  workspaceFiles?: string[];
  workspaceRoot?: string | null;
}

interface MermaidFence {
  code: string;
  line: number;
}

const MERMAID_FENCE_RE = /^```(?:mermaid|mmd)[^\n]*\n([\s\S]*?)^```/gim;
const DISPLAY_MATH_RE = /\$\$([\s\S]*?)\$\$/g;
const INLINE_MATH_RE = /(^|[^\\$])\$([^\n$]+?)\$/g;

function formatError(error: unknown) {
  if (error instanceof Error && error.message.trim()) return error.message.trim();
  if (typeof error === 'string' && error.trim()) return error.trim();
  return t('common.unknown');
}

function lineAtOffset(source: string, offset: number) {
  return source.slice(0, offset).split('\n').length;
}

function createRenderDiagnostic(input: Omit<PrismDiagnostic, 'id' | 'kind' | 'severity' | 'source'>) {
  const diagnostic = {
    ...input,
    kind: 'render',
    severity: 'error',
    source: 'render-diagnostics',
  } satisfies PrismDiagnostic;
  return {
    ...diagnostic,
    id: createPrismDiagnosticId(diagnostic),
  };
}

function createKatexDiagnostic(error: unknown, line: number): PrismDiagnostic {
  return createRenderDiagnostic({
    action: t('diagnostics.render.katex.action'),
    line,
    message: t('diagnostics.render.katex.messageWithReason', { message: formatError(error) }),
    reason: t('diagnostics.render.katex.reason'),
    target: 'katex',
  });
}

function scanKatexSourceDiagnostics(content: string): PrismDiagnostic[] {
  const diagnostics: PrismDiagnostic[] = [];
  const displayRanges: Array<{ from: number; to: number }> = [];

  for (const match of content.matchAll(DISPLAY_MATH_RE)) {
    const from = match.index ?? 0;
    displayRanges.push({ from, to: from + match[0].length });
    try {
      katex.renderToString((match[1] ?? '').trim(), {
        displayMode: true,
        throwOnError: true,
      });
    } catch (error) {
      diagnostics.push(createKatexDiagnostic(error, lineAtOffset(content, from)));
    }
  }

  for (const match of content.matchAll(INLINE_MATH_RE)) {
    const from = (match.index ?? 0) + match[1].length;
    if (displayRanges.some((range) => from >= range.from && from < range.to)) continue;

    try {
      katex.renderToString((match[2] ?? '').trim(), {
        displayMode: false,
        throwOnError: true,
      });
    } catch (error) {
      diagnostics.push(createKatexDiagnostic(error, lineAtOffset(content, from)));
    }
  }

  return diagnostics;
}

export function scanMarkdownKatexDiagnostics(content: string): PrismDiagnostic[] {
  const sourceDiagnostics = scanKatexSourceDiagnostics(content);
  if (sourceDiagnostics.length > 0) return sourceDiagnostics;

  try {
    const html = markdownToHtml(content, { frontMatterMode: 'metadata' });
    if (typeof DOMParser === 'undefined') return [];

    const parsed = new DOMParser().parseFromString(html, 'text/html');
    return Array.from(parsed.querySelectorAll<HTMLElement>('.katex-error')).map((element) => {
      const sourceElement = element.closest<HTMLElement>('[data-source-line], [data-line]');
      const lineValue = sourceElement?.getAttribute('data-source-line')
        ?? sourceElement?.getAttribute('data-line')
        ?? '';
      const line = Number.parseInt(lineValue, 10);
      const message = element.getAttribute('title') || element.textContent || t('diagnostics.render.katex.message');
      return createRenderDiagnostic({
        action: t('diagnostics.render.katex.action'),
        line: Number.isFinite(line) ? line : undefined,
        message: t('diagnostics.render.katex.messageWithReason', { message }),
        reason: t('diagnostics.render.katex.reason'),
        target: 'katex',
      });
    });
  } catch (error) {
    return [createRenderDiagnostic({
      action: t('diagnostics.render.preview.action'),
      line: 1,
      message: t('diagnostics.render.preview.message', { message: formatError(error) }),
      reason: t('diagnostics.render.preview.reason'),
      target: 'preview',
    })];
  }
}

function collectMermaidFences(content: string): MermaidFence[] {
  return Array.from(content.matchAll(MERMAID_FENCE_RE)).map((match) => ({
    code: match[1] ?? '',
    line: lineAtOffset(content, match.index ?? 0),
  }));
}

function createMermaidSandbox() {
  const sandbox = document.createElement('div');
  sandbox.dataset.prismExportPreflightMermaid = 'true';
  sandbox.setAttribute('aria-hidden', 'true');
  Object.assign(sandbox.style, {
    position: 'absolute',
    inset: '0 auto auto -10000px',
    width: '800px',
    height: '600px',
    overflow: 'hidden',
    visibility: 'hidden',
    pointerEvents: 'none',
  });
  document.body.appendChild(sandbox);
  return sandbox;
}

async function scanMarkdownMermaidDiagnostics(content: string): Promise<PrismDiagnostic[]> {
  if (typeof document === 'undefined') return [];

  const fences = collectMermaidFences(content);
  if (fences.length === 0) return [];

  const diagnostics: PrismDiagnostic[] = [];
  const { default: mermaid } = await import('mermaid');
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'strict',
    suppressErrorRendering: true,
  });

  for (const [index, fence] of fences.entries()) {
    if (!fence.code.trim()) {
      diagnostics.push(createRenderDiagnostic({
        action: t('diagnostics.render.mermaid.action'),
        line: fence.line,
        message: t('diagnostics.render.mermaid.empty'),
        reason: t('diagnostics.render.mermaid.reason'),
        target: 'mermaid',
      }));
      continue;
    }

    const sandbox = createMermaidSandbox();
    try {
      await mermaid.render(`prism-preflight-${Date.now()}-${index}`, fence.code, sandbox);
    } catch (error) {
      diagnostics.push(createRenderDiagnostic({
        action: t('diagnostics.render.mermaid.action'),
        line: fence.line,
        message: t('diagnostics.render.mermaid.message', { message: formatError(error) }),
        reason: t('diagnostics.render.mermaid.reason'),
        target: 'mermaid',
      }));
    } finally {
      sandbox.remove();
    }
  }

  return diagnostics;
}

export async function scanMarkdownRenderDiagnostics(content: string): Promise<PrismDiagnostic[]> {
  return [
    ...scanMarkdownKatexDiagnostics(content),
    ...await scanMarkdownMermaidDiagnostics(content),
  ];
}

export async function buildExportPreflightDiagnostics(input: ExportPreflightInput): Promise<PrismDiagnostic[]> {
  const imageDiagnostics = await scanMarkdownImageDiagnostics(input.content, {
    documentPath: input.documentPath,
    existsPath: exportResourceExists,
  });
  const linkDiagnostics = scanMarkdownLinks(input.content, {
    currentPath: input.documentPath,
    workspaceFiles: input.workspaceFiles,
    workspaceRoot: input.workspaceRoot,
  });
  const headingDiagnostics = scanHeadingAnchorDiagnostics(input.content);
  const tableDiagnostics = scanMarkdownTableDiagnostics(input.content);
  const renderDiagnostics = await scanMarkdownRenderDiagnostics(input.content);

  return [
    ...linkDiagnosticsToPrismDiagnostics(linkDiagnostics),
    ...headingDiagnosticsToPrismDiagnostics(headingDiagnostics),
    ...imageDiagnosticsToPrismDiagnostics(imageDiagnostics),
    ...tableDiagnosticsToPrismDiagnostics(tableDiagnostics),
    ...renderDiagnostics,
  ];
}
