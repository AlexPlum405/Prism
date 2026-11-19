import { describe, expect, it } from 'vitest';
import { PDFArray, PDFDocument, PDFName, type PDFDict, type PDFRef } from 'pdf-lib';
import {
  addPdfOutline,
  buildBookmarkTree,
  collectExportPdfBookmarks,
  normalizeBookmarkTitle,
  PDF_BOOKMARK_MAX_TITLE_CHARS,
  type ExportPdfBookmark,
} from './pdfBookmarks';
import { pdfPageMarginsPoints } from '../exportPageLayout';

function rect(input: Partial<DOMRect>): DOMRect {
  return {
    x: input.left ?? 0,
    y: input.top ?? 0,
    left: input.left ?? 0,
    top: input.top ?? 0,
    right: (input.left ?? 0) + (input.width ?? 0),
    bottom: (input.top ?? 0) + (input.height ?? 0),
    width: input.width ?? 0,
    height: input.height ?? 0,
    toJSON: () => input,
  } as DOMRect;
}

const standardMargins = pdfPageMarginsPoints.standard;

function buildExportRoot(headings: Array<{ tag: string; top: number; height?: number; text: string; id?: string }>) {
  const root = document.createElement('div');
  root.className = 'prism-export-document';
  root.innerHTML = headings
    .map((heading) => `<${heading.tag} id="${heading.id ?? ''}">${heading.text}</${heading.tag}>`)
    .join('');
  root.getBoundingClientRect = () => rect({ left: 0, top: 0, width: 800, height: 3000 });

  headings.forEach((heading, index) => {
    const element = root.querySelectorAll<HTMLHeadingElement>('h1, h2, h3, h4, h5, h6')[index];
    element.getBoundingClientRect = () => rect({ top: heading.top, width: 600, height: heading.height ?? 24 });
  });

  return root;
}

describe('normalizeBookmarkTitle', () => {
  it('collapses whitespace and drops control characters', () => {
    expect(normalizeBookmarkTitle('  第一章\t  概述  ')).toBe('第一章 概述');
    expect(normalizeBookmarkTitle('\u0000 \n ')).toBe('');
  });

  it('truncates very long headings so readers do not get a wall of text', () => {
    const title = normalizeBookmarkTitle('长'.repeat(PDF_BOOKMARK_MAX_TITLE_CHARS + 20));
    expect(Array.from(title)).toHaveLength(PDF_BOOKMARK_MAX_TITLE_CHARS);
    expect(title.endsWith('…')).toBe(true);
  });
});

describe('collectExportPdfBookmarks', () => {
  const context = {
    pageCssHeight: 1000,
    pageCount: 3,
    cssPxToPdfPoint: 0.5,
    pageHeight: 841.89,
    margins: standardMargins,
  };

  it('maps heading positions to page index and page-local PDF points', () => {
    const root = buildExportRoot([
      { tag: 'h2', top: 20, text: '第一章 概述' },
      { tag: 'h3', top: 1010, text: '1.1 背景' },
    ]);

    expect(collectExportPdfBookmarks(root, context)).toEqual([
      { level: 2, title: '第一章 概述', pageIndex: 0, y: 841.89 - standardMargins.top - 10 },
      { level: 3, title: '1.1 背景', pageIndex: 1, y: 841.89 - standardMargins.top - 5 },
    ]);
  });

  it('skips empty, invisible and table-of-contents headings', () => {
    const root = buildExportRoot([
      { tag: 'h1', top: 10, text: '   ' },
      { tag: 'h2', top: 40, height: 0, text: '零高度' },
      { tag: 'h3', top: 70, text: '正常标题' },
    ]);
    const toc = document.createElement('nav');
    toc.className = 'prism-export-toc';
    const tocHeading = document.createElement('h4');
    tocHeading.textContent = '目录里的标题';
    tocHeading.getBoundingClientRect = () => rect({ top: 100, width: 600, height: 24 });
    toc.appendChild(tocHeading);
    root.appendChild(toc);

    const bookmarks = collectExportPdfBookmarks(root, context);
    expect(bookmarks.map((bookmark) => bookmark.title)).toEqual(['正常标题']);
  });

  it('returns nothing when pagination metrics are unusable', () => {
    const root = buildExportRoot([{ tag: 'h1', top: 10, text: '标题' }]);
    expect(collectExportPdfBookmarks(root, { ...context, pageCssHeight: 0 })).toEqual([]);
    expect(collectExportPdfBookmarks(root, { ...context, cssPxToPdfPoint: Number.NaN })).toEqual([]);
  });
});

