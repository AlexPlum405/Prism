import { isUnsafeExportUrl } from '../render/htmlFragmentRenderer';

export interface ExportPdfLinkRect {
  url: string;
  left: number;
  top: number;
  width: number;
  height: number;
}

const EXPORT_LINK_PROTOCOLS = new Set(['http:', 'https:', 'mailto:']);

export function normalizeExportExternalLink(rawUrl: string, baseUri: string) {
  const trimmed = rawUrl.trim();
  if (!trimmed || trimmed.startsWith('#')) return null;
  if (isUnsafeExportUrl(trimmed, EXPORT_LINK_PROTOCOLS)) return null;

  try {
    const url = trimmed.startsWith('//')
      ? new URL(`https:${trimmed}`)
      : new URL(trimmed, baseUri || window.location.href);
    return EXPORT_LINK_PROTOCOLS.has(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
}

function getElementRects(element: Element) {
  const rects = Array.from(element.getClientRects?.() ?? []);
  if (rects.length > 0) return rects;
  return [element.getBoundingClientRect()];
}

export function collectExportPdfLinkRects(root: HTMLElement): ExportPdfLinkRect[] {
  const rootRect = root.getBoundingClientRect();
  const links: ExportPdfLinkRect[] = [];
  root.querySelectorAll<HTMLAnchorElement>('a[href]').forEach((anchor) => {
    const url = normalizeExportExternalLink(anchor.getAttribute('href') ?? '', anchor.ownerDocument.baseURI);
    if (!url) return;

    getElementRects(anchor).forEach((rect) => {
      if (rect.width < 2 || rect.height < 2) return;
      links.push({
        url,
        left: Math.max(0, rect.left - rootRect.left),
        top: Math.max(0, rect.top - rootRect.top),
        width: rect.width,
        height: rect.height,
      });
    });
  });
  return links;
}
