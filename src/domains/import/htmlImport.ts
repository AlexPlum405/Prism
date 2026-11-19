import { convertHtmlToMarkdown } from '../editor/extensions/htmlToMarkdown';
import type { ImportAsset, ImportConversionResult } from './types';

/** 网页里对阅读没有贡献、但会被转成大量垃圾文本的节点 */
const NOISE_SELECTOR = 'script, style, noscript, iframe, svg, canvas, form, nav, header, footer, aside, template';

const DATA_URI_PATTERN = /^data:([^;,]+)?(?:;charset=[^;,]+)?;base64,(.*)$/i;

const MIME_EXTENSIONS: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
  'image/bmp': 'bmp',
  'image/avif': 'avif',
};

function base64ToBytes(payload: string): Uint8Array | null {
  try {
    const binary = atob(payload.replace(/\s+/g, ''));
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
  } catch {
    return null;
  }
}

function importableHtmlElement(doc: Document): Element | null {
  // article/main 是「正文」的语义标记，命中就用它，能自动滤掉整站导航与页脚
  return doc.querySelector('article') ?? doc.querySelector('main') ?? doc.body;
}

/**
 * 网页转 Markdown。
 *
 * 内嵌的 base64 图片会被拆成独立的资源文件——留在正文里会把一份文稿变成
 * 几 MB 的单行，编辑器、搜索和导出全都会被拖慢。
 */
export function importHtmlAsMarkdown(html: string): ImportConversionResult {
  const assets: ImportAsset[] = [];
  const warnings: string[] = [];
  let droppedImageCount = 0;

  const doc = new DOMParser().parseFromString(html, 'text/html');
  const root = importableHtmlElement(doc);
  if (!root) {
    return { assets, droppedImageCount, markdown: '', warnings };
  }

  for (const node of Array.from(root.querySelectorAll(NOISE_SELECTOR))) {
    node.remove();
  }

  for (const image of Array.from(root.querySelectorAll('img'))) {
    const source = (image.getAttribute('src') ?? '').trim();

    if (!source) {
      image.remove();
      droppedImageCount += 1;
      continue;
    }

    const dataUri = DATA_URI_PATTERN.exec(source);
    if (!dataUri) continue;

    const bytes = base64ToBytes(dataUri[2] ?? '');
    if (!bytes || bytes.length === 0) {
      image.remove();
      droppedImageCount += 1;
      continue;
    }

    const extension = MIME_EXTENSIONS[(dataUri[1] ?? '').toLowerCase()] ?? 'png';
    const fileName = `image-${assets.length + 1}.${extension}`;
    assets.push({ fileName, bytes });
    image.setAttribute('src', `assets/${fileName}`);
  }

  const markdown = convertHtmlToMarkdown(root.innerHTML)
    // turndown 输出「-   item」三个空格，统一成两个字符宽度，读起来更整齐
    .replace(/^(\s*)([-*+]) {2,}/gm, '$1$2 ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  if (droppedImageCount > 0) {
    warnings.push(`有 ${droppedImageCount} 张图片没有可用的地址，已跳过。`);
  }

  return { assets, droppedImageCount, markdown, warnings };
}
