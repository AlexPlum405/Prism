/**
 * Mermaid 在导出侧的三处用法（HTML/PNG 占位符、DOCX 图片、PDF）共用同一套主题
 * 配置与同一段 SVG 归一化逻辑，配置分叉会让同一份图表在三种格式里长得不一样。
 */
import type { ContentTheme } from '../../settings/types';
import { getMermaidThemeConfig } from '../../themes';

function getMermaidConfig(contentTheme: ContentTheme) {
  return getMermaidThemeConfig(contentTheme);
}

export function getMermaidExportConfig(contentTheme: ContentTheme) {
  return {
    ...getMermaidConfig(contentTheme),
    suppressErrorRendering: true,
  };
}

export function getMermaidDocxConfig(contentTheme: ContentTheme, htmlLabels: boolean) {
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

export function createMermaidExportRenderSandbox() {
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

export function normalizeMermaidSvg(svg: SVGSVGElement) {
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
