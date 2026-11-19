/**
 * PDF 书签（阅读器侧边栏大纲）。
 *
 * 书签不是另画一份目录，而是把导出文档里已经排好版的标题位置，换算成
 * 「第几页 + 页内 y」写进 PDF 的 /Outlines。这样三条 PDF 通路共用同一份
 * 分页参数（pageCssHeight），书签页码和实际页面不会对不上。
 *
 * 两个约束：
 * - 标题位置必须在分页（prepareExportAtomicPagination）之后采集，否则会被
 *   分页插入的撑高块推偏。
 * - 标题文本走 UTF-16BE（PDFHexString），PDFString 会把中文写成乱码。
 */
import { pdfPageMarginsPoints } from '../exportPageLayout';

export interface ExportPdfBookmark {
  level: number;
  title: string;
  pageIndex: number;
  /** 目标位置距页底的 PDF 点（pt）。 */
  y: number;
}

export interface ExportPdfBookmarkContext {
  pageCssHeight: number;
  pageCount: number;
  /** 1 CSS px 对应的 PDF 点。 */
  cssPxToPdfPoint: number;
  pageHeight: number;
  margins: typeof pdfPageMarginsPoints[keyof typeof pdfPageMarginsPoints];
}

export const PDF_BOOKMARK_MAX_ITEMS = 400;
export const PDF_BOOKMARK_MAX_TITLE_CHARS = 160;

function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

export function normalizeBookmarkTitle(raw: string) {
  const collapsed = raw
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!collapsed) return '';
  const chars = Array.from(collapsed);
  if (chars.length <= PDF_BOOKMARK_MAX_TITLE_CHARS) return collapsed;
  return `${chars.slice(0, PDF_BOOKMARK_MAX_TITLE_CHARS - 1).join('')}…`;
}

function headingLevel(tagName: string) {
  const level = Number(tagName.slice(1));
  if (!Number.isFinite(level)) return 1;
  return clamp(Math.round(level), 1, 6);
}

/**
 * 采集可供 PDF 阅读器导航的标题。没有文字的标题、TOC 自身、零高度标题都跳过，
 * 避免生成点不动的空书签。
 */
export function collectExportPdfBookmarks(
  root: HTMLElement,
  context: ExportPdfBookmarkContext,
): ExportPdfBookmark[] {
  const { pageCssHeight, pageCount, cssPxToPdfPoint, pageHeight, margins } = context;
  if (!Number.isFinite(pageCssHeight) || pageCssHeight <= 0) return [];
  if (!Number.isFinite(cssPxToPdfPoint) || cssPxToPdfPoint <= 0) return [];
  if (!Number.isFinite(pageHeight) || pageHeight <= 0) return [];

  const safePageCount = Math.max(1, Math.floor(pageCount));
  const rootRect = root.getBoundingClientRect();
  const headings = root.querySelectorAll<HTMLHeadingElement>('h1, h2, h3, h4, h5, h6');
  const bookmarks: ExportPdfBookmark[] = [];

  for (const heading of Array.from(headings)) {
    if (heading.closest('.prism-export-toc')) continue;
    const title = normalizeBookmarkTitle(heading.textContent ?? '');
    if (!title) continue;
    const rect = heading.getBoundingClientRect();
    if (!Number.isFinite(rect.top) || rect.height < 1) continue;

    const offsetTop = Math.max(0, rect.top - rootRect.top);
    const rawPageIndex = Math.floor(offsetTop / pageCssHeight + 1e-6);
    const pageIndex = clamp(rawPageIndex, 0, safePageCount - 1);
    const offsetWithinPage = Math.max(0, offsetTop - pageIndex * pageCssHeight);
    const y = pageHeight - margins.top - offsetWithinPage * cssPxToPdfPoint;

    bookmarks.push({
      level: headingLevel(heading.tagName),
      title,
      pageIndex,
      y: clamp(y, 0, pageHeight),
    });

    if (bookmarks.length >= PDF_BOOKMARK_MAX_ITEMS) break;
  }

  return bookmarks;
}

interface BookmarkNode extends ExportPdfBookmark {
  children: BookmarkNode[];
}

