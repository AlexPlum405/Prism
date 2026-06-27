import { readFile, remove, writeFile, writeTextFile } from '../../platform/tauri/fileSystem';
import { invokeNativeCommand } from '../../platform/tauri/nativeCommands';
import { readCustomFontBytes } from '../settings/fontService';
import type {
  Paragraph as DocxParagraph,
  Table as DocxTable,
  TextRun as DocxTextRun,
} from 'docx';
import { Zlib } from 'fflate';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import { markdownToHtml } from '../../lib/markdownToHtml';
import { applyCalloutMetadataToMdastBlockquote } from '../editor/extensions/callouts';
import { findPandocCitations } from '../editor/extensions/citations';
import { getMarkmapPalette } from '../editor/components/markmap';
import { createPlantUmlSvgElement } from '../editor/components/plantUml';
import type { ContentTheme } from '../settings/types';
import { t } from '../i18n/runtime';
import type { ExportDocumentInput } from './types';
import {
  getDocxThemeByContentTheme,
  getWriteClassByTheme,
  type DocxTheme,
} from './exportSettings';
import { getMermaidThemeConfig } from '../themes';
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
  getPreviewBackgroundColor,
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
  getDocxRasterType,
  getImageSize,
  getSvgSize,
  prepareSvgForDocx,
  readLocalExportMedia,
  type RasterDocxImageType,
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
  MAX_EXPORT_CANVAS_AREA,
  MAX_EXPORT_CANVAS_DIMENSION,
} from './render/canvasLimits';
import {
  collectExportPdfLinkRects,
  type ExportPdfLinkRect,
} from './pdf/pdfLinks';
import {
  captureCurrentWebviewPdf,
  getPdfCaptureCapability,
} from './pdf/pdfCaptureClient';
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
import {
  escapeHtml,
  sanitizeExportHtmlFragment,
} from './render/htmlFragmentRenderer';
import {
  nextExportFrame as nextFrame,
  normalizeCssColorFunctionsForRaster,
  normalizeRasterComputedColors,
  stripRasterUnsafeColorDeclarations,
  withExportTimeout as withTimeout,
} from './rendering';

type DocxModule = typeof import('docx');
type DocxBlock = DocxParagraph | DocxTable;
type DocxInline = DocxTextRun | InstanceType<DocxModule['ImageRun']>;
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
interface PngRenderedImage {
  data: Uint8Array;
  width: number;
  height: number;
}
interface PngCaptureColumn {
  x: number;
  width: number;
  pixelX: number;
  pixelWidth: number;
}
interface PngCaptureRow {
  y: number;
  height: number;
  pixelY: number;
  pixelHeight: number;
}
interface PngCapturedTile {
  column: PngCaptureColumn;
  data: Uint8ClampedArray;
  width: number;
  height: number;
}
type Html2CanvasRenderer = typeof import('html2canvas')['default'];
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

const PDF_EXPORT_RASTER_SCALE = 2;
const PDF_EXPORT_MAX_PAGES = 500;
const PDF_EXPORT_BATCH_RENDER_TIMEOUT_MS = 60_000;
const PDF_EXPORT_MAX_RENDER_VIEWPORT_HEIGHT = 4_096;
const PDF_EXPORT_MAX_PAGES_PER_BATCH = 8;
const WEBKIT_PDF_CAPTURE_WIDTH = 980;
const STANDALONE_EXPORT_FRAME_WIDTH = 1040;
const WEBKIT_PDF_MAX_CAPTURE_HEIGHT = 12_000;
const WEBKIT_PDF_MAX_PAGES_PER_CAPTURE = 8;
const EXPORT_MERMAID_RENDER_TIMEOUT_MS = 20_000;
const EXPORT_MARKMAP_RENDER_TIMEOUT_MS = 20_000;
const EXPORT_PLANTUML_RENDER_TIMEOUT_MS = 30_000;
const EXPORT_FONT_READY_TIMEOUT_MS = 3_000;
const DOCX_VISUAL_BLOCK_RENDER_TIMEOUT_MS = 60_000;
const DOCX_VISUAL_BLOCK_WIDTH = 760;
const DOCX_IMAGE_MAX_WIDTH = 500;
const DOCX_IMAGE_MAX_HEIGHT = 900;
const DOCX_MERMAID_IMAGE_MAX_WIDTH = 650;
const DOCX_MERMAID_IMAGE_MAX_HEIGHT = 900;
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

const PNG_SIGNATURE = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
const PNG_CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < table.length; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = (value & 1) ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1);
    }
    table[index] = value >>> 0;
  }
  return table;
})();

function writePngUint32(target: Uint8Array, offset: number, value: number) {
  target[offset] = (value >>> 24) & 0xff;
  target[offset + 1] = (value >>> 16) & 0xff;
  target[offset + 2] = (value >>> 8) & 0xff;
  target[offset + 3] = value & 0xff;
}

