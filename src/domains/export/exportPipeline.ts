import { readFile, remove, writeFile, writeTextFile } from '@tauri-apps/plugin-fs';
import { invoke } from '@tauri-apps/api/core';
import { readCustomFontBytes } from '../settings/fontService';
import type {
  Paragraph as DocxParagraph,
  Table as DocxTable,
  TextRun as DocxTextRun,
} from 'docx';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import { markdownToHtml } from '../../lib/markdownToHtml';
import { findPandocCitations } from '../editor/extensions/citations';
import type { ContentTheme } from '../settings/types';
import type { ExportDocumentInput } from './types';
import {
  docxThemeByContentTheme,
  writeClassByTheme,
  type DocxTheme,
} from './exportSettings';
import { getMermaidThemeConfig } from '../themes';
import { dirname, joinPath } from '../workspace/services/path';
import {
  buildExportTocHtml,
  buildExportTocItems,
  buildExportTocItemsFromMdast,
  type ExportTocItem,
} from './toc';

type DocxModule = typeof import('docx');
type DocxBlock = DocxParagraph | DocxTable;
type DocxInline = DocxTextRun | InstanceType<DocxModule['ImageRun']>;
type HeaderFooterTextPart =
  | { type: 'text'; value: string }
  | { type: 'page' }
  | { type: 'pages' };
type RasterDocxImageType = 'png' | 'jpg' | 'gif' | 'bmp';
type RasterDocxImage = { type: RasterDocxImageType; data: Uint8Array; width: number; height: number };
type SvgDocxImage = {
  type: 'svg';
  data: string;
  fallback: RasterDocxImage;
  width: number;
  height: number;
};
type ExportDocxImage = RasterDocxImage | SvgDocxImage;
type MermaidDocxImage = RasterDocxImage;
type ExportFileLabel = 'HTML' | 'PDF' | 'PNG' | 'Word';
interface PdfRenderedPage {
  data: Uint8Array;
  width: number;
  height: number;
}
interface PandocCitationHtmlResult {
  html: string;
  warnings: string;
}
type PandocCitationHtmlAttempt =
  | { attempted: false; html: null }
  | { attempted: true; html: string | null };

const exportProgressMessages = {
  parseMarkdown: '正在解析 Markdown',
  renderDiagrams: '正在渲染图表',
  applyTheme: '正在应用导出主题',
  prepareNativePdf: '正在准备 WebKit PDF 文档',
  printNativePdf: '正在调用 WebKit PDF 引擎',
  applyPdfChrome: '正在补充 PDF 页眉页脚',
  generateFile: (label: ExportFileLabel) => `正在生成 ${label} 文件`,
  writeFile: (label: ExportFileLabel) => `正在写入 ${label} 文件`,
} as const;
type CitationPlaceholderContext = 'html' | 'builtIn';
type PrismRuntimeWindow = Window & {
  __TAURI_INTERNALS__?: unknown;
  __PRISM_EXPORT_WORKER__?: boolean;
};
interface WebkitPdfCaptureLayout {
  rect: { x: number; y: number; width: number; height: number };
  pageCssHeight: number;
  pageCount: number;
  pageWidth: number;
  pageHeight: number;
  contentWidth: number;
  contentHeight: number;
  margins: typeof pdfPageMarginsPoints[keyof typeof pdfPageMarginsPoints];
}

const MAX_EXPORT_CANVAS_DIMENSION = 16_000;
const MAX_EXPORT_CANVAS_AREA = 64_000_000;
const PDF_EXPORT_RASTER_SCALE = 2;
const PDF_EXPORT_MAX_PAGES = 500;
const PDF_EXPORT_BATCH_RENDER_TIMEOUT_MS = 60_000;
const PDF_EXPORT_MAX_RENDER_VIEWPORT_HEIGHT = 4_096;
const PDF_EXPORT_MAX_PAGES_PER_BATCH = 8;
const WEBKIT_PDF_CAPTURE_WIDTH = 980;
const WEBKIT_PDF_MAX_CAPTURE_HEIGHT = 12_000;
const WEBKIT_PDF_MAX_PAGES_PER_CAPTURE = 8;
const EXPORT_MERMAID_RENDER_TIMEOUT_MS = 20_000;
const EXPORT_FONT_READY_TIMEOUT_MS = 3_000;
const DOCX_VISUAL_BLOCK_RENDER_TIMEOUT_MS = 60_000;
const DOCX_VISUAL_BLOCK_WIDTH = 760;
const DOCX_IMAGE_MAX_WIDTH = 500;
const DOCX_MERMAID_IMAGE_MAX_WIDTH = 650;
const EXPORT_PAGE_SPLIT_EPSILON = 2;
const EXPORT_ATOMIC_SPACER_CLASS = 'prism-export-page-spacer';
const EXPORT_ATOMIC_BLOCK_CLASS = 'prism-export-atomic';
const EXPORT_ATOMIC_GROUP_CLASS = 'prism-export-atomic-group';
const EXPORT_ATOMIC_BLOCK_SELECTOR = [
  'img',
  'svg',
  'canvas',
  'figure',
  'table',
  'pre',
  '.mermaid-placeholder',
  '.katex-display',
  '.prism-export-toc',
  '.prism-html-block',
  '[data-prism-docx-visual-target]',
  '[data-prism-docx-mermaid-target]',
  `[data-prism-export-atomic="true"]`,
].join(',');

function normalizeExportRasterScale(scale: unknown, fallback = 2) {
  if (typeof scale !== 'number' || !Number.isFinite(scale)) return fallback;
  return Math.min(4, Math.max(1, Math.round(scale)));
}

function getPreviewBackgroundColor() {
  return getComputedStyle(document.documentElement).getPropertyValue('--bg-preview').trim() || '#ffffff';
}

function isElementInsideAtomicBlock(element: Element) {
  const parent = element.parentElement?.closest(`.${EXPORT_ATOMIC_BLOCK_CLASS}, ${EXPORT_ATOMIC_BLOCK_SELECTOR}`);
  return Boolean(parent);
}

function isStyledVisualBlock(element: Element) {
  if (element.matches('.prism-export-document, .prism-export-document #write')) return false;
  if (!/^(div|section|article|aside|details|blockquote)$/i.test(element.tagName)) return false;
  const style = element.getAttribute('style') ?? '';
  return /\b(background(?:-color)?|border(?:-[a-z]+)?|box-shadow|outline)\s*:/i.test(style);
}

function isScalableAtomicBlock(element: HTMLElement) {
  return element.matches('img, svg, canvas, figure, .mermaid-placeholder, .katex-display, .prism-html-block, [data-prism-export-atomic="true"]')
    || isStyledVisualBlock(element);
}

function markExportAtomicBlocks(root: HTMLElement) {
  const candidates = Array.from(root.querySelectorAll<HTMLElement>(EXPORT_ATOMIC_BLOCK_SELECTOR));
  root.querySelectorAll<HTMLElement>('div, section, article, aside, details, blockquote').forEach((element) => {
    if (isStyledVisualBlock(element)) candidates.push(element);
  });

  candidates.forEach((element) => {
    if (isElementInsideAtomicBlock(element)) return;
    element.classList.add(EXPORT_ATOMIC_BLOCK_CLASS);
    element.dataset.prismExportAtomic = 'true';
  });
}

function isTopLevelAtomicBlock(element: HTMLElement) {
  return !element.parentElement?.closest(`.${EXPORT_ATOMIC_BLOCK_CLASS}`);
}

function findAtomicBlockHeadingSibling(element: HTMLElement) {
  const heading = element.previousElementSibling;
  if (!heading?.matches('h1, h2, h3, h4, h5, h6')) return null;
  if (heading.closest(`.${EXPORT_ATOMIC_GROUP_CLASS}`)) return null;
  return heading as HTMLElement;
}

function groupExportHeadingAtomicBlocks(root: HTMLElement) {
  const atomicBlocks = Array.from(root.querySelectorAll<HTMLElement>(`.${EXPORT_ATOMIC_BLOCK_CLASS}`))
    .filter(isTopLevelAtomicBlock);

  atomicBlocks.forEach((element) => {
    if (element.closest(`.${EXPORT_ATOMIC_GROUP_CLASS}`)) return;
    const heading = findAtomicBlockHeadingSibling(element);
    if (!heading) return;
    if (!heading.parentNode || heading.parentNode !== element.parentNode) return;

    const group = element.ownerDocument.createElement('div');
    group.className = `${EXPORT_ATOMIC_GROUP_CLASS} ${EXPORT_ATOMIC_BLOCK_CLASS}`;
    group.dataset.prismExportAtomic = 'true';
    heading.parentNode.insertBefore(group, heading);

    let node: ChildNode | null = heading;
    while (node) {
      const nextNode: ChildNode | null = node.nextSibling;
      group.appendChild(node);
      if (node === element) break;
      node = nextNode;
    }
  });
}

function scaleOversizedAtomicBlock(element: HTMLElement, pageCssHeight: number) {
  if (!isScalableAtomicBlock(element)) return false;
  const rect = element.getBoundingClientRect();
  if (rect.height <= pageCssHeight - EXPORT_PAGE_SPLIT_EPSILON) return false;
  const scale = Math.max(0.2, Math.min(1, (pageCssHeight - EXPORT_PAGE_SPLIT_EPSILON) / rect.height));
  element.style.transformOrigin = 'top center';
  element.style.transform = `scale(${Number(scale.toFixed(4))})`;
  element.style.width = `${Number((100 / scale).toFixed(4))}%`;
  element.style.marginLeft = 'auto';
  element.style.marginRight = 'auto';
  element.style.breakInside = 'avoid';
  element.style.pageBreakInside = 'avoid';
  return true;
}

async function prepareExportAtomicPagination(root: HTMLElement, pageCssHeight: number) {
  if (!Number.isFinite(pageCssHeight) || pageCssHeight <= 0) return;
  markExportAtomicBlocks(root);
  groupExportHeadingAtomicBlocks(root);
  root.querySelectorAll(`.${EXPORT_ATOMIC_SPACER_CLASS}`).forEach((element) => element.remove());

  for (let pass = 0; pass < 3; pass += 1) {
    let changed = false;
    await nextFrame();
    const rootRect = root.getBoundingClientRect();
    const atomicBlocks = Array.from(root.querySelectorAll<HTMLElement>(`.${EXPORT_ATOMIC_BLOCK_CLASS}`))
      .filter((element) => !element.closest(`.${EXPORT_ATOMIC_SPACER_CLASS}`))
      .filter(isTopLevelAtomicBlock);

    for (const element of atomicBlocks) {
      if (!element.isConnected) continue;
      const rect = element.getBoundingClientRect();
      if (rect.height < 2 || rect.width < 2) continue;

      if (scaleOversizedAtomicBlock(element, pageCssHeight)) {
        changed = true;
        continue;
      }

      const top = Math.max(0, rect.top - rootRect.top);
      const offsetInPage = top % pageCssHeight;
      if (offsetInPage <= EXPORT_PAGE_SPLIT_EPSILON) continue;
      const remaining = pageCssHeight - offsetInPage;
      if (rect.height <= remaining - EXPORT_PAGE_SPLIT_EPSILON) continue;

      const spacer = element.ownerDocument.createElement('div');
      spacer.className = EXPORT_ATOMIC_SPACER_CLASS;
      spacer.setAttribute('aria-hidden', 'true');
      Object.assign(spacer.style, {
        display: 'block',
        width: '100%',
        height: `${Math.ceil(remaining)}px`,
        margin: '0',
        padding: '0',
        border: '0',
        breakAfter: 'page',
        pageBreakAfter: 'always',
      });
      element.parentNode?.insertBefore(spacer, element);
      changed = true;
    }

    if (!changed) break;
  }
}

function assertExportCanvasWithinLimits(width: number, height: number, scale: number, label: string) {
  const scaledWidth = Math.ceil(width * scale);
  const scaledHeight = Math.ceil(height * scale);
  const area = scaledWidth * scaledHeight;
  if (
    scaledWidth > MAX_EXPORT_CANVAS_DIMENSION
    || scaledHeight > MAX_EXPORT_CANVAS_DIMENSION
    || area > MAX_EXPORT_CANVAS_AREA
  ) {
    throw new Error(
      `${label}画布超出系统限制 (${scaledWidth} x ${scaledHeight} @ ${scale}x)，请降低导出清晰度或拆分文档。`,
    );
  }
}

function isExportCanvasWithinLimits(width: number, height: number, scale: number) {
  const scaledWidth = Math.ceil(width * scale);
  const scaledHeight = Math.ceil(height * scale);
  const area = scaledWidth * scaledHeight;
  return scaledWidth <= MAX_EXPORT_CANVAS_DIMENSION
    && scaledHeight <= MAX_EXPORT_CANVAS_DIMENSION
    && area <= MAX_EXPORT_CANVAS_AREA;
}

function stripMarkdownExtension(filename: string) {
  return filename.replace(/\.(md|markdown|txt)$/i, '') || 'Untitled';
}

function getExportTitle(input: Pick<ExportDocumentInput, 'filename' | 'title'>) {
  return input.title?.trim() || stripMarkdownExtension(input.filename);
}

function nextFrame(timeoutMs = 250) {
  return new Promise<void>((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      resolve();
    };
    const timeout = window.setTimeout(finish, timeoutMs);
    if (typeof window.requestAnimationFrame !== 'function') {
      finish();
      return;
    }
    window.requestAnimationFrame(() => window.requestAnimationFrame(finish));
  });
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string) {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(message)), timeoutMs);
    promise.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        window.clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function reportProgress(input: ExportDocumentInput, message: string) {
  input.onProgress?.(message);
}

function reportWarning(input: ExportDocumentInput, message: string) {
  input.onWarning?.(message);
}

function isTauriExportWorkerRuntime() {
  if (typeof window === 'undefined') return false;
  const runtimeWindow = window as PrismRuntimeWindow;
  return Boolean(runtimeWindow.__TAURI_INTERNALS__ && runtimeWindow.__PRISM_EXPORT_WORKER__);
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) return error.message.trim();
  if (typeof error === 'string' && error.trim()) return error.trim();
  return '未知错误';
}

