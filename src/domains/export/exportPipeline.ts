import { writeFile, writeTextFile } from '../../platform/tauri/fileSystem';
import { readCustomFontBytes } from '../settings/fontService';
import type {
  Paragraph as DocxParagraph,
  TextRun as DocxTextRun,
} from 'docx';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import { applyCalloutMetadataToMdastBlockquote } from '../editor/extensions/callouts';
import type { ContentTheme } from '../settings/types';
import { t } from '../i18n/runtime';
import type { ExportDocumentInput } from './types';
import {
  getDocxThemeByContentTheme,
  type DocxTheme,
} from './exportSettings';
import {
  buildExportTocItemsFromMdast,
  type ExportTocItem,
} from './toc';
import {
  exportProgressMessages,
  getExportOutputPath,
  normalizeExportRasterScale,
  reportProgress,
  reportWarning,
} from './pipeline/exportPipelineContext';
import {
  canvasToPngBytes,
} from './assets';
import {
  markExportAtomicBlocks,
  prepareExportAtomicPagination,
} from './pagination';
import { buildStandaloneHtml } from './render/standaloneHtml';
import {
  assertExportCanvasWithinLimits,
  isExportCanvasWithinLimits,
} from './render/canvasLimits';
import {
  DOCX_MERMAID_IMAGE_MAX_HEIGHT,
  DOCX_MERMAID_IMAGE_MAX_WIDTH,
} from './exportConstants';
import { createSlicedRenderedPng } from './png/pngAssembly';
import {
  renderPandocCitationHtml,
  reportCitationPlaceholderWarning,
} from './citations/pandocCitation';
export { exportPdf } from './pdf/pdfExport';
import {
  createRenderedExportNode,
  createStandaloneExportFrame,
  measureRenderedExportBounds,
} from './render/exportNode';
import {
  normalizeDocxDrawingCompatibility,
  renderDocxHtmlBlockImage,
  renderDocxMathImage,
} from './docx/docxVisualBlock';
import {
  normalizePlantUmlSvg,
  rasterizePlantUmlSvgsForCapture,
} from './diagrams/svgDocument';
import {
  buildHeaderFooterTextParts,
  formatPdfHeaderFooterText,
  getPdfFooterY,
  getPdfHeaderY,
  getPdfPageNumberLabel,
  getPdfPageNumberY,
  hasHeaderFooterPageToken,
  normalizePdfChromeText,
  type HeaderFooterTextPart,
} from './pdf/pdfChromeText';
import {
  docxPageMarginsTwips,
  docxPageSizeTwips,
  getDocxContentWidthTwips,
} from './exportPageLayout';
import {
  nextExportFrame as nextFrame,
  normalizeCssColorFunctionsForRaster,
  normalizeRasterComputedColors,
  stripRasterUnsafeColorDeclarations,
} from './rendering';

import {
  constrainDocxImageSize,
  createDocxImageRun,
  rasterizeLinkedDocxImage,
  renderMarkdownImage,
  renderMarkmapImage,
  renderMermaidImage,
  renderPlantUmlImage,
  type DocxBlock,
  type DocxInline,
  type DocxModule,
} from './docx/docxImage';


function isMermaidSource(value: string, lang?: string | null) {
  const normalizedLang = (lang ?? '').trim().toLowerCase();
  if (normalizedLang === 'mermaid' || normalizedLang === 'mmd') return true;
  const source = value.trimStart();
  return /^(graph|flowchart|sequenceDiagram|classDiagram|stateDiagram|erDiagram|journey|gantt|pie|mindmap|timeline|quadrantChart|requirementDiagram|gitGraph|C4Context)\b/.test(source);
}

function normalizeDiagramLanguage(language: unknown) {
  return String(language ?? '').trim().toLowerCase().replace(/[\s_-]+/g, '');
}

function isPlantUmlSource(value: string, lang?: string | null) {
  const normalizedLang = normalizeDiagramLanguage(lang);
  if (normalizedLang === 'plantuml' || normalizedLang === 'puml') return true;
  return /^\s*@startuml\b/i.test(value);
}

