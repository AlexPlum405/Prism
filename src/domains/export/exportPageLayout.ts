/**
 * 纸张与页边距：PDF 用 pt，DOCX 用 twip（1/20 pt）。这里把两套单位并排放，
 * 而不是每次现算，是为了让「A4 + 标准边距」这类常用组合保持可读的整数。
 *
 * 两边并不严格等价（DOCX 侧是取整后的 twip）。改一边要同步看另一边，
 * 否则同一份文档导成 PDF 和 Word，正文宽度会差出几个像素。
 */
import type { ExportDocumentInput } from './types';

export const pdfPageSizePoints = {
  a4: { width: 595.28, height: 841.89 },
  letter: { width: 612, height: 792 },
} as const;

export const pdfPageMarginsPoints = {
  compact: { top: 34, right: 34, bottom: 40, left: 34 },
  standard: { top: 51, right: 51, bottom: 57, left: 51 },
  wide: { top: 71, right: 71, bottom: 79, left: 71 },
} as const;

export const docxPageSizeTwips = {
  a4: { width: 11906, height: 16838 },
  letter: { width: 12240, height: 15840 },
} as const;

export const docxPageMarginsTwips = {
  compact: { top: 680, right: 680, bottom: 794, left: 680 },
  standard: { top: 1020, right: 1020, bottom: 1134, left: 1020 },
  wide: { top: 1418, right: 1418, bottom: 1588, left: 1418 },
} as const;

export function getDocxContentWidthTwips(input?: Pick<ExportDocumentInput, 'pdfPaper' | 'pdfMargin'>) {
  const pageSize = docxPageSizeTwips[input?.pdfPaper ?? 'a4'];
  const pageMargin = docxPageMarginsTwips[input?.pdfMargin ?? 'standard'];
  return Math.max(3600, pageSize.width - pageMargin.left - pageMargin.right);
}