function hasCitationExportConfig(input: ExportDocumentInput) {
  return Boolean(input.citation?.bibliographyPath || input.citation?.cslStylePath);
}

function hasSupportedCitationPathExtension(path: string, extensions: string[]) {
  const normalized = path.trim().toLowerCase();
  return normalized.length === 0 || extensions.some((extension) => normalized.endsWith(extension));
}

function hasPandocCitationHtmlSupport(input: ExportDocumentInput) {
  const bibliographyPath = input.citation?.bibliographyPath ?? '';
  const cslStylePath = input.citation?.cslStylePath ?? '';
  return Boolean(
    input.pandoc?.detected &&
    bibliographyPath &&
    hasSupportedCitationPathExtension(bibliographyPath, ['.bib', '.bibtex', '.json']) &&
    hasSupportedCitationPathExtension(cslStylePath, ['.csl']),
  );
}

function getCitationPlaceholderWarning(input: ExportDocumentInput, context: CitationPlaceholderContext) {
  const bibliographyPath = input.citation?.bibliographyPath?.trim() ?? '';
  const cslStylePath = input.citation?.cslStylePath?.trim() ?? '';
  const hasBibliography = bibliographyPath.length > 0;
  const hasCslStyle = cslStylePath.length > 0;
  const pandocError = input.pandoc?.lastError?.trim();

  if (!hasSupportedCitationPathExtension(bibliographyPath, ['.bib', '.bibtex', '.json'])) {
    return '参考文献文件后缀需要是 .bib、.bibtex 或 .json；当前导出已回退内置管线，citekey 会以占位形式保留。';
  }
  if (!hasSupportedCitationPathExtension(cslStylePath, ['.csl'])) {
    return 'CSL 样式文件后缀需要是 .csl；当前导出已回退内置管线，citekey 会以占位形式保留。';
  }
  if (!hasBibliography && hasCslStyle) {
    return '已配置 CSL 样式，但缺少参考文献文件；当前导出会保留 citekey 占位。';
  }
  if (context === 'html' && hasBibliography && !input.pandoc?.detected) {
    return pandocError
      ? `已配置参考文献，但 Pandoc 未检测成功：${pandocError}；HTML 导出已回退内置管线，citekey 会以占位形式保留。`
      : '已配置参考文献，但 Pandoc 未检测成功；HTML 导出已回退内置管线，citekey 会以占位形式保留。请在设置中心检测 Pandoc。';
  }
  return '当前导出格式使用内置管线，不生成完整参考文献；citekey 会以占位形式保留。';
}

function reportCitationPlaceholderWarning(input: ExportDocumentInput, context: CitationPlaceholderContext = 'builtIn') {
  if (!hasCitationExportConfig(input)) return;
  if (findPandocCitations(input.content).length === 0) return;
  reportWarning(input, getCitationPlaceholderWarning(input, context));
}