function isMarkmapSource(value: string, lang?: string | null) {
  const normalizedLang = normalizeDiagramLanguage(lang);
  if (normalizedLang === 'markmap') return true;
  return normalizedLang === 'mindmap'
    && /^\s{0,3}(?:#{1,6}\s+\S|[-+*]\s+\S|\d+[.)]\s+\S)/m.test(value);
}


export async function exportHtml(input: ExportDocumentInput, outputPath?: string) {
  const targetPath = await getExportOutputPath(outputPath);
  if (!targetPath) return false;

  const pandocCitation = await renderPandocCitationHtml(input);
  if (!pandocCitation.attempted) reportCitationPlaceholderWarning(input, 'html');
  const node = await createRenderedExportNode(input, { html: pandocCitation.html });
  try {
    reportProgress(input, exportProgressMessages.generateFile('HTML'));
    const html = await buildStandaloneHtml(input, node, {
      includeTheme: input.htmlIncludeTheme !== false,
    });
    reportProgress(input, exportProgressMessages.writeFile('HTML'));
    await writeTextFile(targetPath, html);
  } finally {
    node.remove();
  }
  return true;
}

async function createRenderedPng(input: ExportDocumentInput, options: { scale?: number } = {}) {
  const { default: html2canvas } = await import('html2canvas');
  const iframe = await createStandaloneExportFrame(input);
  try {
    const frameDocument = iframe.contentDocument;
    const target = frameDocument?.querySelector<HTMLElement>('.prism-export-document');
    if (!frameDocument || !target) throw new Error(t('export.error.contentRenderFailed'));

    await rasterizePlantUmlSvgsForCapture(target);
    const bounds = measureRenderedExportBounds(target, frameDocument);
    const { height, width } = bounds;
    iframe.style.width = `${width}px`;
    iframe.style.height = `${height}px`;
    await nextFrame();
    normalizeRasterComputedColors(target);

    const requestedScale = normalizeExportRasterScale(options.scale);
    const backgroundColor = normalizeCssColorFunctionsForRaster(getComputedStyle(target).backgroundColor) || '#ffffff';
    if (!isExportCanvasWithinLimits(width, height, requestedScale)) {
      return await createSlicedRenderedPng(html2canvas, target, {
        backgroundColor,
        width,
        height,
        scale: requestedScale,
      });
    }

    assertExportCanvasWithinLimits(width, height, requestedScale, t('export.label.pngExport'));
    const canvas = await html2canvas(target, {
      backgroundColor,
      scale: requestedScale,
      useCORS: true,
      logging: false,
      width,
      height,
      windowWidth: width,
      windowHeight: height,
      scrollX: 0,
      scrollY: 0,
    });
    return {
      data: await canvasToPngBytes(
        canvas,
        t('export.error.exportCanvasLimit', {
          width: Math.ceil(width * requestedScale),
          height: Math.ceil(height * requestedScale),
        }),
      ),
      width: canvas.width || Math.ceil(width * requestedScale),
      height: canvas.height || Math.ceil(height * requestedScale),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : err instanceof Event ? err.type : String(err);
    throw new Error(t('export.error.imageRenderFailed', { message }));
  } finally {
    iframe.remove();
  }
}

export async function exportPng(input: ExportDocumentInput, outputPath?: string) {
  const targetPath = await getExportOutputPath(outputPath);
  if (!targetPath) return false;

  reportCitationPlaceholderWarning(input);
  const image = await createRenderedPng(input, { scale: input.pngScale });
  reportProgress(input, exportProgressMessages.generateFile('PNG'));
  reportProgress(input, exportProgressMessages.writeFile('PNG'));
  await writeFile(targetPath, image.data);
  return true;
}

type RunStyle = Record<string, any>;
type DocxInlineHtmlTagName = 'mark' | 'kbd' | 'abbr';
type DocxInlineHtmlToken =
  | { kind: 'open'; tag: DocxInlineHtmlTagName }
  | { kind: 'close'; tag: DocxInlineHtmlTagName }
  | { kind: 'break' };

const DOCX_INLINE_HTML_TAGS = new Set(['mark', 'kbd', 'abbr']);

function normalizeDocxText(value: string) {
  return value.replace(/[\uFE0E\uFE0F]/g, '');
}

function splitMarkedText(docx: DocxModule, value: string, base: RunStyle = {}) {
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

function parseDocxInlineHtmlToken(value: string): DocxInlineHtmlToken | null {
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

function stripInlineHtmlTag(value: string) {
  return value.replace(/<[^>]*>/g, '');
}

function applyDocxInlineHtmlStyle(docx: DocxModule, theme: DocxTheme, tag: DocxInlineHtmlTagName, style: RunStyle) {
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

function composeDocxInlineHtmlStyle(
  docx: DocxModule,
  theme: DocxTheme,
  base: RunStyle,
  stack: DocxInlineHtmlTagName[],
) {
  return stack.reduce((current, tag) => applyDocxInlineHtmlStyle(docx, theme, tag, current), { ...base });
}


async function inlineChildrenToRuns(
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

async function inlineToRuns(
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

async function paragraphFromInlineChildren(
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

async function paragraphBlocksFromInlineChildren(
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

function isInlineMdastNode(node: any) {
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

async function tableCellToDocxBlocks(
  docx: DocxModule,
  children: any[],
  theme: DocxTheme,
  contentTheme: ContentTheme,
  isHeader: boolean,
  documentPath?: string,
  imageScale = 2,
  input?: ExportDocumentInput,
) {
  const { Paragraph, TextRun } = docx;
  if (children.length === 0) {
    return [new Paragraph({ children: [new TextRun('')], spacing: { before: 0, after: 0 } })];
  }

  if (children.every(isInlineMdastNode)) {
    return [
      new Paragraph({
        children: await inlineChildrenToRuns(docx, children, theme, { bold: isHeader }, input, imageScale),
        spacing: { before: 0, after: 0, line: 300 },
      }),
    ];
  }

  const blocks = await mdastToDocxBlocks(docx, children, theme, contentTheme, 0, documentPath, imageScale, input);
  return blocks.length > 0 ? blocks : [new Paragraph('')];
}

function codeBlockToDocxTable(docx: DocxModule, value: string, theme: DocxTheme, input?: ExportDocumentInput) {
  const {
    AlignmentType,
    BorderStyle,
    Paragraph,
    ShadingType,
    Table,
    TableCell,
    TableLayoutType,
    TableRow,
    TextRun,
    VerticalAlignTable,
    WidthType,
  } = docx;
  const lines = String(value ?? '').replace(/\t/g, '  ').split('\n');
  const tableWidth = getDocxContentWidthTwips(input);
  return new Table({
    width: { size: tableWidth, type: WidthType.DXA },
    columnWidths: [tableWidth],
    layout: TableLayoutType.FIXED,
    borders: {
      top: { style: BorderStyle.SINGLE, size: 4, color: theme.border },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: theme.border },
      left: { style: BorderStyle.SINGLE, size: 4, color: theme.border },
      right: { style: BorderStyle.SINGLE, size: 4, color: theme.border },
      insideHorizontal: { style: BorderStyle.NONE, size: 0, color: theme.fill },
      insideVertical: { style: BorderStyle.NONE, size: 0, color: theme.fill },
    },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: tableWidth, type: WidthType.DXA },
            shading: { type: ShadingType.CLEAR, fill: theme.fill },
            margins: { top: 140, bottom: 140, left: 160, right: 160 },
            verticalAlign: VerticalAlignTable.TOP,
            children: [
              new Paragraph({
                alignment: AlignmentType.LEFT,
                spacing: { before: 0, after: 0, line: 250 },
                children: lines.flatMap((line, index) => [
                  new TextRun({
                    text: line.length > 0 ? line : ' ',
                    font: theme.codeFont,
                    size: 18,
                    noProof: true,
                    break: index === 0 ? 0 : 1,
                  }),
                ]),
              }),
            ],
          }),
        ],
      }),
    ],
  });
}

function stripHtmlTagsToText(source: string) {
  return source.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function htmlNodeOpensDetails(node: any) {
  return node.type === 'html' && /^<\s*details\b/i.test(String(node.value ?? '').trim());
}

function htmlNodeClosesDetails(node: any) {
  return node.type === 'html' && /^<\s*\/\s*details\s*>/i.test(String(node.value ?? '').trim());
}

function extractSummaryTextFromHtmlNode(node: any) {
  if (node.type !== 'html') return null;
  const source = String(node.value ?? '');
  const match = source.match(/<\s*summary\b[^>]*>([\s\S]*?)<\s*\/\s*summary\s*>/i);
  return match ? stripHtmlTagsToText(match[1]) : null;
}

function normalizeDetailsNodesForDocx(nodes: any[]): any[] {
  const normalized: any[] = [];

  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes[index];
    if (!htmlNodeOpensDetails(node)) {
      normalized.push(node);
      continue;
    }

    const children: any[] = [];
    let summary = extractSummaryTextFromHtmlNode(node) ?? t('export.fallback.details');

    for (index += 1; index < nodes.length; index += 1) {
      const child = nodes[index];
      const childSummary = extractSummaryTextFromHtmlNode(child);
      if (childSummary) {
        summary = childSummary;
        continue;
      }
      if (htmlNodeClosesDetails(child)) {
        break;
      }
      if (child.type === 'html') continue;
      children.push(child);
    }

    normalized.push({
      type: 'prismDetails',
      title: summary,
      children,
      data: node.data,
    });
  }

  return normalized;
}

function createDocxTocBlocks(docx: DocxModule, items: ExportTocItem[], theme: DocxTheme): DocxBlock[] {
  if (items.length === 0) return [];
  const { BorderStyle, Paragraph, TextRun } = docx;
  return [
    new Paragraph({
      children: [new TextRun({
        text: t('export.toc'),
        color: theme.accent,
        size: 22,
        bold: true,
      })],
      border: {
        bottom: { style: BorderStyle.SINGLE, size: 4, color: theme.border },
      },
      spacing: { before: 0, after: 160 },
    }),
    ...items.map((item) => new Paragraph({
      children: [new TextRun({
        text: item.text,
        color: theme.text,
        size: 22,
      })],
      indent: { left: Math.max(0, item.level - 1) * 240 },
      spacing: { before: 0, after: 80, line: 300 },
    })),
    new Paragraph({
      children: [new TextRun({ text: '' })],
      spacing: { before: 0, after: 180 },
    }),
  ];
}

function createDocxHeaderFooterRuns(
  docx: DocxModule,
  parts: HeaderFooterTextPart[],
  theme: DocxTheme,
): DocxTextRun[] {
  const { PageNumber, TextRun } = docx;
  return parts.map((part) => {
    const base = {
      color: '737373',
      font: theme.font,
      size: 18,
    };
    if (part.type === 'page') {
      return new TextRun({ ...base, children: [PageNumber.CURRENT] });
    }
    if (part.type === 'pages') {
      return new TextRun({ ...base, children: [PageNumber.TOTAL_PAGES] });
    }
    return new TextRun({ ...base, text: normalizeDocxText(part.value) });
  });
}

function createDocxHeaderFooter(docx: DocxModule, input: ExportDocumentInput, theme: DocxTheme) {
  const { AlignmentType, Footer, Header, Paragraph, TextRun } = docx;
  const headerParts = input.pageHeaderFooter
    ? buildHeaderFooterTextParts(input.pageHeaderText, input)
    : [];
  const footerParts = input.pageHeaderFooter
    ? buildHeaderFooterTextParts(input.pageFooterText, input)
    : [];
  const footerHasPageToken = input.pageHeaderFooter && hasHeaderFooterPageToken(input.pageFooterText);
  const footerParagraphs: DocxParagraph[] = [];
  const header = headerParts.length > 0
    ? new Header({
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: createDocxHeaderFooterRuns(docx, headerParts, theme),
            spacing: { after: 80 },
          }),
        ],
      })
    : undefined;

  if (footerParts.length > 0) {
    footerParagraphs.push(new Paragraph({
      alignment: AlignmentType.LEFT,
      children: createDocxHeaderFooterRuns(docx, footerParts, theme),
      spacing: { before: 80, after: 0 },
    }));
  }

  if (input.pdfPageNumbers && !footerHasPageToken) {
    footerParagraphs.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({ color: '737373', font: theme.font, size: 18, children: [docx.PageNumber.CURRENT] }),
        new TextRun({ color: '737373', font: theme.font, size: 18, text: ' / ' }),
        new TextRun({ color: '737373', font: theme.font, size: 18, children: [docx.PageNumber.TOTAL_PAGES] }),
      ],
      spacing: { before: footerParts.length > 0 ? 40 : 80, after: 0 },
    }));
  }

  return {
    header,
    footer: footerParagraphs.length > 0
      ? new Footer({ children: footerParagraphs })
      : undefined,
  };
}

