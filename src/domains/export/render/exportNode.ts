/**
 * 导出的共同起点：把 Markdown 渲染成一份「离屏、带导出样式」的 DOM，
 * PNG / PDF / DOCX 视觉块三条通路都从这份 DOM 出发。
 *
 * createRenderedExportNode 生成内联节点供直接截图；createStandaloneExportFrame
 * 生成独立 iframe，用来隔离宿主页面的样式与滚动，并拿到准确的文档尺寸。
 */
import type { ExportDocumentInput } from '../types';
import { t } from '../../i18n/runtime';
import { markdownToHtml } from '../../../lib/markdownToHtml';
import { blobToDataUrl, bytesToDataUrl, readLocalExportMedia } from '../assets';
import {
  getWriteClassByTheme,
} from '../exportSettings';
import { buildExportTocHtml, buildExportTocItems } from '../toc';
import { exportProgressMessages, reportProgress } from '../pipeline/exportPipelineContext';
import { markExportAtomicBlocks } from '../pagination';
import { sanitizeExportHtmlFragment } from './htmlFragmentRenderer';
import {
  EXPORT_FONT_READY_TIMEOUT_MS,
  STANDALONE_EXPORT_FRAME_WIDTH,
  WEBKIT_PDF_CAPTURE_WIDTH,
} from '../exportConstants';
import {
  nextExportFrame as nextFrame,
  withExportTimeout as withTimeout,
} from '../rendering';
import { buildStandaloneHtml } from './standaloneHtml';
import {
  renderMarkmapPlaceholders,
  renderMermaidPlaceholders,
  renderPlantUmlPlaceholders,
} from '../diagrams/diagramPlaceholders';

export async function inlineImages(root: HTMLElement, input: ExportDocumentInput) {
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

export function applyExportToc(root: HTMLElement, input: ExportDocumentInput) {
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

export async function createRenderedExportNode(input: ExportDocumentInput, options: { html?: string | null } = {}) {
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

export async function createStandaloneExportFrame(input: ExportDocumentInput) {
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

export function measureRenderedExportBounds(target: HTMLElement, frameDocument: Document) {
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
