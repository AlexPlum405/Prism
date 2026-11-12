import { readFile } from '../../../platform/tauri/fileSystem';
import { bytesToDataUrl, getExportMediaMimeType } from '../../export/assets';

// 预览 DOM 中仅服务 Prism 内部机制的属性，不应进入剪贴板 HTML。
const PREVIEW_INTERNAL_ATTRIBUTE_PREFIXES = ['data-prism-', 'data-preview-'];
const PREVIEW_INTERNAL_ATTRIBUTES = new Set([
  'data-source-line',
  'data-line',
  'data-katex',
  'data-katex-display',
  'data-mermaid',
  'data-markmap',
  'data-plantuml',
  'data-task-checkbox-index',
  'data-callout-kind',
  'data-callout-label',
  'data-callout-title',
]);

// 单张图片内联上限，避免超大图片撑爆剪贴板。
const CLIPBOARD_INLINE_IMAGE_MAX_BYTES = 10 * 1024 * 1024;

// 粘贴目标（Word/飞书/备忘录等）不带 Prism CSS。这里补最小内联样式，
// 保住表格边框、代码块底色和引用样式的可读性；宁少勿多，排版交给目标应用。
const CLIPBOARD_TABLE_STYLE = 'border-collapse:collapse';
const CLIPBOARD_TH_STYLE = 'border:1px solid #d5d5d5;padding:4px 10px;background:#f2f2f2;vertical-align:top';
const CLIPBOARD_TD_STYLE = 'border:1px solid #d5d5d5;padding:4px 10px;vertical-align:top';
const CLIPBOARD_PRE_STYLE = 'background:#f6f8fa;padding:12px;border-radius:6px;font-family:monospace;font-size:0.9em;overflow-x:auto';
const CLIPBOARD_INLINE_CODE_STYLE = 'font-family:monospace;background:#f2f2f2;padding:1px 5px;border-radius:4px';
const CLIPBOARD_BLOCKQUOTE_STYLE = 'border-left:4px solid #d5d5d5;padding:0.2em 1em;color:#666666';
const CLIPBOARD_IMG_STYLE = 'max-width:100%';

function mergeInlineStyle(element: Element, addition: string) {
  const existing = (element.getAttribute('style') ?? '').trim().replace(/;+$/, '');
  element.setAttribute('style', existing ? `${existing};${addition}` : addition);
}

function applyMinimalClipboardStyles(root: ParentNode): void {
  root.querySelectorAll('table').forEach((table) => {
    mergeInlineStyle(table, CLIPBOARD_TABLE_STYLE);
    table.querySelectorAll('th').forEach((cell) => mergeInlineStyle(cell, CLIPBOARD_TH_STYLE));
    table.querySelectorAll('td').forEach((cell) => mergeInlineStyle(cell, CLIPBOARD_TD_STYLE));
  });

  root.querySelectorAll('pre').forEach((pre) => mergeInlineStyle(pre, CLIPBOARD_PRE_STYLE));
  // 行内代码补底色与等宽字体；pre 内的代码交给 pre 自己的样式。
  root.querySelectorAll('code').forEach((code) => {
    if (code.closest('pre')) return;
    mergeInlineStyle(code, CLIPBOARD_INLINE_CODE_STYLE);
  });

  root.querySelectorAll('blockquote').forEach((quote) => mergeInlineStyle(quote, CLIPBOARD_BLOCKQUOTE_STYLE));
  root.querySelectorAll('img').forEach((image) => mergeInlineStyle(image, CLIPBOARD_IMG_STYLE));
}

/**
 * 目标应用（尤其 Word）对只有 width:100% 的内联 SVG 可能按高度 0 渲染。
 * 有 viewBox 的图按比例写入像素级 width/height；无 viewBox 的图
 * （如 markmap）兜底设 450px 高度，避免粘贴后塌陷。
 */
function hardenClipboardSvgSizes(root: ParentNode): void {
  root.querySelectorAll('svg').forEach((svg) => {
    if (svg.closest('pre')) return;
    const viewBox = (svg.getAttribute('viewBox') ?? '').trim().split(/\s+/).map(Number);
    if (viewBox.length === 4 && viewBox.every(Number.isFinite) && viewBox[2] > 0 && viewBox[3] > 0) {
      const width = Math.min(800, Math.round(viewBox[2]));
      const height = Math.round((width * viewBox[3]) / viewBox[2]);
      svg.setAttribute('width', String(width));
      svg.setAttribute('height', String(height));
      return;
    }
    if (!svg.getAttribute('height')) {
      svg.setAttribute('height', '450');
      if (!svg.getAttribute('width')) svg.setAttribute('width', '100%');
    }
  });
}

