/**
 * SVG 文档层的几何与归一化：把一个外来 SVG（PlantUML / Mermaid）调成
 * 「浏览器量得到、光栅化时不会被裁切」的形态。
 *
 * 这里的边界计算是必要的妥协：PlantUML 输出的 SVG 常有超出 viewBox 的文字与
 * 连线，直接截图会掉内容；`getBBox()` 在 WebKit 下又可能因为字体未就绪而报错或
 * 返回荒唐尺寸，所以同时算「自己遍历元素的估界」和「浏览器给的界」两者并集，
 * 并对明显离谱的浏览器结果做丢弃。
 */
import { t } from '../../i18n/runtime';
import { getSvgSize } from '../assets';
import { WEBKIT_PDF_CAPTURE_WIDTH } from '../exportConstants';
import { nextExportFrame as nextFrame } from '../rendering';

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

export function normalizePlantUmlSvg(svg: SVGSVGElement) {
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

/**
 * 把页面内联的 PlantUML `<svg>` 换成 `<img src="data:image/svg+xml,...">`。
 * html2canvas 与 WebKit 的 PDF 截图对内联 SVG 的支持都不稳，换成 img 后
 * 三条导出通路（PNG / PDF 光栅 / DOCX 视觉块）才拿到一致结果。
 */
export async function rasterizePlantUmlSvgsForCapture(target: HTMLElement) {
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
