/**
 * 导出的门面：对外仍然是 exportHtml / exportPdf / exportPng / exportDocx 四个入口，
 * 内部各自落在自己的模块里。
 *
 * HTML 与 PNG 留在这一层，因为它们短且几乎是纯编排；PDF 与 DOCX 的实现分别
 * 在 pdf/pdfExport.ts 与 docx/docxDocument.ts，这里只做重新导出。
 */
import { writeFile, writeTextFile } from '../../platform/tauri/fileSystem';
import { t } from '../i18n/runtime';
import type { ExportDocumentInput } from './types';
import {
  exportProgressMessages,
  getExportOutputPath,
  normalizeExportRasterScale,
  reportProgress,
} from './pipeline/exportPipelineContext';
import {
  canvasToPngBytes,
} from './assets';
import { createSlicedRenderedPng } from './png/pngAssembly';
import { prepareExportAtomicPagination, markExportAtomicBlocks } from './pagination';
import {
  renderPandocCitationHtml,
  reportCitationPlaceholderWarning,
} from './citations/pandocCitation';
import {
  createRenderedExportNode,
  createStandaloneExportFrame,
  measureRenderedExportBounds,
} from './render/exportNode';
import { buildStandaloneHtml } from './render/standaloneHtml';
import { constrainDocxImageSize } from './docx/docxImage';
import {
  formatPdfHeaderFooterText,
  getPdfFooterY,
  getPdfHeaderY,
  getPdfPageNumberLabel,
  getPdfPageNumberY,
  normalizePdfChromeText,
} from './pdf/pdfChromeText';
import { normalizePlantUmlSvg, rasterizePlantUmlSvgsForCapture } from './diagrams/svgDocument';
import {
  assertExportCanvasWithinLimits,
  isExportCanvasWithinLimits,
} from './render/canvasLimits';
import {
  nextExportFrame as nextFrame,
  normalizeCssColorFunctionsForRaster,
  normalizeRasterComputedColors,
  stripRasterUnsafeColorDeclarations,
} from './rendering';

export { exportPdf } from './pdf/pdfExport';
export { exportDocx } from './docx/docxDocument';

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
