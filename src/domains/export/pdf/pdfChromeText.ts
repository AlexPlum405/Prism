import { getExportTitle } from '../pipeline/exportPipelineContext';
import type { ExportDocumentInput } from '../types';

export type HeaderFooterTextPart =
  | { type: 'text'; value: string }
  | { type: 'page' }
  | { type: 'pages' };

export function getPdfPageNumberLabel(pageIndex: number, pageCount: number) {
  return `${pageIndex + 1} / ${pageCount}`;
}

export function getPdfPageNumberY(marginBottom: number) {
  return Math.max(12, Math.min(28, marginBottom * 0.35));
}

export function getPdfHeaderY(pageHeight: number, marginTop: number, imageHeight: number) {
  return pageHeight - Math.max(18, marginTop * 0.5) - imageHeight / 2;
}

export function getPdfFooterY(marginBottom: number) {
  return getPdfPageNumberY(marginBottom);
}

export function normalizePdfChromeText(value: string) {
  return value.replace(/\s+/g, ' ').trim().slice(0, 160);
}

export function formatPdfHeaderFooterText(
  template: string | undefined,
  input: Pick<ExportDocumentInput, 'filename' | 'title' | 'author' | 'date'>,
  pageIndex: number,
  pageCount: number,
) {
  const normalized = normalizePdfChromeText(template ?? '');
  if (!normalized) return '';
  const values: Record<string, string> = {
    title: getExportTitle(input),
    filename: input.filename,
    author: input.author?.trim() ?? '',
    date: input.date?.trim() ?? '',
    page: String(pageIndex + 1),
    pages: String(pageCount),
  };
  return normalizePdfChromeText(normalized.replace(/\{(title|filename|author|date|page|pages)\}/g, (_, token: string) => values[token] ?? ''));
}

export function buildHeaderFooterTextParts(
  template: string | undefined,
  input: Pick<ExportDocumentInput, 'filename' | 'title' | 'author' | 'date'>,
): HeaderFooterTextPart[] {
  const normalized = normalizePdfChromeText(template ?? '');
  if (!normalized) return [];
  const values: Record<string, string> = {
    title: getExportTitle(input),
    filename: input.filename,
    author: input.author?.trim() ?? '',
    date: input.date?.trim() ?? '',
  };
  const resolved = normalizePdfChromeText(
    normalized.replace(/\{(title|filename|author|date)\}/g, (_, token: string) => values[token] ?? ''),
  );
  const parts: HeaderFooterTextPart[] = [];
  const pattern = /\{(page|pages)\}/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(resolved)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', value: resolved.slice(lastIndex, match.index) });
    }
    parts.push({ type: match[1] === 'pages' ? 'pages' : 'page' });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < resolved.length) {
    parts.push({ type: 'text', value: resolved.slice(lastIndex) });
  }

  return parts.filter((part) => part.type !== 'text' || part.value.length > 0);
}

export function hasHeaderFooterPageToken(template: string | undefined) {
  return /\{(?:page|pages)\}/.test(template ?? '');
}

function clipPdfChromeText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  const suffix = '...';
  const suffixWidth = ctx.measureText(suffix).width;
  if (suffixWidth >= maxWidth) return '';

  let low = 0;
  let high = text.length;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if (ctx.measureText(text.slice(0, mid)).width + suffixWidth <= maxWidth) {
      low = mid;
    } else {
      high = mid - 1;
    }
  }

  return `${text.slice(0, low)}${suffix}`;
}

export function createPdfChromeTextImage(text: string, maxWidth: number) {
  const normalized = normalizePdfChromeText(text);
  if (!normalized || maxWidth <= 0) return null;

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const scale = 2;
  const fontSize = 8.5;
  const height = 14;
  const paddingX = 3;
  const font = `500 ${fontSize}px Inter, -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif`;
  ctx.font = font;
  const clipped = clipPdfChromeText(ctx, normalized, Math.max(0, maxWidth - paddingX * 2));
  if (!clipped) return null;

  const width = Math.min(maxWidth, Math.ceil(ctx.measureText(clipped).width + paddingX * 2));
  canvas.width = Math.ceil(width * scale);
  canvas.height = Math.ceil(height * scale);
  ctx.scale(scale, scale);
  ctx.font = font;
  ctx.fillStyle = '#737373';
  ctx.textBaseline = 'middle';
  ctx.fillText(clipped, paddingX, height / 2);

  return { dataUrl: canvas.toDataURL('image/png'), width, height };
}
