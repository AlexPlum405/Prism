import { describe, expect, it } from 'vitest';
import {
  buildHeaderFooterTextParts,
  formatPdfHeaderFooterText,
  getPdfFooterY,
  getPdfHeaderY,
  getPdfPageNumberLabel,
  getPdfPageNumberY,
  hasHeaderFooterPageToken,
  normalizePdfChromeText,
} from './pdfChromeText';

describe('pdfChromeText', () => {
  const input = {
    filename: 'report.md',
    title: '季度报告',
    author: 'Alex',
    date: '2026-05-21',
  };

  it('formats page labels and coordinates within page margins', () => {
    expect(getPdfPageNumberLabel(1, 6)).toBe('2 / 6');
    expect(getPdfPageNumberY(40)).toBe(14);
    expect(getPdfPageNumberY(120)).toBe(28);
    expect(getPdfHeaderY(841.89, 51, 14)).toBeCloseTo(809.39);
    expect(getPdfFooterY(57)).toBeCloseTo(19.95);
  });

  it('formats header and footer template tokens', () => {
    expect(formatPdfHeaderFooterText('{title} · {author} · {page}/{pages}', input, 1, 6))
      .toBe('季度报告 · Alex · 2/6');
    expect(formatPdfHeaderFooterText('{filename} {date}', input, 0, 1))
      .toBe('report.md 2026-05-21');
    expect(normalizePdfChromeText(` ${'x'.repeat(200)} `)).toHaveLength(160);
  });

  it('keeps page tokens as parts for DOCX fields', () => {
    expect(hasHeaderFooterPageToken('{page}/{pages}')).toBe(true);
    expect(buildHeaderFooterTextParts('{title} · {page}/{pages}', input)).toEqual([
      { type: 'text', value: '季度报告 · ' },
      { type: 'page' },
      { type: 'text', value: '/' },
      { type: 'pages' },
    ]);
  });
});
