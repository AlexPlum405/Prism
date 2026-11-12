import { readFile, writeFile, writeTextFile } from '../../platform/tauri/fileSystem';
import { invokeNativeCommand } from '../../platform/tauri/nativeCommands';
import { readCustomFontBytes } from '../settings/fontService';
import type {
  Paragraph as DocxParagraph,
  TextRun as DocxTextRun,
} from 'docx';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import { markdownToHtml } from '../../lib/markdownToHtml';
import { applyCalloutMetadataToMdastBlockquote } from '../editor/extensions/callouts';
import { findPandocCitations } from '../editor/extensions/citations';
import type { ContentTheme } from '../settings/types';
import { t } from '../i18n/runtime';
import type { ExportDocumentInput } from './types';
import {
  getDocxThemeByContentTheme,
  getWriteClassByTheme,
  type DocxTheme,
} from './exportSettings';
import {
  buildExportTocHtml,
  buildExportTocItems,
  buildExportTocItemsFromMdast,
  type ExportTocItem,
} from './toc';
import {
  exportProgressMessages,
  getErrorMessage,
  getExportOutputPath,
  getExportTitle,
  isTauriExportWorkerRuntime,
  normalizeExportRasterScale,
  reportProgress,
  reportWarning,
} from './pipeline/exportPipelineContext';
import {
  blobToDataUrl,
  bytesToDataUrl,
  canvasToPngBytes,
  dataUrlToBytes,
  readLocalExportMedia,
} from './assets';
import {
  EXPORT_PAGE_SPLIT_EPSILON,
  markExportAtomicBlocks,
  prepareExportAtomicPagination,
} from './pagination';
import { collectExportCss } from './render/exportCss';
import { buildStandaloneHtml } from './render/standaloneHtml';
import {
  assertExportCanvasWithinLimits,
  isExportCanvasWithinLimits,
} from './render/canvasLimits';
import {
  DOCX_MERMAID_IMAGE_MAX_HEIGHT,
  DOCX_MERMAID_IMAGE_MAX_WIDTH,
  DOCX_VISUAL_BLOCK_RENDER_TIMEOUT_MS,
  DOCX_VISUAL_BLOCK_WIDTH,
  EXPORT_FONT_READY_TIMEOUT_MS,
  PDF_EXPORT_BATCH_RENDER_TIMEOUT_MS,
  PDF_EXPORT_MAX_PAGES,
  PDF_EXPORT_MAX_PAGES_PER_BATCH,
  PDF_EXPORT_MAX_RENDER_VIEWPORT_HEIGHT,
  PDF_EXPORT_RASTER_SCALE,
  STANDALONE_EXPORT_FRAME_WIDTH,
  WEBKIT_PDF_CAPTURE_WIDTH,
  WEBKIT_PDF_MAX_CAPTURE_HEIGHT,
  WEBKIT_PDF_MAX_PAGES_PER_CAPTURE,
} from './exportConstants';
import { createSlicedRenderedPng } from './png/pngAssembly';
import {
  normalizePlantUmlSvg,
  rasterizePlantUmlSvgsForCapture,
} from './diagrams/svgDocument';
import {
  renderMarkmapPlaceholders,
  renderMermaidPlaceholders,
  renderPlantUmlPlaceholders,
} from './diagrams/diagramPlaceholders';
import {
  collectExportPdfLinkRects,
  type ExportPdfLinkRect,
} from './pdf/pdfLinks';
import {
  captureCurrentWebviewPdf,
  getPdfCaptureCapability,
} from './pdf/pdfCaptureClient';
import { createPdfCaptureTempSession } from './pdf/pdfCaptureTemp';
import {
  buildHeaderFooterTextParts,
  createPdfChromeTextImage,
  formatPdfHeaderFooterText,
  getPdfFooterY,
  getPdfHeaderY,
  getPdfPageNumberLabel,
  getPdfPageNumberY,
  hasHeaderFooterPageToken,
  normalizePdfChromeText,
  type HeaderFooterTextPart,
} from './pdf/pdfChromeText';
import { sanitizeExportHtmlFragment } from './render/htmlFragmentRenderer';
import {
  nextExportFrame as nextFrame,
  normalizeCssColorFunctionsForRaster,
  normalizeRasterComputedColors,
  stripRasterUnsafeColorDeclarations,
  withExportTimeout as withTimeout,
} from './rendering';

import {
  constrainDocxImageSize,
  createDocxImageRun,
  rasterizeLinkedDocxImage,
  renderMarkdownImage,
  renderMarkmapImage,
  renderMermaidImage,
  renderPlantUmlImage,
  type DocxBlock,
  type DocxInline,
  type DocxModule,
  type RasterDocxImage,
} from './docx/docxImage';
interface PdfRenderedPage {
  data: Uint8Array;
  width: number;
  height: number;
}
interface PdfRenderResult {
  pages: PdfRenderedPage[];
  linkRects: ExportPdfLinkRect[];
  pageCssHeight: number;
  contentCssWidth: number;
}
interface PandocCitationHtmlResult {
  html: string;
  warnings: string;
}
type PandocCitationHtmlAttempt =
  | { attempted: false; html: null }
  | { attempted: true; html: string | null };

