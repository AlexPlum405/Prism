/**
 * 把无法用 docx 原生结构表达的 HTML 片段（数学公式、details/summary、标记过的
 * 行内元素等）渲染成图片贴进文档。
 *
 * 这是「宁可糊一点也不要丢内容」的兜底通路：先把片段塞进一份与预览同款的
 * 导出文档骨架里排版，再用 html2canvas 截成图，最后按可用宽度缩放。
 */
import { t } from '../../i18n/runtime';
import type { ExportDocumentInput } from '../types';
import { canvasToPngBytes } from '../assets';
import { getWriteClassByTheme } from '../exportSettings';
import { getErrorMessage, reportWarning } from '../pipeline/exportPipelineContext';
import { assertExportCanvasWithinLimits } from '../render/canvasLimits';
import { sanitizeExportHtmlFragment } from '../render/htmlFragmentRenderer';
import {
  DOCX_VISUAL_BLOCK_RENDER_TIMEOUT_MS,
  DOCX_VISUAL_BLOCK_WIDTH,
  EXPORT_FONT_READY_TIMEOUT_MS,
} from '../exportConstants';
import {
  nextExportFrame as nextFrame,
  normalizeRasterComputedColors,
  withExportTimeout as withTimeout,
} from '../rendering';
import { inlineImages } from '../render/exportNode';
import type { RasterDocxImage } from './docxImage';

export async function renderDocxVisualHtmlFragment(
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

export async function renderDocxMathImage(
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

export async function renderDocxHtmlBlockImage(input: ExportDocumentInput, source: string, scale: number) {
  const sanitized = sanitizeExportHtmlFragment(source).trim();
  if (!sanitized) return null;
  const wrapped = `<div class="prism-html-block" style="border:1px solid #d0d7de;border-left:4px solid #2563eb;background:#f6f8fa;padding:12px 16px;border-radius:6px;line-height:1.6;">${sanitized}</div>`;
  return renderDocxVisualHtmlFragment(input, wrapped, scale, {
    label: t('export.label.htmlBlock'),
  });
}

export function rewriteOpenXmlNumericAttribute(xml: string, tagName: string, attrName: string) {
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

export async function normalizeDocxDrawingCompatibility(blob: Blob) {
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