async function renderPandocCitationHtml(input: ExportDocumentInput): Promise<PandocCitationHtmlAttempt> {
  if (!hasPandocCitationHtmlSupport(input)) return { attempted: false, html: null };
  if (findPandocCitations(input.content).length === 0) return { attempted: false, html: null };

  try {
    const result = await invoke<PandocCitationHtmlResult>('render_citations_with_pandoc', {
      path: input.pandoc?.path || null,
      markdown: input.content,
      bibliographyPath: input.citation?.bibliographyPath ?? '',
      cslStylePath: input.citation?.cslStylePath || null,
    });
    const warnings = result.warnings.trim();
    if (warnings) reportWarning(input, warnings);
    return { attempted: true, html: result.html };
  } catch (error) {
    reportWarning(
      input,
      `Pandoc 引用导出失败，已回退内置导出，citekey 会以占位形式保留：${getErrorMessage(error)}`,
    );
    return { attempted: true, html: null };
  }
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function isUnsafeExportUrl(value: unknown, allowedProtocols: Set<string>) {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (
    trimmed.startsWith('#')
    || trimmed.startsWith('//')
    || trimmed.startsWith('/')
    || trimmed.startsWith('./')
    || trimmed.startsWith('../')
    || trimmed.startsWith('?')
  ) {
    return false;
  }

  const protocolCandidate = trimmed.replace(/[\u0000-\u001F\u007F]+/g, '');
  const protocol = /^[a-zA-Z][a-zA-Z\d+.-]*:/.exec(protocolCandidate)?.[0].toLowerCase();
  return Boolean(protocol && !allowedProtocols.has(protocol));
}

function sanitizeExportHtmlFragment(html: string) {
  const template = document.createElement('template');
  template.innerHTML = html;
  template.content.querySelectorAll('script, iframe, object, embed, base, link, meta').forEach((node) => {
    node.remove();
  });

  const linkProtocols = new Set(['http:', 'https:', 'mailto:']);
  const mediaProtocols = new Set(['http:', 'https:']);

  template.content.querySelectorAll<HTMLElement>('*').forEach((element) => {
    Array.from(element.attributes).forEach((attribute) => {
      const name = attribute.name.toLowerCase();
      if (name.startsWith('on')) {
        element.removeAttribute(attribute.name);
        return;
      }
      if (name === 'style') {
        const value = attribute.value;
        if (/expression\s*\(|javascript:|url\s*\(\s*['"]?javascript:/i.test(value)) {
          element.removeAttribute(attribute.name);
        }
        return;
      }

      if ((name === 'href' || name.endsWith(':href')) && isUnsafeExportUrl(attribute.value, linkProtocols)) {
        element.removeAttribute(attribute.name);
        return;
      }

      if (name === 'src' && isUnsafeExportUrl(attribute.value, mediaProtocols)) {
        element.removeAttribute(attribute.name);
      }
    });
  });

  return template.innerHTML;
}

const pdfPaperCss = {
  a4: 'A4',
  letter: 'Letter',
} as const;

const pdfPageSizePoints = {
  a4: { width: 595.28, height: 841.89 },
  letter: { width: 612, height: 792 },
} as const;

const pdfPageMarginsCss = {
  compact: '12mm 12mm 14mm',
  standard: '18mm 18mm 20mm',
  wide: '25mm 25mm 28mm',
} as const;

const pdfPageMarginsPoints = {
  compact: { top: 34, right: 34, bottom: 40, left: 34 },
  standard: { top: 51, right: 51, bottom: 57, left: 51 },
  wide: { top: 71, right: 71, bottom: 79, left: 71 },
} as const;

const docxPageSizeTwips = {
  a4: { width: 11906, height: 16838 },
  letter: { width: 12240, height: 15840 },
} as const;

const docxPageMarginsTwips = {
  compact: { top: 680, right: 680, bottom: 794, left: 680 },
  standard: { top: 1020, right: 1020, bottom: 1134, left: 1020 },
  wide: { top: 1418, right: 1418, bottom: 1588, left: 1418 },
} as const;

function getDocxContentWidthTwips(input?: Pick<ExportDocumentInput, 'pdfPaper' | 'pdfMargin'>) {
  const pageSize = docxPageSizeTwips[input?.pdfPaper ?? 'a4'];
  const pageMargin = docxPageMarginsTwips[input?.pdfMargin ?? 'standard'];
  return Math.max(3600, pageSize.width - pageMargin.left - pageMargin.right);
}

function getPdfPageNumberLabel(pageIndex: number, pageCount: number) {
  return `${pageIndex + 1} / ${pageCount}`;
}

function getPdfPageNumberY(marginBottom: number) {
  return Math.max(12, Math.min(28, marginBottom * 0.35));
}

function getPdfHeaderY(pageHeight: number, marginTop: number, imageHeight: number) {
  return pageHeight - Math.max(18, marginTop * 0.5) - imageHeight / 2;
}

function getPdfFooterY(marginBottom: number) {
  return getPdfPageNumberY(marginBottom);
}

function normalizePdfChromeText(value: string) {
  return value.replace(/\s+/g, ' ').trim().slice(0, 160);
}

function formatPdfHeaderFooterText(
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

function buildHeaderFooterTextParts(
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

function hasHeaderFooterPageToken(template: string | undefined) {
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

function createPdfChromeTextImage(text: string, maxWidth: number) {
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

function dataUrlToBytes(dataUrl: string) {
  const [, base64 = ''] = dataUrl.split(',');
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

async function canvasToPngBytes(canvas: HTMLCanvasElement, label: string) {
  const shouldUseBlob = typeof canvas.toBlob === 'function'
    && typeof window !== 'undefined'
    && Boolean((window as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__);
  const blob = await new Promise<Blob | null>((resolve) => {
    if (!shouldUseBlob) {
      resolve(null);
      return;
    }
    let settled = false;
    const finish = (value: Blob | null) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      resolve(value);
    };
    const timer = window.setTimeout(() => finish(null), 5_000);
    try {
      canvas.toBlob((value) => finish(value), 'image/png');
    } catch {
      finish(null);
    }
  });
  if (blob) {
    return new Uint8Array(await blob.arrayBuffer());
  }

  const dataUrl = canvas.toDataURL('image/png');
  if (!dataUrl.startsWith('data:image/png')) {
    throw new Error(label);
  }
  return dataUrlToBytes(dataUrl);
}

function getSvgSize(svg: string) {
  const svgDocument = new DOMParser().parseFromString(svg, 'image/svg+xml');
  const element = svgDocument.documentElement;
  const widthAttribute = element.getAttribute('width') ?? '';
  const heightAttribute = element.getAttribute('height') ?? '';
  const width = widthAttribute.trim().endsWith('%') ? Number.NaN : Number.parseFloat(widthAttribute);
  const height = heightAttribute.trim().endsWith('%') ? Number.NaN : Number.parseFloat(heightAttribute);
  const viewBox = (element.getAttribute('viewBox') ?? '')
    .split(/[\s,]+/)
    .map((value) => Number.parseFloat(value));

  return {
    width: Math.max(80, Math.round(Number.isFinite(width) ? width : viewBox[2] || 640)),
    height: Math.max(40, Math.round(Number.isFinite(height) ? height : viewBox[3] || 360)),
  };
}

function ensureSvgExplicitSize(svg: SVGSVGElement) {
  const serialized = new XMLSerializer().serializeToString(svg);
  const size = getSvgSize(serialized);
  const widthAttribute = svg.getAttribute('width') ?? '';
  const heightAttribute = svg.getAttribute('height') ?? '';
  if (!widthAttribute || widthAttribute.trim().endsWith('%')) {
    svg.setAttribute('width', String(size.width));
  }
  if (!heightAttribute || heightAttribute.trim().endsWith('%')) {
    svg.setAttribute('height', String(size.height));
  }
}

function replaceForeignObjectLabels(svg: SVGSVGElement) {
  svg.querySelectorAll('foreignObject').forEach((node) => {
    const text = (node.textContent ?? '').replace(/\s+/g, ' ').trim();
    if (!text) {
      node.remove();
      return;
    }

    const owner = node.ownerDocument;
    const width = Number.parseFloat(node.getAttribute('width') ?? '') || 0;
    const height = Number.parseFloat(node.getAttribute('height') ?? '') || 0;
    const x = Number.parseFloat(node.getAttribute('x') ?? '') || 0;
    const y = Number.parseFloat(node.getAttribute('y') ?? '') || 0;
    const textNode = owner.createElementNS('http://www.w3.org/2000/svg', 'text');
    textNode.setAttribute('x', String(x + width / 2));
    textNode.setAttribute('y', String(y + height / 2));
    textNode.setAttribute('text-anchor', 'middle');
    textNode.setAttribute('dominant-baseline', 'middle');
    textNode.setAttribute('font-size', '14');
    textNode.setAttribute('fill', '#1f2933');
    textNode.textContent = text;
    node.replaceWith(textNode);
  });
}

function prepareSvgForDocx(svgText: string) {
  const svgDocument = new DOMParser().parseFromString(svgText, 'image/svg+xml');
  const svg = svgDocument.documentElement;
  if (svg.tagName.toLowerCase() !== 'svg') return svgText;
  replaceForeignObjectLabels(svg as unknown as SVGSVGElement);
  ensureSvgExplicitSize(svg as unknown as SVGSVGElement);
  return new XMLSerializer().serializeToString(svg);
}

function getImageSize(dataUrl: string) {
  return new Promise<{ width: number; height: number }>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => reject(new Error('导出图像尺寸读取失败'));
    image.src = dataUrl;
  });
}

function isMermaidSource(value: string, lang?: string | null) {
  const normalizedLang = (lang ?? '').trim().toLowerCase();
  if (normalizedLang === 'mermaid' || normalizedLang === 'mmd') return true;
  const source = value.trimStart();
  return /^(graph|flowchart|sequenceDiagram|classDiagram|stateDiagram|erDiagram|journey|gantt|pie|mindmap|timeline|quadrantChart|requirementDiagram|gitGraph|C4Context)\b/.test(source);
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = '';
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.slice(index, index + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

function bytesToDataUrl(bytes: Uint8Array, mimeType: string) {
  return `data:${mimeType};base64,${bytesToBase64(bytes)}`;
}

function isWindowsAbsolutePath(value: string) {
  return /^[a-zA-Z]:[\\/]/.test(value);
}

function isExternalMediaSrc(value: string) {
  if (/^https?:\/\//i.test(value) || value.startsWith('//')) return true;
  if (value.startsWith('data:') || value.startsWith('blob:')) return true;
  if (isWindowsAbsolutePath(value)) return false;
  return /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(value);
}

function stripMediaUrlDecorations(value: string) {
  const hashIndex = value.indexOf('#');
  const queryIndex = value.indexOf('?');
  const indexes = [hashIndex, queryIndex].filter((index) => index >= 0);
  return indexes.length > 0 ? value.slice(0, Math.min(...indexes)) : value;
}

function decodeExportMediaPath(value: string) {
  try {
    return decodeURI(value);
  } catch {
    return value;
  }
}

function fileUrlToPath(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'file:') return null;
    return decodeURIComponent(url.pathname);
  } catch {
    return null;
  }
}

function resolveExportMediaPath(rawSrc: string, documentPath?: string) {
  const src = stripMediaUrlDecorations(rawSrc.trim());
  if (!src || src.startsWith('#') || src.startsWith('?')) return null;
  if (src.startsWith('file://')) return fileUrlToPath(src);
  if (isExternalMediaSrc(src)) return null;
  if (src.startsWith('/') || isWindowsAbsolutePath(src)) return decodeExportMediaPath(src);
  if (!documentPath) return null;
  return joinPath(dirname(documentPath), decodeExportMediaPath(src));
}

function getExportMediaMimeType(filePath: string) {
  const normalized = stripMediaUrlDecorations(filePath).toLowerCase();
  if (normalized.endsWith('.svg')) return 'image/svg+xml';
  if (normalized.endsWith('.png')) return 'image/png';
  if (normalized.endsWith('.jpg') || normalized.endsWith('.jpeg')) return 'image/jpeg';
  if (normalized.endsWith('.gif')) return 'image/gif';
  if (normalized.endsWith('.bmp')) return 'image/bmp';
  if (normalized.endsWith('.webp')) return 'image/webp';
  return 'application/octet-stream';
}

function getDocxRasterType(mimeType: string, filePath: string): RasterDocxImageType | null {
  const normalized = stripMediaUrlDecorations(filePath).toLowerCase();
  if (mimeType === 'image/png' || normalized.endsWith('.png')) return 'png';
  if (mimeType === 'image/jpeg' || normalized.endsWith('.jpg') || normalized.endsWith('.jpeg')) return 'jpg';
  if (mimeType === 'image/gif' || normalized.endsWith('.gif')) return 'gif';
  if (mimeType === 'image/bmp' || normalized.endsWith('.bmp')) return 'bmp';
  return null;
}

async function readLocalExportMedia(rawSrc: string, documentPath?: string) {
  const filePath = resolveExportMediaPath(rawSrc, documentPath);
  if (!filePath) return null;
  const bytes = await readFile(filePath);
  return {
    filePath,
    bytes,
    mimeType: getExportMediaMimeType(filePath),
  };
}

async function inlineCssUrls(css: string) {
  const pattern = /url\((['"]?)([^'")]+)\1\)/g;
  const urls = Array.from(css.matchAll(pattern))
    .map((match) => match[2])
    .filter((url) => !url.startsWith('data:') && !url.startsWith('#') && !url.startsWith('about:'));
  const uniqueUrls = Array.from(new Set(urls));
  const replacements = new Map<string, string>();

  for (const rawUrl of uniqueUrls) {
    try {
      const absoluteUrl = new URL(rawUrl, document.baseURI).toString();
      const response = await fetch(absoluteUrl);
      if (!response.ok) continue;
      const blob = await response.blob();
      replacements.set(rawUrl, await blobToDataUrl(blob));
    } catch {
      // Export CSS can still work with system fallbacks if an asset cannot be inlined.
    }
  }

  return css.replace(pattern, (full, quote, rawUrl) => {
    const replacement = replacements.get(rawUrl);
    return replacement ? `url(${quote}${replacement}${quote})` : full;
  });
}

function stripRasterUnsafeColorDeclarations(css: string) {
  return css.replace(
    /([{\s;])[-\w]+\s*:\s*[^;{}]*\b(?:color-mix|color|lab|lch|oklab|oklch)\([^;{}]*\)[^;{}]*(?:;|(?=}))/gi,
    '$1',
  );
}

function normalizeRasterColorChannel(value: string, scale: number) {
  const trimmed = value.trim();
  if (trimmed.endsWith('%')) {
    return Number.parseFloat(trimmed) / 100 * scale;
  }
  const numeric = Number.parseFloat(trimmed);
  return numeric <= 1 ? numeric * scale : numeric;
}

function normalizeCssColorFunctionsForRaster(value: string) {
  if (!value) return value;
  return value.replace(
    /color\(\s*(?:srgb|display-p3)\s+([+-]?\d*\.?\d+%?)\s+([+-]?\d*\.?\d+%?)\s+([+-]?\d*\.?\d+%?)(?:\s*\/\s*([+-]?\d*\.?\d+%?))?\s*\)/gi,
    (_match, red: string, green: string, blue: string, alpha?: string) => {
      const r = Math.round(Math.max(0, Math.min(255, normalizeRasterColorChannel(red, 255))));
      const g = Math.round(Math.max(0, Math.min(255, normalizeRasterColorChannel(green, 255))));
      const b = Math.round(Math.max(0, Math.min(255, normalizeRasterColorChannel(blue, 255))));
      if (!alpha) return `rgb(${r}, ${g}, ${b})`;
      const a = Math.max(0, Math.min(1, normalizeRasterColorChannel(alpha, 1)));
      return `rgba(${r}, ${g}, ${b}, ${Number(a.toFixed(3))})`;
    },
  );
}

const rasterColorProperties = [
  'background-color',
  'border-bottom-color',
  'border-left-color',
  'border-right-color',
  'border-top-color',
  'box-shadow',
  'caret-color',
  'color',
  'column-rule-color',
  'fill',
  'outline-color',
  'stroke',
  'text-decoration-color',
  'text-shadow',
] as const;

function normalizeRasterComputedColors(root: HTMLElement) {
  const view = root.ownerDocument.defaultView;
  if (!view) return;
  const elements = [root, ...Array.from(root.querySelectorAll<HTMLElement | SVGElement>('*'))];
  elements.forEach((element) => {
    let computed: CSSStyleDeclaration;
    try {
      computed = view.getComputedStyle(element);
    } catch {
      return;
    }
    rasterColorProperties.forEach((property) => {
      try {
        const value = computed.getPropertyValue(property);
        const normalized = normalizeCssColorFunctionsForRaster(value);
        if (normalized !== value) {
          element.style.setProperty(property, normalized, 'important');
        }
      } catch {
        // Some jsdom/SVG style properties are incomplete. Raster export can keep the original value.
      }
    });
  });
}

function getPdfPageRenderWindowHeight(sliceHeight: number) {
  return Math.ceil(Math.min(PDF_EXPORT_MAX_RENDER_VIEWPORT_HEIGHT, Math.max(1200, sliceHeight)));
}

function resolvePdfRenderBatchEndPage(
  pageIndex: number,
  pageCount: number,
  pageCssHeight: number,
  documentHeight: number,
  width: number,
  scale: number,
) {
  let batchEndPage = Math.min(pageCount, pageIndex + PDF_EXPORT_MAX_PAGES_PER_BATCH);
  while (batchEndPage > pageIndex + 1) {
    const batchStartY = Math.floor(pageIndex * pageCssHeight);
    const batchEndY = Math.min(documentHeight, Math.floor(batchEndPage * pageCssHeight));
    const batchHeight = Math.max(1, batchEndY - batchStartY);
    if (isExportCanvasWithinLimits(width, batchHeight, scale)) break;
    batchEndPage -= 1;
  }
  return batchEndPage;
}

function getPdfPageRenderProgressMessage(startPage: number, endPage: number, pageCount: number) {
  return startPage === endPage
    ? `正在生成 PDF 页面 ${startPage} / ${pageCount}`
    : `正在生成 PDF 页面 ${startPage}-${endPage} / ${pageCount}`;
}

async function createPdfRenderedPageFromBatch(
  batchCanvas: HTMLCanvasElement,
  pixelY: number,
  pixelHeight: number,
  errorLabel: string,
): Promise<PdfRenderedPage> {
  const y = Math.max(0, Math.min(batchCanvas.height - 1, pixelY));
  const height = Math.max(1, Math.min(batchCanvas.height - y, pixelHeight));
  const coversWholeBatch = y === 0 && height === batchCanvas.height;
  const canvas = coversWholeBatch ? batchCanvas : document.createElement('canvas');

  if (!coversWholeBatch) {
    canvas.width = batchCanvas.width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error(`${errorLabel}切片失败`);
    context.drawImage(
      batchCanvas,
      0,
      y,
      batchCanvas.width,
      height,
      0,
      0,
      batchCanvas.width,
      height,
    );
  }

  return {
    data: await canvasToPngBytes(canvas, `${errorLabel}画布超出系统限制`),
    width: canvas.width,
    height: canvas.height,
  };
}

async function collectExportCss(
  options: Pick<ExportDocumentInput, 'pdfPaper' | 'pdfMargin'> & { rasterSafe?: boolean } = {},
) {
  const paper = options.pdfPaper ?? 'a4';
  const margin = options.pdfMargin ?? 'standard';
  let css = '';
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      css += Array.from(sheet.cssRules).map((rule) => rule.cssText).join('\n');
    } catch {
      // Cross-origin stylesheets are ignored; Prism's bundled CSS is same-origin.
    }
  }

  css += `
    html, body {
      min-height: 100%;
      height: auto !important;
      overflow: auto !important;
    }
    body {
      margin: 0;
      background: var(--bg-preview, #fff);
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .prism-export-document {
      position: static !important;
      min-height: 100vh;
      height: auto !important;
      overflow: visible !important;
      background: var(--bg-preview, #fff);
    }
    .prism-export-document #write {
      min-height: auto !important;
      padding-top: 44px !important;
      padding-bottom: 56px !important;
    }
    .prism-export-toc {
      margin: 0 0 36px;
      padding: 18px 0 20px;
      border-top: 1px solid var(--theme-divider, var(--c-fog, #e5e7eb));
      border-bottom: 1px solid var(--theme-divider, var(--c-fog, #e5e7eb));
      break-inside: avoid;
    }
    .prism-export-toc-title {
      margin: 0 0 12px;
      color: var(--theme-muted, var(--c-ash, #8f8f8f));
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.08em;
      line-height: 1;
    }
    .prism-export-toc-list {
      display: grid;
      gap: 7px;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .prism-export-toc-item {
      margin: 0;
      padding-left: var(--toc-indent, 0);
    }
    .prism-export-toc-item a {
      display: flex;
      min-width: 0;
      color: var(--theme-text, var(--c-void, #000));
      text-decoration: none;
      line-height: 1.35;
    }
    .prism-export-toc-item span {
      min-width: 0;
      overflow-wrap: anywhere;
    }
    .prism-export-heading-anchor {
      scroll-margin-top: 28px;
    }
    .${EXPORT_ATOMIC_BLOCK_CLASS} {
      break-inside: avoid;
      page-break-inside: avoid;
      -webkit-column-break-inside: avoid;
    }
    .${EXPORT_ATOMIC_SPACER_CLASS} {
      display: block;
      width: 100%;
      margin: 0;
      padding: 0;
      border: 0;
      break-after: page;
      page-break-after: always;
    }
    .prism-export-template--plain pre,
    .prism-export-template--plain code {
      background: transparent !important;
      border-color: color-mix(in srgb, var(--theme-divider, #e5e0d8) 45%, transparent) !important;
    }
    .prism-export-template--plain table,
    .prism-export-template--plain th,
    .prism-export-template--plain td {
      background: transparent !important;
    }
    .prism-export-template--business table,
    .prism-export-template--academic table {
      border-collapse: collapse !important;
    }
    .prism-export-template--business th,
    .prism-export-template--business td,
    .prism-export-template--academic th,
    .prism-export-template--academic td {
      border-width: 1px !important;
    }
    @page {
      size: ${pdfPaperCss[paper]};
      margin: ${pdfPageMarginsCss[margin]};
    }
    @media print {
      body { background: #fff !important; }
      .prism-export-document { background: #fff !important; }
      .prism-export-document #write {
        max-width: none !important;
        padding: 0 !important;
      }
      pre, blockquote, table, figure, img, svg, canvas, .mermaid-placeholder, .katex-display, .prism-html-block, .prism-export-toc, .${EXPORT_ATOMIC_BLOCK_CLASS} {
        break-inside: avoid;
        page-break-inside: avoid;
      }
    }
  `;

  const inlinedCss = await inlineCssUrls(css);
  return options.rasterSafe ? stripRasterUnsafeColorDeclarations(inlinedCss) : inlinedCss;
}

function getMermaidConfig(contentTheme: ContentTheme) {
  return getMermaidThemeConfig(contentTheme);
}

function getMermaidExportConfig(contentTheme: ContentTheme) {
  return {
    ...getMermaidConfig(contentTheme),
    suppressErrorRendering: true,
  };
}

function getMermaidDocxConfig(contentTheme: ContentTheme, htmlLabels: boolean) {
  const config = getMermaidConfig(contentTheme) as any;
  return {
    ...config,
    htmlLabels,
    suppressErrorRendering: true,
    flowchart: {
      ...config.flowchart,
      htmlLabels,
    },
  };
}

function createMermaidExportRenderSandbox() {
  const sandbox = document.createElement('div');
  sandbox.dataset.prismExportMermaidSandbox = 'true';
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

function normalizeMermaidSvg(svg: SVGSVGElement) {
  svg.style.display = 'block';
  svg.style.marginInline = 'auto';
  svg.style.maxWidth = '100%';
  svg.style.height = 'auto';
  svg.style.overflow = 'visible';
  svg.setAttribute('preserveAspectRatio', 'xMidYMin meet');

  svg.querySelectorAll('foreignObject').forEach((node) => {
    const el = node as SVGGraphicsElement;
    el.style.overflow = 'visible';
    el.setAttribute('overflow', 'visible');
  });

  svg.querySelectorAll<HTMLElement>('.nodeLabel, .edgeLabel, .label, .cluster-label').forEach((label) => {
    label.style.overflow = 'visible';
    label.style.lineHeight = '1.35';
  });

  try {
    const box = svg.getBBox();
    if (box.width > 0 && box.height > 0) {
      const padding = 28;
      svg.setAttribute(
        'viewBox',
        `${Math.floor(box.x - padding)} ${Math.floor(box.y - padding)} ${Math.ceil(box.width + padding * 2)} ${Math.ceil(box.height + padding * 2)}`,
      );
    }
  } catch {
    // Font timing can make getBBox unavailable. Overflow rules still protect labels.
  }
}

async function renderMermaidPlaceholders(root: HTMLElement, contentTheme: ContentTheme, input: ExportDocumentInput) {
  const placeholders = Array.from(root.querySelectorAll<HTMLElement>('.mermaid-placeholder'));
  if (placeholders.length === 0) return;

  const { default: mermaid } = await import('mermaid');
  mermaid.initialize(getMermaidExportConfig(contentTheme) as any);

  if ('fonts' in document) {
    try {
      await withTimeout(document.fonts.ready, EXPORT_FONT_READY_TIMEOUT_MS, '导出字体加载超时');
    } catch {
      // Font readiness is best effort.
    }
  }

  for (const [index, placeholder] of placeholders.entries()) {
    const encoded = placeholder.getAttribute('data-mermaid');
    if (!encoded) continue;
    const source = decodeURIComponent(encoded);
    const renderSandbox = createMermaidExportRenderSandbox();
    if (placeholders.length > 1) {
      reportProgress(input, `正在渲染图表 ${index + 1} / ${placeholders.length}`);
    }
    try {
      const { svg } = await withTimeout(
        mermaid.render(`prism-export-mermaid-${Date.now()}-${index}`, source, renderSandbox),
        EXPORT_MERMAID_RENDER_TIMEOUT_MS,
        `Mermaid 图表 ${index + 1} 渲染超时`,
      );
      placeholder.innerHTML = svg;
      placeholder.style.display = 'flex';
      placeholder.style.justifyContent = 'center';
      placeholder.style.margin = '1.5em 0';
      const svgEl = placeholder.querySelector('svg');
      if (svgEl) normalizeMermaidSvg(svgEl);
    } catch (err) {
      placeholder.innerHTML = `<pre>Mermaid 渲染失败: ${escapeHtml(String(err))}</pre>`;
    } finally {
      renderSandbox.remove();
    }
    await nextFrame();
  }
}

async function svgToRasterDataUrl(
  svgText: string,
  options: {
    mimeType?: 'image/png' | 'image/jpeg';
    quality?: number;
    scale?: number;
  } = {},
) {
  const mimeType = options.mimeType ?? 'image/png';
  const scale = normalizeExportRasterScale(options.scale);
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-12000px';
  container.style.top = '0';
  container.style.pointerEvents = 'none';
  container.innerHTML = svgText;
  document.body.appendChild(container);

  try {
    const svg = container.querySelector('svg');
    if (!svg) return null;
    normalizeMermaidSvg(svg);
    const box = (() => {
      try {
        return svg.getBBox();
      } catch {
        const size = getSvgSize(new XMLSerializer().serializeToString(svg));
        return { width: size.width, height: size.height };
      }
    })();
    const width = Math.max(320, Math.ceil(box.width + 56));
    const height = Math.max(180, Math.ceil(box.height + 56));
    svg.setAttribute('width', String(width));
    svg.setAttribute('height', String(height));
    const serialized = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([serialized], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    try {
      const image = await withTimeout(
        new Promise<HTMLImageElement>((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = () => reject(new Error('Mermaid SVG 转图片失败'));
          img.src = url;
        }),
        EXPORT_MERMAID_RENDER_TIMEOUT_MS,
        'Mermaid SVG 转图片超时',
      );
      const canvas = document.createElement('canvas');
      assertExportCanvasWithinLimits(width, height, scale, 'SVG 栅格化');
      canvas.width = Math.ceil(width * scale);
      canvas.height = Math.ceil(height * scale);
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('无法创建 Mermaid 图片画布');
      ctx.scale(scale, scale);
      ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--bg-preview').trim() || '#ffffff';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(image, 0, 0, width, height);
      const dataUrl = canvas.toDataURL(mimeType, options.quality);
      if (!dataUrl.startsWith(`data:${mimeType}`)) {
        throw new Error('SVG 栅格化结果无效');
      }
      return { dataUrl, width, height };
    } finally {
      URL.revokeObjectURL(url);
    }
  } finally {
    container.remove();
  }
}

async function svgToDocxPngImage(svgText: string, scale = 2) {
  const image = await svgToRasterDataUrl(svgText, {
    mimeType: 'image/png',
    scale,
  });
  if (!image) throw new Error('SVG 栅格化结果为空');
  return {
    type: 'png' as const,
    data: dataUrlToBytes(image.dataUrl),
    width: image.width,
    height: image.height,
  };
}

async function renderMermaidSvgToDocxPngImage(svgText: string, contentTheme: ContentTheme, scale = 2): Promise<RasterDocxImage | null> {
  const { default: html2canvas } = await import('html2canvas');
  const background = getPreviewBackgroundColor();
  const root = document.createElement('div');
  root.className = [
    'prism-export-document',
    'prism-export-template--theme',
    'preview-compat',
    `preview-compat--${contentTheme}`,
  ].join(' ');
  Object.assign(root.style, {
    position: 'fixed',
    left: '-12000px',
    top: '0',
    width: `${DOCX_VISUAL_BLOCK_WIDTH}px`,
    pointerEvents: 'none',
    background,
  });
  root.innerHTML = [
    `<div id="write" class="${writeClassByTheme[contentTheme]}">`,
    '<div data-prism-docx-mermaid-target="true" class="mermaid-placeholder"></div>',
    '</div>',
  ].join('');
  document.body.appendChild(root);

  try {
    const target = root.querySelector<HTMLElement>('[data-prism-docx-mermaid-target="true"]');
    if (!target) return null;
    Object.assign(target.style, {
      display: 'flex',
      justifyContent: 'center',
      margin: '0',
      padding: '24px 16px',
      width: '100%',
      boxSizing: 'border-box',
      overflow: 'visible',
      background,
    });
    target.innerHTML = svgText;
    const svg = target.querySelector('svg');
    if (!svg) return null;
    normalizeMermaidSvg(svg);

    if ('fonts' in document) {
      try {
        await withTimeout(document.fonts.ready, EXPORT_FONT_READY_TIMEOUT_MS, '导出字体加载超时');
      } catch {
        // Font readiness is best effort for Mermaid screenshot fallback.
      }
    }
    await nextFrame();
    await nextFrame();
    normalizeRasterComputedColors(target);

    const rect = target.getBoundingClientRect();
    const width = Math.max(
      320,
      Math.ceil(rect.width || target.scrollWidth || DOCX_VISUAL_BLOCK_WIDTH),
    );
    const height = Math.max(
      180,
      Math.ceil(rect.height || target.scrollHeight || getSvgSize(svgText).height),
    );
    assertExportCanvasWithinLimits(width, height, scale, 'DOCX Mermaid');

    const canvas = await withTimeout(
      html2canvas(target, {
        backgroundColor: background,
        scale,
        width,
        height,
        windowWidth: width,
        windowHeight: height,
        scrollX: 0,
        scrollY: 0,
      }),
      DOCX_VISUAL_BLOCK_RENDER_TIMEOUT_MS,
      'DOCX Mermaid 渲染超时',
    );

    return {
      type: 'png',
      data: await canvasToPngBytes(canvas, 'DOCX Mermaid 图像生成失败'),
      width,
      height,
    };
  } finally {
    root.remove();
  }
}

async function svgToDocxImage(svgText: string, scale = 2): Promise<SvgDocxImage> {
  const docxSvg = prepareSvgForDocx(svgText);
  const fallback = await svgToDocxPngImage(docxSvg, scale);
  const size = getSvgSize(docxSvg);
  return {
    type: 'svg',
    data: bytesToDataUrl(new TextEncoder().encode(docxSvg), 'image/svg+xml'),
    fallback,
    width: Math.max(size.width, fallback.width),
    height: Math.max(size.height, fallback.height),
  };
}

async function renderMermaidImage(source: string, contentTheme: ContentTheme, scale = 2): Promise<MermaidDocxImage | null> {
  const { default: mermaid } = await import('mermaid');
  const candidates = [
    source,
    source.replace(/<br\s*\/?>/gi, '<br/>'),
    source.replace(/<br\s*\/?>/gi, '<br>'),
  ];

  for (const [configIndex, htmlLabels] of [false, true].entries()) {
    mermaid.initialize(getMermaidDocxConfig(contentTheme, htmlLabels));

    for (const [sourceIndex, candidate] of candidates.entries()) {
      const renderSandbox = createMermaidExportRenderSandbox();
      try {
        const { svg } = await withTimeout(
          mermaid.render(
            `prism-docx-mermaid-${Date.now()}-${configIndex}-${sourceIndex}-${Math.random().toString(36).slice(2)}`,
            candidate,
            renderSandbox,
          ),
          EXPORT_MERMAID_RENDER_TIMEOUT_MS,
          `Mermaid 图表 ${sourceIndex + 1} 渲染超时`,
        );
        const image = await renderMermaidSvgToDocxPngImage(svg, contentTheme, scale).catch(() => null);
        if (image) {
          return image satisfies MermaidDocxImage;
        }
      } catch {
        // Try the next Mermaid rendering variant before falling back.
      } finally {
        renderSandbox.remove();
      }
    }
  }

  return null;
}

async function renderMarkdownImage(
  source: string,
  documentPath?: string,
  scale = 2,
): Promise<ExportDocxImage | null> {
  const media = await readLocalExportMedia(source, documentPath).catch(() => null);
  if (!media) return null;

  if (media.mimeType === 'image/svg+xml') {
    const svgText = new TextDecoder().decode(media.bytes);
    return svgToDocxImage(svgText, scale).catch(() => null);
  }

  const type = getDocxRasterType(media.mimeType, media.filePath);
  if (!type) return null;

  const size = await getImageSize(bytesToDataUrl(media.bytes, media.mimeType)).catch(() => ({
    width: 640,
    height: 360,
  }));

  return {
    type,
    data: media.bytes,
    width: size.width,
    height: size.height,
  };
}

function createDocxImageRun(
  docx: DocxModule,
  image: ExportDocxImage | MermaidDocxImage,
  altText: { title: string; description: string; name: string },
  options: { maxWidth?: number } = {},
) {
  const { ImageRun } = docx;
  const width = Math.min(options.maxWidth ?? DOCX_IMAGE_MAX_WIDTH, image.width);
  const height = Math.round(width * (image.height / image.width));
  if (image.type === 'svg') {
    return new ImageRun({
      type: 'svg',
      data: image.data,
      fallback: {
        type: image.fallback.type,
        data: image.fallback.data,
      },
      transformation: { width, height },
      altText,
    } as any);
  }

  return new ImageRun({
    type: image.type,
    data: image.data,
    transformation: { width, height },
    altText,
  } as any);
}

async function renderDocxVisualHtmlFragment(
  input: ExportDocumentInput,
  html: string,
  scale: number,
  options: { label: string; inline?: boolean },
): Promise<RasterDocxImage | null> {
  const root = document.createElement('div');
  root.className = [
    'prism-export-document',
    `prism-export-template--${input.templateId ?? 'theme'}`,
    'preview-compat',
    `preview-compat--${input.contentTheme}`,
  ].join(' ');
  Object.assign(root.style, {
    position: 'fixed',
    left: '-12000px',
    top: '0',
    width: `${DOCX_VISUAL_BLOCK_WIDTH}px`,
    pointerEvents: 'none',
    background: getComputedStyle(document.documentElement).getPropertyValue('--bg-preview').trim() || '#ffffff',
  });
  root.innerHTML = [
    `<div id="write" class="${writeClassByTheme[input.contentTheme]}">`,
    `<div data-prism-docx-visual-target="true">${html}</div>`,
    '</div>',
  ].join('');
  document.body.appendChild(root);

  try {
    await inlineImages(root, input);
    if ('fonts' in document) {
      try {
        await withTimeout(document.fonts.ready, EXPORT_FONT_READY_TIMEOUT_MS, '导出字体加载超时');
      } catch {
        // Font readiness is best effort for visual fallback blocks.
      }
    }
    await nextFrame();

    const target = root.querySelector<HTMLElement>('[data-prism-docx-visual-target="true"]');
    if (!target) return null;
    Object.assign(target.style, {
      display: options.inline ? 'inline-block' : 'block',
      width: options.inline ? 'auto' : '100%',
      maxWidth: `${DOCX_VISUAL_BLOCK_WIDTH}px`,
      background: getComputedStyle(document.documentElement).getPropertyValue('--bg-preview').trim() || '#ffffff',
      padding: options.inline ? '2px 4px' : '12px 16px',
      boxSizing: 'border-box',
    });
    normalizeRasterComputedColors(target);

    const rect = target.getBoundingClientRect();
    const width = Math.max(
      options.inline ? 120 : 320,
      Math.ceil(rect.width || target.scrollWidth || (options.inline ? 240 : DOCX_VISUAL_BLOCK_WIDTH)),
    );
    const height = Math.max(
      options.inline ? 48 : 120,
      Math.ceil(rect.height || target.scrollHeight || (options.inline ? 80 : 180)),
    );
    assertExportCanvasWithinLimits(width, height, scale, `DOCX ${options.label}`);

    const { default: html2canvas } = await import('html2canvas');
    const canvas = await withTimeout(
      html2canvas(target, {
        backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--bg-preview').trim() || '#ffffff',
        scale,
        width,
        height,
        windowWidth: width,
        windowHeight: height,
        scrollX: 0,
        scrollY: 0,
      }),
      DOCX_VISUAL_BLOCK_RENDER_TIMEOUT_MS,
      `DOCX ${options.label}渲染超时`,
    );

    return {
      type: 'png',
      data: await canvasToPngBytes(canvas, `DOCX ${options.label}图像生成失败`),
      width,
      height,
    };
  } catch (err) {
    reportWarning(input, `Word ${options.label}无法渲染为图片，已回退为文本：${getErrorMessage(err)}`);
    return null;
  } finally {
    root.remove();
  }
}

async function renderDocxMathImage(
  input: ExportDocumentInput,
  source: string,
  displayMode: boolean,
  scale: number,
) {
  try {
    const katex = await import('katex');
    const html = katex.default.renderToString(source, {
      displayMode,
      throwOnError: false,
      strict: 'ignore',
      trust: false,
      output: 'htmlAndMathml',
    });
    return renderDocxVisualHtmlFragment(input, html, scale, {
      label: displayMode ? '块级公式' : '行内公式',
      inline: !displayMode,
    });
  } catch (err) {
    reportWarning(input, `Word 公式渲染失败，已回退为 TeX 文本：${getErrorMessage(err)}`);
    return null;
  }
}

async function renderDocxHtmlBlockImage(input: ExportDocumentInput, source: string, scale: number) {
  const sanitized = sanitizeExportHtmlFragment(source).trim();
  if (!sanitized) return null;
  const wrapped = `<div class="prism-html-block" style="border:1px solid #d0d7de;border-left:4px solid #2563eb;background:#f6f8fa;padding:12px 16px;border-radius:6px;line-height:1.6;">${sanitized}</div>`;
  return renderDocxVisualHtmlFragment(input, wrapped, scale, {
    label: 'HTML 块',
  });
}

function rewriteOpenXmlNumericAttribute(xml: string, tagName: string, attrName: string) {
  let nextId = 1;
  const tagPattern = new RegExp(`<${tagName}\\b[^>]*\\/?>`, 'g');
  const attrPattern = new RegExp(`\\b${attrName}="[^"]*"`);
  return xml.replace(tagPattern, (tag) => {
    const replacement = `${attrName}="${nextId}"`;
    nextId += 1;
    if (attrPattern.test(tag)) return tag.replace(attrPattern, replacement);
    return tag.replace(/\/?>$/, (end) => ` ${replacement}${end}`);
  });
}

async function normalizeDocxDrawingCompatibility(blob: Blob) {
  const buffer = await blob.arrayBuffer();
  const { default: JSZip } = await import('jszip');
  const zip = await JSZip.loadAsync(buffer);
  const documentXmlFile = zip.file('word/document.xml');
  if (!documentXmlFile) return new Uint8Array(buffer);

  const documentXml = await documentXmlFile.async('string');
  const normalizedXml = rewriteOpenXmlNumericAttribute(
    rewriteOpenXmlNumericAttribute(documentXml, 'wp:docPr', 'id'),
    'pic:cNvPr',
    'id',
  );
  zip.file('word/document.xml', normalizedXml);
  return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
}

async function inlineImages(root: HTMLElement, input: ExportDocumentInput) {
  const images = Array.from(root.querySelectorAll<HTMLImageElement>('img'));
  await Promise.all(images.map(async (image) => {
    const rawSrc = image.getAttribute('src') ?? '';
    if (!rawSrc || rawSrc.startsWith('data:')) return;
    try {
      const localMedia = await readLocalExportMedia(rawSrc, input.documentPath);
      if (localMedia) {
        image.setAttribute('src', bytesToDataUrl(localMedia.bytes, localMedia.mimeType));
        return;
      }

      if (!/^https?:\/\//i.test(rawSrc) && !rawSrc.startsWith('//')) return;
      const response = await fetch(rawSrc.startsWith('//') ? `${window.location.protocol}${rawSrc}` : rawSrc);
      if (!response.ok) return;
      image.setAttribute('src', await blobToDataUrl(await response.blob()));
    } catch {
      // Leave the original src when it cannot be fetched.
    }
  }));
}

function applyExportToc(root: HTMLElement, input: ExportDocumentInput) {
  if (!input.toc) return;
  const write = root.querySelector<HTMLElement>('#write');
  if (!write) return;
  const headingElements = Array.from(write.querySelectorAll<HTMLHeadingElement>('h1, h2, h3, h4, h5, h6'));
  const headings = headingElements
    .map((element) => ({
      element,
      level: Number(element.tagName.slice(1)),
      text: (element.textContent ?? '').trim(),
    }))
    .filter((heading) => heading.text.length > 0);
  const items = buildExportTocItems(headings);
  if (items.length === 0) return;

  headings.forEach((heading, index) => {
    heading.element.id = items[index].anchor;
    heading.element.classList.add('prism-export-heading-anchor');
  });

  write.insertAdjacentHTML('afterbegin', buildExportTocHtml(items));
}

async function createRenderedExportNode(input: ExportDocumentInput, options: { html?: string | null } = {}) {
  reportProgress(input, exportProgressMessages.parseMarkdown);
  const html = options.html ? sanitizeExportHtmlFragment(options.html) : markdownToHtml(input.content);
  reportProgress(input, exportProgressMessages.applyTheme);
  const root = document.createElement('div');
  root.className = [
    'prism-export-document',
    `prism-export-template--${input.templateId ?? 'theme'}`,
    'preview-compat',
    `preview-compat--${input.contentTheme}`,
  ].join(' ');
  root.style.position = 'fixed';
  root.style.left = '-12000px';
  root.style.top = '0';
  root.style.width = '980px';
  root.style.pointerEvents = 'none';
  root.style.opacity = '0';
  root.innerHTML = `<div id="write" class="${writeClassByTheme[input.contentTheme]}">${html}</div>`;
  applyExportToc(root, input);
  document.body.appendChild(root);

  try {
    reportProgress(input, exportProgressMessages.renderDiagrams);
    await renderMermaidPlaceholders(root, input.contentTheme, input);
    await inlineImages(root, input);
    if ('fonts' in document) {
      try {
        await withTimeout(document.fonts.ready, EXPORT_FONT_READY_TIMEOUT_MS, '导出字体加载超时');
      } catch {
        // Font readiness is best effort.
      }
    }
    await nextFrame();
    markExportAtomicBlocks(root);
    return root;
  } catch (err) {
    root.remove();
    throw err;
  }
}

async function buildStandaloneHtml(
  input: ExportDocumentInput,
  renderedRoot?: HTMLElement,
  options: { includeTheme?: boolean; rasterSafeCss?: boolean } = {},
) {
  const css = options.includeTheme === false ? '' : await collectExportCss({
    ...input,
    rasterSafe: options.rasterSafeCss,
  });
  const body = (() => {
    if (!renderedRoot) {
      return `<div class="prism-export-document prism-export-template--${input.templateId ?? 'theme'} preview-compat preview-compat--${input.contentTheme}">
        <div id="write" class="${writeClassByTheme[input.contentTheme]}">${markdownToHtml(input.content)}</div>
      </div>`;
    }

    const clone = renderedRoot.cloneNode(true) as HTMLElement;
    clone.removeAttribute('style');
    return clone.outerHTML;
  })();

  return `<!DOCTYPE html>
<html lang="zh-CN" data-content-theme="${input.contentTheme}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(getExportTitle(input))}</title>
  ${input.author ? `<meta name="author" content="${escapeHtml(input.author)}">` : ''}
  ${input.date ? `<meta name="date" content="${escapeHtml(input.date)}">` : ''}
  ${css ? `<style>${css}</style>` : ''}
</head>
<body class="${document.body.classList.contains('dark') ? 'dark' : ''}">
${body}
</body>
</html>`;
}

async function createStandaloneExportFrame(input: ExportDocumentInput) {
  const node = await createRenderedExportNode(input);
  let html = '';
  try {
    html = await buildStandaloneHtml(input, node, { rasterSafeCss: true });
  } finally {
    node.remove();
  }

  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.left = '-12000px';
  iframe.style.top = '0';
  iframe.style.width = '1040px';
  iframe.style.height = '1200px';
  iframe.style.border = '0';
  iframe.style.opacity = '1';
  iframe.style.pointerEvents = 'none';
  iframe.setAttribute('aria-hidden', 'true');

  await new Promise<void>((resolve) => {
    const timeout = window.setTimeout(resolve, 1600);
    iframe.onload = () => {
      window.clearTimeout(timeout);
      resolve();
    };
    iframe.srcdoc = html;
    document.body.appendChild(iframe);
  });

  const frameDocument = iframe.contentDocument;
  if (!frameDocument) {
    iframe.remove();
    throw new Error('无法创建导出渲染环境');
  }

  if ('fonts' in frameDocument) {
    try {
      await frameDocument.fonts.ready;
    } catch {
      // Font readiness is best effort in the export frame.
    }
  }
  await nextFrame();
  return iframe;
}

async function getExportOutputPath(outputPath?: string) {
  if (outputPath) return outputPath;
  return null;
}

export async function exportHtml(input: ExportDocumentInput, outputPath?: string) {
  const targetPath = await getExportOutputPath(outputPath);
  if (!targetPath) return false;

  const pandocCitation = await renderPandocCitationHtml(input);
  if (!pandocCitation.attempted) reportCitationPlaceholderWarning(input, 'html');
  const node = await createRenderedExportNode(input, { html: pandocCitation.html });
  try {
    reportProgress(input, exportProgressMessages.generateFile('HTML'));
    const html = await buildStandaloneHtml(input, node, {
      includeTheme: input.htmlIncludeTheme !== false,
    });
    reportProgress(input, exportProgressMessages.writeFile('HTML'));
    await writeTextFile(targetPath, html);
  } finally {
    node.remove();
  }
  return true;
}

function getWebkitPdfCapturePath(targetPath: string, batchIndex: number) {
  const suffix = `.webkit-capture-${batchIndex + 1}.pdf`;
  return targetPath.toLowerCase().endsWith('.pdf')
    ? `${targetPath.slice(0, -4)}${suffix}`
    : `${targetPath}${suffix}`;
}

function getWebkitPdfCaptureProgressMessage(startPage: number, endPage: number, pageCount: number) {
  return startPage === endPage
    ? `正在捕获 PDF 页面 ${startPage} / ${pageCount}`
    : `正在捕获 PDF 页面 ${startPage}-${endPage} / ${pageCount}`;
}

function maskPdfPageMargins(
  page: any,
  pageWidth: number,
  pageHeight: number,
  margins: WebkitPdfCaptureLayout['margins'],
  color: any,
) {
  page.drawRectangle({ x: 0, y: 0, width: pageWidth, height: margins.bottom, color });
  page.drawRectangle({
    x: 0,
    y: pageHeight - margins.top,
    width: pageWidth,
    height: margins.top,
    color,
  });
  page.drawRectangle({ x: 0, y: 0, width: margins.left, height: pageHeight, color });
  page.drawRectangle({
    x: pageWidth - margins.right,
    y: 0,
    width: margins.right,
    height: pageHeight,
    color,
  });
}

async function prepareWebkitPdfCaptureDocument(input: ExportDocumentInput): Promise<WebkitPdfCaptureLayout> {
  reportProgress(input, exportProgressMessages.prepareNativePdf);
  const pandocCitation = await renderPandocCitationHtml(input);
  if (!pandocCitation.attempted) reportCitationPlaceholderWarning(input);
  const node = await createRenderedExportNode(input, { html: pandocCitation.html });
  try {
    const css = await collectExportCss(input);
    const clone = node.cloneNode(true) as HTMLElement;
    clone.removeAttribute('style');
    clone.style.position = 'static';
    clone.style.opacity = '1';
    clone.style.pointerEvents = 'auto';

    document.documentElement.setAttribute('data-content-theme', input.contentTheme);
    document.title = getExportTitle(input);
    document.head.querySelectorAll('[data-prism-native-pdf]').forEach((element) => element.remove());

    const style = document.createElement('style');
    style.dataset.prismNativePdf = 'true';
    style.textContent = `
      ${css}
      html, body {
        width: 100%;
        min-height: 100%;
        overflow: visible !important;
        background: #fff !important;
      }
      body.prism-native-pdf-export {
        margin: 0 !important;
      }
      body.prism-native-pdf-export > .prism-export-document {
        position: static !important;
        width: ${WEBKIT_PDF_CAPTURE_WIDTH}px !important;
        max-width: none !important;
        margin: 0 !important;
        opacity: 1 !important;
        pointer-events: auto !important;
      }
    `;
    document.head.appendChild(style);
    document.body.className = [
      document.body.classList.contains('dark') ? 'dark' : '',
      'prism-native-pdf-export',
    ].filter(Boolean).join(' ');
    document.body.replaceChildren(clone);
    if ('fonts' in document) {
      try {
        await withTimeout(document.fonts.ready, EXPORT_FONT_READY_TIMEOUT_MS, '导出字体加载超时');
      } catch {
        // Native print can still proceed with platform font fallback.
      }
    }
    await nextFrame();
    const target = document.body.querySelector<HTMLElement>('.prism-export-document');
    if (!target) throw new Error('无法准备 WebKit PDF 捕获文档');

    const measureTarget = () => {
      const rect = target.getBoundingClientRect();
      return {
        rect,
        width: Math.max(
          WEBKIT_PDF_CAPTURE_WIDTH,
          Math.ceil(rect.width),
          Math.ceil(target.scrollWidth),
        ),
        height: Math.max(
          1,
          Math.ceil(rect.height),
          Math.ceil(target.scrollHeight),
          Math.ceil(document.body.scrollHeight),
          Math.ceil(document.documentElement.scrollHeight),
        ),
      };
    };
    let measured = measureTarget();
    const paper = pdfPageSizePoints[input.pdfPaper ?? 'a4'];
    const margins = pdfPageMarginsPoints[input.pdfMargin ?? 'standard'];
    const contentWidth = paper.width - margins.left - margins.right;
    const contentHeight = paper.height - margins.top - margins.bottom;
    const cssPxToPdfPoint = contentWidth / measured.width;
    const pageCssHeight = Math.max(1, contentHeight / cssPxToPdfPoint);
    await prepareExportAtomicPagination(target, pageCssHeight);
    measured = measureTarget();
    const pageCount = Math.max(1, Math.ceil(measured.height / pageCssHeight));
    if (!Number.isFinite(pageCssHeight) || !Number.isFinite(pageCount)) {
      throw new Error('WebKit PDF 页面尺寸计算失败');
    }
    if (pageCount > PDF_EXPORT_MAX_PAGES) {
      throw new Error(`PDF 页数过多（${pageCount} 页，最大 ${PDF_EXPORT_MAX_PAGES} 页），请拆分文档或改用 HTML 导出。`);
    }

    return {
      rect: {
        x: Math.max(0, Math.floor(measured.rect.left + window.scrollX)),
        y: Math.max(0, Math.floor(measured.rect.top + window.scrollY)),
        width: measured.width,
        height: measured.height,
      },
      pageCssHeight,
      pageCount,
      pageWidth: paper.width,
      pageHeight: paper.height,
      contentWidth,
      contentHeight,
      margins,
    };
  } finally {
    node.remove();
  }
}

async function overlayPdfChrome(input: ExportDocumentInput, targetPath: string) {
  if (!input.pageHeaderFooter && !input.pdfPageNumbers) return;

  reportProgress(input, exportProgressMessages.applyPdfChrome);
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');
  const bytes = await readFile(targetPath);
  const pdf = await PDFDocument.load(bytes);
  const pageCount = pdf.getPageCount();
  const margins = pdfPageMarginsPoints[input.pdfMargin ?? 'standard'];
  const pageNumberFont = input.pdfPageNumbers
    ? await pdf.embedFont(StandardFonts.Helvetica)
    : null;

  for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
    const page = pdf.getPage(pageIndex);
    const { width: pageWidth, height: pageHeight } = page.getSize();
    const contentWidth = Math.max(1, pageWidth - margins.left - margins.right);

    if (input.pageHeaderFooter) {
      const headerText = formatPdfHeaderFooterText(input.pageHeaderText, input, pageIndex, pageCount);
      const footerText = formatPdfHeaderFooterText(input.pageFooterText, input, pageIndex, pageCount);
      const headerImage = createPdfChromeTextImage(headerText, contentWidth);
      if (headerImage) {
        const embeddedHeader = await pdf.embedPng(dataUrlToBytes(headerImage.dataUrl));
        page.drawImage(embeddedHeader, {
          x: (pageWidth - headerImage.width) / 2,
          y: getPdfHeaderY(pageHeight, margins.top, headerImage.height),
          width: headerImage.width,
          height: headerImage.height,
        });
      }

      const footerImage = createPdfChromeTextImage(
        footerText,
        input.pdfPageNumbers ? contentWidth * 0.42 : contentWidth,
      );
      if (footerImage) {
        const embeddedFooter = await pdf.embedPng(dataUrlToBytes(footerImage.dataUrl));
        page.drawImage(embeddedFooter, {
          x: margins.left,
          y: getPdfFooterY(margins.bottom),
          width: footerImage.width,
          height: footerImage.height,
        });
      }
    }

    if (pageNumberFont) {
      const label = getPdfPageNumberLabel(pageIndex, pageCount);
      const size = 8;
      const textWidth = pageNumberFont.widthOfTextAtSize(label, size);
      page.drawText(label, {
        x: (pageWidth - textWidth) / 2,
        y: getPdfPageNumberY(margins.bottom),
        size,
        font: pageNumberFont,
        color: rgb(0.45, 0.45, 0.45),
      });
    }
  }

  await writeFile(targetPath, await pdf.save());
}

async function exportPdfWithWebkitCapture(input: ExportDocumentInput, targetPath: string) {
  const layout = await prepareWebkitPdfCaptureDocument(input);
  reportProgress(input, exportProgressMessages.printNativePdf);

  const { PDFDocument, rgb } = await import('pdf-lib');
  const pdf = await PDFDocument.create();
  const marginMask = rgb(1, 1, 1);
  let pageIndex = 0;
  let batchIndex = 0;
  const tempPaths: string[] = [];

  try {
    while (pageIndex < layout.pageCount) {
      const pagesByHeight = Math.max(1, Math.floor(WEBKIT_PDF_MAX_CAPTURE_HEIGHT / layout.pageCssHeight));
      const pagesPerCapture = Math.max(1, Math.min(WEBKIT_PDF_MAX_PAGES_PER_CAPTURE, pagesByHeight));
      const batchEndPage = Math.min(layout.pageCount, pageIndex + pagesPerCapture);
      const batchStartY = Math.floor(pageIndex * layout.pageCssHeight);
      const batchEndY = Math.min(layout.rect.height, Math.ceil(batchEndPage * layout.pageCssHeight));
      const batchHeight = Math.max(1, batchEndY - batchStartY);
      const capturePath = getWebkitPdfCapturePath(targetPath, batchIndex);
      tempPaths.push(capturePath);

      reportProgress(input, getWebkitPdfCaptureProgressMessage(pageIndex + 1, batchEndPage, layout.pageCount));
      await invoke('capture_current_webview_pdf', {
        outputPath: capturePath,
        x: layout.rect.x,
        y: layout.rect.y + batchStartY,
        width: layout.rect.width,
        height: batchHeight,
      });

      const captureBytes = await readFile(capturePath);
      const [embeddedPage] = await pdf.embedPdf(captureBytes);
      if (!embeddedPage) throw new Error('WebKit PDF 捕获结果为空');

      const scale = layout.contentWidth / embeddedPage.width;
      const embeddedWidth = embeddedPage.width * scale;
      const embeddedHeight = embeddedPage.height * scale;

      for (let splitPageIndex = pageIndex; splitPageIndex < batchEndPage; splitPageIndex += 1) {
        const page = pdf.addPage([layout.pageWidth, layout.pageHeight]);
        const offsetWithinBatch = (splitPageIndex - pageIndex) * layout.contentHeight;
        page.drawPage(embeddedPage, {
          x: layout.margins.left,
          y: layout.pageHeight - layout.margins.top - embeddedHeight + offsetWithinBatch,
          width: embeddedWidth,
          height: embeddedHeight,
        });
        maskPdfPageMargins(page, layout.pageWidth, layout.pageHeight, layout.margins, marginMask);
      }

      pageIndex = batchEndPage;
      batchIndex += 1;
      await nextFrame();
    }

    reportProgress(input, exportProgressMessages.writeFile('PDF'));
    await writeFile(targetPath, await pdf.save());
  } finally {
    await Promise.all(tempPaths.map((path) => remove(path).catch(() => undefined)));
  }

  await overlayPdfChrome(input, targetPath);
  return true;
}

async function exportPdfRaster(input: ExportDocumentInput, targetPath: string) {
  reportCitationPlaceholderWarning(input);
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');
  const paper = pdfPageSizePoints[input.pdfPaper ?? 'a4'];
  const margins = pdfPageMarginsPoints[input.pdfMargin ?? 'standard'];
  const pageWidth = paper.width;
  const pageHeight = paper.height;
  const contentWidth = pageWidth - margins.left - margins.right;
  const contentHeight = pageHeight - margins.top - margins.bottom;
  const renderedPages = await createRenderedPdfPages(input, {
    contentWidth,
    contentHeight,
    scale: input.pngScale ?? PDF_EXPORT_RASTER_SCALE,
  });
  reportProgress(input, exportProgressMessages.generateFile('PDF'));
  const pdf = await PDFDocument.create();
  const pageNumberFont = input.pdfPageNumbers
    ? await pdf.embedFont(StandardFonts.Helvetica)
    : null;

  const pageCount = renderedPages.length;
  const drawChromeText = async (
    page: any,
    text: string,
    maxWidth: number,
    x: number,
    y: number,
  ) => {
    const rendered = createPdfChromeTextImage(text, maxWidth);
    if (!rendered) return;
    const embeddedChrome = await pdf.embedPng(dataUrlToBytes(rendered.dataUrl));
    page.drawImage(embeddedChrome, {
      x,
      y,
      width: rendered.width,
      height: rendered.height,
    });
  };

  for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
    const image = renderedPages[pageIndex];
    const embedded = await pdf.embedPng(image.data);
    const scaledHeight = contentWidth * (image.height / image.width);
    const page = pdf.addPage([pageWidth, pageHeight]);
    page.drawImage(embedded, {
      x: margins.left,
      y: pageHeight - margins.top - scaledHeight,
      width: contentWidth,
      height: scaledHeight,
    });

    if (input.pageHeaderFooter) {
      const headerText = formatPdfHeaderFooterText(input.pageHeaderText, input, pageIndex, pageCount);
      const footerText = formatPdfHeaderFooterText(input.pageFooterText, input, pageIndex, pageCount);
      const headerImage = createPdfChromeTextImage(headerText, contentWidth);
      if (headerImage) {
        const embeddedHeader = await pdf.embedPng(dataUrlToBytes(headerImage.dataUrl));
        page.drawImage(embeddedHeader, {
          x: (pageWidth - headerImage.width) / 2,
          y: getPdfHeaderY(pageHeight, margins.top, headerImage.height),
          width: headerImage.width,
          height: headerImage.height,
        });
      }
      await drawChromeText(
        page,
        footerText,
        input.pdfPageNumbers ? contentWidth * 0.42 : contentWidth,
        margins.left,
        getPdfFooterY(margins.bottom),
      );
    }

    if (pageNumberFont) {
      const label = getPdfPageNumberLabel(pageIndex, pageCount);
      const size = 8;
      const textWidth = pageNumberFont.widthOfTextAtSize(label, size);
      page.drawText(label, {
        x: (pageWidth - textWidth) / 2,
        y: getPdfPageNumberY(margins.bottom),
        size,
        font: pageNumberFont,
        color: rgb(0.45, 0.45, 0.45),
      });
    }
  }

  const bytes = await pdf.save();
  reportProgress(input, exportProgressMessages.writeFile('PDF'));
  await writeFile(targetPath, bytes);
  return true;
}

export async function exportPdf(input: ExportDocumentInput, outputPath?: string) {
  const targetPath = await getExportOutputPath(outputPath);
  if (!targetPath) return false;

  if (isTauriExportWorkerRuntime()) {
    try {
      return await exportPdfWithWebkitCapture(input, targetPath);
    } catch (error) {
      reportWarning(
        input,
        `WebKit PDF 引擎不可用，已回退兼容导出管线：${getErrorMessage(error)}`,
      );
    }
  }

  return exportPdfRaster(input, targetPath);
}

async function createRenderedPdfPages(
  input: ExportDocumentInput,
  options: { contentWidth: number; contentHeight: number; scale?: number },
) {
  const { default: html2canvas } = await import('html2canvas');
  const iframe = await createStandaloneExportFrame(input);
  try {
    const frameDocument = iframe.contentDocument;
    const target = frameDocument?.querySelector<HTMLElement>('.prism-export-document');
    if (!frameDocument || !target) throw new Error('导出内容渲染失败');

    const width = Math.max(980, Math.ceil(target.scrollWidth), Math.ceil(frameDocument.documentElement.scrollWidth));
    const height = Math.max(
      200,
      Math.ceil(target.scrollHeight),
      Math.ceil(frameDocument.body.scrollHeight),
      Math.ceil(frameDocument.documentElement.scrollHeight),
    );
    iframe.style.width = `${width}px`;
    iframe.style.height = `${height}px`;
    await nextFrame();
    normalizeRasterComputedColors(target);

    const cssPxToPdfPoint = options.contentWidth / width;
    const pageCssHeight = Math.max(1, options.contentHeight / cssPxToPdfPoint);
    await prepareExportAtomicPagination(target, pageCssHeight);
    const paginatedHeight = Math.max(
      200,
      Math.ceil(target.scrollHeight),
      Math.ceil(frameDocument.body.scrollHeight),
      Math.ceil(frameDocument.documentElement.scrollHeight),
    );
    iframe.style.height = `${paginatedHeight}px`;
    await nextFrame();
    const pageCount = Math.max(1, Math.ceil(paginatedHeight / pageCssHeight));
    if (!Number.isFinite(pageCssHeight) || !Number.isFinite(pageCount)) {
      throw new Error('PDF 页面尺寸计算失败');
    }
    if (pageCount > PDF_EXPORT_MAX_PAGES) {
      throw new Error(`PDF 页数过多（${pageCount} 页，最大 ${PDF_EXPORT_MAX_PAGES} 页），请拆分文档或改用 HTML 导出。`);
    }
    const requestedScale = normalizeExportRasterScale(options.scale ?? PDF_EXPORT_RASTER_SCALE);
    const backgroundColor = normalizeCssColorFunctionsForRaster(
      target.ownerDocument.defaultView?.getComputedStyle(target).backgroundColor ?? '',
    ) || '#ffffff';

    const pages: PdfRenderedPage[] = [];
    for (let pageIndex = 0; pageIndex < pageCount;) {
      const batchEndPage = resolvePdfRenderBatchEndPage(
        pageIndex,
        pageCount,
        pageCssHeight,
        paginatedHeight,
        width,
        requestedScale,
      );
      const batchStartY = Math.floor(pageIndex * pageCssHeight);
      const batchEndY = Math.min(paginatedHeight, Math.floor(batchEndPage * pageCssHeight));
      const batchHeight = Math.max(1, batchEndY - batchStartY);
      const scale = requestedScale;
      const windowHeight = getPdfPageRenderWindowHeight(batchHeight);
      assertExportCanvasWithinLimits(
        width,
        batchHeight,
        scale,
        batchEndPage === pageIndex + 1
          ? `PDF 第 ${pageIndex + 1} 页`
          : `PDF 第 ${pageIndex + 1}-${batchEndPage} 页`,
      );

      reportProgress(input, getPdfPageRenderProgressMessage(pageIndex + 1, batchEndPage, pageCount));
      await nextFrame();
      const canvas = await withTimeout(
        html2canvas(target, {
          backgroundColor,
          scale,
          useCORS: true,
          logging: false,
          width,
          height: batchHeight,
          x: 0,
          y: batchStartY,
          windowWidth: width,
          windowHeight,
          scrollX: 0,
          scrollY: 0,
        }),
        PDF_EXPORT_BATCH_RENDER_TIMEOUT_MS,
        batchEndPage === pageIndex + 1
          ? `PDF 第 ${pageIndex + 1} 页渲染超时，请减少单页复杂图表或改用 HTML 导出。`
          : `PDF 第 ${pageIndex + 1}-${batchEndPage} 页渲染超时，请减少复杂图表或改用 HTML 导出。`,
      );
      canvas.width ||= Math.ceil(width * scale);
      canvas.height ||= Math.ceil(batchHeight * scale);

      const pixelPerCssY = canvas.height / batchHeight;
      for (let splitPageIndex = pageIndex; splitPageIndex < batchEndPage; splitPageIndex += 1) {
        const pageStartY = Math.floor(splitPageIndex * pageCssHeight);
        const pageEndY = Math.min(paginatedHeight, Math.floor((splitPageIndex + 1) * pageCssHeight));
        const pageOffsetY = Math.max(0, pageStartY - batchStartY);
        const nextPageOffsetY = Math.max(pageOffsetY + 1, pageEndY - batchStartY);
        const pixelY = Math.round(pageOffsetY * pixelPerCssY);
        const nextPixelY = splitPageIndex === batchEndPage - 1
          ? canvas.height
          : Math.round(nextPageOffsetY * pixelPerCssY);
        const pixelHeight = Math.max(1, nextPixelY - pixelY);
        pages.push(await createPdfRenderedPageFromBatch(
          canvas,
          pixelY,
          pixelHeight,
          `PDF 第 ${splitPageIndex + 1} 页`,
        ));
      }

      pageIndex = batchEndPage;
      await nextFrame();
    }
    return pages;
  } catch (err) {
    const message = err instanceof Error ? err.message : err instanceof Event ? err.type : String(err);
    throw new Error(`PDF 渲染失败: ${message}`);
  } finally {
    iframe.remove();
  }
}

async function createRenderedPng(input: ExportDocumentInput, options: { scale?: number } = {}) {
  const { default: html2canvas } = await import('html2canvas');
  const iframe = await createStandaloneExportFrame(input);
  try {
    const frameDocument = iframe.contentDocument;
    const target = frameDocument?.querySelector<HTMLElement>('.prism-export-document');
    if (!frameDocument || !target) throw new Error('导出内容渲染失败');

    const width = Math.max(980, Math.ceil(target.scrollWidth), Math.ceil(frameDocument.documentElement.scrollWidth));
    const height = Math.max(
      200,
      Math.ceil(target.scrollHeight),
      Math.ceil(frameDocument.body.scrollHeight),
      Math.ceil(frameDocument.documentElement.scrollHeight),
    );
    iframe.style.width = `${width}px`;
    iframe.style.height = `${height}px`;
    await nextFrame();
    normalizeRasterComputedColors(target);

    const scale = normalizeExportRasterScale(options.scale);
    assertExportCanvasWithinLimits(width, height, scale, 'PNG 导出');

    const canvas = await html2canvas(target, {
      backgroundColor: normalizeCssColorFunctionsForRaster(getComputedStyle(target).backgroundColor) || '#ffffff',
      scale,
      useCORS: true,
      logging: false,
      width,
      height,
      windowWidth: width,
      windowHeight: height,
      scrollX: 0,
      scrollY: 0,
    });
    const dataUrl = canvas.toDataURL('image/png');
    if (!dataUrl.startsWith('data:image/png')) {
      throw new Error(`导出画布超出系统限制 (${Math.ceil(width * scale)} x ${Math.ceil(height * scale)})`);
    }
    return {
      dataUrl,
      width: canvas.width || Math.ceil(width * scale),
      height: canvas.height || Math.ceil(height * scale),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : err instanceof Event ? err.type : String(err);
    throw new Error(`图像渲染失败: ${message}`);
  } finally {
    iframe.remove();
  }
}

export async function exportPng(input: ExportDocumentInput, outputPath?: string) {
  const targetPath = await getExportOutputPath(outputPath);
  if (!targetPath) return false;

  reportCitationPlaceholderWarning(input);
  const image = await createRenderedPng(input, { scale: input.pngScale });
  reportProgress(input, exportProgressMessages.generateFile('PNG'));
  reportProgress(input, exportProgressMessages.writeFile('PNG'));
  await writeFile(targetPath, dataUrlToBytes(image.dataUrl));
  return true;
}

type RunStyle = Record<string, any>;

function splitMarkedText(docx: DocxModule, value: string, base: RunStyle = {}) {
  const { ShadingType, TextRun } = docx;
  const runs: DocxTextRun[] = [];
  const pattern = /==([^=\n]+)==/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(value)) !== null) {
    if (match.index > lastIndex) {
      runs.push(new TextRun({ ...base, text: value.slice(lastIndex, match.index) }));
    }
    runs.push(new TextRun({
      ...base,
      text: match[1],
      shading: { type: ShadingType.CLEAR, fill: 'FFF3A3' },
    }));
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < value.length) {
    runs.push(new TextRun({ ...base, text: value.slice(lastIndex) }));
  }
  return runs.length > 0 ? runs : [new TextRun({ ...base, text: value })];
}

async function inlineToRuns(
  docx: DocxModule,
  node: any,
  theme: DocxTheme,
  style: RunStyle = {},
  input?: ExportDocumentInput,
  imageScale = 2,
): Promise<DocxInline[]> {
  const { ShadingType, TextRun, UnderlineType } = docx;
  if (!node) return [];
  if (node.type === 'text') return splitMarkedText(docx, node.value ?? '', style);
  if (node.type === 'break') return [new TextRun({ text: '', break: 1 })];
  if (node.type === 'inlineMath') {
    const source = String(node.value ?? '');
    const image = input ? await renderDocxMathImage(input, source, false, imageScale) : null;
    if (image) {
      return [createDocxImageRun(docx, image, {
        title: 'Inline math',
        description: source,
        name: 'Inline math',
      })];
    }
    return [new TextRun({
      ...style,
      text: `$${source}$`,
      font: theme.codeFont,
      color: theme.accent,
    })];
  }
  if (node.type === 'inlineCode') {
    return [new TextRun({
      ...style,
      text: node.value ?? '',
      font: theme.codeFont,
      color: theme.accent,
      shading: { type: ShadingType.CLEAR, fill: theme.fill },
    })];
  }
  if (node.type === 'strong') {
    const nested = await Promise.all((node.children ?? []).map((child: any) => inlineToRuns(docx, child, theme, { ...style, bold: true }, input, imageScale)));
    return nested.flat();
  }
  if (node.type === 'emphasis') {
    const nested = await Promise.all((node.children ?? []).map((child: any) => inlineToRuns(docx, child, theme, { ...style, italics: true }, input, imageScale)));
    return nested.flat();
  }
  if (node.type === 'delete') {
    const nested = await Promise.all((node.children ?? []).map((child: any) => inlineToRuns(docx, child, theme, { ...style, strike: true }, input, imageScale)));
    return nested.flat();
  }
  if (node.type === 'link') {
    const url = String(node.url ?? '');
    const hasImageChild = (node.children ?? []).some((child: any) => child?.type === 'image');
    const nested: any[] = [];
    for (const child of (node.children ?? [])) {
      if (child?.type === 'image') {
        const image = await renderMarkdownImage(String(child.url ?? ''), input?.documentPath, imageScale);
        if (image) {
          const alt = String(child.alt || child.title || 'Markdown image');
          nested.push(createDocxImageRun(docx, image, { title: alt, description: alt, name: alt }));
          continue;
        }
        const fallback = String(child.alt || child.title || child.url || '图片无法导出');
        nested.push(...splitMarkedText(docx, fallback, { ...style, italics: true, color: theme.muted }));
        continue;
      }
      const childRuns = await inlineToRuns(docx, child, theme, {
        ...style,
        color: theme.accent,
        underline: { type: UnderlineType.SINGLE },
      }, input, imageScale);
      nested.push(...childRuns);
    }
    if (url && /^https?:\/\//i.test(url)) {
      const { ExternalHyperlink } = docx as any;
      if (ExternalHyperlink) {
        return [new ExternalHyperlink({ link: url, children: nested })];
      }
    }
    return nested;
    void hasImageChild;
  }
  if (node.type === 'image') {
    const label = String(node.alt || node.title || node.url || '');
    return label ? splitMarkedText(docx, label, { ...style, italics: true, color: theme.muted }) : [];
  }
  if (node.value && typeof node.value === 'string') return splitMarkedText(docx, node.value, style);
  const nested = await Promise.all((node.children ?? []).map((child: any) => inlineToRuns(docx, child, theme, style, input, imageScale)));
  return nested.flat();
}

async function paragraphFromInlineChildren(
  docx: DocxModule,
  children: any[],
  theme: DocxTheme,
  style: RunStyle = {},
  input?: ExportDocumentInput,
  imageScale = 2,
) {
  const { Paragraph } = docx;
  return new Paragraph({
    children: (await Promise.all(children.map((child) => inlineToRuns(docx, child, theme, style, input, imageScale)))).flat(),
    spacing: { after: 180, line: 330 },
  });
}

async function paragraphBlocksFromInlineChildren(
  docx: DocxModule,
  children: any[],
  theme: DocxTheme,
  documentPath?: string,
  imageScale = 2,
  input?: ExportDocumentInput,
) {
  const { AlignmentType, Paragraph, TextRun } = docx;
  if (!children.some((child) => child?.type === 'image')) {
    return [await paragraphFromInlineChildren(docx, children, theme, {}, input, imageScale)];
  }

  const blocks: DocxBlock[] = [];
  let pendingInline: any[] = [];
  const flushInline = async () => {
    if (pendingInline.length === 0) return;
    blocks.push(await paragraphFromInlineChildren(docx, pendingInline, theme, {}, input, imageScale));
    pendingInline = [];
  };

  for (const child of children) {
    if (child?.type !== 'image') {
      pendingInline.push(child);
      continue;
    }

    await flushInline();
    const image = await renderMarkdownImage(String(child.url ?? ''), documentPath, imageScale);
    if (!image) {
      const fallback = String(child.alt || child.title || child.url || '图片无法导出');
      blocks.push(new Paragraph({
        children: [new TextRun({ text: fallback, italics: true, color: theme.muted })],
        spacing: { after: 180, line: 330 },
      }));
      continue;
    }

    const alt = String(child.alt || child.title || 'Markdown image');
    blocks.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 120, after: 220 },
      children: [
        createDocxImageRun(docx, image, {
          title: alt,
          description: alt,
          name: alt,
        }),
      ],
    }));
  }

  await flushInline();
  return blocks;
}

function isInlineMdastNode(node: any) {
  return [
    'text',
    'emphasis',
    'strong',
    'delete',
    'inlineCode',
    'inlineMath',
    'link',
    'break',
    'html',
    'image',
  ].includes(node?.type);
}

async function tableCellToDocxBlocks(
  docx: DocxModule,
  children: any[],
  theme: DocxTheme,
  contentTheme: ContentTheme,
  isHeader: boolean,
  documentPath?: string,
  imageScale = 2,
  input?: ExportDocumentInput,
) {
  const { Paragraph, TextRun } = docx;
  if (children.length === 0) {
    return [new Paragraph({ children: [new TextRun('')], spacing: { before: 0, after: 0 } })];
  }

  if (children.every(isInlineMdastNode)) {
    return [
      new Paragraph({
        children: (await Promise.all(children.map((child) => inlineToRuns(docx, child, theme, { bold: isHeader }, input, imageScale)))).flat(),
        spacing: { before: 0, after: 0, line: 300 },
      }),
    ];
  }

  const blocks = await mdastToDocxBlocks(docx, children, theme, contentTheme, 0, documentPath, imageScale, input);
  return blocks.length > 0 ? blocks : [new Paragraph('')];
}

function codeBlockToDocxTable(docx: DocxModule, value: string, theme: DocxTheme, input?: ExportDocumentInput) {
  const {
    AlignmentType,
    BorderStyle,
    Paragraph,
    ShadingType,
    Table,
    TableCell,
    TableLayoutType,
    TableRow,
    TextRun,
    VerticalAlignTable,
    WidthType,
  } = docx;
  const lines = String(value ?? '').replace(/\t/g, '  ').split('\n');
  const tableWidth = getDocxContentWidthTwips(input);
  return new Table({
    width: { size: tableWidth, type: WidthType.DXA },
    columnWidths: [tableWidth],
    layout: TableLayoutType.FIXED,
    borders: {
      top: { style: BorderStyle.SINGLE, size: 4, color: theme.border },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: theme.border },
      left: { style: BorderStyle.SINGLE, size: 4, color: theme.border },
      right: { style: BorderStyle.SINGLE, size: 4, color: theme.border },
      insideHorizontal: { style: BorderStyle.NONE, size: 0, color: theme.fill },
      insideVertical: { style: BorderStyle.NONE, size: 0, color: theme.fill },
    },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: tableWidth, type: WidthType.DXA },
            shading: { type: ShadingType.CLEAR, fill: theme.fill },
            margins: { top: 140, bottom: 140, left: 160, right: 160 },
            verticalAlign: VerticalAlignTable.TOP,
            children: [
              new Paragraph({
                alignment: AlignmentType.LEFT,
                spacing: { before: 0, after: 0, line: 250 },
                children: lines.flatMap((line, index) => [
                  new TextRun({
                    text: line.length > 0 ? line : ' ',
                    font: theme.codeFont,
                    size: 18,
                    noProof: true,
                    break: index === 0 ? 0 : 1,
                  }),
                ]),
              }),
            ],
          }),
        ],
      }),
    ],
  });
}

