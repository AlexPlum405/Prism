/**
 * 行内内容转 docx run：文本、加粗/斜体/删除线、行内代码、脚注、图片，
 * 以及 Markdown 里混进来的 <mark>/<kbd>/<abbr> 三种 HTML 行内标签。
 *
 * 这一层刻意只产出 run 数组，不碰段落与分页——段落级的事在 docxBlocks 里，
 * 因为 docx 的段落属性（缩进、间距、编号）与行内样式互不影响。
 */
import { t } from '../../i18n/runtime';
import type { ExportDocumentInput } from '../types';
import type { DocxTheme } from '../exportSettings';
import type { TextRun as DocxTextRun } from 'docx';
import {
  createDocxImageRun,
  rasterizeLinkedDocxImage,
  renderMarkdownImage,
  type DocxBlock,
  type DocxInline,
  type DocxModule,
} from './docxImage';
import { renderDocxMathImage } from './docxVisualBlock';

export type RunStyle = Record<string, any>;
export type DocxInlineHtmlTagName = 'mark' | 'kbd' | 'abbr';
export type DocxInlineHtmlToken =
  | { kind: 'open'; tag: DocxInlineHtmlTagName }
  | { kind: 'close'; tag: DocxInlineHtmlTagName }
  | { kind: 'break' };

export const DOCX_INLINE_HTML_TAGS = new Set(['mark', 'kbd', 'abbr']);

export function normalizeDocxText(value: string) {
  return value.replace(/[\uFE0E\uFE0F]/g, '');
}

export function splitMarkedText(docx: DocxModule, value: string, base: RunStyle = {}) {
  const { ShadingType, TextRun } = docx;
  const runs: DocxTextRun[] = [];
  const pattern = /==([^=\n]+)==/g;
  const normalizedValue = normalizeDocxText(value);
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(normalizedValue)) !== null) {
    if (match.index > lastIndex) {
      runs.push(new TextRun({ ...base, text: normalizedValue.slice(lastIndex, match.index) }));
    }
    runs.push(new TextRun({
      ...base,
      text: match[1],
      shading: { type: ShadingType.CLEAR, fill: 'FFF3A3' },
    }));
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < normalizedValue.length) {
    runs.push(new TextRun({ ...base, text: normalizedValue.slice(lastIndex) }));
  }
  return runs.length > 0 ? runs : [new TextRun({ ...base, text: normalizedValue })];
}

export function parseDocxInlineHtmlToken(value: string): DocxInlineHtmlToken | null {
  const trimmed = value.trim();
  if (/^<\s*br\s*\/?\s*>$/i.test(trimmed)) return { kind: 'break' };

  const closeMatch = trimmed.match(/^<\s*\/\s*([a-z][\w:-]*)\s*>$/i);
  if (closeMatch) {
    const tag = closeMatch[1].toLowerCase();
    return DOCX_INLINE_HTML_TAGS.has(tag) ? { kind: 'close', tag: tag as DocxInlineHtmlTagName } : null;
  }

  const openMatch = trimmed.match(/^<\s*([a-z][\w:-]*)(?:\s[^>]*)?>$/i);
  if (openMatch) {
    const tag = openMatch[1].toLowerCase();
    return DOCX_INLINE_HTML_TAGS.has(tag) ? { kind: 'open', tag: tag as DocxInlineHtmlTagName } : null;
  }

  return null;
}

export function stripInlineHtmlTag(value: string) {
  return value.replace(/<[^>]*>/g, '');
}

export function applyDocxInlineHtmlStyle(docx: DocxModule, theme: DocxTheme, tag: DocxInlineHtmlTagName, style: RunStyle) {
  const { BorderStyle, ShadingType, UnderlineType } = docx;
  if (tag === 'mark') {
    return {
      ...style,
      shading: { type: ShadingType.CLEAR, fill: 'FFF3A3' },
    };
  }

  if (tag === 'kbd') {
    return {
      ...style,
      font: theme.codeFont,
      color: theme.text,
      shading: { type: ShadingType.CLEAR, fill: theme.fill },
      border: { style: BorderStyle.SINGLE, size: 2, color: theme.border, space: 1 },
      noProof: true,
    };
  }

  return {
    ...style,
    underline: { type: UnderlineType.DOTTED, color: theme.muted },
    noProof: true,
  };
}

