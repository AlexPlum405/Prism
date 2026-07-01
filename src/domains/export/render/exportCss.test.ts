import { afterEach, describe, expect, it, vi } from 'vitest';
import { collectExportCss, inlineCssUrls } from './exportCss';

describe('exportCss', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('builds export page css with paper, margins, and atomic block rules', async () => {
    const css = await collectExportCss({ pdfPaper: 'letter', pdfMargin: 'wide' });

    expect(css).toContain('size: Letter');
    expect(css).toContain('margin: 25mm 25mm 28mm');
    expect(css).toContain('.prism-export-atomic');
    expect(css).toContain('.prism-export-page-spacer');
  });

  it('keeps all diagram placeholders inside print atomic rules', async () => {
    const css = await collectExportCss({ pdfPaper: 'a4', pdfMargin: 'standard' });

    const printRuleStart = css.indexOf('@media print');
    expect(printRuleStart).toBeGreaterThanOrEqual(0);
    const printCss = css.slice(printRuleStart);
    expect(printCss).toContain('.mermaid-placeholder');
    expect(printCss).toContain('.markmap-placeholder');
    expect(printCss).toContain('.plantuml-placeholder');
  });

  it('inlines external css urls and leaves safe local urls untouched', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      new Blob(['font'], { type: 'font/woff2' }),
      { status: 200 },
    )));

    const css = await inlineCssUrls(`
      .remote { src: url("fonts/inter.woff2"); }
      .data { src: url(data:font/woff2;base64,Zm9udA==); }
      .hash { background: url("#clip"); }
      .about { background: url(about:blank); }
    `);

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(css).toContain('data:font/woff2');
    expect(css).toContain('url(data:font/woff2;base64,Zm9udA==)');
    expect(css).toContain('url("#clip")');
    expect(css).toContain('url(about:blank)');
  });
});