function getPngCrc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (let index = 0; index < bytes.length; index += 1) {
    crc = PNG_CRC_TABLE[(crc ^ bytes[index]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function createPngChunk(type: string, data: Uint8Array<ArrayBufferLike> = new Uint8Array()) {
  if (type.length !== 4) throw new Error(`Invalid PNG chunk type: ${type}`);
  const chunk = new Uint8Array(12 + data.length);
  writePngUint32(chunk, 0, data.length);
  for (let index = 0; index < 4; index += 1) {
    chunk[4 + index] = type.charCodeAt(index);
  }
  chunk.set(data, 8);
  writePngUint32(chunk, 8 + data.length, getPngCrc32(chunk.subarray(4, 8 + data.length)));
  return chunk;
}

function concatPngChunks(chunks: Uint8Array<ArrayBufferLike>[]) {
  const byteLength = chunks.reduce((total, chunk) => total + chunk.length, 0);
  const output = new Uint8Array(byteLength);
  let offset = 0;
  chunks.forEach((chunk) => {
    output.set(chunk, offset);
    offset += chunk.length;
  });
  return output;
}

class RgbaPngStreamEncoder {
  private readonly chunks: Uint8Array<ArrayBufferLike>[];

  private readonly idatChunks: Uint8Array<ArrayBufferLike>[] = [];

  private readonly zlib: Zlib;

  constructor(width: number, height: number) {
    const ihdr = new Uint8Array(13);
    writePngUint32(ihdr, 0, width);
    writePngUint32(ihdr, 4, height);
    ihdr[8] = 8;
    ihdr[9] = 6;
    ihdr[10] = 0;
    ihdr[11] = 0;
    ihdr[12] = 0;

    this.chunks = [PNG_SIGNATURE, createPngChunk('IHDR', ihdr)];
    this.zlib = new Zlib({ level: 6 }, (data) => {
      if (data.length > 0) this.idatChunks.push(data);
    });
  }

  pushScanline(scanline: Uint8Array) {
    this.zlib.push(scanline);
  }

  finish() {
    this.zlib.push(new Uint8Array(), true);
    this.idatChunks.forEach((chunk) => {
      this.chunks.push(createPngChunk('IDAT', chunk));
    });
    this.chunks.push(createPngChunk('IEND'));
    return concatPngChunks(this.chunks);
  }
}

function getScaledPngPixelLength(cssLength: number, scale: number) {
  return Math.max(1, Math.ceil(cssLength * scale));
}

function createPngCaptureColumns(width: number, scale: number): PngCaptureColumn[] {
  const maxCssWidth = Math.max(1, Math.floor(MAX_EXPORT_CANVAS_DIMENSION / scale));
  const finalPixelWidth = getScaledPngPixelLength(width, scale);
  const columns: PngCaptureColumn[] = [];
  for (let x = 0; x < width;) {
    const columnWidth = Math.min(maxCssWidth, width - x);
    const nextX = x + columnWidth;
    const pixelX = Math.round(x * scale);
    const pixelEnd = nextX >= width ? finalPixelWidth : Math.round(nextX * scale);
    columns.push({
      x,
      width: columnWidth,
      pixelX,
      pixelWidth: Math.max(1, pixelEnd - pixelX),
    });
    x = nextX;
  }
  return columns;
}

function getMaxPngRowCssHeight(documentWidth: number, documentHeight: number, scale: number) {
  const scaledWidth = getScaledPngPixelLength(documentWidth, scale);
  const maxScaledHeightByArea = Math.max(1, Math.floor(MAX_EXPORT_CANVAS_AREA / scaledWidth));
  const maxScaledHeight = Math.max(1, Math.min(MAX_EXPORT_CANVAS_DIMENSION, maxScaledHeightByArea));
  return Math.max(1, Math.min(documentHeight, Math.floor(maxScaledHeight / scale)));
}

function createPngCaptureRows(width: number, height: number, scale: number): PngCaptureRow[] {
  const maxCssHeight = getMaxPngRowCssHeight(width, height, scale);
  const finalPixelHeight = getScaledPngPixelLength(height, scale);
  const rows: PngCaptureRow[] = [];
  for (let y = 0; y < height;) {
    const rowHeight = Math.min(maxCssHeight, height - y);
    const nextY = y + rowHeight;
    const pixelY = Math.round(y * scale);
    const pixelEnd = nextY >= height ? finalPixelHeight : Math.round(nextY * scale);
    rows.push({
      y,
      height: rowHeight,
      pixelY,
      pixelHeight: Math.max(1, pixelEnd - pixelY),
    });
    y = nextY;
  }
  return rows;
}

async function capturePngTile(
  html2canvas: Html2CanvasRenderer,
  target: HTMLElement,
  options: {
    backgroundColor: string;
    documentWidth: number;
    scale: number;
    column: PngCaptureColumn;
    row: PngCaptureRow;
  },
): Promise<PngCapturedTile> {
  assertExportCanvasWithinLimits(
    options.column.width,
    options.row.height,
    options.scale,
    t('export.label.pngExport'),
  );

  const canvas = await html2canvas(target, {
    backgroundColor: options.backgroundColor,
    scale: options.scale,
    useCORS: true,
    logging: false,
    width: options.column.width,
    height: options.row.height,
    x: options.column.x,
    y: options.row.y,
    windowWidth: options.documentWidth,
    windowHeight: Math.max(1200, Math.ceil(options.row.height)),
    scrollX: 0,
    scrollY: 0,
  });
  canvas.width ||= options.column.pixelWidth;
  canvas.height ||= options.row.pixelHeight;

  const context = canvas.getContext('2d');
  if (!context) throw new Error(t('export.error.sliceFailed', { label: t('export.label.pngExport') }));
  const width = Math.min(options.column.pixelWidth, canvas.width);
  const height = Math.min(options.row.pixelHeight, canvas.height);
  const imageData = context.getImageData(0, 0, width, height);
  return {
    column: options.column,
    data: imageData.data,
    width,
    height,
  };
}

async function createSlicedRenderedPng(
  html2canvas: Html2CanvasRenderer,
  target: HTMLElement,
  options: {
    backgroundColor: string;
    width: number;
    height: number;
    scale: number;
  },
): Promise<PngRenderedImage> {
  const pixelWidth = getScaledPngPixelLength(options.width, options.scale);
  const pixelHeight = getScaledPngPixelLength(options.height, options.scale);
  const columns = createPngCaptureColumns(options.width, options.scale);
  const rows = createPngCaptureRows(options.width, options.height, options.scale);
  const encoder = new RgbaPngStreamEncoder(pixelWidth, pixelHeight);
  const scanline = new Uint8Array(1 + pixelWidth * 4);

  for (const row of rows) {
    await nextFrame();
    const tiles: PngCapturedTile[] = [];
    for (const column of columns) {
      tiles.push(await capturePngTile(html2canvas, target, {
        backgroundColor: options.backgroundColor,
        documentWidth: options.width,
        scale: options.scale,
        column,
        row,
      }));
    }

    for (let pixelRow = 0; pixelRow < row.pixelHeight; pixelRow += 1) {
      scanline.fill(0);
      for (const tile of tiles) {
        if (pixelRow >= tile.height) continue;
        const copyWidth = Math.min(tile.column.pixelWidth, tile.width);
        const sourceOffset = pixelRow * tile.width * 4;
        scanline.set(
          tile.data.subarray(sourceOffset, sourceOffset + copyWidth * 4),
          1 + tile.column.pixelX * 4,
        );
      }
      encoder.pushScanline(scanline);
      if (pixelRow > 0 && pixelRow % 512 === 0) await nextFrame();
    }
  }

  return {
    data: encoder.finish(),
    width: pixelWidth,
    height: pixelHeight,
  };
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
    label.style.lineHeight = '1.2';
  });

  try {
    const box = svg.getBBox();
    if (box.width > 0 && box.height > 0) {
      const padding = 12;
      svg.setAttribute(
        'viewBox',
        `${Math.floor(box.x - padding)} ${Math.floor(box.y - padding)} ${Math.ceil(box.width + padding * 2)} ${Math.ceil(box.height + padding * 2)}`,
      );
    }
  } catch {
    // Font timing can make getBBox unavailable. Overflow rules still protect labels.
  }
}

type SvgViewBox = { x: number; y: number; width: number; height: number };
type SvgBounds = { minX: number; minY: number; maxX: number; maxY: number };

const PLANTUML_SVG_BOUNDS_PADDING = 8;

function parseSvgNumberAttribute(element: Element, name: string) {
  const raw = element.getAttribute(name)?.trim();
  if (!raw || raw.endsWith('%')) return Number.NaN;
  return Number.parseFloat(raw);
}

function createSvgBounds(x: number, y: number, width: number, height: number): SvgBounds | null {
  if (![x, y, width, height].every(Number.isFinite) || width < 0 || height < 0) return null;
  return {
    minX: x,
    minY: y,
    maxX: x + width,
    maxY: y + height,
  };
}

function unionSvgBounds(current: SvgBounds | null, next: SvgBounds | null): SvgBounds | null {
  if (!next) return current;
  if (!current) return next;
  return {
    minX: Math.min(current.minX, next.minX),
    minY: Math.min(current.minY, next.minY),
    maxX: Math.max(current.maxX, next.maxX),
    maxY: Math.max(current.maxY, next.maxY),
  };
}

function offsetSvgBounds(bounds: SvgBounds | null, x: number, y: number): SvgBounds | null {
  if (!bounds) return null;
  return {
    minX: bounds.minX + x,
    minY: bounds.minY + y,
    maxX: bounds.maxX + x,
    maxY: bounds.maxY + y,
  };
}

function svgBoundsToViewBox(bounds: SvgBounds): SvgViewBox {
  return {
    x: bounds.minX,
    y: bounds.minY,
    width: bounds.maxX - bounds.minX,
    height: bounds.maxY - bounds.minY,
  };
}

function parseSvgTranslate(element: Element) {
  const transform = element.getAttribute('transform') ?? '';
  const match = /translate\(\s*([+-]?\d*\.?\d+)(?:[\s,]+([+-]?\d*\.?\d+))?\s*\)/i.exec(transform);
  if (!match) return { x: 0, y: 0 };
  return {
    x: Number.parseFloat(match[1]) || 0,
    y: Number.parseFloat(match[2] ?? '0') || 0,
  };
}

function getSvgPointsBounds(points: string | null): SvgBounds | null {
  if (!points) return null;
  const values = points
    .trim()
    .split(/[\s,]+/)
    .map((value) => Number.parseFloat(value))
    .filter(Number.isFinite);
  if (values.length < 2) return null;

  let bounds: SvgBounds | null = null;
  for (let index = 0; index + 1 < values.length; index += 2) {
    bounds = unionSvgBounds(bounds, createSvgBounds(values[index], values[index + 1], 0, 0));
  }
  return bounds;
}

function getSvgTextApproximateBounds(element: Element): SvgBounds | null {
  const x = parseSvgNumberAttribute(element, 'x');
  const y = parseSvgNumberAttribute(element, 'y');
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;

  const fontSize = Math.max(8, parseSvgNumberAttribute(element, 'font-size') || 12);
  const textLength = parseSvgNumberAttribute(element, 'textLength');
  const text = (element.textContent ?? '').trim();
  const approximateWidth = Number.isFinite(textLength)
    ? textLength
    : Array.from(text).reduce((sum, char) => sum + (/[^\x00-\x7F]/.test(char) ? 1 : 0.58), 0) * fontSize;
  if (!Number.isFinite(approximateWidth) || approximateWidth <= 0) return null;

  const anchor = element.getAttribute('text-anchor');
  const left = anchor === 'middle'
    ? x - approximateWidth / 2
    : anchor === 'end'
      ? x - approximateWidth
      : x;

  return createSvgBounds(left, y - fontSize, approximateWidth, fontSize * 1.35);
}

function getSvgElementOwnBounds(element: Element): SvgBounds | null {
  const tagName = element.tagName.toLowerCase();

  if (tagName === 'rect' || tagName === 'image' || tagName === 'foreignobject' || tagName === 'use') {
    return createSvgBounds(
      parseSvgNumberAttribute(element, 'x') || 0,
      parseSvgNumberAttribute(element, 'y') || 0,
      parseSvgNumberAttribute(element, 'width'),
      parseSvgNumberAttribute(element, 'height'),
    );
  }

  if (tagName === 'circle') {
    const cx = parseSvgNumberAttribute(element, 'cx');
    const cy = parseSvgNumberAttribute(element, 'cy');
    const radius = parseSvgNumberAttribute(element, 'r');
    return createSvgBounds(cx - radius, cy - radius, radius * 2, radius * 2);
  }

  if (tagName === 'ellipse') {
    const cx = parseSvgNumberAttribute(element, 'cx');
    const cy = parseSvgNumberAttribute(element, 'cy');
    const rx = parseSvgNumberAttribute(element, 'rx');
    const ry = parseSvgNumberAttribute(element, 'ry');
    return createSvgBounds(cx - rx, cy - ry, rx * 2, ry * 2);
  }

  if (tagName === 'line') {
    const x1 = parseSvgNumberAttribute(element, 'x1');
    const y1 = parseSvgNumberAttribute(element, 'y1');
    const x2 = parseSvgNumberAttribute(element, 'x2');
    const y2 = parseSvgNumberAttribute(element, 'y2');
    return unionSvgBounds(createSvgBounds(x1, y1, 0, 0), createSvgBounds(x2, y2, 0, 0));
  }

  if (tagName === 'polygon' || tagName === 'polyline') {
    return getSvgPointsBounds(element.getAttribute('points'));
  }

  if (tagName === 'text') {
    return getSvgTextApproximateBounds(element);
  }

  return null;
}

function getPlantUmlChildDrawableBounds(element: Element, offsetX = 0, offsetY = 0): SvgBounds | null {
  let bounds: SvgBounds | null = null;

  Array.from(element.children).forEach((child) => {
    const translate = parseSvgTranslate(child);
    const childOffsetX = offsetX + translate.x;
    const childOffsetY = offsetY + translate.y;
    bounds = unionSvgBounds(bounds, offsetSvgBounds(getSvgElementOwnBounds(child), childOffsetX, childOffsetY));
    bounds = unionSvgBounds(bounds, getPlantUmlChildDrawableBounds(child, childOffsetX, childOffsetY));
  });

  return bounds;
}

function getSvgBrowserDrawableBounds(svg: SVGSVGElement, current: SvgViewBox, childBounds: SvgBounds | null): SvgBounds | null {
  try {
    const box = svg.getBBox();
    if (!Number.isFinite(box.x) || !Number.isFinite(box.y) || box.width <= 0 || box.height <= 0) {
      return null;
    }

    const referenceWidth = Math.max(current.width, childBounds ? childBounds.maxX - childBounds.minX : 0);
    const referenceHeight = Math.max(current.height, childBounds ? childBounds.maxY - childBounds.minY : 0);
    if (
      childBounds
      && (box.width > Math.max(referenceWidth * 4, WEBKIT_PDF_CAPTURE_WIDTH * 2)
        || box.height > Math.max(referenceHeight * 4, 2000))
    ) {
      return null;
    }

    return createSvgBounds(box.x, box.y, box.width, box.height);
  } catch {
    return null;
  }
}

function parseSvgViewBox(svg: SVGSVGElement, fallback: { width: number; height: number }): SvgViewBox {
  const values = (svg.getAttribute('viewBox') ?? '')
    .split(/[\s,]+/)
    .filter(Boolean)
    .map((value) => Number.parseFloat(value));
  if (
    values.length === 4
    && values.every(Number.isFinite)
    && values[2] > 0
    && values[3] > 0
  ) {
    return {
      x: values[0],
      y: values[1],
      width: values[2],
      height: values[3],
    };
  }
  return { x: 0, y: 0, width: fallback.width, height: fallback.height };
}

function getPlantUmlDrawableViewBox(svg: SVGSVGElement, fallback: { width: number; height: number }): SvgViewBox {
  const current = parseSvgViewBox(svg, fallback);
  const childBounds = getPlantUmlChildDrawableBounds(svg);
  const browserBounds = getSvgBrowserDrawableBounds(svg, current, childBounds);
  const drawableBounds = unionSvgBounds(childBounds, browserBounds);

  if (!drawableBounds) return current;

  const box = svgBoundsToViewBox(drawableBounds);
  const overflowsCurrentViewBox = box.x < current.x
    || box.y < current.y
    || box.x + box.width > current.x + current.width
    || box.y + box.height > current.y + current.height;
  if (!overflowsCurrentViewBox) return current;

  const minX = Math.min(current.x, box.x - PLANTUML_SVG_BOUNDS_PADDING);
  const minY = Math.min(current.y, box.y - PLANTUML_SVG_BOUNDS_PADDING);
  const maxX = Math.max(current.x + current.width, box.x + box.width + PLANTUML_SVG_BOUNDS_PADDING);
  const maxY = Math.max(current.y + current.height, box.y + box.height + PLANTUML_SVG_BOUNDS_PADDING);
  return {
    x: Math.floor(minX),
    y: Math.floor(minY),
    width: Math.ceil(maxX - minX),
    height: Math.ceil(maxY - minY),
  };
}

function normalizePlantUmlSvg(svg: SVGSVGElement) {
  const size = getSvgSize(new XMLSerializer().serializeToString(svg));
  const viewBox = getPlantUmlDrawableViewBox(svg, size);
  const width = Math.max(80, Math.ceil(viewBox.width));
  const height = Math.max(40, Math.ceil(viewBox.height));
  const displayWidth = Math.min(width, WEBKIT_PDF_CAPTURE_WIDTH);
  const displayHeight = Math.max(1, Math.ceil(height * (displayWidth / width)));

  svg.style.display = 'block';
  svg.style.marginInline = 'auto';
  svg.style.width = width > WEBKIT_PDF_CAPTURE_WIDTH ? '100%' : `${displayWidth}px`;
  svg.style.maxWidth = '100%';
  svg.style.height = 'auto';
  svg.style.overflow = 'visible';
  svg.setAttribute('preserveAspectRatio', 'xMidYMin meet');
  svg.setAttribute('overflow', 'visible');

  svg.setAttribute('width', String(displayWidth));
  svg.setAttribute('height', String(displayHeight));
  const currentViewBox = parseSvgViewBox(svg, size);
  if (
    !svg.getAttribute('viewBox')
    || viewBox.x < currentViewBox.x
    || viewBox.y < currentViewBox.y
    || viewBox.x + viewBox.width > currentViewBox.x + currentViewBox.width
    || viewBox.y + viewBox.height > currentViewBox.y + currentViewBox.height
  ) {
    svg.setAttribute('viewBox', `${viewBox.x} ${viewBox.y} ${width} ${height}`);
  }
}

function serializeSvgForRasterImage(svg: SVGSVGElement, width: number, height: number) {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute('width', String(width));
  clone.setAttribute('height', String(height));
  clone.style.width = `${width}px`;
  clone.style.height = `${height}px`;
  clone.style.maxWidth = '100%';
  clone.style.overflow = 'visible';
  return new XMLSerializer()
    .serializeToString(clone)
    .replace(/<\?plantuml-src[\s\S]*?\?>/g, '');
}

async function waitForRasterImageLoad(image: HTMLImageElement) {
  if (image.complete && image.naturalWidth > 0 && image.naturalHeight > 0) return;
  if (image.ownerDocument.defaultView?.navigator.userAgent.toLowerCase().includes('jsdom')) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(() => reject(new Error(t('export.error.svgRasterize'))), 10_000);
    image.onload = () => {
      window.clearTimeout(timeout);
      resolve();
    };
    image.onerror = () => {
      window.clearTimeout(timeout);
      reject(new Error(t('export.error.svgRasterize')));
    };
  });
}

