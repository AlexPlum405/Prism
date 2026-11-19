import { unzipSync } from 'fflate';
import type { ImportAsset, ImportConversionResult } from './types';

const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const R_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const MAX_HEADING_LEVEL = 6;

interface DocxContext {
  assetNames: Map<string, string>;
  assets: ImportAsset[];
  counters: Map<string, number>;
  files: Record<string, Uint8Array>;
  images: Map<string, string>;
  links: Map<string, string>;
  numbering: Map<string, Map<number, 'bullet' | 'ordered'>>;
  warnings: string[];
}

function decodeXml(bytes: Uint8Array): string {
  if (bytes[0] === 0xff && bytes[1] === 0xfe) {
    return new TextDecoder('utf-16le').decode(bytes);
  }
  return new TextDecoder('utf-8').decode(bytes);
}

function parseXml(text: string): Document | null {
  const doc = new DOMParser().parseFromString(text.replace(/^\uFEFF/, ''), 'application/xml');
  if (doc.getElementsByTagName('parsererror').length > 0) return null;
  return doc.documentElement ? doc : null;
}

/**
 * 只按 localName 匹配，不校验命名空间。
 *
 * Word 正文里同一个前缀可能绑到别的命名空间（例如中文版模板里的 w14），
 * 严格校验会让整篇文档安静地变成空文；localName 在 OOXML 里足够唯一。
 */
function elements(node: Element | null | undefined, localName?: string): Element[] {
  if (!node) return [];
  const children = Array.from(node.children);
  return localName ? children.filter((child) => child.localName === localName) : children;
}

function child(node: Element | null | undefined, localName: string): Element | null {
  return elements(node, localName)[0] ?? null;
}

function descendants(node: Element, localName: string): Element[] {
  return Array.from(node.getElementsByTagName('*')).filter((element) => element.localName === localName);
}

function attributeValue(element: Element | null | undefined): string {
  if (!element) return '';
  return element.getAttribute('w:val') ?? element.getAttributeNS(W_NS, 'val') ?? '';
}

function relationshipId(element: Element): string {
  return element.getAttribute('r:id') ?? element.getAttributeNS(R_NS, 'id') ?? '';
}

function relAttribute(element: Element, local: string): string {
  return element.getAttribute(`r:${local}`) ?? element.getAttributeNS(R_NS, local) ?? '';
}

function isToggleOn(parent: Element | null, localName: string): boolean {
  const node = child(parent, localName);
  if (!node) return false;
  const value = attributeValue(node).toLowerCase();
  return value !== '0' && value !== 'false' && value !== 'off';
}

function headingLevel(styleId: string): number {
  const style = styleId.trim();
  if (!style) return 0;
  if (/^(title|标题)$/i.test(style)) return 1;

  const match = /^heading\s*([1-9])$/i.exec(style);
  if (match) return Math.min(MAX_HEADING_LEVEL, Number(match[1]));
  return 0;
}

function parseRelationships(xml: string | undefined, ctx: DocxContext): void {
  if (!xml) return;
  const doc = parseXml(xml);
  if (!doc) return;

  for (const relation of Array.from(doc.documentElement?.children ?? [])) {
    const id = relation.getAttribute('Id') ?? '';
    const target = relation.getAttribute('Target') ?? '';
    const type = relation.getAttribute('Type') ?? '';
    if (!id || !target) continue;

    if (type.endsWith('/image')) ctx.images.set(id, target);
    else if (type.endsWith('/hyperlink')) ctx.links.set(id, target);
  }
}