function createDocxTocBlocks(docx: DocxModule, items: ExportTocItem[], theme: DocxTheme): DocxBlock[] {
  if (items.length === 0) return [];
  const { BorderStyle, Paragraph, TextRun } = docx;
  return [
    new Paragraph({
      children: [new TextRun({
        text: '目录',
        color: theme.accent,
        size: 22,
        bold: true,
      })],
      border: {
        bottom: { style: BorderStyle.SINGLE, size: 4, color: theme.border },
      },
      spacing: { before: 0, after: 160 },
    }),
    ...items.map((item) => new Paragraph({
      children: [new TextRun({
        text: item.text,
        color: theme.text,
        size: 22,
      })],
      indent: { left: Math.max(0, item.level - 1) * 240 },
      spacing: { before: 0, after: 80, line: 300 },
    })),
    new Paragraph({
      children: [new TextRun({ text: '' })],
      spacing: { before: 0, after: 180 },
    }),
  ];
}

function createDocxHeaderFooterRuns(
  docx: DocxModule,
  parts: HeaderFooterTextPart[],
  theme: DocxTheme,
): DocxTextRun[] {
  const { PageNumber, TextRun } = docx;
  return parts.map((part) => {
    const base = {
      color: '737373',
      font: theme.font,
      size: 18,
    };
    if (part.type === 'page') {
      return new TextRun({ ...base, children: [PageNumber.CURRENT] });
    }
    if (part.type === 'pages') {
      return new TextRun({ ...base, children: [PageNumber.TOTAL_PAGES] });
    }
    return new TextRun({ ...base, text: part.value });
  });
}

