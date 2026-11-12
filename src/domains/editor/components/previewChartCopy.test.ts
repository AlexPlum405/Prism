/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest';
import {
  PreviewChartCopyError,
  copyPreviewChartAsSource,
  findPreviewChartTarget,
} from './previewChartCopy';

function buildPreview(html: string): HTMLElement {
  const host = document.createElement('div');
  host.innerHTML = html;
  document.body.appendChild(host);
  return host;
}

describe('findPreviewChartTarget', () => {
  it('detects a mermaid placeholder and decodes its source', () => {
    const host = buildPreview(
      '<div class="mermaid-placeholder" data-mermaid="graph%20TD%3B%20A--%3EB"></div>',
    );
    const inner = host.querySelector('.mermaid-placeholder')!.appendChild(document.createElement('span'));
    const target = findPreviewChartTarget(inner);
    expect(target?.kind).toBe('mermaid');
    expect(target?.element.classList.contains('mermaid-placeholder')).toBe(true);
    expect(target?.source).toBe('graph TD; A-->B');
    host.remove();
  });

  it('detects markmap and plantuml placeholders', () => {
    const host = buildPreview(
      '<div class="markmap-placeholder" data-markmap="%23%20title"></div>'
      + '<div class="plantuml-placeholder" data-plantuml="Alice%20-%3E%20Bob"></div>',
    );
    const markmap = findPreviewChartTarget(host.querySelector('.markmap-placeholder span') ?? host.firstElementChild);
    expect(markmap?.kind).toBe('markmap');
    expect(markmap?.source).toBe('# title');

    const plantUml = findPreviewChartTarget(host.querySelector('.plantuml-placeholder'));
    expect(plantUml?.kind).toBe('plantuml');
    expect(plantUml?.source).toBe('Alice -> Bob');
    host.remove();
  });

  it('prefers the outer katex-display container over the nested katex span', () => {
    const host = buildPreview(
      `<span class="katex-display" data-katex="x%5E2">
         <span class="katex"><span class="katex-html">x^2</span></span>
       </span>`,
    );
    const nested = host.querySelector('.katex-html')!;
    const target = findPreviewChartTarget(nested);
    expect(target?.kind).toBe('katex');
    expect(target?.element.classList.contains('katex-display')).toBe(true);
    expect(target?.source).toBe('x^2');
    host.remove();
  });

  it('detects an unrendered katex placeholder', () => {
    const host = buildPreview('<span class="katex-placeholder" data-katex="a%2Bb">a+b</span>');
    const target = findPreviewChartTarget(host.querySelector('span')!);
    expect(target?.kind).toBe('katex');
    expect(target?.source).toBe('a+b');
    host.remove();
  });

  it('returns null outside of chart elements', () => {
    const host = buildPreview('<p>plain <strong>text</strong></p>');
    expect(findPreviewChartTarget(host.querySelector('strong')!)).toBeNull();
    expect(findPreviewChartTarget(null)).toBeNull();
    host.remove();
  });

  it('keeps an empty source when the encoded attribute is missing or malformed', () => {
    const host = buildPreview(
      '<div class="mermaid-placeholder" data-mermaid="%E0%A4%A"></div>'
      + '<div class="plantuml-placeholder"></div>',
    );
    const mermaid = findPreviewChartTarget(host.firstElementChild);
    expect(mermaid?.source).toBe('');
    const plantUml = findPreviewChartTarget(host.lastElementChild);
    expect(plantUml?.source).toBe('');
    host.remove();
  });
});

describe('copyPreviewChartAsSource', () => {
  it('writes the decoded source to the clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });

    await copyPreviewChartAsSource({
      kind: 'mermaid',
      element: document.createElement('div'),
      source: 'graph TD; A-->B',
    });
    expect(writeText).toHaveBeenCalledWith('graph TD; A-->B');
  });

  it('throws no-source when the source text is unavailable', async () => {
    await expect(copyPreviewChartAsSource({
      kind: 'katex',
      element: document.createElement('span'),
      source: '',
    })).rejects.toMatchObject({ code: 'no-source' });
  });

  it('wraps clipboard failures', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockRejectedValue(new Error('denied')) },
      configurable: true,
    });
    await expect(copyPreviewChartAsSource({
      kind: 'mermaid',
      element: document.createElement('div'),
      source: 'graph TD',
    })).rejects.toBeInstanceOf(PreviewChartCopyError);
  });
});
