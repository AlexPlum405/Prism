/**
 * 图片尺寸属性：`![说明](assets/a.png){width=320}`。
 *
 * 选择属性语法而不是 HTML `<img>`，是为了让源文件在任何 Markdown 工具里都还是
 * 一张普通图片——不认识 `{...}` 的渲染器只会多显示一段文字，而不会把整段变成裸标签。
 *
 * 宽度既可以是像素（`320` / `320px`），也可以是百分比（`40%`）。只给宽度时高度
 * 保持 auto，避免用户拖一次就改变图片比例。
 */

export interface ImageSize {
  width?: string;
  height?: string;
}

export const IMAGE_MIN_WIDTH_PX = 8;
export const IMAGE_MAX_WIDTH_PX = 4096;
export const IMAGE_MIN_PERCENT = 1;
export const IMAGE_MAX_PERCENT = 100;

const ATTRIBUTE_AT_START = /^\{[^{}\n]{1,80}\}/;
const IMAGE_PATTERN = /!\[[^\]]*]\([^)]*\)/g;
const FENCED_CODE_PATTERN = /```[\s\S]*?```/g;
const INLINE_CODE_PATTERN = /`[^`\n]*`/g;

function normalizeLength(raw: string): string | null {
  const match = /^(-?\d+(?:\.\d+)?)(px|%)?$/.exec(raw.trim());
  if (!match) return null;
  const value = Number(match[1]);
  if (!Number.isFinite(value) || value <= 0) return null;
  if (match[2] === '%') {
    const clamped = Math.min(IMAGE_MAX_PERCENT, Math.max(IMAGE_MIN_PERCENT, Math.round(value)));
    return `${clamped}%`;
  }
  const clamped = Math.min(IMAGE_MAX_WIDTH_PX, Math.max(IMAGE_MIN_WIDTH_PX, Math.round(value)));
  return `${clamped}px`;
}

function parseAttributeBody(body: string): ImageSize | null {
  const size: ImageSize = {};
  const pairPattern = /(width|height)\s*=\s*([^\s}]+)/gi;
  let match: RegExpExecArray | null = pairPattern.exec(body);
  while (match) {
    const value = normalizeLength(match[2]);
    if (value) size[match[1].toLowerCase() as 'width' | 'height'] = value;
    match = pairPattern.exec(body);
  }

  return size.width || size.height ? size : null;
}

/** 只接受「整个字符串就是一个属性」的形式，避免把正文里的花括号误判为尺寸。 */
export function parseImageSizeAttribute(raw: string): ImageSize | null {
  const trimmed = raw.trim();
  if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) return null;
  return parseAttributeBody(trimmed.slice(1, -1));
}

/** 从 `index` 起解析紧邻的属性块，返回结束位置，便于调用方跳过它。 */
export function parseImageSizeFromText(
  text: string,
  index: number,
): { size: ImageSize; endIndex: number } | null {
  const rest = text.slice(index);
  const match = ATTRIBUTE_AT_START.exec(rest);
  if (!match) return null;
  const size = parseImageSizeAttribute(match[0]);
  if (!size) return null;
  return { size, endIndex: index + match[0].length };
}

function toAttributeValue(value: string) {
  return value.endsWith('px') ? value.slice(0, -2) : value;
}

export function formatImageSizeAttribute(size: ImageSize): string {
  const parts: string[] = [];
  if (size.width) parts.push(`width=${toAttributeValue(size.width)}`);
  if (size.height) parts.push(`height=${toAttributeValue(size.height)}`);
  return parts.length > 0 ? `{${parts.join(' ')}}` : '';
}

export function imageSizeStyle(size: ImageSize): string | null {
  if (!size.width && !size.height) return null;
  const declarations: string[] = [];
  if (size.width) declarations.push(`width: ${size.width}`);
  if (size.height) declarations.push(`height: ${size.height}`);
  else declarations.push('height: auto');
  if (!size.width) declarations.push('width: auto');
  return `${declarations.join('; ')};`;
}

/** 把代码块与行内代码替换成等长空白，保证下标仍然对得上原文。 */
function maskCode(markdown: string) {
  const blank = (value: string) => value.replace(/[^\n]/g, ' ');
  return markdown
    .replace(FENCED_CODE_PATTERN, blank)
    .replace(INLINE_CODE_PATTERN, blank);
}

/**
 * 把第 N 张图片的宽度写回 Markdown。用于预览里拖动缩放手柄后回写源码，
 * 不改动图片链接本身，也不重排文档其余部分。
 */
export function applyImageWidthToMarkdown(
  markdown: string,
  imageIndex: number,
  width: string,
): string {
  const normalized = normalizeLength(width);
  if (!normalized || imageIndex < 0) return markdown;

  const masked = maskCode(markdown);
  IMAGE_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null = null;
  for (let index = 0; index <= imageIndex; index += 1) {
    match = IMAGE_PATTERN.exec(masked);
    if (!match) return markdown;
  }
  if (!match) return markdown;

  const imageEnd = match.index + match[0].length;
  const existing = parseImageSizeFromText(markdown, imageEnd);
  const nextSize: ImageSize = { ...(existing?.size ?? {}), width: normalized };
  const attribute = formatImageSizeAttribute(nextSize);

  if (existing) {
    return `${markdown.slice(0, imageEnd)}${attribute}${markdown.slice(existing.endIndex)}`;
  }
  return `${markdown.slice(0, imageEnd)}${attribute}${markdown.slice(imageEnd)}`;
}
