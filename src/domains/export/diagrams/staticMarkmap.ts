/**
 * Markmap 的静态 SVG 渲染：不走 markmap-view 的交互式渲染（它需要 d3 与容器测量），
 * 而是把 transformer 产出的树自己算一份横向树图布局，直接拼 SVG。
 * 导出只需要一张能截图的静态图，这样才不依赖 DOM 尺寸。
 */
import type { ContentTheme } from '../../settings/types';
import { getMarkmapPalette } from '../../editor/components/markmap';

export interface StaticMarkmapNode {
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

export async function createMarkmapSvgElement(source: string, contentTheme: ContentTheme) {
  const { Transformer } = await import('markmap-lib');
  const transformer = new Transformer();
  const { root: markmapRoot } = transformer.transform(source);
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  renderStaticMarkmapSvg(svg, markmapRoot as StaticMarkmapNode, contentTheme);
  return svg;
}