type CitationPlaceholderContext = 'html' | 'builtIn';
interface WebkitPdfCaptureLayout {
  rect: { x: number; y: number; width: number; height: number };
  pageCssHeight: number;
  pageCount: number;
  pageWidth: number;
  pageHeight: number;
  contentWidth: number;
  contentHeight: number;
  linkRects: ExportPdfLinkRect[];
  margins: typeof pdfPageMarginsPoints[keyof typeof pdfPageMarginsPoints];
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
    return t('export.warning.citationInvalidBibliography');
  }
  if (!hasSupportedCitationPathExtension(cslStylePath, ['.csl'])) {
    return t('export.warning.citationInvalidCsl');
  }
  if (!hasBibliography && hasCslStyle) {
    return t('export.warning.citationMissingBibliography');
  }
  if (context === 'html' && hasBibliography && !input.pandoc?.detected) {
    return pandocError
      ? t('export.warning.citationPandocMissingWithError', { error: pandocError })
      : t('export.warning.citationPandocMissing');
  }
  return t('export.warning.citationBuiltIn');
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
    const result = await invokeNativeCommand<PandocCitationHtmlResult>('render_citations_with_pandoc', {
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
      t('export.warning.citationPandocFailed', { message: getErrorMessage(error) }),
    );
    return { attempted: true, html: null };
  }
}

const pdfPageSizePoints = {
  a4: { width: 595.28, height: 841.89 },
  letter: { width: 612, height: 792 },
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

function isMermaidSource(value: string, lang?: string | null) {
  const normalizedLang = (lang ?? '').trim().toLowerCase();
  if (normalizedLang === 'mermaid' || normalizedLang === 'mmd') return true;
  const source = value.trimStart();
  return /^(graph|flowchart|sequenceDiagram|classDiagram|stateDiagram|erDiagram|journey|gantt|pie|mindmap|timeline|quadrantChart|requirementDiagram|gitGraph|C4Context)\b/.test(source);
}

function normalizeDiagramLanguage(language: unknown) {
  return String(language ?? '').trim().toLowerCase().replace(/[\s_-]+/g, '');
}

function isPlantUmlSource(value: string, lang?: string | null) {
  const normalizedLang = normalizeDiagramLanguage(lang);
  if (normalizedLang === 'plantuml' || normalizedLang === 'puml') return true;
  return /^\s*@startuml\b/i.test(value);
}

function isMarkmapSource(value: string, lang?: string | null) {
  const normalizedLang = normalizeDiagramLanguage(lang);
  if (normalizedLang === 'markmap') return true;
  return normalizedLang === 'mindmap'
    && /^\s{0,3}(?:#{1,6}\s+\S|[-+*]\s+\S|\d+[.)]\s+\S)/m.test(value);
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
    ? t('export.progress.generatePdfPage', { page: startPage, total: pageCount })
    : t('export.progress.generatePdfPageRange', { start: startPage, end: endPage, total: pageCount });
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
    if (!context) throw new Error(t('export.error.sliceFailed', { label: errorLabel }));
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
    data: await canvasToPngBytes(canvas, t('export.error.canvasLimitSimple', { label: errorLabel })),
    width: canvas.width,
    height: canvas.height,
  };
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
    `<div id="write" class="${getWriteClassByTheme(input.contentTheme)}">`,
    `<div data-prism-docx-visual-target="true">${html}</div>`,
    '</div>',
  ].join('');
  document.body.appendChild(root);

  try {
    await inlineImages(root, input);
    if ('fonts' in document) {
      try {
        await withTimeout(document.fonts.ready, EXPORT_FONT_READY_TIMEOUT_MS, t('export.error.fontLoadTimeout'));
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
      t('export.error.docxVisualTimeout', { label: options.label }),
    );

    return {
      type: 'png',
      data: await canvasToPngBytes(canvas, t('export.error.docxVisualImageFailed', { label: options.label })),
      width,
      height,
    };
  } catch (err) {
    reportWarning(input, t('export.warning.docxVisualFallback', { label: options.label, message: getErrorMessage(err) }));
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
      label: displayMode ? t('export.label.mathBlock') : t('export.label.inlineMath'),
      inline: !displayMode,
    });
  } catch (err) {
    reportWarning(input, t('export.warning.wordMathFallback', { message: getErrorMessage(err) }));
    return null;
  }
}