export function stripPreviewInternalAttributesInRoot(root: ParentNode): void {
  root.querySelectorAll('*').forEach((element) => {
    for (const attribute of Array.from(element.attributes)) {
      const name = attribute.name.toLowerCase();
      if (PREVIEW_INTERNAL_ATTRIBUTES.has(name)
        || PREVIEW_INTERNAL_ATTRIBUTE_PREFIXES.some((prefix) => name.startsWith(prefix))) {
        element.removeAttribute(attribute.name);
      }
    }
  });
}

export function stripPreviewInternalAttributes(html: string): string {
  const trimmed = html.trim();
  if (!trimmed) return html;
  const template = document.createElement('template');
  template.innerHTML = trimmed;
  stripPreviewInternalAttributesInRoot(template.content);
  return template.innerHTML;
}

/**
 * fast path 大文档（≥300KB）的表格被渲染成 .prism-simple-table（display:grid
 * 的 div+span 假表格，见 markdownToHtml 的 renderCommonPreviewSimpleTable），
 * 没有任何 <table> 语义，直接复制粘贴出去表格会塌掉。这里把它反解析回真表格：
 * 列数取自 --cols-N 包装类，前 N 个 span 是表头，其余按行还原，
 * 对齐从 __cell--{align} 单元格类转成 inline style。
 */
function convertSimpleTableToRealTable(table: HTMLElement): void {
  const columnCount = Number(/prism-simple-table--cols-(\d+)/.exec(table.className)?.[1]);
  if (!Number.isFinite(columnCount) || columnCount <= 0) return;

  const spans = Array.from(table.querySelectorAll(':scope > span'));
  if (spans.length === 0 || spans.length < columnCount || spans.length % columnCount !== 0) return;

  const alignAttr = (span: Element): string => {
    const align = Array.from(span.classList)
      .find((className) => className.startsWith('prism-simple-table__cell--'))
      ?.slice('prism-simple-table__cell--'.length);
    return (align === 'left' || align === 'center' || align === 'right')
      ? ` style="text-align:${align}"`
      : '';
  };
  const cellHtml = (span: Element, tag: 'th' | 'td'): string =>
    `<${tag}${alignAttr(span)}>${span.innerHTML}</${tag}>`;

  const headerCells = spans
    .slice(0, columnCount)
    .map((span) => cellHtml(span, 'th'));
  const bodyRows: string[] = [];
  for (let index = columnCount; index < spans.length; index += columnCount) {
    bodyRows.push(
      `<tr>${spans
        .slice(index, index + columnCount)
        .map((span) => cellHtml(span, 'td'))
        .join('')}</tr>`,
    );
  }

  const tableElement = document.createElement('table');
  const thead = document.createElement('thead');
  thead.innerHTML = `<tr>${headerCells.join('')}</tr>`;
  const tbody = document.createElement('tbody');
  tbody.innerHTML = bodyRows.join('');
  tableElement.append(thead, tbody);

  table.replaceWith(tableElement);
}

/**
 * 把预览 DOM 中本地图片的 blob: 对象 URL 内联为 data URL。
 * 预览渲染时本地图片会被替换为 blob:（见 PreviewPane 的 previewMediaCache），
 * 粘贴到其他应用后 blob 失效会裂图，因此剪贴板 HTML 需要内联。
 * 读取失败或超过大小上限时保持原样。
 */
async function inlinePreviewImages(root: ParentNode): Promise<void> {
  const images = Array.from(
    root.querySelectorAll<HTMLImageElement>('img[data-prism-file-src]'),
  );
  await Promise.all(images.map(async (image) => {
    try {
      const filePath = image.getAttribute('data-prism-file-src');
      if (!filePath) return;
      const bytes = await readFile(filePath);
      if (!bytes || bytes.length > CLIPBOARD_INLINE_IMAGE_MAX_BYTES) return;
      image.setAttribute('src', bytesToDataUrl(bytes, getExportMediaMimeType(filePath)));
    } catch {
      // 文件不可读时保持原 src，不阻断整体复制。
    }
  }));
}

/**
 * 把预览 HTML 整理为适合写入剪贴板的形态：
 * 本地图片内联为 data URL，并剥离 Prism 内部 data-* 属性。
 */
export async function buildPreviewClipboardHtml(rawHtml: string): Promise<string> {
  const trimmed = rawHtml.trim();
  if (!trimmed) return '';
  const template = document.createElement('template');
  template.innerHTML = trimmed;
  template.content
    .querySelectorAll<HTMLElement>('.prism-simple-table')
    .forEach((table) => convertSimpleTableToRealTable(table));
  hardenClipboardSvgSizes(template.content);
  applyMinimalClipboardStyles(template.content);
  await inlinePreviewImages(template.content);
  stripPreviewInternalAttributesInRoot(template.content);
  return template.innerHTML;
}
