import { readFile } from '../../platform/tauri/fileSystem';
import { t } from '../i18n/runtime';
import { dirname, joinPath } from '../workspace/services/path';
import { readExportResource } from './resources/exportResourceClient';

export type RasterDocxImageType = 'png' | 'jpg' | 'gif' | 'bmp';

export function dataUrlToBytes(dataUrl: string) {
  const [, base64 = ''] = dataUrl.split(',');
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

export async function canvasToPngBytes(canvas: HTMLCanvasElement, label: string) {
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

export function getSvgSize(svg: string) {
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

export function prepareSvgForDocx(svgText: string) {
  const svgDocument = new DOMParser().parseFromString(svgText, 'image/svg+xml');
  const svg = svgDocument.documentElement;
  if (svg.tagName.toLowerCase() !== 'svg') return svgText;
  replaceForeignObjectLabels(svg as unknown as SVGSVGElement);
  ensureSvgExplicitSize(svg as unknown as SVGSVGElement);
  return new XMLSerializer().serializeToString(svg);
}

export function getImageSize(dataUrl: string) {
  return new Promise<{ width: number; height: number }>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => reject(new Error(t('export.imageSizeReadFailed')));
    image.src = dataUrl;
  });
}

export function blobToDataUrl(blob: Blob) {
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

export function bytesToDataUrl(bytes: Uint8Array, mimeType: string) {
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

export function resolveExportMediaPath(rawSrc: string, documentPath?: string) {
  const src = stripMediaUrlDecorations(rawSrc.trim());
  if (!src || src.startsWith('#') || src.startsWith('?')) return null;
  if (src.startsWith('file://')) return fileUrlToPath(src);
  if (isExternalMediaSrc(src)) return null;
  if (src.startsWith('/') || isWindowsAbsolutePath(src)) return decodeExportMediaPath(src);
  if (!documentPath) return null;
  return joinPath(dirname(documentPath), decodeExportMediaPath(src));
}

export function getExportMediaMimeType(filePath: string) {
  const normalized = stripMediaUrlDecorations(filePath).toLowerCase();
  if (normalized.endsWith('.svg')) return 'image/svg+xml';
  if (normalized.endsWith('.png')) return 'image/png';
  if (normalized.endsWith('.jpg') || normalized.endsWith('.jpeg')) return 'image/jpeg';
  if (normalized.endsWith('.gif')) return 'image/gif';
  if (normalized.endsWith('.bmp')) return 'image/bmp';
  if (normalized.endsWith('.webp')) return 'image/webp';
  return 'application/octet-stream';
}

export function getDocxRasterType(mimeType: string, filePath: string): RasterDocxImageType | null {
  const normalized = stripMediaUrlDecorations(filePath).toLowerCase();
  if (mimeType === 'image/png' || normalized.endsWith('.png')) return 'png';
  if (mimeType === 'image/jpeg' || normalized.endsWith('.jpg') || normalized.endsWith('.jpeg')) return 'jpg';
  if (mimeType === 'image/gif' || normalized.endsWith('.gif')) return 'gif';
  if (mimeType === 'image/bmp' || normalized.endsWith('.bmp')) return 'bmp';
  return null;
}

export async function readLocalExportMedia(rawSrc: string, documentPath?: string) {
  const filePath = resolveExportMediaPath(rawSrc, documentPath);
  if (!filePath) return null;
  const nativeResource = await readExportResource({
    rawSrc,
    documentPath: documentPath ?? null,
  }).catch(() => null);
  if (nativeResource) {
    return {
      filePath: nativeResource.path,
      bytes: nativeResource.bytes,
      mimeType: nativeResource.mimeType,
    };
  }
  const bytes = await readFile(filePath);
  return {
    filePath,
    bytes,
    mimeType: getExportMediaMimeType(filePath),
  };
}
