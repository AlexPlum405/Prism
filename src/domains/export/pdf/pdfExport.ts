/**
 * PDF 导出有三条通路，按可用性依次降级：
 *
 * 1. WebKit 原生打印（最优）：矢量文字、可选中可搜索，页眉页脚由 PDF 叠加层绘制；
 * 2. 光栅化：按批把页面截成图再塞进 PDF，慢但任何环境都能出；
 * 3. 原生捕获失败时自动落到第 2 条，并在结果里带一条 warning 说明降级原因。
 *
 * 分页统一用「CSS 高度切窗」表达，而不是依赖打印引擎自己分页：三条通路的分页点
 * 必须一致，否则同一篇文稿换台机器导出，页码和目录会对不上。
 */
import { readFile, writeFile } from '../../../platform/tauri/fileSystem';
import { t } from '../../i18n/runtime';
import type { ExportDocumentInput } from '../types';
import { canvasToPngBytes, dataUrlToBytes } from '../assets';
import {
  exportProgressMessages,
  getErrorMessage,
  normalizeExportRasterScale,
  getExportOutputPath,
  getExportTitle,
  isTauriExportWorkerRuntime,
  reportProgress,
  reportWarning,
} from '../pipeline/exportPipelineContext';
import { EXPORT_PAGE_SPLIT_EPSILON, prepareExportAtomicPagination } from '../pagination';
import { collectExportCss } from '../render/exportCss';
import { collectExportPdfLinkRects, type ExportPdfLinkRect } from './pdfLinks';
import {
  addPdfOutline,
  collectExportPdfBookmarks,
  type ExportPdfBookmark,
} from './pdfBookmarks';
import { captureCurrentWebviewPdf, getPdfCaptureCapability } from './pdfCaptureClient';
import { createPdfCaptureTempSession } from './pdfCaptureTemp';
import {
  createPdfChromeTextImage,
  formatPdfHeaderFooterText,
  getPdfFooterY,
  getPdfHeaderY,
  getPdfPageNumberLabel,
  getPdfPageNumberY,
} from './pdfChromeText';
import {
  createRenderedExportNode,
  createStandaloneExportFrame,
  measureRenderedExportBounds,
} from '../render/exportNode';
import { rasterizePlantUmlSvgsForCapture } from '../diagrams/svgDocument';
import { pdfPageMarginsPoints, pdfPageSizePoints } from '../exportPageLayout';
import {
  PDF_EXPORT_BATCH_RENDER_TIMEOUT_MS,
  PDF_EXPORT_MAX_PAGES,
  PDF_EXPORT_MAX_PAGES_PER_BATCH,
  PDF_EXPORT_MAX_RENDER_VIEWPORT_HEIGHT,
  PDF_EXPORT_RASTER_SCALE,
  WEBKIT_PDF_CAPTURE_WIDTH,
  WEBKIT_PDF_MAX_CAPTURE_HEIGHT,
  EXPORT_FONT_READY_TIMEOUT_MS,
  WEBKIT_PDF_MAX_PAGES_PER_CAPTURE,
} from '../exportConstants';
import {
  assertExportCanvasWithinLimits,
  isExportCanvasWithinLimits,
} from '../render/canvasLimits';
import {
  nextExportFrame as nextFrame,
  normalizeCssColorFunctionsForRaster,
  normalizeRasterComputedColors,
  withExportTimeout as withTimeout,
} from '../rendering';
import {
  renderPandocCitationHtml,
  reportCitationPlaceholderWarning,
} from '../citations/pandocCitation';

interface PdfRenderedPage {
  data: Uint8Array;
  width: number;
  height: number;
}
interface PdfRenderResult {
  pages: PdfRenderedPage[];
  linkRects: ExportPdfLinkRect[];
  bookmarks: ExportPdfBookmark[];
  pageCssHeight: number;
  contentCssWidth: number;
}

interface WebkitPdfCaptureLayout {
  rect: { x: number; y: number; width: number; height: number };
  pageCssHeight: number;
  pageCount: number;
  pageWidth: number;
  pageHeight: number;
  contentWidth: number;
  contentHeight: number;
  linkRects: ExportPdfLinkRect[];
  bookmarks: ExportPdfBookmark[];
  margins: typeof pdfPageMarginsPoints[keyof typeof pdfPageMarginsPoints];
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
    const bookmarks = collectExportPdfBookmarks(target, {
      pageCssHeight,
      pageCount,
      cssPxToPdfPoint,
      pageHeight: paper.height,
      margins,
    });

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
      bookmarks,
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

async function overlayPdfChrome(
  input: ExportDocumentInput,
  targetPath: string,
  bookmarks: ExportPdfBookmark[] = [],
) {
  const needsChrome = Boolean(input.pageHeaderFooter || input.pdfPageNumbers);
  if (!needsChrome && bookmarks.length === 0) return;

  if (needsChrome) reportProgress(input, exportProgressMessages.applyPdfChrome());
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

  await addPdfOutline(pdf, bookmarks);
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

  await overlayPdfChrome(input, targetPath, layout.bookmarks);
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
    pageHeight,
    margins,
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

  await addPdfOutline(pdf, renderedPages.bookmarks);
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
  options: {
    contentWidth: number;
    contentHeight: number;
    pageHeight: number;
    margins: typeof pdfPageMarginsPoints[keyof typeof pdfPageMarginsPoints];
    scale?: number;
  },
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
    const bookmarks = collectExportPdfBookmarks(target, {
      pageCssHeight,
      pageCount,
      cssPxToPdfPoint,
      pageHeight: options.pageHeight,
      margins: options.margins,
    });
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
      bookmarks,
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