/**
 * 按标题级别组成树：只比栈顶更浅的标题才能成为它的父级。
 * H1 → H3 仍算一层子级，H3 → H1 直接回到顶层，不会产生负层级。
 */
export function buildBookmarkTree(bookmarks: ExportPdfBookmark[]): BookmarkNode[] {
  const roots: BookmarkNode[] = [];
  const stack: Array<{ level: number; node: BookmarkNode }> = [];

  for (const bookmark of bookmarks) {
    const node: BookmarkNode = { ...bookmark, children: [] };
    while (stack.length > 0 && stack[stack.length - 1].level >= node.level) stack.pop();
    if (stack.length === 0) roots.push(node);
    else stack[stack.length - 1].node.children.push(node);
    stack.push({ level: node.level, node });
  }

  return roots;
}

export interface PdfOutlineResult {
  count: number;
  truncated: boolean;
}

/**
 * 往内存中的 PDF 写 /Outlines。传空列表时什么都不做，不触碰文档结构。
 * 返回实际写入的条目数，供导出结果提示使用。
 */
export async function addPdfOutline(
  pdf: any,
  bookmarks: ExportPdfBookmark[],
): Promise<PdfOutlineResult> {
  if (!pdf || bookmarks.length === 0) return { count: 0, truncated: false };

  const pages = pdf.getPages() as any[];
  if (pages.length === 0) return { count: 0, truncated: false };

  const ranked = bookmarks
    .filter((bookmark) => Number.isFinite(bookmark.pageIndex) && Number.isFinite(bookmark.y))
    .slice(0, PDF_BOOKMARK_MAX_ITEMS)
    .map((bookmark) => ({
      ...bookmark,
      pageIndex: clamp(Math.round(bookmark.pageIndex), 0, pages.length - 1),
    }));
  if (ranked.length === 0) return { count: 0, truncated: false };

  const { PDFName, PDFHexString, PDFString } = await import('pdf-lib');
  const context = pdf.context;
  const toPdfText = (title: string) => (
    /^[\x20-\x7E]*$/.test(title) ? PDFString.of(title) : PDFHexString.fromText(title)
  );

  const rootDict = context.obj({ Type: 'Outlines' });
  const rootRef = context.register(rootDict);
  pdf.catalog.set(PDFName.of('Outlines'), rootRef);

  const createEntries = (nodes: BookmarkNode[], parentRef: any): Array<{ dict: any; ref: any; node: BookmarkNode }> => {
    const entries = nodes.map((node) => {
      const dict = context.obj({
        Title: toPdfText(node.title),
        Parent: parentRef,
      });
      dict.set(
        PDFName.of('Dest'),
        context.obj([pages[node.pageIndex].ref, PDFName.of('XYZ'), 0, node.y, null]),
      );
      return { dict, ref: context.register(dict), node };
    });

    entries.forEach((entry, index) => {
      if (index > 0) entry.dict.set(PDFName.of('Prev'), entries[index - 1].ref);
      if (index < entries.length - 1) entry.dict.set(PDFName.of('Next'), entries[index + 1].ref);
      if (entry.node.children.length > 0) {
        const children = createEntries(entry.node.children, entry.ref);
        entry.dict.set(PDFName.of('First'), children[0].ref);
        entry.dict.set(PDFName.of('Last'), children[children.length - 1].ref);
        entry.dict.set(PDFName.of('Count'), context.obj(countNodes(entry.node.children)));
      }
    });

    return entries;
  };

  const tree = buildBookmarkTree(ranked);
  const topLevel = createEntries(tree, rootRef);
  rootDict.set(PDFName.of('First'), topLevel[0].ref);
  rootDict.set(PDFName.of('Last'), topLevel[topLevel.length - 1].ref);
  rootDict.set(PDFName.of('Count'), context.obj(countNodes(tree)));

  return {
    count: countNodes(tree),
    truncated: bookmarks.length > PDF_BOOKMARK_MAX_ITEMS,
  };
}

function countNodes(nodes: BookmarkNode[]): number {
  return nodes.reduce((total, node) => total + 1 + countNodes(node.children), 0);
}
