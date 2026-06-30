import { load } from 'js-yaml';
import type {
  ExportTemplateId,
  PdfMargin,
  PdfPaper,
} from '../settings/types';

export interface ExportFrontMatter {
  title?: string;
  author?: string;
  date?: string;
  templateId?: ExportTemplateId;
  pdfPaper?: PdfPaper;
  pdfMargin?: PdfMargin;
  toc?: boolean;
}

export interface ExportFrontMatterResult {
  content: string;
  frontMatter: ExportFrontMatter | null;
}

const FRONT_MATTER_PATTERN = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;
const TEMPLATE_IDS = new Set<ExportTemplateId>(['theme', 'business', 'plain', 'academic']);
const PDF_PAPERS = new Set<PdfPaper>(['a4', 'letter']);
const PDF_MARGINS = new Set<PdfMargin>(['compact', 'standard', 'wide']);

function stringValue(value: unknown): string | undefined {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value !== 'string' && typeof value !== 'number') return undefined;
  const text = String(value).trim();
  return text ? text : undefined;
}

function booleanValue(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', 'yes', '1', 'on'].includes(normalized)) return true;
    if (['false', 'no', '0', 'off'].includes(normalized)) return false;
  }
  return undefined;
}

function templateValue(value: unknown): ExportTemplateId | undefined {
  const normalized = stringValue(value)?.toLowerCase();
  return normalized && TEMPLATE_IDS.has(normalized as ExportTemplateId)
    ? normalized as ExportTemplateId
    : undefined;
}

function paperValue(value: unknown): PdfPaper | undefined {
  const normalized = stringValue(value)?.toLowerCase();
  return normalized && PDF_PAPERS.has(normalized as PdfPaper)
    ? normalized as PdfPaper
    : undefined;
}

function marginValue(value: unknown): PdfMargin | undefined {
  const normalized = stringValue(value)?.toLowerCase();
  if (normalized === 'narrow') return 'compact';
  return normalized && PDF_MARGINS.has(normalized as PdfMargin)
    ? normalized as PdfMargin
    : undefined;
}

function objectValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function normalizeFrontMatter(value: unknown): ExportFrontMatter | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const data = value as Record<string, unknown>;
  const exportData = objectValue(data.export);
  const frontMatter: ExportFrontMatter = {};

  const title = stringValue(data.title);
  if (title) frontMatter.title = title;

  const author = stringValue(data.author);
  if (author) frontMatter.author = author;

  const date = stringValue(data.date);
  if (date) frontMatter.date = date;

  const templateId = templateValue(exportData?.template ?? exportData?.templateId ?? data.template ?? data.templateId);
  if (templateId) frontMatter.templateId = templateId;

  const pdfPaper = paperValue(exportData?.paper ?? exportData?.pdfPaper ?? data.paper ?? data.pdfPaper);
  if (pdfPaper) frontMatter.pdfPaper = pdfPaper;

  const pdfMargin = marginValue(exportData?.margin ?? exportData?.pdfMargin ?? data.margin ?? data.pdfMargin);
  if (pdfMargin) frontMatter.pdfMargin = pdfMargin;

  const toc = booleanValue(exportData?.toc ?? data.toc);
  if (toc !== undefined) frontMatter.toc = toc;

  return Object.keys(frontMatter).length > 0 ? frontMatter : null;
}

export function parseExportFrontMatter(content: string): ExportFrontMatterResult {
  const match = FRONT_MATTER_PATTERN.exec(content);
  if (!match) return { content, frontMatter: null };

  try {
    const loaded = load(match[1]);
    return {
      content: content.slice(match[0].length),
      frontMatter: normalizeFrontMatter(loaded),
    };
  } catch {
    return {
      content,
      frontMatter: null,
    };
  }
}
