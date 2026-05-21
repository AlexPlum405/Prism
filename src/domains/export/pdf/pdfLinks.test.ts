import { describe, expect, it } from 'vitest';
import {
  collectExportPdfLinkRects,
  normalizeExportExternalLink,
} from './pdfLinks';

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

describe('pdfLinks', () => {
  it('normalizes only supported external links', () => {
    expect(normalizeExportExternalLink('https://example.com/a', 'https://prism.local/doc')).toBe('https://example.com/a');
    expect(normalizeExportExternalLink('mailto:hello@example.com', 'https://prism.local/doc')).toBe('mailto:hello@example.com');
    expect(normalizeExportExternalLink('//example.com/a', 'https://prism.local/doc')).toBe('https://example.com/a');
    expect(normalizeExportExternalLink('/local.md', 'https://prism.local/doc')).toBe('https://prism.local/local.md');
    expect(normalizeExportExternalLink('#heading', 'https://prism.local/doc')).toBeNull();
    expect(normalizeExportExternalLink('javascript:alert(1)', 'https://prism.local/doc')).toBeNull();
    expect(normalizeExportExternalLink('data:text/html,abc', 'https://prism.local/doc')).toBeNull();
  });

  it('collects link rectangles relative to the export root', () => {
    const root = document.createElement('div');
    root.innerHTML = `
      <a id="ok" href="https://example.com">ok</a>
      <a id="tiny" href="https://tiny.example">tiny</a>
      <a id="bad" href="javascript:alert(1)">bad</a>
    `;
    root.getBoundingClientRect = () => rect({ left: 10, top: 20, width: 500, height: 400 });

    const ok = root.querySelector('#ok') as HTMLAnchorElement;
    ok.getClientRects = () => [rect({ left: 30, top: 50, width: 120, height: 18 })] as unknown as DOMRectList;

    const tiny = root.querySelector('#tiny') as HTMLAnchorElement;
    tiny.getClientRects = () => [rect({ left: 30, top: 80, width: 1, height: 18 })] as unknown as DOMRectList;

    const bad = root.querySelector('#bad') as HTMLAnchorElement;
    bad.getClientRects = () => [rect({ left: 30, top: 110, width: 120, height: 18 })] as unknown as DOMRectList;

    expect(collectExportPdfLinkRects(root)).toEqual([
      {
        url: 'https://example.com/',
        left: 20,
        top: 30,
        width: 120,
        height: 18,
      },
    ]);
  });
});