function getDocxListMarker(node: any, item: any, index: number) {
  if (typeof item.checked === 'boolean') {
    return item.checked ? '☑ ' : '☐ ';
  }

  return node.ordered ? `${(node.start ?? 1) + index}. ` : '• ';
}

async function mdastToDocxBlocks(
  docx: DocxModule,
  nodes: any[],
  theme: DocxTheme,
  contentTheme: ContentTheme,
  listDepth = 0,
  documentPath?: string,
  imageScale = 2,
  input?: ExportDocumentInput,
): Promise<DocxBlock[]> {
  const {
    AlignmentType,
    BorderStyle,
    HeadingLevel,
    Paragraph,
    ShadingType,
    Table,
    TableCell,
    TableLayoutType,
    TableRow,
    TextRun,
    VerticalAlignTable,
    WidthType,
  } = docx;
  const blocks: DocxBlock[] = [];

  for (const node of normalizeDetailsNodesForDocx(nodes)) {
    if (node.type === 'heading') {
      const level = Math.min(Math.max(node.depth ?? 1, 1), 6);
      blocks.push(new Paragraph({
        heading: [
          HeadingLevel.HEADING_1,
          HeadingLevel.HEADING_2,
          HeadingLevel.HEADING_3,
          HeadingLevel.HEADING_4,
          HeadingLevel.HEADING_5,
          HeadingLevel.HEADING_6,
        ][level - 1],
        children: await inlineChildrenToRuns(docx, node.children ?? [], theme, {}, input, imageScale),
        spacing: { before: level <= 2 ? 360 : 260, after: 160 },
      }));
      continue;
    }

    if (node.type === 'paragraph') {
      blocks.push(...await paragraphBlocksFromInlineChildren(docx, node.children ?? [], theme, documentPath, imageScale, input));
      continue;
    }

    if (node.type === 'blockquote') {
      const callout = applyCalloutMetadataToMdastBlockquote(node);
      const textRuns = (await Promise.all((node.children ?? []).map(async (child: any) => {
        if (child.type === 'paragraph') {
          return inlineChildrenToRuns(docx, child.children ?? [], theme, {}, input, imageScale);
        }
        return inlineToRuns(docx, child, theme, {}, input, imageScale);
      }))).flat();
      blocks.push(new Paragraph({
        children: callout
          ? [
              new TextRun({ text: `${callout.title}: `, bold: true, color: theme.accent }),
              ...textRuns,
            ]
          : textRuns,
        indent: { left: 360 },
        border: {
          left: { style: BorderStyle.SINGLE, size: 12, color: theme.accent, space: 12 },
        },
        shading: { type: ShadingType.CLEAR, fill: theme.fill },
        spacing: { before: 120, after: 180, line: 330 },
      }));
      continue;
    }

    if (node.type === 'prismDetails') {
      blocks.push(new Paragraph({
        children: [
          new TextRun({
            text: t('export.fallback.detailsPrefix', { title: String(node.title ?? t('export.fallback.details')) }),
            bold: true,
            color: theme.accent,
          }),
        ],
        indent: { left: 240 },
        border: {
          left: { style: BorderStyle.SINGLE, size: 8, color: theme.border, space: 12 },
        },
        shading: { type: ShadingType.CLEAR, fill: theme.fill },
        spacing: { before: 120, after: 100, line: 330 },
      }));
      blocks.push(...await mdastToDocxBlocks(
        docx,
        node.children ?? [],
        theme,
        contentTheme,
        listDepth,
        documentPath,
        imageScale,
        input,
      ));
      continue;
    }

    if (node.type === 'code') {
      if (isMermaidSource(String(node.value ?? ''), node.lang)) {
        const image = await renderMermaidImage(String(node.value ?? ''), contentTheme, imageScale);
        if (image) {
          blocks.push(new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 180, after: 220 },
            children: [
              createDocxImageRun(docx, image, {
                title: 'Mermaid diagram',
                description: 'Mermaid diagram exported from Prism',
                name: 'Mermaid diagram',
              }, { maxWidth: DOCX_MERMAID_IMAGE_MAX_WIDTH, maxHeight: DOCX_MERMAID_IMAGE_MAX_HEIGHT }),
            ],
          }));
          continue;
        }

        blocks.push(new Paragraph({
          children: [
            new TextRun({
              text: t('export.fallback.mermaidFailed'),
              color: theme.accent,
              italics: true,
            }),
          ],
          spacing: { before: 120, after: 160 },
        }));
        continue;
      }

      if (isMarkmapSource(String(node.value ?? ''), node.lang)) {
        const image = await renderMarkmapImage(String(node.value ?? ''), contentTheme, imageScale);
        if (image) {
          blocks.push(new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 180, after: 220 },
            children: [
              createDocxImageRun(docx, image, {
                title: 'Markmap diagram',
                description: 'Markmap diagram exported from Prism',
                name: 'Markmap diagram',
              }, { maxWidth: DOCX_MERMAID_IMAGE_MAX_WIDTH, maxHeight: DOCX_MERMAID_IMAGE_MAX_HEIGHT }),
            ],
          }));
          continue;
        }

        blocks.push(new Paragraph({
          children: [
            new TextRun({
              text: t('export.fallback.markmapFailed'),
              color: theme.accent,
              italics: true,
            }),
          ],
          spacing: { before: 120, after: 160 },
        }));
        continue;
      }

      if (isPlantUmlSource(String(node.value ?? ''), node.lang)) {
        const image = await renderPlantUmlImage(String(node.value ?? ''), contentTheme, input, imageScale);
        if (image) {
          blocks.push(new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 180, after: 220 },
            children: [
              createDocxImageRun(docx, image, {
                title: 'PlantUML diagram',
                description: 'PlantUML diagram exported from Prism',
                name: 'PlantUML diagram',
              }, { maxWidth: DOCX_MERMAID_IMAGE_MAX_WIDTH, maxHeight: DOCX_MERMAID_IMAGE_MAX_HEIGHT }),
            ],
          }));
          continue;
        }

        blocks.push(new Paragraph({
          children: [
            new TextRun({
              text: t('export.fallback.plantUmlFailed'),
              color: theme.accent,
              italics: true,
            }),
          ],
          spacing: { before: 120, after: 160 },
        }));
        continue;
      }

      blocks.push(codeBlockToDocxTable(docx, node.value ?? '', theme, input));
      continue;
    }

    if (node.type === 'math') {
      const source = String(node.value ?? '');
      const image = input ? await renderDocxMathImage(input, source, true, imageScale) : null;
      if (image) {
        blocks.push(new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 180, after: 220 },
          children: [
            createDocxImageRun(docx, image, {
              title: 'Math formula',
              description: source,
              name: 'Math formula',
            }),
          ],
        }));
      } else {
        blocks.push(new Paragraph({
          children: [new TextRun({
            text: `$$ ${source} $$`,
            font: theme.codeFont,
            color: theme.accent,
          })],
          spacing: { before: 120, after: 160 },
        }));
      }
      continue;
    }

    if (node.type === 'list') {
      for (const [index, item] of (node.children ?? []).entries()) {
        const marker = getDocxListMarker(node, item, index);
        const paragraphChild = (item.children ?? []).find((child: any) => child.type === 'paragraph');
        const runs = paragraphChild
          ? await inlineChildrenToRuns(docx, paragraphChild.children ?? [], theme, {}, input, imageScale)
          : [];
        blocks.push(new Paragraph({
          children: [new TextRun({ text: marker, color: theme.accent }), ...runs],
          indent: { left: 360 + listDepth * 240, hanging: 240 },
          spacing: { after: 100, line: 330 },
        }));
        const nested = (item.children ?? []).filter((child: any) => child.type !== 'paragraph');
        blocks.push(...await mdastToDocxBlocks(docx, nested, theme, contentTheme, listDepth + 1, documentPath, imageScale, input));
      }
      continue;
    }

    if (node.type === 'table') {
      const rows = [];
      const columnCount = Math.max(
        1,
        ...(node.children ?? []).map((row: any) => (row.children ?? []).length),
      );
      const tableWidth = getDocxContentWidthTwips(input);
      const columnWidth = Math.floor(tableWidth / columnCount);
      for (const [rowIndex, row] of (node.children ?? []).entries()) {
        const cells = [];
        for (const cell of row.children ?? []) {
          cells.push(new TableCell({
            width: { size: columnWidth, type: WidthType.DXA },
            children: await tableCellToDocxBlocks(
              docx,
              cell.children ?? [],
              theme,
              contentTheme,
              rowIndex === 0,
              documentPath,
              imageScale,
              input,
            ),
            shading: rowIndex === 0 ? { type: ShadingType.CLEAR, fill: theme.fill } : undefined,
            margins: { top: 110, bottom: 110, left: 140, right: 140 },
            verticalAlign: VerticalAlignTable.TOP,
            borders: {
              top: { style: BorderStyle.SINGLE, size: 4, color: theme.border },
              bottom: { style: BorderStyle.SINGLE, size: 4, color: theme.border },
              left: { style: BorderStyle.SINGLE, size: 4, color: theme.border },
              right: { style: BorderStyle.SINGLE, size: 4, color: theme.border },
            },
          }));
        }
        rows.push(new TableRow({ children: cells, cantSplit: true }));
      }
      blocks.push(new Table({
        rows,
        width: { size: tableWidth, type: WidthType.DXA },
        columnWidths: Array.from({ length: columnCount }, () => columnWidth),
        layout: TableLayoutType.FIXED,
        borders: {
          top: { style: BorderStyle.SINGLE, size: 4, color: theme.border },
          bottom: { style: BorderStyle.SINGLE, size: 4, color: theme.border },
          left: { style: BorderStyle.SINGLE, size: 4, color: theme.border },
          right: { style: BorderStyle.SINGLE, size: 4, color: theme.border },
          insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: theme.border },
          insideVertical: { style: BorderStyle.SINGLE, size: 4, color: theme.border },
        },
      }));
      continue;
    }

    if (node.type === 'thematicBreak') {
      blocks.push(new Paragraph({
        border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: theme.border } },
        spacing: { before: 240, after: 240 },
      }));
      continue;
    }

    if (node.type === 'html') {
      const source = String(node.value ?? '');
      const image = input ? await renderDocxHtmlBlockImage(input, source, imageScale) : null;
      if (image) {
        blocks.push(new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 180, after: 220 },
          children: [
            createDocxImageRun(docx, image, {
              title: 'HTML block',
              description: source.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() || 'HTML block',
              name: 'HTML block',
            }),
          ],
        }));
        continue;
      }
      blocks.push(new Paragraph({
        children: [new TextRun({ text: source.replace(/<[^>]*>/g, '') })],
      }));
      continue;
    }
  }

  return blocks;
}