async function rasterizePlantUmlSvgsForCapture(target: HTMLElement) {
  const svgs = Array.from(target.querySelectorAll<SVGSVGElement>('svg.plantuml-image'));
  if (svgs.length === 0) return;

  for (const svg of svgs) {
    normalizePlantUmlSvg(svg);
    const rect = svg.getBoundingClientRect();
    const fallback = getSvgSize(new XMLSerializer().serializeToString(svg));
    const width = Math.max(80, Math.ceil(rect.width || fallback.width));
    const height = Math.max(40, Math.ceil(rect.height || fallback.height));
    const serialized = serializeSvgForRasterImage(svg, width, height);
    const image = target.ownerDocument.createElement('img');
    image.className = `${svg.getAttribute('class') ?? ''} prism-export-rasterized-svg`.trim();
    image.setAttribute('role', svg.getAttribute('role') ?? 'img');
    image.setAttribute('aria-label', svg.getAttribute('aria-label') ?? 'PlantUML diagram');
    image.setAttribute('alt', svg.getAttribute('aria-label') ?? 'PlantUML diagram');
    image.width = width;
    image.height = height;
    image.style.cssText = svg.style.cssText;
    image.style.display = 'block';
    image.style.width = `${width}px`;
    image.style.height = `${height}px`;
    image.style.maxWidth = '100%';
    image.style.marginInline = 'auto';
    image.style.objectFit = 'contain';
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(serialized)}`;
    await waitForRasterImageLoad(image);
    svg.replaceWith(image);
  }

  await nextFrame();
}

async function renderMermaidPlaceholders(root: HTMLElement, contentTheme: ContentTheme, input: ExportDocumentInput) {
  const placeholders = Array.from(root.querySelectorAll<HTMLElement>('.mermaid-placeholder'));
  if (placeholders.length === 0) return;

  const { default: mermaid } = await import('mermaid');
  mermaid.initialize(getMermaidExportConfig(contentTheme) as any);

  if ('fonts' in document) {
    try {
      await withTimeout(document.fonts.ready, EXPORT_FONT_READY_TIMEOUT_MS, t('export.error.fontLoadTimeout'));
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
      reportProgress(input, t('export.progress.renderDiagramIndexed', { index: index + 1, total: placeholders.length }));
    }
    try {
      const { svg } = await withTimeout(
        mermaid.render(`prism-export-mermaid-${Date.now()}-${index}`, source, renderSandbox),
        EXPORT_MERMAID_RENDER_TIMEOUT_MS,
        t('export.error.mermaidTimeout', { index: index + 1 }),
      );
      placeholder.innerHTML = svg;
      placeholder.style.display = 'flex';
      placeholder.style.justifyContent = 'center';
      placeholder.style.margin = '8px 0';
      placeholder.style.boxSizing = 'border-box';
      placeholder.style.width = '100%';
      placeholder.style.maxWidth = '100%';
      placeholder.style.overflow = 'hidden';
      const svgEl = placeholder.querySelector('svg');
      if (svgEl) normalizeMermaidSvg(svgEl);
    } catch (err) {
      placeholder.innerHTML = `<pre>${escapeHtml(t('export.error.mermaidRenderFailed'))}: ${escapeHtml(String(err))}</pre>`;
    } finally {
      renderSandbox.remove();
    }
    await nextFrame();
  }
}

interface StaticMarkmapNode {
  content?: string;
  children?: StaticMarkmapNode[];
}

interface StaticMarkmapLayoutNode {
  depth: number;
  height: number;
  node: StaticMarkmapNode;
  parent: StaticMarkmapLayoutNode | null;
  text: string;
  width: number;
  x: number;
  y: number;
}

function getExportDiagramTextColor(contentTheme: ContentTheme) {
  switch (contentTheme) {
    case 'inkstone': return '#2B261D';
    case 'slate': return '#1F2933';
    case 'mono': return '#101310';
    case 'nocturne': return '#E8DDC8';
    case 'carbon': return '#EDEDED';
    default: return '#262626';
  }
}

function getMarkmapPlainText(content: string | undefined) {
  if (!content) return '';
  const template = document.createElement('template');
  template.innerHTML = content;
  return (template.content.textContent || template.innerText || content)
    .replace(/\s+/g, ' ')
    .trim();
}

function measureStaticMarkmapText(text: string, depth: number, compact: boolean) {
  const normalizedLength = [...text].reduce((total, char) => (
    total + (char.charCodeAt(0) > 255 ? 1.1 : 0.58)
  ), 0);
  const minWidth = compact ? (depth === 0 ? 96 : 68) : (depth === 0 ? 120 : 88);
  const maxWidth = compact ? 180 : 220;
  const charWidth = compact ? 12 : 14;
  const padding = compact ? 16 : 24;
  return Math.max(minWidth, Math.min(maxWidth, Math.ceil(normalizedLength * charWidth) + padding));
}

function createStaticMarkmapLayout(root: StaticMarkmapNode, compact: boolean) {
  const rowGap = compact ? 28 : 38;
  const columnGap = compact ? 176 : 236;
  const paddingX = compact ? 24 : 32;
  const paddingY = compact ? 26 : 36;
  const nodes: StaticMarkmapLayoutNode[] = [];
  let leafIndex = 0;
  let maxDepth = 0;

  function visit(node: StaticMarkmapNode, depth: number, parent: StaticMarkmapLayoutNode | null): StaticMarkmapLayoutNode {
    const text = getMarkmapPlainText(node.content) || 'Untitled';
    const children = node.children ?? [];
    const layoutNode: StaticMarkmapLayoutNode = {
      depth,
      height: compact ? (depth === 0 ? 24 : 20) : (depth === 0 ? 30 : 26),
      node,
      parent,
      text,
      width: measureStaticMarkmapText(text, depth, compact),
      x: paddingX + depth * columnGap,
      y: paddingY,
    };

    nodes.push(layoutNode);
    maxDepth = Math.max(maxDepth, depth);

    if (children.length === 0) {
      layoutNode.y = paddingY + leafIndex * rowGap;
      leafIndex += 1;
      return layoutNode;
    }

    const childLayouts = children.map((child) => visit(child, depth + 1, layoutNode));
    layoutNode.y = (childLayouts[0].y + childLayouts[childLayouts.length - 1].y) / 2;
    return layoutNode;
  }

  visit(root, 0, null);

  const contentWidth = paddingX * 2 + (maxDepth + 1) * columnGap + (compact ? 120 : 180);
  const contentHeight = Math.max(450, paddingY * 2 + Math.max(leafIndex - 1, 0) * rowGap + (compact ? 28 : 36));
  return {
    height: contentHeight,
    nodes,
    width: Math.max(compact ? 720 : 900, contentWidth),
  };
}

function renderStaticMarkmapSvg(svg: SVGSVGElement, markmapRoot: StaticMarkmapNode, contentTheme: ContentTheme) {
  const palette = getMarkmapPalette(contentTheme);
  const compact = contentTheme === 'miaoyan';
  const textColor = getExportDiagramTextColor(contentTheme);
  const layout = createStaticMarkmapLayout(markmapRoot, compact);

  svg.replaceChildren();
  svg.classList.add('markmap-svg');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', 'Markmap diagram');
  svg.setAttribute('width', String(layout.width));
  svg.setAttribute('height', String(layout.height));
  svg.setAttribute('viewBox', `0 0 ${layout.width} ${layout.height}`);
  svg.setAttribute('data-markmap-renderer', 'static');
  svg.style.display = 'block';
  svg.style.width = '100%';
  svg.style.height = 'auto';
  svg.style.marginInline = 'auto';
  svg.style.overflow = 'visible';

  const edges = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  edges.setAttribute('class', 'markmap-edges');
  edges.setAttribute('fill', 'none');
  edges.setAttribute('stroke-linecap', 'round');
  svg.append(edges);

  const nodeLayer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  nodeLayer.setAttribute('class', 'markmap-nodes');
  svg.append(nodeLayer);

  for (const node of layout.nodes) {
    if (!node.parent) continue;
    const stroke = palette[node.depth % palette.length] ?? palette[0];
    const startX = node.parent.x + node.parent.width + 8;
    const startY = node.parent.y;
    const endX = node.x - 14;
    const endY = node.y;
    const midX = (startX + endX) / 2;
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('class', 'markmap-link');
    path.setAttribute('d', `M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${endX} ${endY}`);
    path.setAttribute('stroke', stroke);
    path.setAttribute('stroke-width', compact ? (node.depth === 1 ? '1.1' : '0.9') : (node.depth === 1 ? '1.6' : '1.2'));
    path.setAttribute('opacity', node.depth === 1 ? '0.9' : '0.68');
    edges.append(path);
  }

  for (const node of layout.nodes) {
    const color = palette[node.depth % palette.length] ?? palette[0];
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.setAttribute('class', 'markmap-node');
    group.setAttribute('transform', `translate(${node.x} ${node.y})`);

    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.textContent = node.text;
    text.setAttribute('x', '0');
    text.setAttribute('y', '0');
    text.setAttribute('dominant-baseline', 'middle');
    text.setAttribute('fill', textColor);
    text.setAttribute('font-size', compact ? (node.depth === 0 ? '13' : '12') : (node.depth === 0 ? '16' : '14'));
    text.setAttribute('font-weight', node.depth <= 1 ? '600' : '400');
    text.setAttribute('font-family', '-apple-system, BlinkMacSystemFont, "Helvetica Neue", "PingFang SC", "Microsoft YaHei", Arial, sans-serif');
    group.append(text);

    const underline = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    underline.setAttribute('x1', '0');
    underline.setAttribute('x2', String(node.width));
    underline.setAttribute('y1', String(node.height / 2));
    underline.setAttribute('y2', String(node.height / 2));
    underline.setAttribute('stroke', color);
    underline.setAttribute('stroke-width', compact ? (node.depth === 0 ? '1.4' : '1') : (node.depth === 0 ? '2' : '1.3'));
    underline.setAttribute('opacity', node.depth === 0 ? '0.95' : '0.68');
    group.append(underline);

    if (node.node.children?.length) {
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', String(node.width + 8));
      circle.setAttribute('cy', '0');
      circle.setAttribute('r', compact ? (node.depth === 0 ? '2.4' : '1.8') : (node.depth === 0 ? '3.2' : '2.5'));
      circle.setAttribute('fill', color);
      circle.setAttribute('opacity', '0.85');
      group.append(circle);
    }

    nodeLayer.append(group);
  }

  return layout;
}

async function createMarkmapSvgElement(source: string, contentTheme: ContentTheme) {
  const { Transformer } = await import('markmap-lib');
  const transformer = new Transformer();
  const { root: markmapRoot } = transformer.transform(source);
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  renderStaticMarkmapSvg(svg, markmapRoot as StaticMarkmapNode, contentTheme);
  return svg;
}

function applyExportDiagramPlaceholderLayout(placeholder: HTMLElement) {
  placeholder.style.display = 'block';
  placeholder.style.boxSizing = 'border-box';
  placeholder.style.width = '100%';
  placeholder.style.maxWidth = '100%';
  placeholder.style.minHeight = '0';
  placeholder.style.margin = '8px 0';
  placeholder.style.overflow = 'visible';
}

async function renderMarkmapPlaceholders(root: HTMLElement, contentTheme: ContentTheme, input: ExportDocumentInput) {
  const placeholders = Array.from(root.querySelectorAll<HTMLElement>('.markmap-placeholder'));
  if (placeholders.length === 0) return;

  for (const [index, placeholder] of placeholders.entries()) {
    const encoded = placeholder.getAttribute('data-markmap');
    if (!encoded) continue;
    if (placeholders.length > 1) {
      reportProgress(input, t('export.progress.renderDiagramIndexed', { index: index + 1, total: placeholders.length }));
    }
    try {
      const svg = await withTimeout(
        createMarkmapSvgElement(decodeURIComponent(encoded), contentTheme),
        EXPORT_MARKMAP_RENDER_TIMEOUT_MS,
        t('export.error.markmapTimeout', { index: index + 1 }),
      );
      applyExportDiagramPlaceholderLayout(placeholder);
      placeholder.replaceChildren(svg);
      placeholder.removeAttribute('aria-busy');
      placeholder.removeAttribute('data-markmap');
      await nextFrame();
    } catch (err) {
      placeholder.innerHTML = `<pre>${escapeHtml(t('export.error.markmapRenderFailed'))}: ${escapeHtml(String(err))}</pre>`;
    }
  }
}

async function createExportPlantUmlSvgElement(source: string, contentTheme: ContentTheme, input?: ExportDocumentInput) {
  const svg = await createPlantUmlSvgElement(source, contentTheme, { documentPath: input?.documentPath });
  svg.classList.add('plantuml-image');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', 'PlantUML diagram');
  normalizePlantUmlSvg(svg);
  return svg;
}

async function renderPlantUmlPlaceholders(root: HTMLElement, contentTheme: ContentTheme, input: ExportDocumentInput) {
  const placeholders = Array.from(root.querySelectorAll<HTMLElement>('.plantuml-placeholder'));
  if (placeholders.length === 0) return;

  for (const [index, placeholder] of placeholders.entries()) {
    const encoded = placeholder.getAttribute('data-plantuml');
    if (!encoded) continue;
    if (placeholders.length > 1) {
      reportProgress(input, t('export.progress.renderDiagramIndexed', { index: index + 1, total: placeholders.length }));
    }
    try {
      const svg = await withTimeout(
        createExportPlantUmlSvgElement(decodeURIComponent(encoded), contentTheme, input),
        EXPORT_PLANTUML_RENDER_TIMEOUT_MS,
        t('export.error.plantUmlTimeout', { index: index + 1 }),
      );
      applyExportDiagramPlaceholderLayout(placeholder);
      placeholder.replaceChildren(svg);
      await nextFrame();
      const insertedSvg = placeholder.querySelector<SVGSVGElement>('svg.plantuml-image');
      if (insertedSvg) normalizePlantUmlSvg(insertedSvg);
      placeholder.removeAttribute('aria-busy');
      placeholder.removeAttribute('data-plantuml');
      await nextFrame();
    } catch (err) {
      placeholder.innerHTML = `<pre>${escapeHtml(t('export.error.plantUmlRenderFailed'))}: ${escapeHtml(String(err))}</pre>`;
    }
  }
}

async function svgToRasterDataUrl(
  svgText: string,
  options: {
    mimeType?: 'image/png' | 'image/jpeg';
    normalizeSvg?: boolean;
    padding?: number;
    quality?: number;
    scale?: number;
  } = {},
) {
  const mimeType = options.mimeType ?? 'image/png';
  const scale = normalizeExportRasterScale(options.scale);
  const normalizeSvg = options.normalizeSvg ?? true;
  const padding = options.padding ?? 56;
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
    if (normalizeSvg) normalizeMermaidSvg(svg);
    const box = (() => {
      if (!normalizeSvg) {
        const size = getSvgSize(new XMLSerializer().serializeToString(svg));
        return { width: size.width, height: size.height };
      }
      try {
        return svg.getBBox();
      } catch {
        const size = getSvgSize(new XMLSerializer().serializeToString(svg));
        return { width: size.width, height: size.height };
      }
    })();
    const width = Math.max(320, Math.ceil(box.width + padding));
    const height = Math.max(180, Math.ceil(box.height + padding));
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
          img.onerror = () => reject(new Error(t('export.error.mermaidSvgImageFailed')));
          img.src = url;
        }),
        EXPORT_MERMAID_RENDER_TIMEOUT_MS,
        t('export.error.mermaidSvgTimeout'),
      );
      const canvas = document.createElement('canvas');
      assertExportCanvasWithinLimits(width, height, scale, t('export.error.svgRasterize'));
      canvas.width = Math.ceil(width * scale);
      canvas.height = Math.ceil(height * scale);
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error(t('export.error.mermaidCanvasFailed'));
      ctx.scale(scale, scale);
      ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--bg-preview').trim() || '#ffffff';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(image, 0, 0, width, height);
      const dataUrl = canvas.toDataURL(mimeType, options.quality);
      if (!dataUrl.startsWith(`data:${mimeType}`)) {
        throw new Error(t('export.error.svgRasterInvalid'));
      }
      return { dataUrl, width, height };
    } finally {
      URL.revokeObjectURL(url);
    }
  } finally {
    container.remove();
  }
}

async function svgToDocxPngImage(
  svgText: string,
  scale = 2,
  options: { normalizeSvg?: boolean; padding?: number } = {},
) {
  const image = await svgToRasterDataUrl(svgText, {
    mimeType: 'image/png',
    normalizeSvg: options.normalizeSvg,
    padding: options.padding,
    scale,
  });
  if (!image) throw new Error(t('export.error.svgRasterEmpty'));
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
    `<div id="write" class="${getWriteClassByTheme(contentTheme)}">`,
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
        await withTimeout(document.fonts.ready, EXPORT_FONT_READY_TIMEOUT_MS, t('export.error.fontLoadTimeout'));
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
      t('export.error.docxMermaidTimeout'),
    );

    return {
      type: 'png',
      data: await canvasToPngBytes(canvas, t('export.error.docxMermaidImageFailed')),
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
          t('export.error.mermaidTimeout', { index: sourceIndex + 1 }),
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

async function renderMarkmapImage(
  source: string,
  contentTheme: ContentTheme,
  scale = 2,
): Promise<MermaidDocxImage | null> {
  try {
    const svg = await withTimeout(
      createMarkmapSvgElement(source, contentTheme),
      EXPORT_MARKMAP_RENDER_TIMEOUT_MS,
      t('export.error.markmapTimeout', { index: 1 }),
    );
    const svgText = new XMLSerializer().serializeToString(svg);
    return await renderMermaidSvgToDocxPngImage(svgText, contentTheme, scale);
  } catch {
    return null;
  }
}

async function renderPlantUmlImage(
  source: string,
  contentTheme: ContentTheme,
  input?: ExportDocumentInput,
  scale = 2,
): Promise<MermaidDocxImage | null> {
  try {
    const svg = await withTimeout(
      createExportPlantUmlSvgElement(source, contentTheme, input),
      EXPORT_PLANTUML_RENDER_TIMEOUT_MS,
      t('export.error.plantUmlTimeout', { index: 1 }),
    );
    const svgText = new XMLSerializer().serializeToString(svg);
    return await svgToDocxPngImage(prepareSvgForDocx(svgText), scale, {
      normalizeSvg: false,
      padding: 0,
    });
  } catch {
    return null;
  }
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
  options: { maxWidth?: number; maxHeight?: number } = {},
) {
  const { ImageRun } = docx;
  const { width, height } = constrainDocxImageSize(image, options);
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

function constrainDocxImageSize(
  image: Pick<ExportDocxImage | MermaidDocxImage, 'width' | 'height'>,
  options: { maxWidth?: number; maxHeight?: number } = {},
) {
  const sourceWidth = Math.max(1, image.width);
  const sourceHeight = Math.max(1, image.height);
  let width = Math.min(options.maxWidth ?? DOCX_IMAGE_MAX_WIDTH, sourceWidth);
  let height = Math.round(width * (sourceHeight / sourceWidth));
  const maxHeight = options.maxHeight ?? DOCX_IMAGE_MAX_HEIGHT;
  if (height > maxHeight) {
    const ratio = maxHeight / height;
    height = maxHeight;
    width = Math.max(1, Math.round(width * ratio));
  }
  return { width, height };
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

function getWebkitPdfCapturePath(targetPath: string, batchIndex: number) {
  const suffix = `.webkit-capture-${batchIndex + 1}.pdf`;
  return targetPath.toLowerCase().endsWith('.pdf')
    ? `${targetPath.slice(0, -4)}${suffix}`
    : `${targetPath}${suffix}`;
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
    await Promise.all(tempPaths.map((path) => remove(path).catch(() => undefined)));
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

function rasterizeLinkedDocxImage(image: ExportDocxImage | MermaidDocxImage): ExportDocxImage | MermaidDocxImage {
  return image.type === 'svg' ? image.fallback : image;
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
