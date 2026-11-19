/**
 * DOCX 正文：mdast 一路转成 docx 的段落/表格/图片，最后打包成 .docx。
 *
 * 这里几乎没有「一对一映射」，全是妥协：
 * - docx 没有折叠块，details 被展平成「摘要 + 正文」；
 * - 没有代码块样式，用单格表格 + 等宽字体 + 底色兜住；
 * - 目录不生成 Word 的 TOC 域（打开会弹「更新域」），写成静态条目；
 * - 表格列宽按内容宽度均分，超宽的图表代码块转成图片再嵌入。
 *
 * 单元格与正文共用同一套块转换（tableCellToDocxBlocks 会回头调
 * mdastToDocxBlocks），所以两者必须放在同一个文件里，否则形成循环依赖。
 */
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import { remarkImageSize } from '../../markdown/remarkImageSize';
import type { Paragraph as DocxParagraph, TextRun as DocxTextRun } from 'docx';
import { writeFile } from '../../../platform/tauri/fileSystem';
import { t } from '../../i18n/runtime';
import type { ExportDocumentInput } from '../types';
import type { ContentTheme } from '../../settings/types';
import { readCustomFontBytes } from '../../settings/fontService';
import { getDocxThemeByContentTheme, type DocxTheme } from '../exportSettings';
import { applyCalloutMetadataToMdastBlockquote } from '../../editor/extensions/callouts';
import { buildExportTocItemsFromMdast, type ExportTocItem } from '../toc';
import {
  exportProgressMessages,
  getExportOutputPath,
  normalizeExportRasterScale,
  reportProgress,
  reportWarning,
} from '../pipeline/exportPipelineContext';
import {
  docxPageMarginsTwips,
  docxPageSizeTwips,
  getDocxContentWidthTwips,
} from '../exportPageLayout';
import {
  DOCX_MERMAID_IMAGE_MAX_HEIGHT,
  DOCX_MERMAID_IMAGE_MAX_WIDTH,
} from '../exportConstants';
import {
  buildHeaderFooterTextParts,
  hasHeaderFooterPageToken,
  type HeaderFooterTextPart,
} from '../pdf/pdfChromeText';
import { reportCitationPlaceholderWarning } from '../citations/pandocCitation';
import { isMarkmapSource, isMermaidSource, isPlantUmlSource } from '../diagrams/diagramSource';
import {
  createDocxImageRun,
  renderMarkmapImage,
  renderMermaidImage,
  renderPlantUmlImage,
  type DocxBlock,
  type DocxModule,
} from './docxImage';
import {
  normalizeDocxDrawingCompatibility,
  renderDocxHtmlBlockImage,
  renderDocxMathImage,
} from './docxVisualBlock';
import {
  inlineChildrenToRuns,
  inlineToRuns,
  isInlineMdastNode,
  normalizeDocxText,
  paragraphBlocksFromInlineChildren,
} from './docxInline';

export async function tableCellToDocxBlocks(
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

export function codeBlockToDocxTable(docx: DocxModule, value: string, theme: DocxTheme, input?: ExportDocumentInput) {
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

export function stripHtmlTagsToText(source: string) {
  return source.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

export function htmlNodeOpensDetails(node: any) {
  return node.type === 'html' && /^<\s*details\b/i.test(String(node.value ?? '').trim());
}

export function htmlNodeClosesDetails(node: any) {
  return node.type === 'html' && /^<\s*\/\s*details\s*>/i.test(String(node.value ?? '').trim());
}

export function extractSummaryTextFromHtmlNode(node: any) {
  if (node.type !== 'html') return null;
  const source = String(node.value ?? '');
  const match = source.match(/<\s*summary\b[^>]*>([\s\S]*?)<\s*\/\s*summary\s*>/i);
  return match ? stripHtmlTagsToText(match[1]) : null;
}

export function normalizeDetailsNodesForDocx(nodes: any[]): any[] {
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

export function createDocxTocBlocks(docx: DocxModule, items: ExportTocItem[], theme: DocxTheme): DocxBlock[] {
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

export function createDocxHeaderFooterRuns(
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

export function createDocxHeaderFooter(docx: DocxModule, input: ExportDocumentInput, theme: DocxTheme) {
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

export function getDocxListMarker(node: any, item: any, index: number) {
  if (typeof item.checked === 'boolean') {
    return item.checked ? '☑ ' : '☐ ';
  }

  return node.ordered ? `${(node.start ?? 1) + index}. ` : '• ';
}

export async function mdastToDocxBlocks(
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
  const processor = unified().use(remarkParse).use(remarkGfm).use(remarkMath).use(remarkImageSize);
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