function parseNumbering(xml: string | undefined, ctx: DocxContext): void {
  if (!xml) return;
  const doc = parseXml(xml);
  const root = doc?.documentElement;
  if (!root) return;

  const abstractFormats = new Map<string, Map<number, 'bullet' | 'ordered'>>();
  for (const abstract of elements(root, 'abstractNum')) {
    const abstractId = abstract.getAttribute('w:abstractNumId')
      ?? abstract.getAttributeNS(W_NS, 'abstractNumId')
      ?? '';
    const levels = new Map<number, 'bullet' | 'ordered'>();
    for (const level of elements(abstract, 'lvl')) {
      const index = Number(level.getAttribute('w:ilvl') ?? level.getAttributeNS(W_NS, 'ilvl') ?? '0');
      const format = attributeValue(child(level, 'numFmt'));
      levels.set(Number.isFinite(index) ? index : 0, format === 'bullet' ? 'bullet' : 'ordered');
    }
    abstractFormats.set(abstractId, levels);
  }

  for (const num of elements(root, 'num')) {
    const numId = num.getAttribute('w:numId') ?? num.getAttributeNS(W_NS, 'numId') ?? '';
    const abstractId = attributeValue(child(num, 'abstractNumId'));
    const levels = abstractFormats.get(abstractId);
    if (numId && levels) ctx.numbering.set(numId, levels);
  }
}