export function composeDocxInlineHtmlStyle(
  docx: DocxModule,
  theme: DocxTheme,
  base: RunStyle,
  stack: DocxInlineHtmlTagName[],
) {
  return stack.reduce((current, tag) => applyDocxInlineHtmlStyle(docx, theme, tag, current), { ...base });
}


export async function inlineChildrenToRuns(
  docx: DocxModule,
  children: any[],
  theme: DocxTheme,
  style: RunStyle = {},
  input?: ExportDocumentInput,
  imageScale = 2,
): Promise<DocxInline[]> {
  const { TextRun } = docx;
  const runs: DocxInline[] = [];
  const htmlStack: DocxInlineHtmlTagName[] = [];

  for (const child of children) {
    if (child?.type === 'html') {
      const value = String(child.value ?? '');
      const token = parseDocxInlineHtmlToken(value);
      if (token?.kind === 'break') {
        runs.push(new TextRun({ text: '', break: 1 }));
        continue;
      }
      if (token?.kind === 'open') {
        htmlStack.push(token.tag);
        continue;
      }
      if (token?.kind === 'close') {
        const index = htmlStack.lastIndexOf(token.tag);
        if (index >= 0) htmlStack.splice(index, 1);
        continue;
      }

      const fallback = stripInlineHtmlTag(value);
      if (fallback) {
        runs.push(...splitMarkedText(docx, fallback, composeDocxInlineHtmlStyle(docx, theme, style, htmlStack)));
      }
      continue;
    }

    runs.push(...await inlineToRuns(
      docx,
      child,
      theme,
      composeDocxInlineHtmlStyle(docx, theme, style, htmlStack),
      input,
      imageScale,
    ));
  }

  return runs;
}

export async function inlineToRuns(
  docx: DocxModule,
  node: any,
  theme: DocxTheme,
  style: RunStyle = {},
  input?: ExportDocumentInput,
  imageScale = 2,
): Promise<DocxInline[]> {
  const { ShadingType, TextRun, UnderlineType } = docx;
  if (!node) return [];
  if (node.type === 'text') return splitMarkedText(docx, node.value ?? '', style);
  if (node.type === 'break') return [new TextRun({ text: '', break: 1 })];
  if (node.type === 'inlineMath') {
    const source = String(node.value ?? '');
    const image = input ? await renderDocxMathImage(input, source, false, imageScale) : null;
    if (image) {
      return [createDocxImageRun(docx, image, {
        title: 'Inline math',
        description: source,
        name: 'Inline math',
      })];
    }
    return [new TextRun({
      ...style,
      text: `$${source}$`,
      font: theme.codeFont,
      color: theme.accent,
    })];
  }
  if (node.type === 'inlineCode') {
    return [new TextRun({
      ...style,
      text: node.value ?? '',
      font: theme.codeFont,
      color: theme.accent,
      shading: { type: ShadingType.CLEAR, fill: theme.fill },
    })];
  }
  if (node.type === 'strong') {
    return inlineChildrenToRuns(docx, node.children ?? [], theme, { ...style, bold: true }, input, imageScale);
  }
  if (node.type === 'emphasis') {
    return inlineChildrenToRuns(docx, node.children ?? [], theme, { ...style, italics: true }, input, imageScale);
  }
  if (node.type === 'delete') {
    return inlineChildrenToRuns(docx, node.children ?? [], theme, { ...style, strike: true }, input, imageScale);
  }
  if (node.type === 'link') {
    const url = String(node.url ?? '');
    const nested: any[] = [];
    let pendingInline: any[] = [];
    const flushInline = async () => {
      if (pendingInline.length === 0) return;
      nested.push(...await inlineChildrenToRuns(docx, pendingInline, theme, {
        ...style,
        color: theme.accent,
        underline: { type: UnderlineType.SINGLE },
      }, input, imageScale));
      pendingInline = [];
    };

    for (const child of (node.children ?? [])) {
      if (child?.type === 'image') {
        await flushInline();
        const image = await renderMarkdownImage(String(child.url ?? ''), input?.documentPath, imageScale);
        if (image) {
          const alt = String(child.alt || child.title || 'Markdown image');
          nested.push(createDocxImageRun(docx, rasterizeLinkedDocxImage(image), { title: alt, description: alt, name: alt }));
          continue;
        }
        const fallback = String(child.alt || child.title || child.url || t('export.fallback.imageUnavailable'));
        nested.push(...splitMarkedText(docx, fallback, { ...style, italics: true, color: theme.muted }));
        continue;
      }
      pendingInline.push(child);
    }
    await flushInline();
    if (url && /^https?:\/\//i.test(url)) {
      const { ExternalHyperlink } = docx as any;
      if (ExternalHyperlink) {
        return [new ExternalHyperlink({ link: url, children: nested })];
      }
    }
    return nested;
  }
  if (node.type === 'image') {
    const label = String(node.alt || node.title || node.url || '');
    return label ? splitMarkedText(docx, label, { ...style, italics: true, color: theme.muted }) : [];
  }
  if (node.type === 'html') {
    const value = String(node.value ?? '');
    const token = parseDocxInlineHtmlToken(value);
    if (token?.kind === 'break') return [new TextRun({ text: '', break: 1 })];
    if (token?.kind === 'open' || token?.kind === 'close') return [];
    const fallback = stripInlineHtmlTag(value);
    return fallback ? splitMarkedText(docx, fallback, style) : [];
  }
  if (node.value && typeof node.value === 'string') return splitMarkedText(docx, node.value, style);
  return inlineChildrenToRuns(docx, node.children ?? [], theme, style, input, imageScale);
}

