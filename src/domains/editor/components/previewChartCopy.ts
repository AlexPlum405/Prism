import { getSafeExportCanvasScale } from '../../export/render/canvasLimits';
import { isTauriClipboardRuntime, writeClipboardRichNative, writeClipboardTextNative } from '../../../platform/tauri/clipboardRich';

export type PreviewChartKind = 'mermaid' | 'markmap' | 'plantuml' | 'katex';

export interface PreviewChartTarget {
  kind: PreviewChartKind;
  /** 渲染块的最外层容器（复制图片时以此为截图范围）。 */
  element: HTMLElement;
  /** 渲染前的源码文本；不可用时为空字符串。 */
  source: string;
}

export type PreviewChartCopyErrorCode = 'no-source' | 'render-failed' | 'clipboard-failed';

export class PreviewChartCopyError extends Error {
  code: PreviewChartCopyErrorCode;

  constructor(code: PreviewChartCopyErrorCode) {
    super(code);
    this.name = 'PreviewChartCopyError';
    this.code = code;
  }
}

// Mermaid 等 SVG 图表的文本标签走 foreignObject（HTML），SVG 序列化后经 <img>
// 绘制会污染画布（Tainted canvases may not be exported），因此统一用 html2canvas
// 对容器截图，与导出管道的 DOCX 图表嵌入策略一致。
const CHART_IMAGE_SCALE = 2;

function readDecodedSource(element: HTMLElement, attribute: string): string {
  const encoded = element.getAttribute(attribute);
  if (!encoded) return '';
  try {
    return decodeURIComponent(encoded);
  } catch {
    return '';
  }
}

export function findPreviewChartTarget(start: Element | null): PreviewChartTarget | null {
  if (!start) return null;

  const mermaid = start.closest<HTMLElement>('.mermaid-placeholder');
  if (mermaid) {
    return { kind: 'mermaid', element: mermaid, source: readDecodedSource(mermaid, 'data-mermaid') };
  }

  const markmap = start.closest<HTMLElement>('.markmap-placeholder');
  if (markmap) {
    return { kind: 'markmap', element: markmap, source: readDecodedSource(markmap, 'data-markmap') };
  }

  const plantUml = start.closest<HTMLElement>('.plantuml-placeholder');
  if (plantUml) {
    return { kind: 'plantuml', element: plantUml, source: readDecodedSource(plantUml, 'data-plantuml') };
  }

  // KaTeX：display 容器内嵌套 .katex，必须优先取外层 .katex-display；
  // 未渲染的占位元素同时带 katex-placeholder class。
  const katexDisplay = start.closest<HTMLElement>('.katex-display');
  if (katexDisplay) {
    return { kind: 'katex', element: katexDisplay, source: readDecodedSource(katexDisplay, 'data-katex') };
  }
  const katex = start.closest<HTMLElement>('.katex');
  if (katex) {
    return { kind: 'katex', element: katex, source: readDecodedSource(katex, 'data-katex') };
  }
  const katexPlaceholder = start.closest<HTMLElement>('.katex-placeholder');
  if (katexPlaceholder) {
    return { kind: 'katex', element: katexPlaceholder, source: readDecodedSource(katexPlaceholder, 'data-katex') };
  }

  return null;
}

function getPreviewBackgroundColor(): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue('--bg-preview').trim();
  return value || '#ffffff';
}

function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new PreviewChartCopyError('render-failed'));
    }, 'image/png');
  });
}

async function chartElementToPngBlob(element: HTMLElement): Promise<Blob> {
  const { default: html2canvas } = await import('html2canvas');
  const rect = element.getBoundingClientRect();
  const scale = getSafeExportCanvasScale(rect.width, rect.height, CHART_IMAGE_SCALE);
  if (scale === null) throw new PreviewChartCopyError('render-failed');
  const canvas = await html2canvas(element, {
    backgroundColor: getPreviewBackgroundColor(),
    scale,
    logging: false,
  });
  return canvasToPngBlob(canvas);
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}

async function writePngBlobToClipboard(blob: Blob): Promise<void> {
  if (isTauriClipboardRuntime()) {
    try {
      const bytes = new Uint8Array(await blob.arrayBuffer());
      await writeClipboardRichNative({ pngBytesBase64: bytesToBase64(bytes) });
      return;
    } catch {
      throw new PreviewChartCopyError('clipboard-failed');
    }
  }

  const clipboard = navigator.clipboard as (Clipboard & { write?: (items: ClipboardItem[]) => Promise<void> }) | undefined;
  if (!clipboard?.write || typeof globalThis.ClipboardItem === 'undefined') {
    throw new PreviewChartCopyError('clipboard-failed');
  }
  try {
    await clipboard.write([new ClipboardItem({ 'image/png': blob })]);
  } catch {
    throw new PreviewChartCopyError('clipboard-failed');
  }
}

/** 把图表渲染为 PNG 并写入系统剪贴板。 */
export async function copyPreviewChartAsImage(target: PreviewChartTarget): Promise<void> {
  let blob: Blob;
  try {
    blob = await chartElementToPngBlob(target.element);
  } catch (error) {
    if (error instanceof PreviewChartCopyError) throw error;
    throw new PreviewChartCopyError('render-failed');
  }
  await writePngBlobToClipboard(blob);
}

/** 把图表渲染前的源码文本写入系统剪贴板。 */
export async function copyPreviewChartAsSource(target: PreviewChartTarget): Promise<void> {
  if (!target.source) throw new PreviewChartCopyError('no-source');
  if (isTauriClipboardRuntime()) {
    try {
      await writeClipboardTextNative(target.source);
      return;
    } catch {
      throw new PreviewChartCopyError('clipboard-failed');
    }
  }
  try {
    await navigator.clipboard.writeText(target.source);
  } catch {
    throw new PreviewChartCopyError('clipboard-failed');
  }
}