function resolveZipPath(target: string): string {
  const clean = target.replace(/\\/g, '/').replace(/^\.\//, '');
  if (clean.startsWith('/')) return clean.slice(1);
  if (clean.startsWith('word/')) return clean;
  return `word/${clean}`;
}

function assetBaseName(target: string): string {
  const raw = target.split(/[\\/]/).pop() ?? 'image';
  const safe = raw
    .replace(/[^\p{L}\p{N}._-]+/gu, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^[-.]+/, '');
  return safe || 'image';
}

function uniqueAssetName(base: string, ctx: DocxContext): string {
  const taken = new Set(Array.from(ctx.assetNames.values()));
  if (!taken.has(base)) return base;

  const dot = base.lastIndexOf('.');
  const stem = dot > 0 ? base.slice(0, dot) : base;
  const extension = dot > 0 ? base.slice(dot) : '';
  for (let index = 2; index < 1000; index += 1) {
    const candidate = `${stem}-${index}${extension}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${stem}-${Date.now()}${extension}`;
}

function ensureAsset(relId: string, ctx: DocxContext): string | null {
  const target = ctx.images.get(relId);
  if (!target) return null;

  const existing = ctx.assetNames.get(target);
  if (existing) return existing;

  const bytes = ctx.files[resolveZipPath(target)];
  if (!bytes || bytes.length === 0) {
    ctx.warnings.push(`图片 ${target} 在文件里找不到，已跳过。`);
    return null;
  }

  const fileName = uniqueAssetName(assetBaseName(target), ctx);
  ctx.assetNames.set(target, fileName);
  ctx.assets.push({ fileName, bytes });
  return fileName;
}

function escapeMarkdown(text: string): string {
  return text.replace(/([\\`*_[\]])/g, '\\$1');
}

function escapeLineStart(line: string): string {
  return line.replace(/^(\s*)([#>+-])(\s|$)/, '$1\\$2$3');
}

function escapeText(text: string): string {
  return text
    .split('\n')
    .map((line) => escapeLineStart(escapeMarkdown(line)))
    .join('  \n');
}

/** 图片替代文本只需要防止提前闭合方括号，转义其它记号会让语法本身失效 */
function escapeAltText(text: string): string {
  return text.replace(/([\\\]])/g, '\\$1');
}

function wrapEmphasis(text: string, marker: string): string {
  const match = /^(\s*)([\s\S]*?)(\s*)$/.exec(text);
  if (!match || !match[2]) return text;
  return `${match[1]}${marker}${match[2]}${marker}${match[3]}`;
}

function renderDrawing(node: Element, ctx: DocxContext): string {
  const blip = descendants(node, 'blip')[0];
  if (!blip) return '';

  const fileName = ensureAsset(relAttribute(blip, 'embed'), ctx);
  if (!fileName) return '';

  const properties = descendants(node, 'docPr')[0];
  const alt = properties?.getAttribute('descr') || properties?.getAttribute('name') || '';
  return `![${escapeAltText(alt)}](assets/${fileName})`;
}

function renderRun(run: Element, ctx: DocxContext): string {
  const properties = child(run, 'rPr');
  // 隐藏文字（vanish）在 Word 里本来就不可见，转出来会凭空多内容
  if (isToggleOn(properties, 'vanish')) return '';

  let text = '';
  for (const node of elements(run)) {
    switch (node.localName) {
      case 't':
        // 逐段转义：图片这类由转换器自己生成的 Markdown 不能再被转义一次
        text += escapeText(node.textContent ?? '');
        break;
      case 'tab':
        text += ' ';
        break;
      case 'br':
      case 'cr':
        text += '  \n';
        break;
      case 'noBreakHyphen':
        text += '-';
        break;
      case 'drawing':
      case 'pict':
        text += renderDrawing(node, ctx);
        break;
      default:
        break;
    }
  }

  if (!text.trim()) return text;

  const bold = isToggleOn(properties, 'b');
  const italic = isToggleOn(properties, 'i');
  const strike = isToggleOn(properties, 'strike') || isToggleOn(properties, 'dstrike');

  let result = text;
  if (bold && italic) result = wrapEmphasis(result, '***');
  else if (bold) result = wrapEmphasis(result, '**');
  else if (italic) result = wrapEmphasis(result, '*');
  if (strike) result = wrapEmphasis(result, '~~');
  return result;
}

function renderInline(node: Element, ctx: DocxContext): string {
  const parts: string[] = [];

  for (const element of elements(node)) {
    switch (element.localName) {
      case 'r':
        parts.push(renderRun(element, ctx));
        break;
      case 'hyperlink': {
        const url = ctx.links.get(relationshipId(element)) ?? '';
        const text = renderInline(element, ctx).trim();
        parts.push(url && text ? `[${text}](${url})` : text);
        break;
      }
      case 'fldSimple':
        parts.push(renderInline(element, ctx));
        break;
      case 'sdt':
      case 'sdtContent':
      case 'smartTag':
      case 'ins':
        parts.push(renderInline(element, ctx));
        break;
      default:
        break;
    }
  }

  return parts.join('');
}

function listInfo(
  properties: Element | null,
  ctx: DocxContext,
): { level: number; marker: string } | null {
  const numberingProperties = child(properties, 'numPr');
  if (!numberingProperties) return null;

  const numId = attributeValue(child(numberingProperties, 'numId'));
  if (!numId || numId === '0') return null;

  const rawLevel = Number(attributeValue(child(numberingProperties, 'ilvl')) || '0');
  const level = Number.isFinite(rawLevel) && rawLevel > 0 ? Math.min(rawLevel, 8) : 0;
  const format = ctx.numbering.get(numId)?.get(level) ?? 'bullet';

  if (format === 'ordered') {
    const key = `${numId}:${level}`;
    const next = (ctx.counters.get(key) ?? 0) + 1;
    ctx.counters.set(key, next);
    return { level, marker: `${next}.` };
  }

  return { level, marker: '-' };
}

function renderParagraph(paragraph: Element, ctx: DocxContext): string {
  const properties = child(paragraph, 'pPr');
  const level = headingLevel(attributeValue(child(properties, 'pStyle')));
  const content = renderInline(paragraph, ctx).trim();
  if (!content) return '';

  if (level > 0) {
    ctx.counters.clear();
    // 标题里自带的 # 会被二次解释，去掉行首的标记字符
    return `${'#'.repeat(level)} ${content.replace(/^[#\s]+/, '')}`;
  }

  const list = listInfo(properties, ctx);
  if (list) return `${'  '.repeat(list.level)}${list.marker} ${content}`;

  ctx.counters.clear();
  return content;
}

function renderTableCell(cell: Element, ctx: DocxContext): string {
  const text = elements(cell, 'p')
    .map((paragraph) => renderInline(paragraph, ctx).trim())
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .replace(/\|/g, '\\|');
  return text;
}

function renderTable(table: Element, ctx: DocxContext): string {
  const rows = elements(table, 'tr').map((row) => elements(row, 'tc').map((cell) => renderTableCell(cell, ctx)));
  const matrix = rows.filter((cells) => cells.length > 0);
  if (matrix.length === 0) return '';

  const width = matrix.reduce((max, cells) => Math.max(max, cells.length), 0);
  const pad = (cells: string[]) => {
    const next = cells.slice(0, width);
    while (next.length < width) next.push('');
    return next;
  };

  const [head, ...body] = matrix;
  return [
    `| ${pad(head).join(' | ')} |`,
    `| ${Array.from({ length: width }, () => '---').join(' | ')} |`,
    ...body.map((cells) => `| ${pad(cells).join(' | ')} |`),
  ].join('\n');
}

function renderBlocks(body: Element, ctx: DocxContext): string[] {
  const blocks: string[] = [];

  for (const element of elements(body)) {
    switch (element.localName) {
      case 'p': {
        const block = renderParagraph(element, ctx);
        if (block) blocks.push(block);
        break;
      }
      case 'tbl': {
        const table = renderTable(element, ctx);
        if (table) blocks.push(table);
        break;
      }
      case 'sdt':
      case 'sdtContent': {
        blocks.push(...renderBlocks(element, ctx));
        break;
      }
      default:
        break;
    }
  }

  return blocks;
}

const BULLET_ITEM_PATTERN = /^\s*[-*+]\s/;
const ORDERED_ITEM_PATTERN = /^\s*\d+\.\s/;

function listKind(block: string): 'bullet' | 'ordered' | null {
  if (BULLET_ITEM_PATTERN.test(block)) return 'bullet';
  if (ORDERED_ITEM_PATTERN.test(block)) return 'ordered';
  return null;
}

/**
 * 相邻的同类列表项之间只留一个换行。
 *
 * 每项之间插空行会让 Markdown 变成「松散列表」，渲染时段落间距被撑开，
 * 与 Word 里的紧凑列表观感不一致；跨列表（项目符号 ↔ 编号）仍要留空行，
 * 否则会被合并成同一个列表。
 */
function joinBlocks(blocks: string[]): string {
  let output = '';
  blocks.forEach((block, index) => {
    if (index === 0) {
      output = block;
      return;
    }

    const previousKind = listKind(blocks[index - 1]);
    const currentKind = listKind(block);
    const tight = previousKind !== null && previousKind === currentKind;
    output += `${tight ? '\n' : '\n\n'}${block}`;
  });
  return output;
}

/**
 * Word（.docx）转 Markdown。
 *
 * 只覆盖正文语义：标题、加粗/斜体/删除线、列表、表格、链接、内嵌图片。
 * 版式信息（字号、颜色、页边距、文本框）不转换——Markdown 表达不了，硬塞
 * 只会让文稿变成一堆无法维护的内联 HTML。
 */
export function importDocxAsMarkdown(bytes: Uint8Array): ImportConversionResult {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes) as Record<string, Uint8Array>;
  } catch {
    throw new Error('这个 .docx 文件读不出来，可能已损坏或被加密。');
  }

  const documentBytes = files['word/document.xml'];
  if (!documentBytes) {
    return { assets: [], markdown: '', warnings: ['文件里没有正文，可能不是 Word 文档。'] };
  }

  const document = parseXml(decodeXml(documentBytes));
  const body = document ? child(document.documentElement, 'body') : null;
  if (!body) {
    throw new Error('这个 .docx 的正文结构无法解析。');
  }

  const ctx: DocxContext = {
    assetNames: new Map(),
    assets: [],
    counters: new Map(),
    files,
    images: new Map(),
    links: new Map(),
    numbering: new Map(),
    warnings: [],
  };

  parseRelationships(files['word/_rels/document.xml.rels'] ? decodeXml(files['word/_rels/document.xml.rels']) : undefined, ctx);
  parseNumbering(files['word/numbering.xml'] ? decodeXml(files['word/numbering.xml']) : undefined, ctx);

  const markdown = joinBlocks(renderBlocks(body, ctx))
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return { assets: ctx.assets, markdown, warnings: ctx.warnings };
}