export async function paragraphFromInlineChildren(
  docx: DocxModule,
  children: any[],
  theme: DocxTheme,
  style: RunStyle = {},
  input?: ExportDocumentInput,
  imageScale = 2,
) {
  const { Paragraph } = docx;
  return new Paragraph({
    children: await inlineChildrenToRuns(docx, children, theme, style, input, imageScale),
    spacing: { after: 180, line: 330 },
  });
}

export async function paragraphBlocksFromInlineChildren(
  docx: DocxModule,
  children: any[],
  theme: DocxTheme,
  documentPath?: string,
  imageScale = 2,
  input?: ExportDocumentInput,
) {
  const { AlignmentType, Paragraph, TextRun } = docx;
  if (!children.some((child) => child?.type === 'image')) {
    return [await paragraphFromInlineChildren(docx, children, theme, {}, input, imageScale)];
  }

  const blocks: DocxBlock[] = [];
  let pendingInline: any[] = [];
  const flushInline = async () => {
    if (pendingInline.length === 0) return;
    blocks.push(await paragraphFromInlineChildren(docx, pendingInline, theme, {}, input, imageScale));
    pendingInline = [];
  };

  for (const child of children) {
    if (child?.type !== 'image') {
      pendingInline.push(child);
      continue;
    }

    await flushInline();
    const image = await renderMarkdownImage(String(child.url ?? ''), documentPath, imageScale);
    if (!image) {
      const fallback = String(child.alt || child.title || child.url || t('export.fallback.imageUnavailable'));
      blocks.push(new Paragraph({
        children: [new TextRun({ text: fallback, italics: true, color: theme.muted })],
        spacing: { after: 180, line: 330 },
      }));
      continue;
    }

    const alt = String(child.alt || child.title || 'Markdown image');
    blocks.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 120, after: 220 },
      children: [
        createDocxImageRun(docx, image, {
          title: alt,
          description: alt,
          name: alt,
        }),
      ],
    }));
  }

  await flushInline();
  return blocks;
}

export function isInlineMdastNode(node: any) {
  return [
    'text',
    'emphasis',
    'strong',
    'delete',
    'inlineCode',
    'inlineMath',
    'link',
    'break',
    'html',
    'image',
  ].includes(node?.type);
}
