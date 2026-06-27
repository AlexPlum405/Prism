import { blobToDataUrl } from '../assets';
import {
  EXPORT_ATOMIC_BLOCK_CLASS,
  EXPORT_ATOMIC_SPACER_CLASS,
} from '../pagination';
import { stripRasterUnsafeColorDeclarations } from '../rendering';
import type { ExportDocumentInput } from '../types';

const pdfPaperCss = {
  a4: 'A4',
  letter: 'Letter',
} as const;

const pdfPageMarginsCss = {
  compact: '12mm 12mm 14mm',
  standard: '18mm 18mm 20mm',
  wide: '25mm 25mm 28mm',
} as const;

export async function inlineCssUrls(css: string) {
  const pattern = /url\((['"]?)([^'")]+)\1\)/g;
  const urls = Array.from(css.matchAll(pattern))
    .map((match) => match[2])
    .filter((url) => !url.startsWith('data:') && !url.startsWith('#') && !url.startsWith('about:'));
  const uniqueUrls = Array.from(new Set(urls));
  const replacements = new Map<string, string>();

  for (const rawUrl of uniqueUrls) {
    try {
      const absoluteUrl = new URL(rawUrl, document.baseURI).toString();
      const response = await fetch(absoluteUrl);
      if (!response.ok) continue;
      const blob = await response.blob();
      replacements.set(rawUrl, await blobToDataUrl(blob));
    } catch {
      // Export CSS can still work with system fallbacks if an asset cannot be inlined.
    }
  }

  return css.replace(pattern, (full, quote, rawUrl) => {
    const replacement = replacements.get(rawUrl);
    return replacement ? `url(${quote}${replacement}${quote})` : full;
  });
}

export async function collectExportCss(
  options: Pick<ExportDocumentInput, 'pdfPaper' | 'pdfMargin'> & { rasterSafe?: boolean } = {},
) {
  const paper = options.pdfPaper ?? 'a4';
  const margin = options.pdfMargin ?? 'standard';
  let css = '';
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      css += Array.from(sheet.cssRules).map((rule) => rule.cssText).join('\n');
    } catch {
      // Cross-origin stylesheets are ignored; Prism's bundled CSS is same-origin.
    }
  }

  css += `
    html, body {
      min-height: 100%;
      height: auto !important;
      overflow: auto !important;
    }
    body {
      margin: 0;
      background: var(--bg-preview, #fff);
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .prism-export-document {
      position: static !important;
      min-height: 100vh;
      height: auto !important;
      overflow: visible !important;
      background: var(--bg-preview, #fff);
    }
    .prism-export-document #write {
      min-height: auto !important;
      padding-top: 44px !important;
      padding-bottom: 56px !important;
      box-sizing: border-box;
      max-width: 100%;
      overflow-wrap: break-word;
    }
    .prism-export-document :is(.mermaid-placeholder, .markmap-placeholder, .plantuml-placeholder) {
      box-sizing: border-box !important;
      display: block !important;
      width: 100% !important;
      max-width: 100% !important;
      min-width: 0 !important;
      overflow: visible !important;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .prism-export-document :is(.mermaid-placeholder svg, .markmap-placeholder svg, .plantuml-image) {
      display: block !important;
      max-width: 100% !important;
      height: auto !important;
      margin-inline: auto !important;
      overflow: visible !important;
    }
    .prism-export-document :is(h1, h2, h3, h4, h5, h6, p, li, blockquote, dd, dt) {
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .prism-export-document .prism-export-scaled-atomic {
      contain: layout paint;
      max-width: 100% !important;
      overflow: visible !important;
    }
    .prism-export-document .prism-export-scaled-atomic-content {
      max-width: 100% !important;
    }
    .prism-export-toc {
      margin: 0 0 36px;
      padding: 18px 0 20px;
      border-top: 1px solid var(--theme-divider, var(--c-fog, #e5e7eb));
      border-bottom: 1px solid var(--theme-divider, var(--c-fog, #e5e7eb));
      break-inside: avoid;
    }
    .prism-export-toc-title {
      margin: 0 0 12px;
      color: var(--theme-muted, var(--c-ash, #8f8f8f));
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.08em;
      line-height: 1;
    }
    .prism-export-toc-list {
      display: grid;
      gap: 7px;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .prism-export-toc-item {
      margin: 0;
      padding-left: var(--toc-indent, 0);
    }
    .prism-export-toc-item a {
      display: flex;
      min-width: 0;
      color: var(--theme-text, var(--c-void, #000));
      text-decoration: none;
      line-height: 1.35;
    }
    .prism-export-toc-item span {
      min-width: 0;
      overflow-wrap: anywhere;
    }
    .prism-export-heading-anchor {
      scroll-margin-top: 28px;
    }
    .${EXPORT_ATOMIC_BLOCK_CLASS} {
      break-inside: avoid;
      page-break-inside: avoid;
      -webkit-column-break-inside: avoid;
    }
    .${EXPORT_ATOMIC_SPACER_CLASS} {
      display: block;
      width: 100%;
      margin: 0;
      padding: 0;
      border: 0;
      break-after: page;
      page-break-after: always;
    }
    .prism-export-template--plain pre,
    .prism-export-template--plain code {
      background: transparent !important;
      border-color: color-mix(in srgb, var(--theme-divider, #e5e0d8) 45%, transparent) !important;
    }
    .prism-export-template--plain table,
    .prism-export-template--plain th,
    .prism-export-template--plain td {
      background: transparent !important;
    }
    .prism-export-template--business table,
    .prism-export-template--academic table {
      border-collapse: collapse !important;
    }
    .prism-export-template--business th,
    .prism-export-template--business td,
    .prism-export-template--academic th,
    .prism-export-template--academic td {
      border-width: 1px !important;
    }
    @page {
      size: ${pdfPaperCss[paper]};
      margin: ${pdfPageMarginsCss[margin]};
    }
    @media print {
      body { background: #fff !important; }
      .prism-export-document { background: #fff !important; }
      .prism-export-document #write {
        max-width: none !important;
        padding: 0 !important;
      }
      pre, blockquote, details, table, figure, img, svg, canvas, .mermaid-placeholder, .katex-display, .prism-callout, .prism-html-block, .prism-export-toc, .${EXPORT_ATOMIC_BLOCK_CLASS} {
        break-inside: avoid;
        page-break-inside: avoid;
      }
    }
  `;

  const inlinedCss = await inlineCssUrls(css);
  return options.rasterSafe ? stripRasterUnsafeColorDeclarations(inlinedCss) : inlinedCss;
}