describe('buildBookmarkTree', () => {
  const bookmark = (level: number, title: string): ExportPdfBookmark => ({
    level,
    title,
    pageIndex: 0,
    y: 700,
  });

  it('nests deeper headings and returns to top level when the level drops', () => {
    const tree = buildBookmarkTree([
      bookmark(1, 'A'),
      bookmark(3, 'A.1'),
      bookmark(4, 'A.1.1'),
      bookmark(2, 'B'),
      bookmark(1, 'C'),
    ]);

    expect(tree.map((node) => node.title)).toEqual(['A', 'C']);
    expect(tree[0].children.map((node) => node.title)).toEqual(['A.1', 'B']);
    expect(tree[0].children[0].children.map((node) => node.title)).toEqual(['A.1.1']);
  });
});

async function loadOutline(pdf: PDFDocument) {
  const outlinesRef = pdf.catalog.get(PDFName.of('Outlines')) as PDFRef | undefined;
  if (!outlinesRef) return null;
  return pdf.context.lookup(outlinesRef) as PDFDict;
}

function entryAt(pdf: PDFDocument, ref: PDFRef | undefined) {
  if (!ref) return null;
  return pdf.context.lookup(ref) as PDFDict;
}

function titleOf(entry: PDFDict) {
  const title = entry.get(PDFName.of('Title')) as unknown as { decodeText: () => string };
  return title.decodeText();
}

function pageIndexOfDest(pdf: PDFDocument, entry: PDFDict) {
  const dest = pdf.context.lookup(entry.get(PDFName.of('Dest')), PDFArray);
  const pageRef = dest.get(0);
  return pdf.getPages().findIndex((page) => page.ref.toString() === pageRef.toString());
}

describe('addPdfOutline', () => {
  it('writes a nested outline with resolvable page destinations', async () => {
    const pdf = await PDFDocument.create();
    pdf.addPage([595.28, 841.89]);
    pdf.addPage([595.28, 841.89]);
    pdf.addPage([595.28, 841.89]);

    const result = await addPdfOutline(pdf, [
      { level: 1, title: '第一章 概述', pageIndex: 0, y: 700 },
      { level: 2, title: '1.1 背景', pageIndex: 1, y: 650 },
      { level: 1, title: '第二章 结论', pageIndex: 2, y: 720 },
    ]);
    expect(result).toEqual({ count: 3, truncated: false });

    const reloaded = await PDFDocument.load(await pdf.save());
    const outline = await loadOutline(reloaded);
    expect(outline).not.toBeNull();
    expect(Number(outline!.get(PDFName.of('Count')))).toBe(3);

    const first = entryAt(reloaded, outline!.get(PDFName.of('First')) as PDFRef);
    expect(titleOf(first!)).toBe('第一章 概述');
    expect(pageIndexOfDest(reloaded, first!)).toBe(0);

    const child = entryAt(reloaded, first!.get(PDFName.of('First')) as PDFRef);
    expect(titleOf(child!)).toBe('1.1 背景');
    expect(pageIndexOfDest(reloaded, child!)).toBe(1);

    const second = entryAt(reloaded, first!.get(PDFName.of('Next')) as PDFRef);
    expect(titleOf(second!)).toBe('第二章 结论');
    expect(pageIndexOfDest(reloaded, second!)).toBe(2);
    expect(second!.get(PDFName.of('Next'))).toBeUndefined();
    expect((second!.get(PDFName.of('Prev')) as PDFRef).toString()).toBe(
      (outline!.get(PDFName.of('First')) as PDFRef).toString(),
    );
  });

  it('keeps the document untouched when there is nothing to bookmark', async () => {
    const pdf = await PDFDocument.create();
    pdf.addPage([595.28, 841.89]);

    expect(await addPdfOutline(pdf, [])).toEqual({ count: 0, truncated: false });
    expect(pdf.catalog.get(PDFName.of('Outlines'))).toBeUndefined();
  });

  it('clamps out-of-range pages instead of writing broken destinations', async () => {
    const pdf = await PDFDocument.create();
    pdf.addPage([595.28, 841.89]);
    await addPdfOutline(pdf, [{ level: 1, title: '越界标题', pageIndex: 99, y: 9999 }]);

    const reloaded = await PDFDocument.load(await pdf.save());
    const outline = await loadOutline(reloaded);
    const first = entryAt(reloaded, outline!.get(PDFName.of('First')) as PDFRef);
    expect(pageIndexOfDest(reloaded, first!)).toBe(0);
  });
});