function createDocxHeaderFooter(docx: DocxModule, input: ExportDocumentInput, theme: DocxTheme) {
  const { AlignmentType, Footer, Header, Paragraph, TextRun } = docx;
  const headerParts = input.pageHeaderFooter
    ? buildHeaderFooterTextParts(input.pageHeaderText, input)
    : [];
  const footerParts = input.pageHeaderFooter
    ? buildHeaderFooterTextParts(input.pageFooterText, input)
    : [];
  const footerHasPageToken = input.pageHeaderFooter && hasHeaderFooterPageToken(input.pageFooterText);
  const footerParagraphs: DocxParagraph[] = [];
  const header = headerParts.length > 0
    ? new Header({
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: createDocxHeaderFooterRuns(docx, headerParts, theme),
            spacing: { after: 80 },
          }),
        ],
      })
    : undefined;

  if (footerParts.length > 0) {
    footerParagraphs.push(new Paragraph({
      alignment: AlignmentType.LEFT,
      children: createDocxHeaderFooterRuns(docx, footerParts, theme),
      spacing: { before: 80, after: 0 },
    }));
  }

  if (input.pdfPageNumbers && !footerHasPageToken) {
    footerParagraphs.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({ color: '737373', font: theme.font, size: 18, children: [docx.PageNumber.CURRENT] }),
        new TextRun({ color: '737373', font: theme.font, size: 18, text: ' / ' }),
        new TextRun({ color: '737373', font: theme.font, size: 18, children: [docx.PageNumber.TOTAL_PAGES] }),
      ],
      spacing: { before: footerParts.length > 0 ? 40 : 80, after: 0 },
    }));
  }

  return {
    header,
    footer: footerParagraphs.length > 0
      ? new Footer({ children: footerParagraphs })
      : undefined,
  };
}