export async function exportDocx(input: ExportDocumentInput, outputPath?: string) {
  const docx = await import('docx');
  const targetPath = await getExportOutputPath(outputPath);
  if (!targetPath) return false;

  reportCitationPlaceholderWarning(input);
  reportProgress(input, exportProgressMessages.parseMarkdown());
  const processor = unified().use(remarkParse).use(remarkGfm).use(remarkMath);
  const tree = processor.runSync(processor.parse(input.content)) as any;
  reportProgress(input, exportProgressMessages.applyTheme());
  const baseTheme = getDocxThemeByContentTheme(input.contentTheme);
  const theme: DocxTheme = {
    ...baseTheme,
    font: input.docxFontFamily || baseTheme.font,
    fill: input.codeStyle === 'plain' ? 'FFFFFF' : baseTheme.fill,
    border: input.tableStyle === 'minimal' ? 'D8D2C8' : baseTheme.border,
  };
  const tocBlocks = input.toc
    ? createDocxTocBlocks(docx, buildExportTocItemsFromMdast(tree.children ?? []), theme)
    : [];
  reportProgress(input, exportProgressMessages.renderDiagrams());
  const docxImageScale = normalizeExportRasterScale(input.pngScale);
  const bodyBlocks = await mdastToDocxBlocks(
    docx,
    tree.children ?? [],
    theme,
    input.contentTheme,
    0,
    input.documentPath,
    docxImageScale,
    input,
  );
  const blocks = [...tocBlocks, ...bodyBlocks];
  const { Document, Packer, Paragraph } = docx;
  const fonts = [];
  const pageSize = docxPageSizeTwips[input.pdfPaper ?? 'a4'];
  const pageMargin = docxPageMarginsTwips[input.pdfMargin ?? 'standard'];
  const { header, footer } = createDocxHeaderFooter(docx, input, theme);

  if (input.docxFontFile) {
    try {
      reportProgress(input, t('export.progress.embedWordFonts'));
      fonts.push({
        name: theme.font,
        data: await readCustomFontBytes({
          id: input.docxFontFile.filename,
          family: theme.font,
          displayName: theme.font,
          filename: input.docxFontFile.filename,
          path: input.docxFontFile.path,
          format: input.docxFontFile.format,
          importedAt: Date.now(),
        }),
      } as any);
    } catch (err) {
      console.error('[Export] DOCX font embedding failed:', err);
      reportWarning(input, t('export.warning.wordFontEmbedLimited'));
    }
  }

  reportProgress(input, exportProgressMessages.generateFile('Word'));
  const document = new Document({
    fonts,
    styles: {
      default: {
        document: {
          run: { font: theme.font, color: theme.text, size: 24 },
          paragraph: { spacing: { line: 330 } },
        },
      },
      paragraphStyles: [
        {
          id: 'Heading1',
          name: 'Heading 1',
          basedOn: 'Normal',
          next: 'Normal',
          quickFormat: true,
          run: { size: 34, color: theme.accent, bold: false, font: theme.font },
          paragraph: { spacing: { before: 420, after: 160 } },
        },
        {
          id: 'Heading2',
          name: 'Heading 2',
          basedOn: 'Normal',
          next: 'Normal',
          quickFormat: true,
          run: { size: 30, color: theme.accent, bold: false, font: theme.font },
          paragraph: { spacing: { before: 360, after: 140 } },
        },
        {
          id: 'Heading3',
          name: 'Heading 3',
          basedOn: 'Normal',
          next: 'Normal',
          quickFormat: true,
          run: { size: 26, color: theme.accent, bold: false, font: theme.font },
          paragraph: { spacing: { before: 300, after: 120 } },
        },
      ],
    },
    sections: [{
      headers: header ? { default: header } : undefined,
      footers: footer ? { default: footer } : undefined,
      properties: {
        page: {
          size: pageSize,
          margin: pageMargin,
        },
      },
      children: blocks.length > 0 ? blocks : [new Paragraph('')],
    }],
  });

  const blob = await Packer.toBlob(document);
  const bytes = await normalizeDocxDrawingCompatibility(blob);
  reportProgress(input, exportProgressMessages.writeFile('Word'));
  await writeFile(targetPath, bytes);
  return true;
}

export const __exportPipelineTesting = {
  constrainDocxImageSize,
  formatPdfHeaderFooterText,
  getPdfFooterY,
  getPdfHeaderY,
  getPdfPageNumberLabel,
  getPdfPageNumberY,
  markExportAtomicBlocks,
  measureRenderedExportBounds,
  normalizeCssColorFunctionsForRaster,
  normalizePlantUmlSvg,
  normalizePdfChromeText,
  rasterizePlantUmlSvgsForCapture,
  prepareExportAtomicPagination,
  stripRasterUnsafeColorDeclarations,
};