async function renderDocxHtmlBlockImage(input: ExportDocumentInput, source: string, scale: number) {
  const sanitized = sanitizeExportHtmlFragment(source).trim();
  if (!sanitized) return null;
  const wrapped = `<div class="prism-html-block" style="border:1px solid #d0d7de;border-left:4px solid #2563eb;background:#f6f8fa;padding:12px 16px;border-radius:6px;line-height:1.6;">${sanitized}</div>`;
  return renderDocxVisualHtmlFragment(input, wrapped, scale, {
    label: t('export.label.htmlBlock'),
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
  reportProgress(input, exportProgressMessages.parseMarkdown());
  const html = options.html ? sanitizeExportHtmlFragment(options.html) : markdownToHtml(input.content);
  reportProgress(input, exportProgressMessages.applyTheme());
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
  root.innerHTML = `<div id="write" class="${getWriteClassByTheme(input.contentTheme)}">${html}</div>`;
  applyExportToc(root, input);
  document.body.appendChild(root);

  try {
    reportProgress(input, exportProgressMessages.renderDiagrams());
    await renderMermaidPlaceholders(root, input.contentTheme, input);
    await renderMarkmapPlaceholders(root, input.contentTheme, input);
    await renderPlantUmlPlaceholders(root, input.contentTheme, input);
    await inlineImages(root, input);
    if ('fonts' in document) {
      try {
        await withTimeout(document.fonts.ready, EXPORT_FONT_READY_TIMEOUT_MS, t('export.error.fontLoadTimeout'));
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
  iframe.style.width = `${STANDALONE_EXPORT_FRAME_WIDTH}px`;
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
    throw new Error(t('export.error.renderEnvironmentFailed'));
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

function isNestedSvgGraphicsElement(element: Element) {
  const ownerSvg = (element as Element & { ownerSVGElement?: SVGSVGElement | null }).ownerSVGElement;
  return Boolean(ownerSvg && ownerSvg !== element);
}

function measureRenderedExportBounds(target: HTMLElement, frameDocument: Document) {
  const targetRect = target.getBoundingClientRect();
  let maxRight = Math.max(targetRect.width, WEBKIT_PDF_CAPTURE_WIDTH);
  let maxBottom = Math.max(
    targetRect.height,
    target.scrollHeight || 0,
    frameDocument.body.scrollHeight || 0,
    frameDocument.documentElement.scrollHeight || 0,
  );

  target.querySelectorAll<Element>('*').forEach((element) => {
    if (isNestedSvgGraphicsElement(element)) return;
    const rect = element.getBoundingClientRect();
    if (!Number.isFinite(rect.right) || !Number.isFinite(rect.bottom)) return;
    if (rect.width < 1 || rect.height < 1) return;
    maxRight = Math.max(maxRight, rect.right - targetRect.left);
    maxBottom = Math.max(maxBottom, rect.bottom - targetRect.top);
  });

  return {
    width: Math.max(WEBKIT_PDF_CAPTURE_WIDTH, Math.ceil(maxRight || WEBKIT_PDF_CAPTURE_WIDTH)),
    height: Math.max(200, Math.ceil(maxBottom || 200)),
  };
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

function getWebkitPdfCaptureProgressMessage(startPage: number, endPage: number, pageCount: number) {
  return startPage === endPage
    ? t('export.progress.capturePdfPage', { page: startPage, total: pageCount })
    : t('export.progress.capturePdfPageRange', { start: startPage, end: endPage, total: pageCount });
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
  reportProgress(input, exportProgressMessages.prepareNativePdf());
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
        await withTimeout(document.fonts.ready, EXPORT_FONT_READY_TIMEOUT_MS, t('export.error.fontLoadTimeout'));
      } catch {
        // Native print can still proceed with platform font fallback.
      }
    }
    await nextFrame();
    const target = document.body.querySelector<HTMLElement>('.prism-export-document');
    if (!target) throw new Error(t('export.error.webkitPdfPrepareFailed'));
    await rasterizePlantUmlSvgsForCapture(target);

    const measureTarget = () => {
      const rect = target.getBoundingClientRect();
      const bounds = measureRenderedExportBounds(target, document);
      return {
        rect,
        width: bounds.width,
        height: Math.max(1, bounds.height),
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
      throw new Error(t('export.error.webkitPdfPageSizeFailed'));
    }
    if (pageCount > PDF_EXPORT_MAX_PAGES) {
      throw new Error(t('export.error.pdfTooManyPages', { count: pageCount, max: PDF_EXPORT_MAX_PAGES }));
    }
    const linkRects = collectExportPdfLinkRects(target);

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
      linkRects,
      margins,
    };
  } finally {
    node.remove();
  }
}

function addPdfUriAnnotation(
  pdfLib: typeof import('pdf-lib'),
  pdf: any,
  page: any,
  rect: { x: number; y: number; width: number; height: number },
  url: string,
) {
  if (rect.width < 1 || rect.height < 1) return;
  const context = pdf.context;
  const annotation = context.obj({
    Type: 'Annot',
    Subtype: 'Link',
    Rect: [
      Number(rect.x.toFixed(2)),
      Number(rect.y.toFixed(2)),
      Number((rect.x + rect.width).toFixed(2)),
      Number((rect.y + rect.height).toFixed(2)),
    ],
    Border: [0, 0, 0],
    F: 4,
    H: 'I',
    A: {
      S: 'URI',
      URI: pdfLib.PDFString.of(url),
    },
  });
  page.node.addAnnot(context.register(annotation));
}

function addExportPdfLinkAnnotations(
  pdfLib: typeof import('pdf-lib'),
  pdf: any,
  page: any,
  linkRects: ExportPdfLinkRect[],
  options: {
    pageIndex: number;
    pageCssHeight: number;
    cssPxToPdfPoint: number;
    pageHeight: number;
    margins: typeof pdfPageMarginsPoints[keyof typeof pdfPageMarginsPoints];
  },
) {
  if (linkRects.length === 0) return;
  const pageStart = options.pageIndex * options.pageCssHeight;
  const pageEnd = pageStart + options.pageCssHeight;

  for (const link of linkRects) {
    const linkTop = link.top;
    const linkBottom = link.top + link.height;
    if (linkBottom <= pageStart + EXPORT_PAGE_SPLIT_EPSILON) continue;
    if (linkTop >= pageEnd - EXPORT_PAGE_SPLIT_EPSILON) continue;

    const clippedTop = Math.max(linkTop, pageStart);
    const clippedBottom = Math.min(linkBottom, pageEnd);
    const height = (clippedBottom - clippedTop) * options.cssPxToPdfPoint;
    const yTop = options.pageHeight
      - options.margins.top
      - ((clippedTop - pageStart) * options.cssPxToPdfPoint);

    addPdfUriAnnotation(pdfLib, pdf, page, {
      x: options.margins.left + (link.left * options.cssPxToPdfPoint),
      y: yTop - height,
      width: link.width * options.cssPxToPdfPoint,
      height,
    }, link.url);
  }
}

async function overlayPdfChrome(input: ExportDocumentInput, targetPath: string) {
  if (!input.pageHeaderFooter && !input.pdfPageNumbers) return;

  reportProgress(input, exportProgressMessages.applyPdfChrome());
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

async function exportPdfWithNativeCapture(input: ExportDocumentInput, targetPath: string) {
  const layout = await prepareWebkitPdfCaptureDocument(input);
  reportProgress(input, exportProgressMessages.printNativePdf());

  const pdfLib = await import('pdf-lib');
  const { PDFDocument, rgb } = pdfLib;
  const pdf = await PDFDocument.create();
  const marginMask = rgb(1, 1, 1);
  const cssPxToPdfPoint = layout.contentWidth / layout.rect.width;
  let pageIndex = 0;
  let batchIndex = 0;
  const tempSession = await createPdfCaptureTempSession();

  try {
    while (pageIndex < layout.pageCount) {
      const pagesByHeight = Math.max(1, Math.floor(WEBKIT_PDF_MAX_CAPTURE_HEIGHT / layout.pageCssHeight));
      const pagesPerCapture = Math.max(1, Math.min(WEBKIT_PDF_MAX_PAGES_PER_CAPTURE, pagesByHeight));
      const batchEndPage = Math.min(layout.pageCount, pageIndex + pagesPerCapture);
      const batchStartY = Math.floor(pageIndex * layout.pageCssHeight);
      const batchEndY = Math.min(layout.rect.height, Math.ceil(batchEndPage * layout.pageCssHeight));
      const batchHeight = Math.max(1, batchEndY - batchStartY);
      const capturePath = tempSession.getCapturePath(batchIndex);

      reportProgress(input, getWebkitPdfCaptureProgressMessage(pageIndex + 1, batchEndPage, layout.pageCount));
      await captureCurrentWebviewPdf({
        outputPath: capturePath,
        x: layout.rect.x,
        y: layout.rect.y + batchStartY,
        width: layout.rect.width,
        height: batchHeight,
      });

      const captureBytes = await readFile(capturePath);
      const [embeddedPage] = await pdf.embedPdf(captureBytes);
      if (!embeddedPage) throw new Error(t('export.error.webkitPdfEmpty'));

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
        addExportPdfLinkAnnotations(pdfLib, pdf, page, layout.linkRects, {
          pageIndex: splitPageIndex,
          pageCssHeight: layout.pageCssHeight,
          cssPxToPdfPoint,
          pageHeight: layout.pageHeight,
          margins: layout.margins,
        });
      }

      pageIndex = batchEndPage;
      batchIndex += 1;
      await nextFrame();
    }

    reportProgress(input, exportProgressMessages.writeFile('PDF'));
    await writeFile(targetPath, await pdf.save());
  } finally {
    await tempSession.cleanup().catch(() => undefined);
  }

  await overlayPdfChrome(input, targetPath);
  return true;
}

async function exportPdfRaster(input: ExportDocumentInput, targetPath: string) {
  reportCitationPlaceholderWarning(input);
  const pdfLib = await import('pdf-lib');
  const { PDFDocument, StandardFonts, rgb } = pdfLib;
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

  const pageCount = renderedPages.pages.length;
  const cssPxToPdfPoint = contentWidth / renderedPages.contentCssWidth;
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
    const image = renderedPages.pages[pageIndex];
    const embedded = await pdf.embedPng(image.data);
    const scaledHeight = contentWidth * (image.height / image.width);
    const page = pdf.addPage([pageWidth, pageHeight]);
    page.drawImage(embedded, {
      x: margins.left,
      y: pageHeight - margins.top - scaledHeight,
      width: contentWidth,
      height: scaledHeight,
    });
    addExportPdfLinkAnnotations(pdfLib, pdf, page, renderedPages.linkRects, {
      pageIndex,
      pageCssHeight: renderedPages.pageCssHeight,
      cssPxToPdfPoint,
      pageHeight,
      margins,
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
    const capability = await getPdfCaptureCapability();
    if (capability.supported) {
      try {
        return await exportPdfWithNativeCapture(input, targetPath);
      } catch (error) {
        reportWarning(
          input,
          t('export.warning.webkitFallback', { message: getErrorMessage(error) }),
        );
      }
    }
  }

  return exportPdfRaster(input, targetPath);
}

async function createRenderedPdfPages(
  input: ExportDocumentInput,
  options: { contentWidth: number; contentHeight: number; scale?: number },
): Promise<PdfRenderResult> {
  const { default: html2canvas } = await import('html2canvas');
  const iframe = await createStandaloneExportFrame(input);
  try {
    const frameDocument = iframe.contentDocument;
    const target = frameDocument?.querySelector<HTMLElement>('.prism-export-document');
    if (!frameDocument || !target) throw new Error(t('export.error.contentRenderFailed'));

    await rasterizePlantUmlSvgsForCapture(target);
    const bounds = measureRenderedExportBounds(target, frameDocument);
    const { height, width } = bounds;
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
      throw new Error(t('export.error.webkitPdfPageSizeFailed'));
    }
    if (pageCount > PDF_EXPORT_MAX_PAGES) {
      throw new Error(t('export.error.pdfTooManyPages', { count: pageCount, max: PDF_EXPORT_MAX_PAGES }));
    }
    const linkRects = collectExportPdfLinkRects(target);
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
          ? t('export.label.pdfPage', { page: pageIndex + 1 })
          : t('export.label.pdfPageRange', { start: pageIndex + 1, end: batchEndPage }),
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
          ? t('export.error.pdfPageTimeout', { page: pageIndex + 1 })
          : t('export.error.pdfPageRangeTimeout', { start: pageIndex + 1, end: batchEndPage }),
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
          t('export.label.pdfPage', { page: splitPageIndex + 1 }),
        ));
      }

      pageIndex = batchEndPage;
      await nextFrame();
    }
    return {
      pages,
      linkRects,
      pageCssHeight,
      contentCssWidth: width,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : err instanceof Event ? err.type : String(err);
    throw new Error(t('export.error.pdfRenderFailed', { message }));
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
    if (!frameDocument || !target) throw new Error(t('export.error.contentRenderFailed'));

    await rasterizePlantUmlSvgsForCapture(target);
    const bounds = measureRenderedExportBounds(target, frameDocument);
    const { height, width } = bounds;
    iframe.style.width = `${width}px`;
    iframe.style.height = `${height}px`;
    await nextFrame();
    normalizeRasterComputedColors(target);

    const requestedScale = normalizeExportRasterScale(options.scale);
    const backgroundColor = normalizeCssColorFunctionsForRaster(getComputedStyle(target).backgroundColor) || '#ffffff';
    if (!isExportCanvasWithinLimits(width, height, requestedScale)) {
      return await createSlicedRenderedPng(html2canvas, target, {
        backgroundColor,
        width,
        height,
        scale: requestedScale,
      });
    }

    assertExportCanvasWithinLimits(width, height, requestedScale, t('export.label.pngExport'));
    const canvas = await html2canvas(target, {
      backgroundColor,
      scale: requestedScale,
      useCORS: true,
      logging: false,
      width,
      height,
      windowWidth: width,
      windowHeight: height,
      scrollX: 0,
      scrollY: 0,
    });
    return {
      data: await canvasToPngBytes(
        canvas,
        t('export.error.exportCanvasLimit', {
          width: Math.ceil(width * requestedScale),
          height: Math.ceil(height * requestedScale),
        }),
      ),
      width: canvas.width || Math.ceil(width * requestedScale),
      height: canvas.height || Math.ceil(height * requestedScale),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : err instanceof Event ? err.type : String(err);
    throw new Error(t('export.error.imageRenderFailed', { message }));
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
  await writeFile(targetPath, image.data);
  return true;
}

type RunStyle = Record<string, any>;
type DocxInlineHtmlTagName = 'mark' | 'kbd' | 'abbr';
type DocxInlineHtmlToken =
  | { kind: 'open'; tag: DocxInlineHtmlTagName }
  | { kind: 'close'; tag: DocxInlineHtmlTagName }
  | { kind: 'break' };

const DOCX_INLINE_HTML_TAGS = new Set(['mark', 'kbd', 'abbr']);

function normalizeDocxText(value: string) {
  return value.replace(/[\uFE0E\uFE0F]/g, '');
}

function splitMarkedText(docx: DocxModule, value: string, base: RunStyle = {}) {
  const { ShadingType, TextRun } = docx;
  const runs: DocxTextRun[] = [];
  const pattern = /==([^=\n]+)==/g;
  const normalizedValue = normalizeDocxText(value);
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(normalizedValue)) !== null) {
    if (match.index > lastIndex) {
      runs.push(new TextRun({ ...base, text: normalizedValue.slice(lastIndex, match.index) }));
    }
    runs.push(new TextRun({
      ...base,
      text: match[1],
      shading: { type: ShadingType.CLEAR, fill: 'FFF3A3' },
    }));
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < normalizedValue.length) {
    runs.push(new TextRun({ ...base, text: normalizedValue.slice(lastIndex) }));
  }
  return runs.length > 0 ? runs : [new TextRun({ ...base, text: normalizedValue })];
}

function parseDocxInlineHtmlToken(value: string): DocxInlineHtmlToken | null {
  const trimmed = value.trim();
  if (/^<\s*br\s*\/?\s*>$/i.test(trimmed)) return { kind: 'break' };

  const closeMatch = trimmed.match(/^<\s*\/\s*([a-z][\w:-]*)\s*>$/i);
  if (closeMatch) {
    const tag = closeMatch[1].toLowerCase();
    return DOCX_INLINE_HTML_TAGS.has(tag) ? { kind: 'close', tag: tag as DocxInlineHtmlTagName } : null;
  }

  const openMatch = trimmed.match(/^<\s*([a-z][\w:-]*)(?:\s[^>]*)?>$/i);
  if (openMatch) {
    const tag = openMatch[1].toLowerCase();
    return DOCX_INLINE_HTML_TAGS.has(tag) ? { kind: 'open', tag: tag as DocxInlineHtmlTagName } : null;
  }

  return null;
}

function stripInlineHtmlTag(value: string) {
  return value.replace(/<[^>]*>/g, '');
}

function applyDocxInlineHtmlStyle(docx: DocxModule, theme: DocxTheme, tag: DocxInlineHtmlTagName, style: RunStyle) {
  const { BorderStyle, ShadingType, UnderlineType } = docx;
  if (tag === 'mark') {
    return {
      ...style,
      shading: { type: ShadingType.CLEAR, fill: 'FFF3A3' },
    };
  }

  if (tag === 'kbd') {
    return {
      ...style,
      font: theme.codeFont,
      color: theme.text,
      shading: { type: ShadingType.CLEAR, fill: theme.fill },
      border: { style: BorderStyle.SINGLE, size: 2, color: theme.border, space: 1 },
      noProof: true,
    };
  }

  return {
    ...style,
    underline: { type: UnderlineType.DOTTED, color: theme.muted },
    noProof: true,
  };
}

function composeDocxInlineHtmlStyle(
  docx: DocxModule,
  theme: DocxTheme,
  base: RunStyle,
  stack: DocxInlineHtmlTagName[],
) {
  return stack.reduce((current, tag) => applyDocxInlineHtmlStyle(docx, theme, tag, current), { ...base });
}


async function inlineChildrenToRuns(
  docx: DocxModule,
  children: any[],
  theme: DocxTheme,
  style: RunStyle = {},
  input?: ExportDocumentInput,
  imageScale = 2,
): Promise<DocxInline[]> {
  const { TextRun } = docx;
  const runs: DocxInline[] = [];
  const htmlStack: DocxInlineHtmlTagName[] = [];

  for (const child of children) {
    if (child?.type === 'html') {
      const value = String(child.value ?? '');
      const token = parseDocxInlineHtmlToken(value);
      if (token?.kind === 'break') {
        runs.push(new TextRun({ text: '', break: 1 }));
        continue;
      }
      if (token?.kind === 'open') {
        htmlStack.push(token.tag);
        continue;
      }
      if (token?.kind === 'close') {
        const index = htmlStack.lastIndexOf(token.tag);
        if (index >= 0) htmlStack.splice(index, 1);
        continue;
      }

      const fallback = stripInlineHtmlTag(value);
      if (fallback) {
        runs.push(...splitMarkedText(docx, fallback, composeDocxInlineHtmlStyle(docx, theme, style, htmlStack)));
      }
      continue;
    }

    runs.push(...await inlineToRuns(
      docx,
      child,
      theme,
      composeDocxInlineHtmlStyle(docx, theme, style, htmlStack),
      input,
      imageScale,
    ));
  }

  return runs;
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
    return inlineChildrenToRuns(docx, node.children ?? [], theme, { ...style, bold: true }, input, imageScale);
  }
  if (node.type === 'emphasis') {
    return inlineChildrenToRuns(docx, node.children ?? [], theme, { ...style, italics: true }, input, imageScale);
  }
  if (node.type === 'delete') {
    return inlineChildrenToRuns(docx, node.children ?? [], theme, { ...style, strike: true }, input, imageScale);
  }
  if (node.type === 'link') {
    const url = String(node.url ?? '');
    const nested: any[] = [];
    let pendingInline: any[] = [];
    const flushInline = async () => {
      if (pendingInline.length === 0) return;
      nested.push(...await inlineChildrenToRuns(docx, pendingInline, theme, {
        ...style,
        color: theme.accent,
        underline: { type: UnderlineType.SINGLE },
      }, input, imageScale));
      pendingInline = [];
    };

    for (const child of (node.children ?? [])) {
      if (child?.type === 'image') {
        await flushInline();
        const image = await renderMarkdownImage(String(child.url ?? ''), input?.documentPath, imageScale);
        if (image) {
          const alt = String(child.alt || child.title || 'Markdown image');
          nested.push(createDocxImageRun(docx, rasterizeLinkedDocxImage(image), { title: alt, description: alt, name: alt }));
          continue;
        }
        const fallback = String(child.alt || child.title || child.url || t('export.fallback.imageUnavailable'));
        nested.push(...splitMarkedText(docx, fallback, { ...style, italics: true, color: theme.muted }));
        continue;
      }
      pendingInline.push(child);
    }
    await flushInline();
    if (url && /^https?:\/\//i.test(url)) {
      const { ExternalHyperlink } = docx as any;
      if (ExternalHyperlink) {
        return [new ExternalHyperlink({ link: url, children: nested })];
      }
    }
    return nested;
  }
  if (node.type === 'image') {
    const label = String(node.alt || node.title || node.url || '');
    return label ? splitMarkedText(docx, label, { ...style, italics: true, color: theme.muted }) : [];
  }
  if (node.type === 'html') {
    const value = String(node.value ?? '');
    const token = parseDocxInlineHtmlToken(value);
    if (token?.kind === 'break') return [new TextRun({ text: '', break: 1 })];
    if (token?.kind === 'open' || token?.kind === 'close') return [];
    const fallback = stripInlineHtmlTag(value);
    return fallback ? splitMarkedText(docx, fallback, style) : [];
  }
  if (node.value && typeof node.value === 'string') return splitMarkedText(docx, node.value, style);
  return inlineChildrenToRuns(docx, node.children ?? [], theme, style, input, imageScale);
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
    children: await inlineChildrenToRuns(docx, children, theme, style, input, imageScale),
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
      const fallback = String(child.alt || child.title || child.url || t('export.fallback.imageUnavailable'));
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
        children: await inlineChildrenToRuns(docx, children, theme, { bold: isHeader }, input, imageScale),
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

function stripHtmlTagsToText(source: string) {
  return source.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function htmlNodeOpensDetails(node: any) {
  return node.type === 'html' && /^<\s*details\b/i.test(String(node.value ?? '').trim());
}

function htmlNodeClosesDetails(node: any) {
  return node.type === 'html' && /^<\s*\/\s*details\s*>/i.test(String(node.value ?? '').trim());
}

function extractSummaryTextFromHtmlNode(node: any) {
  if (node.type !== 'html') return null;
  const source = String(node.value ?? '');
  const match = source.match(/<\s*summary\b[^>]*>([\s\S]*?)<\s*\/\s*summary\s*>/i);
  return match ? stripHtmlTagsToText(match[1]) : null;
}

function normalizeDetailsNodesForDocx(nodes: any[]): any[] {
  const normalized: any[] = [];

  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes[index];
    if (!htmlNodeOpensDetails(node)) {
      normalized.push(node);
      continue;
    }

    const children: any[] = [];
    let summary = extractSummaryTextFromHtmlNode(node) ?? t('export.fallback.details');

    for (index += 1; index < nodes.length; index += 1) {
      const child = nodes[index];
      const childSummary = extractSummaryTextFromHtmlNode(child);
      if (childSummary) {
        summary = childSummary;
        continue;
      }
      if (htmlNodeClosesDetails(child)) {
        break;
      }
      if (child.type === 'html') continue;
      children.push(child);
    }

    normalized.push({
      type: 'prismDetails',
      title: summary,
      children,
      data: node.data,
    });
  }

  return normalized;
}

function createDocxTocBlocks(docx: DocxModule, items: ExportTocItem[], theme: DocxTheme): DocxBlock[] {
  if (items.length === 0) return [];
  const { BorderStyle, Paragraph, TextRun } = docx;
  return [
    new Paragraph({
      children: [new TextRun({
        text: t('export.toc'),
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
    return new TextRun({ ...base, text: normalizeDocxText(part.value) });
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

  for (const node of normalizeDetailsNodesForDocx(nodes)) {
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
        children: await inlineChildrenToRuns(docx, node.children ?? [], theme, {}, input, imageScale),
        spacing: { before: level <= 2 ? 360 : 260, after: 160 },
      }));
      continue;
    }

    if (node.type === 'paragraph') {
      blocks.push(...await paragraphBlocksFromInlineChildren(docx, node.children ?? [], theme, documentPath, imageScale, input));
      continue;
    }

    if (node.type === 'blockquote') {
      const callout = applyCalloutMetadataToMdastBlockquote(node);
      const textRuns = (await Promise.all((node.children ?? []).map(async (child: any) => {
        if (child.type === 'paragraph') {
          return inlineChildrenToRuns(docx, child.children ?? [], theme, {}, input, imageScale);
        }
        return inlineToRuns(docx, child, theme, {}, input, imageScale);
      }))).flat();
      blocks.push(new Paragraph({
        children: callout
          ? [
              new TextRun({ text: `${callout.title}: `, bold: true, color: theme.accent }),
              ...textRuns,
            ]
          : textRuns,
        indent: { left: 360 },
        border: {
          left: { style: BorderStyle.SINGLE, size: 12, color: theme.accent, space: 12 },
        },
        shading: { type: ShadingType.CLEAR, fill: theme.fill },
        spacing: { before: 120, after: 180, line: 330 },
      }));
      continue;
    }

    if (node.type === 'prismDetails') {
      blocks.push(new Paragraph({
        children: [
          new TextRun({
            text: t('export.fallback.detailsPrefix', { title: String(node.title ?? t('export.fallback.details')) }),
            bold: true,
            color: theme.accent,
          }),
        ],
        indent: { left: 240 },
        border: {
          left: { style: BorderStyle.SINGLE, size: 8, color: theme.border, space: 12 },
        },
        shading: { type: ShadingType.CLEAR, fill: theme.fill },
        spacing: { before: 120, after: 100, line: 330 },
      }));
      blocks.push(...await mdastToDocxBlocks(
        docx,
        node.children ?? [],
        theme,
        contentTheme,
        listDepth,
        documentPath,
        imageScale,
        input,
      ));
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
              }, { maxWidth: DOCX_MERMAID_IMAGE_MAX_WIDTH, maxHeight: DOCX_MERMAID_IMAGE_MAX_HEIGHT }),
            ],
          }));
          continue;
        }

        blocks.push(new Paragraph({
          children: [
            new TextRun({
              text: t('export.fallback.mermaidFailed'),
              color: theme.accent,
              italics: true,
            }),
          ],
          spacing: { before: 120, after: 160 },
        }));
        continue;
      }

      if (isMarkmapSource(String(node.value ?? ''), node.lang)) {
        const image = await renderMarkmapImage(String(node.value ?? ''), contentTheme, imageScale);
        if (image) {
          blocks.push(new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 180, after: 220 },
            children: [
              createDocxImageRun(docx, image, {
                title: 'Markmap diagram',
                description: 'Markmap diagram exported from Prism',
                name: 'Markmap diagram',
              }, { maxWidth: DOCX_MERMAID_IMAGE_MAX_WIDTH, maxHeight: DOCX_MERMAID_IMAGE_MAX_HEIGHT }),
            ],
          }));
          continue;
        }

        blocks.push(new Paragraph({
          children: [
            new TextRun({
              text: t('export.fallback.markmapFailed'),
              color: theme.accent,
              italics: true,
            }),
          ],
          spacing: { before: 120, after: 160 },
        }));
        continue;
      }

      if (isPlantUmlSource(String(node.value ?? ''), node.lang)) {
        const image = await renderPlantUmlImage(String(node.value ?? ''), contentTheme, input, imageScale);
        if (image) {
          blocks.push(new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 180, after: 220 },
            children: [
              createDocxImageRun(docx, image, {
                title: 'PlantUML diagram',
                description: 'PlantUML diagram exported from Prism',
                name: 'PlantUML diagram',
              }, { maxWidth: DOCX_MERMAID_IMAGE_MAX_WIDTH, maxHeight: DOCX_MERMAID_IMAGE_MAX_HEIGHT }),
            ],
          }));
          continue;
        }

        blocks.push(new Paragraph({
          children: [
            new TextRun({
              text: t('export.fallback.plantUmlFailed'),
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
          ? await inlineChildrenToRuns(docx, paragraphChild.children ?? [], theme, {}, input, imageScale)
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
  reportProgress(input, exportProgressMessages.parseMarkdown());
  const processor = unified().use(remarkParse).use(remarkGfm).use(remarkMath);
  const tree = processor.runSync(processor.parse(input.content)) as any;
  reportProgress(input, exportProgressMessages.applyTheme());
  const baseTheme = getDocxThemeByContentTheme(input.contentTheme);
  const theme: DocxTheme = {
    ...baseTheme,
    font: input.docxFontFamily || baseTheme.font,
    fill: input.codeStyle === 'plain' ? 'FFFFFF' : baseTheme.fill,
    border: input.tableStyle === 'minimal' ? 'D8D2C8' : baseTheme.border,
  };
  const tocBlocks = input.toc
    ? createDocxTocBlocks(docx, buildExportTocItemsFromMdast(tree.children ?? []), theme)
    : [];
  reportProgress(input, exportProgressMessages.renderDiagrams());
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
      reportProgress(input, t('export.progress.embedWordFonts'));
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
      reportWarning(input, t('export.warning.wordFontEmbedLimited'));
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
  constrainDocxImageSize,
  formatPdfHeaderFooterText,
  getPdfFooterY,
  getPdfHeaderY,
  getPdfPageNumberLabel,
  getPdfPageNumberY,
  markExportAtomicBlocks,
  measureRenderedExportBounds,
  normalizeCssColorFunctionsForRaster,
  normalizePlantUmlSvg,
  normalizePdfChromeText,
  rasterizePlantUmlSvgsForCapture,
  prepareExportAtomicPagination,
  stripRasterUnsafeColorDeclarations,
};
