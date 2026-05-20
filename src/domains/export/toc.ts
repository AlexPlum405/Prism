import { t } from '../i18n';

export interface ExportTocHeading {
  level: number;
  text: string;
}

export interface ExportTocItem extends ExportTocHeading {
  anchor: string;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function normalizeLevel(level: number) {
  if (!Number.isFinite(level)) return 1;
  return Math.min(6, Math.max(1, Math.round(level)));
}

function slugifyHeading(text: string) {
  const slug = text
    .trim()
    .toLowerCase()
    .replace(/[\s/]+/g, '-')
    .replace(/[^\p{L}\p{N}_-]+/gu, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return slug || 'section';
}

function uniqueAnchor(text: string, used: Map<string, number>) {
  const base = slugifyHeading(text);
  const count = used.get(base) ?? 0;
  used.set(base, count + 1);
  return count === 0 ? base : `${base}-${count + 1}`;
}

function extractMdastText(node: any): string {
  if (!node) return '';
  if (typeof node.value === 'string') return node.value;
  if (typeof node.alt === 'string') return node.alt;
  if (!Array.isArray(node.children)) return '';
  return node.children.map(extractMdastText).join('');
}

export function buildExportTocItems(headings: ExportTocHeading[]): ExportTocItem[] {
  const used = new Map<string, number>();
  return headings
    .map((heading) => ({
      level: normalizeLevel(heading.level),
      text: heading.text.trim().replace(/\s+/g, ' '),
    }))
    .filter((heading) => heading.text.length > 0)
    .map((heading) => ({
      ...heading,
      anchor: uniqueAnchor(heading.text, used),
    }));
}

export function buildExportTocItemsFromMdast(nodes: any[]): ExportTocItem[] {
  const headings = nodes
    .filter((node) => node?.type === 'heading')
    .map((node) => ({
      level: node.depth ?? 1,
      text: extractMdastText(node),
    }));
  return buildExportTocItems(headings);
}

export function buildExportTocHtml(items: ExportTocItem[]) {
  if (items.length === 0) return '';

  const rows = items.map((item) => {
    const indent = Math.max(0, item.level - 1) * 14;
    return [
      `<li class="prism-export-toc-item" style="--toc-indent: ${indent}px">`,
      `<a href="#${encodeURIComponent(item.anchor)}">`,
      `<span>${escapeHtml(item.text)}</span>`,
      '</a>',
      '</li>',
    ].join('');
  }).join('');

  return [
    `<nav class="prism-export-toc" aria-label="${escapeHtml(t('export.toc'))}">`,
    `<div class="prism-export-toc-title">${escapeHtml(t('export.toc'))}</div>`,
    `<ol class="prism-export-toc-list">${rows}</ol>`,
    '</nav>',
  ].join('');
}
