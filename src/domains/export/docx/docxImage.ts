/**
 * DOCX 图片层：把 SVG / Mermaid / Markmap / PlantUML / Markdown 图片转成 docx 库能吃的东西。
 *
 * 两条策略并存：优先嵌入 SVG（矢量、缩放不糊），但 docx 的 SVG 支持依赖阅读器，
 * 所以 SVG 里总带一份 PNG fallback；而被链接引用的图片必须降级成光栅图，
 * 因为带超链接的 SVG 在 Word/WPS 里会丢链接。
 */
import type {
  Paragraph as DocxParagraph,
  Table as DocxTable,
  TextRun as DocxTextRun,
} from 'docx';
import { t } from '../../i18n/runtime';
import { createMarkmapSvgElement } from '../diagrams/staticMarkmap';
import { createExportPlantUmlSvgElement } from '../diagrams/diagramPlaceholders';
import type { ContentTheme } from '../../settings/types';
import type { ExportDocumentInput } from '../types';
import { getWriteClassByTheme } from '../exportSettings';
import {
  bytesToDataUrl,
  canvasToPngBytes,
  dataUrlToBytes,
  getDocxRasterType,
  getImageSize,
  getSvgSize,
  prepareSvgForDocx,
  readLocalExportMedia,
  type RasterDocxImageType,
} from '../assets';
import {
  getPreviewBackgroundColor,
  normalizeExportRasterScale,
} from '../pipeline/exportPipelineContext';
import { assertExportCanvasWithinLimits } from '../render/canvasLimits';
import {
  DOCX_IMAGE_MAX_HEIGHT,
  DOCX_IMAGE_MAX_WIDTH,
  DOCX_VISUAL_BLOCK_RENDER_TIMEOUT_MS,
  DOCX_VISUAL_BLOCK_WIDTH,
  EXPORT_FONT_READY_TIMEOUT_MS,
  EXPORT_MARKMAP_RENDER_TIMEOUT_MS,
  EXPORT_MERMAID_RENDER_TIMEOUT_MS,
  EXPORT_PLANTUML_RENDER_TIMEOUT_MS,
} from '../exportConstants';
import {
  nextExportFrame as nextFrame,
  normalizeRasterComputedColors,
  withExportTimeout as withTimeout,
} from '../rendering';
import {
  createMermaidExportRenderSandbox,
  getMermaidDocxConfig,
  normalizeMermaidSvg,
} from '../diagrams/mermaidSvg';

/** docx 是动态 import 的，类型只能从模块类型上反射。 */
export type DocxModule = typeof import('docx');
export type DocxBlock = DocxParagraph | DocxTable;
export type DocxInline = DocxTextRun | InstanceType<DocxModule['ImageRun']>;
export type RasterDocxImage = { type: RasterDocxImageType; data: Uint8Array; width: number; height: number };
export type SvgDocxImage = {
  type: 'svg';
  data: string;
  fallback: RasterDocxImage;
  width: number;
  height: number;
};
export type ExportDocxImage = RasterDocxImage | SvgDocxImage;
export type MermaidDocxImage = RasterDocxImage;

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

export async function svgToDocxPngImage(
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

export async function renderMermaidSvgToDocxPngImage(svgText: string, contentTheme: ContentTheme, scale = 2): Promise<RasterDocxImage | null> {
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

export async function svgToDocxImage(svgText: string, scale = 2): Promise<SvgDocxImage> {
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

export async function renderMermaidImage(source: string, contentTheme: ContentTheme, scale = 2): Promise<MermaidDocxImage | null> {
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

export async function renderMarkmapImage(
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

export async function renderPlantUmlImage(
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

export async function renderMarkdownImage(
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

export function createDocxImageRun(
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

export function constrainDocxImageSize(
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

export function rasterizeLinkedDocxImage(image: ExportDocxImage | MermaidDocxImage): ExportDocxImage | MermaidDocxImage {
  return image.type === 'svg' ? image.fallback : image;
}