function getDocxListMarker(node: any, item: any, index: number) {
  if (typeof item.checked === 'boolean') {
    return item.checked ? '☑ ' : '☐ ';
  }

  return node.ordered ? `${(node.start ?? 1) + index}. ` : '• ';
}

async function mdastToDocxBlocks(
  docx: DocxModule,
  nodes: any[],
  theme: DocxTheme,
  contentTheme: ContentTheme,
  listDepth = 0,
  documentPath?: string,
  imageScale = 2,
  input?: ExportDocumentInput,
): Promise<DocxBlock[]> {
  const {
    AlignmentType,
    BorderStyle,
    HeadingLevel,
    Paragraph,
    ShadingType,
    Table,
    TableCell,
    TableLayoutType,
    TableRow,
    TextRun,
    VerticalAlignTable,
    WidthType,
  } = docx;
  const blocks: DocxBlock[] = [];

  for (const node of nodes) {
    if (node.type === 'heading') {
      const level = Math.min(Math.max(node.depth ?? 1, 1), 6);
      blocks.push(new Paragraph({
        heading: [
          HeadingLevel.HEADING_1,
          HeadingLevel.HEADING_2,
          HeadingLevel.HEADING_3,
          HeadingLevel.HEADING_4,
          HeadingLevel.HEADING_5,
          HeadingLevel.HEADING_6,
        ][level - 1],
        children: (await Promise.all((node.children ?? []).map((child: any) => inlineToRuns(docx, child, theme, {}, input, imageScale)))).flat(),
        spacing: { before: level <= 2 ? 360 : 260, after: 160 },
      }));
      continue;
    }

    if (node.type === 'paragraph') {
      blocks.push(...await paragraphBlocksFromInlineChildren(docx, node.children ?? [], theme, documentPath, imageScale, input));
      continue;
    }

    if (node.type === 'blockquote') {
      const textRuns = (await Promise.all((node.children ?? []).map(async (child: any) => {
        if (child.type === 'paragraph') {
          return (await Promise.all((child.children ?? []).map((inline: any) => inlineToRuns(docx, inline, theme, {}, input, imageScale)))).flat();
        }
        return inlineToRuns(docx, child, theme, {}, input, imageScale);
      }))).flat();
      blocks.push(new Paragraph({
        children: textRuns,
        indent: { left: 360 },
        border: {
          left: { style: BorderStyle.SINGLE, size: 12, color: theme.accent, space: 12 },
        },
        shading: { type: ShadingType.CLEAR, fill: theme.fill },
        spacing: { before: 120, after: 180, line: 330 },
      }));
      continue;
    }

    if (node.type === 'code') {
      if (isMermaidSource(String(node.value ?? ''), node.lang)) {
        const image = await renderMermaidImage(String(node.value ?? ''), contentTheme, imageScale);
        if (image) {
          blocks.push(new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 180, after: 220 },
            children: [
              createDocxImageRun(docx, image, {
                title: 'Mermaid diagram',
                description: 'Mermaid diagram exported from Prism',
                name: 'Mermaid diagram',
              }, { maxWidth: DOCX_MERMAID_IMAGE_MAX_WIDTH }),
            ],
          }));
          continue;
        }

        blocks.push(new Paragraph({
          children: [
            new TextRun({
              text: 'Mermaid 图表渲染失败，请检查语法',
              color: theme.accent,
              italics: true,
            }),
          ],
          spacing: { before: 120, after: 160 },
        }));
        continue;
      }

      blocks.push(codeBlockToDocxTable(docx, node.value ?? '', theme, input));
      continue;
    }

    if (node.type === 'math') {
      const source = String(node.value ?? '');
      const image = input ? await renderDocxMathImage(input, source, true, imageScale) : null;
      if (image) {
        blocks.push(new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 180, after: 220 },
          children: [
            createDocxImageRun(docx, image, {
              title: 'Math formula',
              description: source,
              name: 'Math formula',
            }),
          ],
        }));
      } else {
        blocks.push(new Paragraph({
          children: [new TextRun({
            text: `$$ ${source} $$`,
            font: theme.codeFont,
            color: theme.accent,
          })],
          spacing: { before: 120, after: 160 },
        }));
      }
      continue;
    }

    if (node.type === 'list') {
      for (const [index, item] of (node.children ?? []).entries()) {
        const marker = getDocxListMarker(node, item, index);
        const paragraphChild = (item.children ?? []).find((child: any) => child.type === 'paragraph');
        const runs = paragraphChild
          ? (await Promise.all((paragraphChild.children ?? []).map((child: any) => inlineToRuns(docx, child, theme, {}, input, imageScale)))).flat()
          : [];
        blocks.push(new Paragraph({
          children: [new TextRun({ text: marker, color: theme.accent }), ...runs],
          indent: { left: 360 + listDepth * 240, hanging: 240 },
          spacing: { after: 100, line: 330 },
        }));
        const nested = (item.children ?? []).filter((child: any) => child.type !== 'paragraph');
        blocks.push(...await mdastToDocxBlocks(docx, nested, theme, contentTheme, listDepth + 1, documentPath, imageScale, input));
      }
      continue;
    }

    if (node.type === 'table') {
      const rows = [];
      const columnCount = Math.max(
        1,
        ...(node.children ?? []).map((row: any) => (row.children ?? []).length),
      );
      const tableWidth = getDocxContentWidthTwips(input);
      const columnWidth = Math.floor(tableWidth / columnCount);
      for (const [rowIndex, row] of (node.children ?? []).entries()) {
        const cells = [];
        for (const cell of row.children ?? []) {
          cells.push(new TableCell({
            width: { size: columnWidth, type: WidthType.DXA },
            children: await tableCellToDocxBlocks(
              docx,
              cell.children ?? [],
              theme,
              contentTheme,
              rowIndex === 0,
              documentPath,
              imageScale,
              input,
            ),
            shading: rowIndex === 0 ? { type: ShadingType.CLEAR, fill: theme.fill } : undefined,
            margins: { top: 110, bottom: 110, left: 140, right: 140 },
            verticalAlign: VerticalAlignTable.TOP,
            borders: {
              top: { style: BorderStyle.SINGLE, size: 4, color: theme.border },
              bottom: { style: BorderStyle.SINGLE, size: 4, color: theme.border },
              left: { style: BorderStyle.SINGLE, size: 4, color: theme.border },
              right: { style: BorderStyle.SINGLE, size: 4, color: theme.border },
            },
          }));
        }
        rows.push(new TableRow({ children: cells, cantSplit: true }));
      }
      blocks.push(new Table({
        rows,
        width: { size: tableWidth, type: WidthType.DXA },
        columnWidths: Array.from({ length: columnCount }, () => columnWidth),
        layout: TableLayoutType.FIXED,
        borders: {
          top: { style: BorderStyle.SINGLE, size: 4, color: theme.border },
          bottom: { style: BorderStyle.SINGLE, size: 4, color: theme.border },
          left: { style: BorderStyle.SINGLE, size: 4, color: theme.border },
          right: { style: BorderStyle.SINGLE, size: 4, color: theme.border },
          insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: theme.border },
          insideVertical: { style: BorderStyle.SINGLE, size: 4, color: theme.border },
        },
      }));
      continue;
    }

    if (node.type === 'thematicBreak') {
      blocks.push(new Paragraph({
        border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: theme.border } },
        spacing: { before: 240, after: 240 },
      }));
      continue;
    }

    if (node.type === 'html') {
      const source = String(node.value ?? '');
      const image = input ? await renderDocxHtmlBlockImage(input, source, imageScale) : null;
      if (image) {
        blocks.push(new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 180, after: 220 },
          children: [
            createDocxImageRun(docx, image, {
              title: 'HTML block',
              description: source.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() || 'HTML block',
              name: 'HTML block',
            }),
          ],
        }));
        continue;
      }
      blocks.push(new Paragraph({
        children: [new TextRun({ text: source.replace(/<[^>]*>/g, '') })],
      }));
      continue;
    }
  }

  return blocks;
}

export async function exportDocx(input: ExportDocumentInput, outputPath?: string) {
  const docx = await import('docx');
  const targetPath = await getExportOutputPath(outputPath);
  if (!targetPath) return false;

  reportCitationPlaceholderWarning(input);
  reportProgress(input, exportProgressMessages.parseMarkdown);
  const processor = unified().use(remarkParse).use(remarkGfm).use(remarkMath);
  const tree = processor.runSync(processor.parse(input.content)) as any;
  reportProgress(input, exportProgressMessages.applyTheme);
  const baseTheme = docxThemeByContentTheme[input.contentTheme];
  const theme: DocxTheme = {
    ...baseTheme,
    font: input.docxFontFamily || baseTheme.font,
    fill: input.codeStyle === 'plain' ? 'FFFFFF' : baseTheme.fill,
    border: input.tableStyle === 'minimal' ? 'D8D2C8' : baseTheme.border,
  };
  const tocBlocks = input.toc
    ? createDocxTocBlocks(docx, buildExportTocItemsFromMdast(tree.children ?? []), theme)
    : [];
  reportProgress(input, exportProgressMessages.renderDiagrams);
  const docxImageScale = normalizeExportRasterScale(input.pngScale);
  const bodyBlocks = await mdastToDocxBlocks(
    docx,
    tree.children ?? [],
    theme,
    input.contentTheme,
    0,
    input.documentPath,
    docxImageScale,
    input,
  );
  const blocks = [...tocBlocks, ...bodyBlocks];
  const { Document, Packer, Paragraph } = docx;
  const fonts = [];
  const pageSize = docxPageSizeTwips[input.pdfPaper ?? 'a4'];
  const pageMargin = docxPageMarginsTwips[input.pdfMargin ?? 'standard'];
  const { header, footer } = createDocxHeaderFooter(docx, input, theme);

  if (input.docxFontFile) {
    try {
      reportProgress(input, '正在嵌入 Word 字体');
      fonts.push({
        name: theme.font,
        data: await readCustomFontBytes({
          id: input.docxFontFile.filename,
          family: theme.font,
          displayName: theme.font,
          filename: input.docxFontFile.filename,
          path: input.docxFontFile.path,
          format: input.docxFontFile.format,
          importedAt: Date.now(),
        }),
      } as any);
    } catch (err) {
      console.error('[Export] DOCX font embedding failed:', err);
      reportWarning(input, 'Word 字体嵌入受限，已写入字体名称；打开设备需安装该字体才能完全一致。');
    }
  }

  reportProgress(input, exportProgressMessages.generateFile('Word'));
  const document = new Document({
    fonts,
    styles: {
      default: {
        document: {
          run: { font: theme.font, color: theme.text, size: 24 },
          paragraph: { spacing: { line: 330 } },
        },
      },
      paragraphStyles: [
        {
          id: 'Heading1',
          name: 'Heading 1',
          basedOn: 'Normal',
          next: 'Normal',
          quickFormat: true,
          run: { size: 34, color: theme.accent, bold: false, font: theme.font },
          paragraph: { spacing: { before: 420, after: 160 } },
        },
        {
          id: 'Heading2',
          name: 'Heading 2',
          basedOn: 'Normal',
          next: 'Normal',
          quickFormat: true,
          run: { size: 30, color: theme.accent, bold: false, font: theme.font },
          paragraph: { spacing: { before: 360, after: 140 } },
        },
        {
          id: 'Heading3',
          name: 'Heading 3',
          basedOn: 'Normal',
          next: 'Normal',
          quickFormat: true,
          run: { size: 26, color: theme.accent, bold: false, font: theme.font },
          paragraph: { spacing: { before: 300, after: 120 } },
        },
      ],
    },
    sections: [{
      headers: header ? { default: header } : undefined,
      footers: footer ? { default: footer } : undefined,
      properties: {
        page: {
          size: pageSize,
          margin: pageMargin,
        },
      },
      children: blocks.length > 0 ? blocks : [new Paragraph('')],
    }],
  });

  const blob = await Packer.toBlob(document);
  const bytes = await normalizeDocxDrawingCompatibility(blob);
  reportProgress(input, exportProgressMessages.writeFile('Word'));
  await writeFile(targetPath, bytes);
  return true;
}

export const __exportPipelineTesting = {
  formatPdfHeaderFooterText,
  getPdfFooterY,
  getPdfHeaderY,
  getPdfPageNumberLabel,
  getPdfPageNumberY,
  markExportAtomicBlocks,
  normalizeCssColorFunctionsForRaster,
  normalizePdfChromeText,
  prepareExportAtomicPagination,
  stripRasterUnsafeColorDeclarations,
};
