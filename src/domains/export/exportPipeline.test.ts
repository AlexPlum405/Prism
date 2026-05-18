import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdir, readFile, stat, writeFile as writeNodeFile } from 'node:fs/promises';
import path from 'node:path';
const mermaidMock = vi.hoisted(() => ({
  initialize: vi.fn(),
  render: vi.fn(async (_id?: string, _code?: string, _container?: Element) => ({
    svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 40"><text>Golden Mermaid</text></svg>',
  })),
}));
const canvasRenderMock = vi.hoisted(() => {
  const dataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=';
  return {
    render: vi.fn(async () => ({
      width: 320,
      height: 200,
      toDataURL: () => dataUrl,
    })),
  };
});
const invokeMock = vi.hoisted(() => vi.fn());

vi.mock('mermaid', () => ({ default: mermaidMock }));
vi.mock('html2canvas', () => ({ default: canvasRenderMock.render }));
vi.mock('@tauri-apps/api/core', () => ({ invoke: invokeMock }));

import { __exportPipelineTesting, exportDocx, exportHtml, exportPdf, exportPng } from './exportPipeline';
import { resolveExportOptions } from './templates';
import { EXPORT_GOLDEN_DOCX_MARKDOWN, EXPORT_GOLDEN_MARKDOWN } from './goldenFixture';
import type { ExportDocumentInput } from './types';
import { DEFAULT_SETTINGS } from '../settings/types';

type PrismRuntimeWindow = Window & {
  __TAURI_INTERNALS__?: unknown;
  __PRISM_EXPORT_WORKER__?: boolean;
};

const fsMock = vi.hoisted(() => ({
  readFile: vi.fn(async (_path: string) => new Uint8Array()),
  remove: vi.fn(async (_path: string) => undefined),
  writeFile: vi.fn(async (_path: string, _contents: Uint8Array) => undefined),
  writeTextFile: vi.fn(async (_path: string, _contents: string) => undefined),
}));

vi.mock('@tauri-apps/plugin-fs', () => fsMock);

function createInput(overrides: Partial<ExportDocumentInput> = {}): ExportDocumentInput {
  return {
    content: '# Intro\n\n## Details\n\nBody',
    filename: 'demo.md',
    contentTheme: 'miaoyan',
    templateId: 'theme',
    htmlIncludeTheme: true,
    ...overrides,
  };
}

function createTestRect(left: number, top: number, width: number, height: number): DOMRect {
  return {
    x: left,
    y: top,
    top,
    left,
    right: left + width,
    bottom: top + height,
    width,
    height,
    toJSON: () => ({}),
  } as DOMRect;
}

function createTestRectList(rects: DOMRect[]): DOMRectList {
  return Object.assign(rects, {
    item: (index: number) => rects[index] ?? null,
  }) as unknown as DOMRectList;
}

const COMPLEX_EXPORT_SMOKE_MARKDOWN = `---
title: 导出 Smoke 验收文档
author: Prism QA
date: 2026-05-15
template: academic
paper: a4
margin: standard
toc: true
---

# 导出 Smoke 验收文档

这是一段中文长文内容，用于验证 Prism 的复杂导出。English words 与中文混排，行内公式 $E = mc^2$ 应该正常渲染。

引用占位：[@doe2024]。如果 Pandoc 未检测成功，导出应保留 citekey 占位并给出 warning，不应崩溃。

![本地图片](assets/prism-export-figure.png)

## 表格与任务

| 项目 | 期望 | 状态 |
| --- | --- | --- |
| 中文 | 保留中文字符 | 通过 |
| 表格 | 保留表格结构 | 通过 |
| Mermaid | 导出为图表或图片 | 待检 |

- [x] 已完成的任务
- [ ] 待完成的任务

> 引用块应该有明确层级，不能贴边或丢失正文。

## 代码

\`\`\`ts
const title = 'Prism Export Smoke';
console.log(title);
\`\`\`

## Mermaid

\`\`\`mermaid
graph TD
  A[Markdown] --> B[HTML]
  A --> C[PDF]
  A --> D[PNG]
  A --> E[DOCX]
\`\`\`

## KaTeX

$$
\\int_0^1 x^2 dx = \\frac{1}{3}
$$
`;

function resetFsMockImplementations() {
  fsMock.readFile.mockImplementation(async (_path: string) => new Uint8Array());
  fsMock.writeTextFile.mockImplementation(async (_path: string, _contents: string) => undefined);
  fsMock.writeFile.mockImplementation(async (_path: string, _contents: Uint8Array) => undefined);
}

describe('export pipeline html', () => {
  const originalRequestAnimationFrame = globalThis.requestAnimationFrame;
  let originalFonts: unknown;

  beforeEach(() => {
    fsMock.readFile.mockClear();
    fsMock.writeTextFile.mockClear();
    fsMock.writeFile.mockClear();
    mermaidMock.initialize.mockClear();
    mermaidMock.render.mockClear();
    invokeMock.mockReset();
    fsMock.remove.mockClear();
    delete (window as PrismRuntimeWindow).__TAURI_INTERNALS__;
    delete (window as PrismRuntimeWindow).__PRISM_EXPORT_WORKER__;
    document.documentElement.removeAttribute('data-content-theme');
    document.head.querySelectorAll('[data-prism-native-pdf]').forEach((element) => element.remove());
    document.body.className = '';
    document.body.replaceChildren();
    originalFonts = (document as any).fonts;
    Object.defineProperty(document, 'fonts', {
      configurable: true,
      value: { ready: Promise.resolve() },
    });
    globalThis.requestAnimationFrame = ((callback: FrameRequestCallback) => {
      window.setTimeout(() => callback(performance.now()), 0);
      return 1;
    }) as typeof requestAnimationFrame;
  });

  afterEach(() => {
    if (originalRequestAnimationFrame) {
      globalThis.requestAnimationFrame = originalRequestAnimationFrame;
    } else {
      delete (globalThis as Partial<typeof globalThis>).requestAnimationFrame;
    }
    if (originalFonts) {
      Object.defineProperty(document, 'fonts', {
        configurable: true,
        value: originalFonts,
      });
    } else {
      delete (document as any).fonts;
    }
  });

  it('injects a table of contents and heading anchors when toc is enabled', async () => {
    await exportHtml(createInput({
      toc: true,
      title: 'Export Title',
      author: 'Alex',
      date: '2026-05-15',
    }), '/tmp/demo.html');

    expect(fsMock.writeTextFile).toHaveBeenCalledTimes(1);
    const html = fsMock.writeTextFile.mock.calls[0][1] as string;
    expect(html).toContain('<title>Export Title</title>');
    expect(html).toContain('<meta name="author" content="Alex">');
    expect(html).toContain('<meta name="date" content="2026-05-15">');
    expect(html).toContain('prism-export-toc');
    expect(html).toContain('href="#intro"');
    expect(html).toContain('href="#details"');
    expect(html).toContain('id="intro"');
    expect(html).toContain('id="details"');
  });

  it('does not inject toc markup when toc is disabled', async () => {
    await exportHtml(createInput({ toc: false }), '/tmp/demo.html');

    const html = fsMock.writeTextFile.mock.calls[0][1] as string;
    expect(html).not.toContain('<nav class');
    expect(html).not.toContain('href="#intro"');
  });

  it('exports the golden markdown fixture with front matter, toc, rich blocks, and rendered mermaid', async () => {
    const options = resolveExportOptions({
      content: EXPORT_GOLDEN_MARKDOWN,
      filename: 'golden.md',
      settings: {
        ...DEFAULT_SETTINGS,
        contentTheme: 'miaoyan',
        exportDefaults: {
          ...DEFAULT_SETTINGS.exportDefaults,
          frontMatterOverrides: true,
          htmlIncludeTheme: true,
        },
      },
    });

    await exportHtml(options, '/tmp/golden.html');

    const html = fsMock.writeTextFile.mock.calls[0][1] as string;
    expect(html).toContain('<title>导出验收文档</title>');
    expect(html).toContain('<meta name="author" content="Prism QA">');
    expect(html).toContain('<meta name="date" content="2026-05-15">');
    expect(html).toContain('prism-export-toc');
    expect(html).toContain('<span>导出验收文档</span>');
    expect(html).toContain('id="导出验收文档"');
    expect(html).toContain('<table');
    expect(html).toContain('<th>项目</th>');
    expect(html).toContain('class="hljs language-ts"');
    expect(html).toContain('class="katex');
    expect(html).toContain('Golden Mermaid');
    expect(html).not.toContain('template: business');
    expect(mermaidMock.render).toHaveBeenCalledTimes(1);
  });

  it('reports diagnostic progress stages for html export', async () => {
    const onProgress = vi.fn();

    await exportHtml(createInput({
      content: '# Intro\n\n```mermaid\ngraph TD\nA-->B\n```',
      onProgress,
    }), '/tmp/progress.html');

    expect(onProgress.mock.calls.map(([message]) => message)).toEqual([
      '正在解析 Markdown',
      '正在应用导出主题',
      '正在渲染图表',
      '正在生成 HTML 文件',
      '正在写入 HTML 文件',
    ]);
  });

  it('keeps html export moving when animation frames are throttled', async () => {
    vi.useFakeTimers();
    globalThis.requestAnimationFrame = vi.fn(() => 1) as unknown as typeof requestAnimationFrame;

    try {
      const exportPromise = exportHtml(createInput({
        content: '# Intro\n\n```mermaid\ngraph TD\nA-->B\n```',
      }), '/tmp/throttled-frame.html');
      await vi.runAllTimersAsync();
      await exportPromise;
    } finally {
      vi.useRealTimers();
    }

    expect(fsMock.writeTextFile).toHaveBeenCalledWith(
      '/tmp/throttled-frame.html',
      expect.stringContaining('Golden Mermaid'),
    );
  });

  it('reports per-diagram progress for multi Mermaid exports', async () => {
    const onProgress = vi.fn();

    await exportHtml(createInput({
      content: [
        '# Intro',
        '',
        '```mermaid',
        'graph TD',
        'A-->B',
        '```',
        '',
        '```mermaid',
        'graph TD',
        'B-->C',
        '```',
      ].join('\n'),
      onProgress,
    }), '/tmp/multi-mermaid.html');

    expect(onProgress.mock.calls.map(([message]) => message)).toEqual(expect.arrayContaining([
      '正在渲染图表 1 / 2',
      '正在渲染图表 2 / 2',
    ]));
  });

  it('inlines relative local svg images from the markdown document directory', async () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="90"><text>Local SVG</text></svg>';
    fsMock.readFile.mockImplementationOnce(async (targetPath: string) => {
      expect(targetPath).toBe('/tmp/prism-doc/assets/logo.svg');
      return new TextEncoder().encode(svg);
    });

    await exportHtml(createInput({
      content: '# Local image\n\n![Logo](assets/logo.svg)',
      documentPath: '/tmp/prism-doc/article.md',
    } as Partial<ExportDocumentInput>), '/tmp/local-svg.html');

    const html = fsMock.writeTextFile.mock.calls[0][1] as string;
    expect(fsMock.readFile).toHaveBeenCalledWith('/tmp/prism-doc/assets/logo.svg');
    expect(html).toContain('src="data:image/svg+xml;base64,');
    expect(Buffer.from(html.match(/src="data:image\/svg\+xml;base64,([^"]+)"/)?.[1] ?? '', 'base64').toString('utf8'))
      .toContain('Local SVG');
    expect(html).not.toContain('src="assets/logo.svg"');
    expect(html).not.toContain('<div id="root"></div>');
  });

  it('isolates Mermaid parser error artifacts during html export', async () => {
    let renderContainer: Element | undefined;
    let sandboxWasConnectedDuringRender = false;
    mermaidMock.render.mockImplementationOnce(async (_id, _code, container?: Element) => {
      renderContainer = container;
      sandboxWasConnectedDuringRender = container?.isConnected ?? false;
      const artifact = document.createElement('svg');
      artifact.dataset.testid = 'mermaid-export-error-artifact';
      artifact.textContent = 'Syntax error in text';
      (container ?? document.body).appendChild(artifact);
      throw new Error('Syntax error in text');
    });

    await exportHtml(createInput({
      content: '# Bad diagram\n\n```mermaid\ngraph TD\n  A -->\n```',
    }), '/tmp/bad-mermaid.html');

    expect(renderContainer).toBeInstanceOf(HTMLElement);
    expect((renderContainer as HTMLElement).dataset.prismExportMermaidSandbox).toBe('true');
    expect(sandboxWasConnectedDuringRender).toBe(true);
    expect((renderContainer as HTMLElement).isConnected).toBe(false);
    expect(document.body.querySelector('[data-testid="mermaid-export-error-artifact"]')).toBeNull();
    const html = fsMock.writeTextFile.mock.calls[0][1] as string;
    expect(html).toContain('Mermaid 渲染失败');
    expect(html).toContain('Syntax error in text');
  });

  it('uses pandoc citeproc html when HTML export has detected pandoc and bibliography settings', async () => {
    const onWarning = vi.fn();
    invokeMock.mockResolvedValueOnce({
      html: '<p>研究参考 <span class="citation">Doe 2024</span>。</p><section id="refs"></section>',
      warnings: 'pandoc citeproc warning',
    });

    await exportHtml(createInput({
      content: '研究参考 [@doe2024]。',
      citation: {
        bibliographyPath: '/tmp/library.bib',
        cslStylePath: '/tmp/chinese-gb7714.csl',
      },
      pandoc: {
        path: '/opt/homebrew/bin/pandoc',
        detected: true,
        version: 'pandoc 3.2.1',
        lastCheckedAt: 123,
        lastError: '',
      },
      onWarning,
    }), '/tmp/citation.html');

    expect(invokeMock).toHaveBeenCalledWith('render_citations_with_pandoc', {
      path: '/opt/homebrew/bin/pandoc',
      markdown: '研究参考 [@doe2024]。',
      bibliographyPath: '/tmp/library.bib',
      cslStylePath: '/tmp/chinese-gb7714.csl',
    });
    const html = fsMock.writeTextFile.mock.calls[0][1] as string;
    expect(html).toContain('Doe 2024');
    expect(html).not.toContain('[@doe2024]');
    expect(onWarning).toHaveBeenCalledWith('pandoc citeproc warning');
    expect(onWarning).not.toHaveBeenCalledWith(expect.stringContaining('占位形式保留'));
  });

  it('sanitizes unsafe html returned by pandoc before writing html export output', async () => {
    invokeMock.mockResolvedValueOnce({
      html: [
        '<p>',
        '<a href="javascript:alert(1)" onclick="alert(2)">bad link</a>',
        '<a href="https://example.com/ref">safe link</a>',
        '<img src="javascript:alert(3)" onerror="alert(4)" style="width: 999px; background: url(javascript:alert(6))" alt="bad image">',
        '<script>alert(5)</script>',
        '</p>',
      ].join(''),
      warnings: '',
    });

    await exportHtml(createInput({
      content: '研究参考 [@doe2024]。',
      citation: {
        bibliographyPath: '/tmp/library.bib',
        cslStylePath: '',
      },
      pandoc: {
        path: '/opt/homebrew/bin/pandoc',
        detected: true,
        version: 'pandoc 3.2.1',
        lastCheckedAt: 123,
        lastError: '',
      },
    }), '/tmp/citation.html');

    const html = fsMock.writeTextFile.mock.calls[0][1] as string;
    expect(html).toContain('bad link');
    expect(html).toContain('href="https://example.com/ref"');
    expect(html).not.toContain('javascript:');
    expect(html).not.toContain('onclick');
    expect(html).not.toContain('onerror');
    expect(html).not.toContain('<script>');
  });

  it('falls back to built-in HTML export when pandoc citation rendering fails', async () => {
    const onWarning = vi.fn();
    invokeMock.mockRejectedValueOnce(new Error('citeproc failed'));

    await exportHtml(createInput({
      content: '研究参考 [@doe2024]。',
      citation: {
        bibliographyPath: '/tmp/library.bib',
        cslStylePath: '',
      },
      pandoc: {
        path: '',
        detected: true,
        version: 'pandoc 3.2.1',
        lastCheckedAt: 123,
        lastError: '',
      },
      onWarning,
    }), '/tmp/citation.html');

    const html = fsMock.writeTextFile.mock.calls[0][1] as string;
    expect(html).toContain('[@doe2024]');
    expect(onWarning).toHaveBeenCalledWith(expect.stringContaining('已回退内置导出'));
    expect(onWarning).toHaveBeenCalledWith(expect.stringContaining('citeproc failed'));
  });

  it('warns when built-in export keeps configured citations as placeholders', async () => {
    const onWarning = vi.fn();

    await exportHtml(createInput({
      content: '研究参考 [@doe2024]。',
      citation: {
        bibliographyPath: '/tmp/library.bib',
        cslStylePath: '/tmp/chinese-gb7714.csl',
      },
      onWarning,
    }), '/tmp/citation.html');

    expect(onWarning).toHaveBeenCalledWith(expect.stringContaining('Pandoc 未检测成功'));
    expect(onWarning).toHaveBeenCalledWith(expect.stringContaining('请在设置中心检测 Pandoc'));
  });

  it('explains when CSL is configured without a bibliography file', async () => {
    const onWarning = vi.fn();

    await exportHtml(createInput({
      content: '研究参考 [@doe2024]。',
      citation: {
        bibliographyPath: '',
        cslStylePath: '/tmp/chinese-gb7714.csl',
      },
      onWarning,
    }), '/tmp/citation.html');

    expect(onWarning).toHaveBeenCalledWith('已配置 CSL 样式，但缺少参考文献文件；当前导出会保留 citekey 占位。');
  });

  it('explains unsupported citation path suffixes before falling back', async () => {
    const onWarning = vi.fn();

    await exportHtml(createInput({
      content: '研究参考 [@doe2024]。',
      citation: {
        bibliographyPath: '/tmp/references.txt',
        cslStylePath: '/tmp/style.json',
      },
      pandoc: {
        path: '/opt/homebrew/bin/pandoc',
        detected: true,
        version: 'pandoc 3.2.1',
        lastCheckedAt: 123,
        lastError: '',
      },
      onWarning,
    }), '/tmp/citation.html');

    expect(invokeMock).not.toHaveBeenCalled();
    expect(onWarning).toHaveBeenCalledWith(expect.stringContaining('参考文献文件后缀需要是 .bib、.bibtex 或 .json'));
  });

  it('does not warn about citations when bibliography settings are empty', async () => {
    const onWarning = vi.fn();

    await exportHtml(createInput({
      content: '研究参考 [@doe2024]。',
      citation: {
        bibliographyPath: '',
        cslStylePath: '',
      },
      onWarning,
    }), '/tmp/citation.html');

    expect(onWarning).not.toHaveBeenCalled();
  });
});

describe('export pipeline pdf page numbers', () => {
  it('formats page number labels and keeps them inside the bottom margin', () => {
    expect(__exportPipelineTesting.getPdfPageNumberLabel(0, 3)).toBe('1 / 3');
    expect(__exportPipelineTesting.getPdfPageNumberLabel(2, 3)).toBe('3 / 3');
    expect(__exportPipelineTesting.getPdfPageNumberY(40)).toBe(14);
    expect(__exportPipelineTesting.getPdfPageNumberY(120)).toBe(28);
  });

  it('formats pdf header and footer token text', () => {
    expect(__exportPipelineTesting.formatPdfHeaderFooterText(
      '{title} · {author} · {page}/{pages}',
      createInput({ title: '季度报告', author: 'Alex' }),
      1,
      6,
    )).toBe('季度报告 · Alex · 2/6');
    expect(__exportPipelineTesting.formatPdfHeaderFooterText(
      '{filename} {date}',
      createInput({ filename: 'demo.md', date: '2026-05-15' }),
      0,
      1,
    )).toBe('demo.md 2026-05-15');
    expect(__exportPipelineTesting.normalizePdfChromeText(` ${'x'.repeat(200)} `)).toHaveLength(160);
  });

  it('positions pdf header and footer inside page margins', () => {
    expect(__exportPipelineTesting.getPdfHeaderY(841.89, 51, 14)).toBeCloseTo(809.39);
    expect(__exportPipelineTesting.getPdfFooterY(57)).toBeCloseTo(19.95);
  });
});

describe('export pipeline raster CSS compatibility', () => {
  it('removes modern color function declarations before html2canvas rendering', () => {
    const css = `
      .preview-compat {
        --preview-search-match-bg: color-mix(in srgb, #1c5d33 15%, transparent);
        color: #262626;
        box-shadow: 0 0 0 3px color-mix(in srgb, #1c5d33 18%, transparent), inset 0 1px 0 rgba(255, 255, 255, 0.28);
      }
      .prism-export-document {
        background: color(display-p3 1 1 1);
        border: 1px solid #dddddd;
      }
    `;

    const safeCss = __exportPipelineTesting.stripRasterUnsafeColorDeclarations(css);

    expect(safeCss).not.toContain('color-mix(');
    expect(safeCss).not.toContain('color(display-p3');
    expect(safeCss).toContain('color: #262626;');
    expect(safeCss).toContain('border: 1px solid #dddddd;');
  });

  it('normalizes WebKit color functions before html2canvas reads computed styles', () => {
    expect(
      __exportPipelineTesting.normalizeCssColorFunctionsForRaster('color(srgb 1 0.5 0 / 75%)'),
    ).toBe('rgba(255, 128, 0, 0.75)');
    expect(
      __exportPipelineTesting.normalizeCssColorFunctionsForRaster(
        '0 0 0 1px color(display-p3 0.1 0.2 0.3)',
      ),
    ).toBe('0 0 0 1px rgb(26, 51, 77)');
  });

  it('marks styled raw html blocks as atomic export blocks', () => {
    const root = document.createElement('div');
    root.className = 'prism-export-document';
    root.innerHTML = '<div style="border:1px solid #f59e0b;background:#fff7cc;padding:12px">警告</div>';

    __exportPipelineTesting.markExportAtomicBlocks(root);

    const block = root.querySelector<HTMLElement>('div[style]');
    expect(block?.classList.contains('prism-export-atomic')).toBe(true);
    expect(block?.dataset.prismExportAtomic).toBe('true');
  });
});

describe('export pipeline image progress', () => {
  const originalRequestAnimationFrame = globalThis.requestAnimationFrame;
  const originalImage = globalThis.Image;
  const originalCreateElement = document.createElement.bind(document);
  let createElementSpy: { mockRestore: () => void } | null = null;
  let getContextSpy: { mockRestore: () => void } | null = null;
  let toDataUrlSpy: { mockRestore: () => void } | null = null;
  let originalFonts: unknown;
  let iframeScrollMetrics: { width: number; height: number } | null = null;
  let iframeLinkRect: { left: number; top: number; width: number; height: number } | null = null;

  beforeEach(() => {
    iframeScrollMetrics = null;
    iframeLinkRect = null;
    fsMock.writeFile.mockClear();
    fsMock.writeTextFile.mockClear();
    mermaidMock.initialize.mockClear();
    mermaidMock.render.mockClear();
    canvasRenderMock.render.mockClear();
    invokeMock.mockReset();
    fsMock.remove.mockClear();
    delete (window as PrismRuntimeWindow).__TAURI_INTERNALS__;
    delete (window as PrismRuntimeWindow).__PRISM_EXPORT_WORKER__;
    document.documentElement.removeAttribute('data-content-theme');
    document.head.querySelectorAll('[data-prism-native-pdf]').forEach((element) => element.remove());
    document.body.className = '';
    document.body.replaceChildren();
    originalFonts = (document as any).fonts;
    Object.defineProperty(document, 'fonts', {
      configurable: true,
      value: { ready: Promise.resolve() },
    });
    globalThis.requestAnimationFrame = ((callback: FrameRequestCallback) => {
      window.setTimeout(() => callback(performance.now()), 0);
      return 1;
    }) as typeof requestAnimationFrame;
    createElementSpy = vi.spyOn(document, 'createElement').mockImplementation((tagName: any, options?: any) => {
      const element = originalCreateElement(tagName, options);
      if (String(tagName).toLowerCase() === 'iframe') {
        Object.defineProperty(element, 'srcdoc', {
          configurable: true,
          get: () => '',
          set: (value: string) => {
            window.setTimeout(() => {
              const frameDocument = (element as HTMLIFrameElement).contentDocument;
              if (frameDocument) {
                frameDocument.open();
                frameDocument.write(value);
                frameDocument.close();
                const frameHTMLElement = frameDocument.defaultView?.HTMLElement;
                if (frameHTMLElement && iframeScrollMetrics) {
                  Object.defineProperty(frameHTMLElement.prototype, 'scrollHeight', {
                    configurable: true,
                    get() {
                      return (this as HTMLElement).classList?.contains('prism-export-document')
                        ? iframeScrollMetrics?.height ?? 0
                        : 0;
                    },
                  });
                  Object.defineProperty(frameHTMLElement.prototype, 'scrollWidth', {
                    configurable: true,
                    get() {
                      return (this as HTMLElement).classList?.contains('prism-export-document')
                        ? iframeScrollMetrics?.width ?? 0
                        : 0;
                    },
                  });
                }
                if (frameHTMLElement && iframeLinkRect) {
                  const linkRect = iframeLinkRect;
                  Object.defineProperty(frameHTMLElement.prototype, 'getBoundingClientRect', {
                    configurable: true,
                    value() {
                      if ((this as HTMLElement).classList?.contains('prism-export-document')) {
                        return createTestRect(0, 0, iframeScrollMetrics?.width ?? 980, iframeScrollMetrics?.height ?? 1200);
                      }
                      if ((this as HTMLElement).tagName === 'A') {
                        return createTestRect(linkRect.left, linkRect.top, linkRect.width, linkRect.height);
                      }
                      return createTestRect(0, 0, 0, 0);
                    },
                  });
                  Object.defineProperty(frameHTMLElement.prototype, 'getClientRects', {
                    configurable: true,
                    value() {
                      if ((this as HTMLElement).tagName === 'A') {
                        return createTestRectList([
                          createTestRect(linkRect.left, linkRect.top, linkRect.width, linkRect.height),
                        ]);
                      }
                      return createTestRectList([]);
                    },
                  });
                }
              }
              (element as HTMLIFrameElement).onload?.(new Event('load'));
            }, 0);
          },
        });
      }
      return element;
    });
    globalThis.Image = class {
      width = 320;
      height = 200;
      onload: ((event: Event) => void) | null = null;
      onerror: ((event: Event) => void) | null = null;

      set src(_value: string) {
        window.setTimeout(() => this.onload?.(new Event('load')), 0);
      }
    } as typeof Image;
    getContextSpy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      scale: vi.fn(),
      fillRect: vi.fn(),
      drawImage: vi.fn(),
      fillText: vi.fn(),
      measureText: vi.fn((text: string) => ({ width: text.length * 7 })),
    } as unknown as CanvasRenderingContext2D);
    toDataUrlSpy = vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockImplementation((type?: string) => (
      type === 'image/jpeg'
        ? 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2w=='
        : 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII='
    ));
  });

  afterEach(() => {
    if (originalRequestAnimationFrame) {
      globalThis.requestAnimationFrame = originalRequestAnimationFrame;
    } else {
      delete (globalThis as Partial<typeof globalThis>).requestAnimationFrame;
    }
    globalThis.Image = originalImage;
    createElementSpy?.mockRestore();
    createElementSpy = null;
    getContextSpy?.mockRestore();
    getContextSpy = null;
    toDataUrlSpy?.mockRestore();
    toDataUrlSpy = null;
    if (originalFonts) {
      Object.defineProperty(document, 'fonts', {
        configurable: true,
        value: originalFonts,
      });
    } else {
      delete (document as any).fonts;
    }
  });

  it('renders the golden markdown fixture through png and pdf image exports', async () => {
    const options = resolveExportOptions({
      content: EXPORT_GOLDEN_MARKDOWN,
      filename: 'golden.md',
      settings: {
        ...DEFAULT_SETTINGS,
        contentTheme: 'miaoyan',
        exportDefaults: {
          ...DEFAULT_SETTINGS.exportDefaults,
          frontMatterOverrides: true,
          htmlIncludeTheme: true,
        },
      },
    });

    await exportPng(options, '/tmp/golden.png');
    await exportPdf(options, '/tmp/golden.pdf');

    expect(fsMock.writeFile.mock.calls.map(([path]) => path)).toEqual([
      '/tmp/golden.png',
      '/tmp/golden.pdf',
    ]);
    expect(canvasRenderMock.render).toHaveBeenCalledTimes(2);
    expect(mermaidMock.render).toHaveBeenCalledTimes(2);
  });

  it('reports diagnostic progress stages for png export', async () => {
    const onProgress = vi.fn();

    await exportPng(createInput({ onProgress }), '/tmp/progress.png');

    expect(onProgress.mock.calls.map(([message]) => message)).toEqual([
      '正在解析 Markdown',
      '正在应用导出主题',
      '正在渲染图表',
      '正在生成 PNG 文件',
      '正在写入 PNG 文件',
    ]);
    expect(canvasRenderMock.render).toHaveBeenCalled();
  });

  it('does not reload the generated png data url to determine export size', async () => {
    fsMock.writeFile.mockClear();
    globalThis.Image = class {
      onload: ((event: Event) => void) | null = null;
      onerror: ((event: Event) => void) | null = null;

      set src(_value: string) {
        window.setTimeout(() => this.onerror?.(new Event('error')), 0);
      }
    } as typeof Image;
    canvasRenderMock.render.mockResolvedValueOnce({
      width: 640,
      height: 1200,
      toDataURL: () => 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=',
    });

    await exportPng(createInput(), '/tmp/no-reload.png');

    expect(fsMock.writeFile).toHaveBeenCalledWith('/tmp/no-reload.png', expect.any(Uint8Array));
  });

  it('rejects over-limit png exports instead of lowering the requested scale', async () => {
    fsMock.writeFile.mockClear();
    canvasRenderMock.render.mockClear();
    const warnings: string[] = [];
    iframeScrollMetrics = { width: 980, height: 60_000 };

    try {
      await expect(exportPng(createInput({
        pngScale: 2,
        onWarning: (message) => warnings.push(message),
      }), '/tmp/too-tall.png')).rejects.toThrow('PNG 导出画布超出系统限制');
    } finally {
      iframeScrollMetrics = null;
    }

    expect(warnings).toEqual([]);
    expect(canvasRenderMock.render).not.toHaveBeenCalled();
    expect(fsMock.writeFile).not.toHaveBeenCalled();
  });

  it('renders long pdf documents in multi-page batches without lowering scale', async () => {
    fsMock.writeFile.mockClear();
    canvasRenderMock.render.mockClear();
    const warnings: string[] = [];
    const progress: string[] = [];
    iframeScrollMetrics = { width: 980, height: 60_000 };

    try {
      await exportPdf(createInput({
        onProgress: (message) => progress.push(message),
        onWarning: (message) => warnings.push(message),
      }), '/tmp/long.pdf');
    } finally {
      iframeScrollMetrics = null;
    }

    const renderCalls = canvasRenderMock.render.mock.calls as unknown as Array<[
      HTMLElement,
      { scale: number; height: number; windowHeight: number },
    ]>;
    expect(renderCalls.length).toBeGreaterThan(1);
    expect(renderCalls.every(([, options]) => options.scale === 2)).toBe(true);
    expect(renderCalls.every(([, options]) => options.windowHeight < 60_000)).toBe(true);
    expect(progress.some((message) => /正在生成 PDF 页面 1-\d+ \/ \d+/.test(message))).toBe(true);
    expect(warnings).not.toEqual(expect.arrayContaining([expect.stringContaining('0.21x')]));
    const { PDFDocument } = await import('pdf-lib');
    const bytes = fsMock.writeFile.mock.calls[0][1] as Uint8Array;
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBeGreaterThan(renderCalls.length);
    expect(renderCalls.some(([, options]) => options.height > 4096)).toBe(true);
  });

  it('stops pdf export before rendering documents with excessive page counts', async () => {
    fsMock.writeFile.mockClear();
    canvasRenderMock.render.mockClear();
    iframeScrollMetrics = { width: 980, height: 1_000_000 };

    try {
      await expect(exportPdf(createInput(), '/tmp/too-many-pages.pdf')).rejects.toThrow('PDF 页数过多');
    } finally {
      iframeScrollMetrics = null;
    }

    expect(canvasRenderMock.render).not.toHaveBeenCalled();
    expect(fsMock.writeFile).not.toHaveBeenCalled();
  });

  it('fails pdf export with a diagnostic error when a page render stalls', async () => {
    fsMock.writeFile.mockClear();
    canvasRenderMock.render.mockClear();
    vi.useFakeTimers();
    canvasRenderMock.render.mockReturnValueOnce(new Promise(() => {}) as never);

    try {
      const exportPromise = exportPdf(createInput(), '/tmp/stalled.pdf');
      const assertion = expect(exportPromise).rejects.toThrow('PDF 第 1 页渲染超时');
      await vi.runAllTimersAsync();
      await assertion;
    } finally {
      vi.useRealTimers();
    }

    expect(fsMock.writeFile).not.toHaveBeenCalled();
  });

  it('reports diagnostic progress stages for pdf export', async () => {
    const onProgress = vi.fn();

    await exportPdf(createInput({ onProgress }), '/tmp/progress.pdf');

    expect(onProgress.mock.calls.map(([message]) => message)).toEqual([
      '正在解析 Markdown',
      '正在应用导出主题',
      '正在渲染图表',
      '正在生成 PDF 页面 1 / 1',
      '正在生成 PDF 文件',
      '正在写入 PDF 文件',
    ]);
    expect(canvasRenderMock.render).toHaveBeenCalled();
  });

  it('adds URI annotations for linked images in pdf export', async () => {
    fsMock.writeFile.mockClear();
    canvasRenderMock.render.mockClear();
    iframeScrollMetrics = { width: 980, height: 1200 };
    iframeLinkRect = { left: 120, top: 160, width: 240, height: 120 };

    try {
      await exportPdf(createInput({
        content: '# Linked image\n\n[![点击访问](https://example.com/image.png)](https://example.com)',
      }), '/tmp/linked-image.pdf');
    } finally {
      iframeScrollMetrics = null;
      iframeLinkRect = null;
    }

    const bytes = fsMock.writeFile.mock.calls[0][1] as Uint8Array;
    const { PDFDict, PDFDocument, PDFName, PDFString } = await import('pdf-lib');
    const pdf = await PDFDocument.load(bytes);
    const annots = pdf.getPage(0).node.Annots();
    expect(annots?.size()).toBe(1);
    const annotation = pdf.context.lookup(annots!.get(0), PDFDict);
    const action = pdf.context.lookup(annotation.get(PDFName.of('A')), PDFDict);
    expect(annotation.get(PDFName.of('Subtype'))?.toString()).toBe('/Link');
    expect(action.lookup(PDFName.of('URI'), PDFString).asString()).toBe('https://example.com/');
  });

  it('inserts pdf pagination spacers before atomic blocks that would be cut by a page boundary', async () => {
    const root = document.createElement('div');
    const block = document.createElement('div');
    block.className = 'prism-export-atomic';
    root.appendChild(block);
    document.body.appendChild(root);

    try {
      root.getBoundingClientRect = vi.fn(() => ({
        x: 0,
        y: 0,
        top: 0,
        left: 0,
        right: 980,
        bottom: 300,
        width: 980,
        height: 300,
        toJSON: () => ({}),
      } as DOMRect));
      block.getBoundingClientRect = vi.fn(() => {
        const hasSpacer = Boolean(root.querySelector('.prism-export-page-spacer'));
        const top = hasSpacer ? 100 : 80;
        return {
          x: 0,
          y: top,
          top,
          left: 0,
          right: 400,
          bottom: top + 40,
          width: 400,
          height: 40,
          toJSON: () => ({}),
        } as DOMRect;
      });

      await __exportPipelineTesting.prepareExportAtomicPagination(root, 100);

      const spacer = root.querySelector<HTMLElement>('.prism-export-page-spacer');
      expect(spacer).toBeTruthy();
      expect(spacer?.style.height).toBe('20px');
      expect(spacer?.nextSibling).toBe(block);
    } finally {
      root.remove();
    }
  });

  it('keeps headings attached to following raw html visual blocks during pdf pagination', async () => {
    const root = document.createElement('div');
    const heading = document.createElement('h3');
    const block = document.createElement('div');
    heading.textContent = '4.3 嵌套 HTML';
    block.className = 'prism-export-atomic';
    block.textContent = '警告';
    root.append(heading, block);
    document.body.appendChild(root);

    const getBoundingClientRectSpy = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockImplementation(function getBoundingClientRect(this: HTMLElement) {
        if (this === root) {
          return {
            x: 0,
            y: 0,
            top: 0,
            left: 0,
            right: 980,
            bottom: 300,
            width: 980,
            height: 300,
            toJSON: () => ({}),
          } as DOMRect;
        }
        if (this.classList.contains('prism-export-atomic-group')) {
          const hasSpacer = Boolean(root.querySelector('.prism-export-page-spacer'));
          const top = hasSpacer ? 100 : 80;
          return {
            x: 0,
            y: top,
            top,
            left: 0,
            right: 400,
            bottom: top + 60,
            width: 400,
            height: 60,
            toJSON: () => ({}),
          } as DOMRect;
        }
        if (this === heading) {
          return {
            x: 0,
            y: 80,
            top: 80,
            left: 0,
            right: 400,
            bottom: 100,
            width: 400,
            height: 20,
            toJSON: () => ({}),
          } as DOMRect;
        }
        if (this === block) {
          return {
            x: 0,
            y: 100,
            top: 100,
            left: 0,
            right: 400,
            bottom: 140,
            width: 400,
            height: 40,
            toJSON: () => ({}),
          } as DOMRect;
        }
        return {
          x: 0,
          y: 0,
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: 0,
          height: 0,
          toJSON: () => ({}),
        } as DOMRect;
      });

    try {
      await __exportPipelineTesting.prepareExportAtomicPagination(root, 100);

      const group = root.querySelector<HTMLElement>('.prism-export-atomic-group');
      const spacer = root.querySelector<HTMLElement>('.prism-export-page-spacer');
      expect(group).toBeTruthy();
      expect(group?.contains(heading)).toBe(true);
      expect(group?.contains(block)).toBe(true);
      expect(spacer).toBeTruthy();
      expect(spacer?.style.height).toBe('20px');
      expect(spacer?.nextSibling).toBe(group);
      expect(block.previousSibling).not.toBe(spacer);
    } finally {
      getBoundingClientRectSpy.mockRestore();
      root.remove();
    }
  });

  it('uses the WebKit PDF engine inside the Tauri export worker before raster fallback', async () => {
    (window as PrismRuntimeWindow).__TAURI_INTERNALS__ = {};
    (window as PrismRuntimeWindow).__PRISM_EXPORT_WORKER__ = true;
    invokeMock.mockResolvedValueOnce(undefined);
    const { PDFDocument, StandardFonts } = await import('pdf-lib');
    const sourcePdf = await PDFDocument.create();
    const sourceFont = await sourcePdf.embedFont(StandardFonts.Helvetica);
    sourcePdf.addPage([980, 1400]).drawText('Vector PDF source', {
      x: 24,
      y: 1360,
      size: 12,
      font: sourceFont,
    });
    fsMock.readFile.mockResolvedValueOnce(new Uint8Array(await sourcePdf.save()));
    const onProgress = vi.fn();
    const warnings: string[] = [];

    await exportPdf(createInput({
      onProgress,
      onWarning: (message) => warnings.push(message),
      pdfPaper: 'letter',
      pdfMargin: 'wide',
    }), '/tmp/native.pdf');

    expect(warnings).toEqual([]);
    expect(invokeMock).toHaveBeenCalledWith('capture_current_webview_pdf', {
      outputPath: '/tmp/native.webkit-capture-1.pdf',
      x: expect.any(Number),
      y: expect.any(Number),
      width: expect.any(Number),
      height: expect.any(Number),
    });
    expect(canvasRenderMock.render).not.toHaveBeenCalled();
    expect(fsMock.writeFile).toHaveBeenCalledWith('/tmp/native.pdf', expect.any(Uint8Array));
    expect(fsMock.remove).toHaveBeenCalledWith('/tmp/native.webkit-capture-1.pdf');
    expect(onProgress.mock.calls.map(([message]) => message)).toEqual([
      '正在准备 WebKit PDF 文档',
      '正在解析 Markdown',
      '正在应用导出主题',
      '正在渲染图表',
      '正在调用 WebKit PDF 引擎',
      '正在捕获 PDF 页面 1 / 1',
      '正在写入 PDF 文件',
    ]);
    expect(document.body.querySelector('.prism-export-document')).not.toBeNull();
    expect(document.head.querySelector('[data-prism-native-pdf]')).not.toBeNull();
  });

  it('keeps native PDF content and overlays only small chrome when headers or page numbers are enabled', async () => {
    (window as PrismRuntimeWindow).__TAURI_INTERNALS__ = {};
    (window as PrismRuntimeWindow).__PRISM_EXPORT_WORKER__ = true;
    invokeMock.mockResolvedValueOnce(undefined);
    const { PDFDocument, StandardFonts } = await import('pdf-lib');
    const pdf = await PDFDocument.create();
    const sourceFont = await pdf.embedFont(StandardFonts.Helvetica);
    pdf.addPage([980, 1200]).drawText('Vector PDF source', {
      x: 24,
      y: 1160,
      size: 12,
      font: sourceFont,
    });
    const sourceBytes = new Uint8Array(await pdf.save());
    fsMock.readFile
      .mockResolvedValueOnce(sourceBytes)
      .mockResolvedValueOnce(sourceBytes);
    const warnings: string[] = [];

    await exportPdf(createInput({
      onWarning: (message) => warnings.push(message),
      pageHeaderFooter: true,
      pageHeaderText: '{title}',
      pageFooterText: '{filename} · {page}/{pages}',
      pdfPageNumbers: true,
      title: '导出标题',
    }), '/tmp/native-chrome.pdf');

    expect(warnings).toEqual([]);
    expect(canvasRenderMock.render).not.toHaveBeenCalled();
    expect(fsMock.readFile).toHaveBeenCalledWith('/tmp/native-chrome.webkit-capture-1.pdf');
    expect(fsMock.readFile).toHaveBeenCalledWith('/tmp/native-chrome.pdf');
    expect(fsMock.writeFile).toHaveBeenCalledWith('/tmp/native-chrome.pdf', expect.any(Uint8Array));
    const lastWrite = fsMock.writeFile.mock.calls.at(-1);
    const updated = await PDFDocument.load(lastWrite?.[1] as Uint8Array);
    expect(updated.getPageCount()).toBe(1);
  });

  it('captures long native PDF documents in bounded batches without rasterizing pages', async () => {
    const scrollHeightDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollHeight');
    const scrollWidthDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollWidth');
    const getBoundingClientRectSpy = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockImplementation(function getBoundingClientRect(this: HTMLElement) {
        if (this.classList?.contains('prism-export-document')) {
          return {
            x: 0,
            y: 0,
            top: 0,
            left: 0,
            right: 980,
            bottom: 18_000,
            width: 980,
            height: 18_000,
            toJSON: () => ({}),
          } as DOMRect;
        }
        return {
          x: 0,
          y: 0,
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: 0,
          height: 0,
          toJSON: () => ({}),
        } as DOMRect;
      });
    Object.defineProperty(HTMLElement.prototype, 'scrollHeight', {
      configurable: true,
      get() {
        return (this as HTMLElement).classList?.contains('prism-export-document') ? 18_000 : 0;
      },
    });
    Object.defineProperty(HTMLElement.prototype, 'scrollWidth', {
      configurable: true,
      get() {
        return (this as HTMLElement).classList?.contains('prism-export-document') ? 980 : 0;
      },
    });

    try {
      (window as PrismRuntimeWindow).__TAURI_INTERNALS__ = {};
      (window as PrismRuntimeWindow).__PRISM_EXPORT_WORKER__ = true;
      invokeMock.mockResolvedValue(undefined);
      const { PDFDocument, StandardFonts } = await import('pdf-lib');
      const sourcePdf = await PDFDocument.create();
      const sourceFont = await sourcePdf.embedFont(StandardFonts.Helvetica);
      sourcePdf.addPage([980, 12_000]).drawText('Vector batch source', {
        x: 24,
        y: 11_960,
        size: 12,
        font: sourceFont,
      });
      fsMock.readFile.mockResolvedValue(new Uint8Array(await sourcePdf.save()));
      const progress: string[] = [];

      await exportPdf(createInput({
        onProgress: (message) => progress.push(message),
      }), '/tmp/native-long.pdf');

      expect(invokeMock).toHaveBeenCalledTimes(2);
      expect(invokeMock).toHaveBeenNthCalledWith(1, 'capture_current_webview_pdf', expect.objectContaining({
        outputPath: '/tmp/native-long.webkit-capture-1.pdf',
      }));
      expect(invokeMock).toHaveBeenNthCalledWith(2, 'capture_current_webview_pdf', expect.objectContaining({
        outputPath: '/tmp/native-long.webkit-capture-2.pdf',
      }));
      expect(canvasRenderMock.render).not.toHaveBeenCalled();
      expect(fsMock.remove).toHaveBeenCalledWith('/tmp/native-long.webkit-capture-1.pdf');
      expect(fsMock.remove).toHaveBeenCalledWith('/tmp/native-long.webkit-capture-2.pdf');
      expect(progress).toContain('正在捕获 PDF 页面 1-8 / 13');
      expect(progress).toContain('正在捕获 PDF 页面 9-13 / 13');
      const write = fsMock.writeFile.mock.calls.find(([targetPath]) => targetPath === '/tmp/native-long.pdf');
      const pdf = await PDFDocument.load(write?.[1] as Uint8Array);
      expect(pdf.getPageCount()).toBe(13);
    } finally {
      getBoundingClientRectSpy.mockRestore();
      if (scrollHeightDescriptor) {
        Object.defineProperty(HTMLElement.prototype, 'scrollHeight', scrollHeightDescriptor);
      } else {
        delete (HTMLElement.prototype as unknown as Record<string, unknown>).scrollHeight;
      }
      if (scrollWidthDescriptor) {
        Object.defineProperty(HTMLElement.prototype, 'scrollWidth', scrollWidthDescriptor);
      } else {
        delete (HTMLElement.prototype as unknown as Record<string, unknown>).scrollWidth;
      }
    }
  });

  it('falls back to the raster PDF engine with a warning when WebKit capture fails', async () => {
    (window as PrismRuntimeWindow).__TAURI_INTERNALS__ = {};
    (window as PrismRuntimeWindow).__PRISM_EXPORT_WORKER__ = true;
    invokeMock.mockRejectedValueOnce(new Error('native unavailable'));
    const warnings: string[] = [];

    await exportPdf(createInput({
      onWarning: (message) => warnings.push(message),
    }), '/tmp/fallback.pdf');

    expect(warnings).toEqual([
      'WebKit PDF 引擎不可用，已回退兼容导出管线：native unavailable',
    ]);
    expect(canvasRenderMock.render).toHaveBeenCalled();
    expect(fsMock.writeFile).toHaveBeenCalledWith('/tmp/fallback.pdf', expect.any(Uint8Array));
  });

  it('writes complex export smoke artifacts for all supported formats', async () => {
    const outDir = path.resolve(process.cwd(), '.codex-smoke/complex-export/out');
    const outputPaths = {
      html: path.join(outDir, 'complex-export.html'),
      pdf: path.join(outDir, 'complex-export.pdf'),
      png: path.join(outDir, 'complex-export.png'),
      docx: path.join(outDir, 'complex-export.docx'),
    };
    const warnings: string[] = [];

    await mkdir(outDir, { recursive: true });
    fsMock.writeTextFile.mockImplementation(async (targetPath: string, contents: string) => {
      await mkdir(path.dirname(targetPath), { recursive: true });
      await writeNodeFile(targetPath, contents, 'utf8');
    });
    fsMock.writeFile.mockImplementation(async (targetPath: string, contents: Uint8Array) => {
      await mkdir(path.dirname(targetPath), { recursive: true });
      await writeNodeFile(targetPath, Buffer.from(contents));
    });

    try {
      const options = resolveExportOptions({
        content: COMPLEX_EXPORT_SMOKE_MARKDOWN,
        filename: 'complex-export.md',
        settings: {
          ...DEFAULT_SETTINGS,
          contentTheme: 'miaoyan',
          exportDefaults: {
            ...DEFAULT_SETTINGS.exportDefaults,
            frontMatterOverrides: true,
            htmlIncludeTheme: true,
            toc: true,
            pageHeaderFooter: true,
            pageHeaderText: '{title}',
            pageFooterText: '{filename} · {page}/{pages}',
            pdfPageNumbers: true,
          },
          citation: {
            bibliographyPath: '/tmp/prism-smoke-library.bib',
            cslStylePath: '',
          },
          pandoc: {
            ...DEFAULT_SETTINGS.pandoc,
            lastError: 'pandoc command not found',
          },
        },
        onWarning: (message) => warnings.push(message),
      });

      await exportHtml(options, outputPaths.html);
      await exportPdf(options, outputPaths.pdf);
      await exportPng(options, outputPaths.png);
      await exportDocx(options, outputPaths.docx);

      for (const targetPath of Object.values(outputPaths)) {
        expect((await stat(targetPath)).size).toBeGreaterThan(0);
      }

      const html = await readFile(outputPaths.html, 'utf8');
      expect(html).toContain('<title>导出 Smoke 验收文档</title>');
      expect(html).toContain('prism-export-toc');
      expect(html).toContain('<table');
      expect(html).toContain('Golden Mermaid');
      expect(html).toContain('class="katex');
      expect(html).toContain('assets/prism-export-figure.png');
      expect(html).toContain('[@doe2024]');

      const { PDFDocument } = await import('pdf-lib');
      const pdf = await PDFDocument.load(new Uint8Array(await readFile(outputPaths.pdf)));
      expect(pdf.getPageCount()).toBeGreaterThanOrEqual(1);
      expect(pdf.getPage(0).getWidth()).toBeCloseTo(595.28, 1);
      expect(pdf.getPage(0).getHeight()).toBeCloseTo(841.89, 1);

      const pngBytes = await readFile(outputPaths.png);
      expect(Array.from(pngBytes.slice(0, 8))).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);

      const { default: JSZip } = await import('jszip');
      const docx = await JSZip.loadAsync(await readFile(outputPaths.docx));
      const documentXml = await docx.file('word/document.xml')?.async('string');
      const mediaFiles = Object.keys(docx.files).filter((filePath) => filePath.startsWith('word/media/'));
      expect(documentXml).toContain('导出 Smoke 验收文档');
      expect(documentXml).toContain('Prism Export Smoke');
      expect(documentXml).toContain('项目');
      expect(documentXml).not.toContain('graph TD');
      expect(mediaFiles.some((filePath) => /\.(png|jpe?g|svg)$/.test(filePath))).toBe(true);

      expect(warnings.some((message) => message.includes('Pandoc 未检测成功'))).toBe(true);
    } finally {
      resetFsMockImplementations();
    }
  });
});

describe('export pipeline docx header and footer', () => {
  const originalImage = globalThis.Image;
  let getContextSpy: { mockRestore: () => void } | null = null;
  let toDataUrlSpy: { mockRestore: () => void } | null = null;

  beforeEach(() => {
    fsMock.readFile.mockClear();
    globalThis.Image = class {
      onload: ((event: Event) => void) | null = null;
      onerror: ((event: Event) => void) | null = null;

      set src(_value: string) {
        window.setTimeout(() => this.onload?.(new Event('load')), 0);
      }
    } as typeof Image;
    getContextSpy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      scale: vi.fn(),
      fillRect: vi.fn(),
      drawImage: vi.fn(),
      fillText: vi.fn(),
      measureText: vi.fn((text: string) => ({ width: text.length * 7 })),
    } as unknown as CanvasRenderingContext2D);
    toDataUrlSpy = vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockImplementation((type?: string) => (
      type === 'image/jpeg'
        ? 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2w=='
        : 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII='
    ));
  });

  afterEach(() => {
    globalThis.Image = originalImage;
    getContextSpy?.mockRestore();
    getContextSpy = null;
    toDataUrlSpy?.mockRestore();
    toDataUrlSpy = null;
  });

  it('writes configured header and footer tokens to docx parts', async () => {
    fsMock.writeFile.mockClear();

    await exportDocx(createInput({
      title: '季度报告',
      pageHeaderFooter: true,
      pageHeaderText: '{title}',
      pageFooterText: '{filename} · {page}/{pages}',
      pdfPageNumbers: false,
    }), '/tmp/demo.docx');

    const { default: JSZip } = await import('jszip');
    const bytes = fsMock.writeFile.mock.calls[0][1] as Uint8Array;
    const zip = await JSZip.loadAsync(bytes);
    const headerXml = await zip.file('word/header1.xml')?.async('string');
    const footerXml = await zip.file('word/footer1.xml')?.async('string');

    expect(headerXml).toContain('季度报告');
    expect(footerXml).toContain('demo.md');
    expect(footerXml).toContain('PAGE');
    expect(footerXml).toContain('NUMPAGES');
  });

  it('exports the docx golden fixture with toc, table, code, and chinese text', async () => {
    fsMock.writeFile.mockClear();

    await exportDocx(createInput({
      content: EXPORT_GOLDEN_DOCX_MARKDOWN,
      title: '导出验收文档',
      toc: true,
      pageHeaderFooter: true,
      pageHeaderText: '{title}',
      pageFooterText: '{filename}',
      pdfPageNumbers: true,
    }), '/tmp/golden.docx');

    const { default: JSZip } = await import('jszip');
    const bytes = fsMock.writeFile.mock.calls[0][1] as Uint8Array;
    const zip = await JSZip.loadAsync(bytes);
    const documentXml = await zip.file('word/document.xml')?.async('string');
    const headerXml = await zip.file('word/header1.xml')?.async('string');
    const footerXml = await zip.file('word/footer1.xml')?.async('string');
    const mediaFiles = Object.keys(zip.files).filter((path) => path.startsWith('word/media/'));

    expect(documentXml).toContain('目录');
    expect(documentXml).toContain('导出验收文档');
    expect(documentXml).toContain('项目');
    expect(documentXml).toMatch(/<w:tcW w:type="dxa" w:w="\d+"/);
    expect(documentXml).toMatch(/<w:gridCol w:w="\d+"/);
    expect(documentXml).toContain('<w:gridCol w:w="9866"/>');
    expect(documentXml).toContain('const title');
    expect(documentXml).not.toContain('graph TD');
    expect(mediaFiles.some((path) => /\.(png|jpe?g|svg)$/.test(path))).toBe(true);
    expect(headerXml).toContain('导出验收文档');
    expect(footerXml).toContain('demo.md');
    expect(footerXml).toContain('PAGE');
    expect(footerXml).toContain('NUMPAGES');
    expect(mermaidMock.render).toHaveBeenCalled();
  });

  it('exports GFM task lists as readable checked and unchecked items in docx', async () => {
    fsMock.writeFile.mockClear();

    await exportDocx(createInput({
      content: '# 任务\n\n- [x] 已完成\n- [ ] 待确认\n',
    }), '/tmp/tasks.docx');

    const { default: JSZip } = await import('jszip');
    const bytes = fsMock.writeFile.mock.calls[0][1] as Uint8Array;
    const zip = await JSZip.loadAsync(bytes);
    const documentXml = await zip.file('word/document.xml')?.async('string');

    expect(documentXml).toContain('☑');
    expect(documentXml).toContain('已完成');
    expect(documentXml).toContain('☐');
    expect(documentXml).toContain('待确认');
  });

  it('embeds relative local svg images in docx output with a png fallback', async () => {
    fsMock.writeFile.mockClear();
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="120"><text>Local Docx SVG</text></svg>';
    fsMock.readFile.mockImplementationOnce(async (targetPath: string) => {
      expect(targetPath).toBe('/tmp/prism-doc/assets/logo.svg');
      return new TextEncoder().encode(svg);
    });

    await exportDocx(createInput({
      content: '# Local image\n\n![Logo](assets/logo.svg)',
      documentPath: '/tmp/prism-doc/article.md',
    } as Partial<ExportDocumentInput>), '/tmp/image.docx');

    const { default: JSZip } = await import('jszip');
    const bytes = fsMock.writeFile.mock.calls[0][1] as Uint8Array;
    const zip = await JSZip.loadAsync(bytes);
    const documentXml = await zip.file('word/document.xml')?.async('string');
    const mediaFiles = Object.keys(zip.files).filter((filePath) => filePath.startsWith('word/media/'));

    expect(fsMock.readFile).toHaveBeenCalledWith('/tmp/prism-doc/assets/logo.svg');
    expect(documentXml).toContain('<w:drawing>');
    expect(mediaFiles.some((filePath) => /\.svg$/.test(filePath))).toBe(true);
    expect(mediaFiles.some((filePath) => /\.png$/.test(filePath))).toBe(true);
  });

  it('keeps markdown image links clickable in docx output', async () => {
    fsMock.writeFile.mockClear();
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="120"><text>Linked SVG</text></svg>';
    fsMock.readFile.mockImplementationOnce(async (targetPath: string) => {
      expect(targetPath).toBe('/tmp/prism-doc/assets/logo.svg');
      return new TextEncoder().encode(svg);
    });

    await exportDocx(createInput({
      content: '# Linked image\n\n[![点击访问](assets/logo.svg)](https://example.com)',
      documentPath: '/tmp/prism-doc/article.md',
    } as Partial<ExportDocumentInput>), '/tmp/linked-image.docx');

    const { default: JSZip } = await import('jszip');
    const bytes = fsMock.writeFile.mock.calls[0][1] as Uint8Array;
    const zip = await JSZip.loadAsync(bytes);
    const documentXml = await zip.file('word/document.xml')?.async('string') ?? '';
    const relsXml = await zip.file('word/_rels/document.xml.rels')?.async('string') ?? '';
    const mediaFiles = Object.keys(zip.files).filter((filePath) => filePath.startsWith('word/media/'));

    expect(relsXml).toContain('Target="https://example.com"');
    expect(relsXml).toContain('relationships/hyperlink');
    expect(documentXml).toContain('<w:hyperlink');
    expect(documentXml).toContain('<a:hlinkClick');
    expect(documentXml).toContain('<w:drawing>');
    expect(documentXml).not.toContain('asvg:svgBlip');
    expect(mediaFiles.some((filePath) => /\.png$/.test(filePath))).toBe(true);
    expect(mediaFiles.some((filePath) => /\.svg$/.test(filePath))).toBe(false);
  });

  it('maps safe inline html elements to docx run styling', async () => {
    fsMock.writeFile.mockClear();

    await exportDocx(createInput({
      content: [
        '# Inline HTML',
        '',
        '文字中可以混合 <mark>高亮标记</mark>、<kbd>Ctrl</kbd>+<kbd>C</kbd> 键盘按键，以及 <abbr title="超文本传输协议">HTTP</abbr> 缩写。',
      ].join('\n'),
    }), '/tmp/inline-html.docx');

    const { default: JSZip } = await import('jszip');
    const bytes = fsMock.writeFile.mock.calls[0][1] as Uint8Array;
    const zip = await JSZip.loadAsync(bytes);
    const documentXml = await zip.file('word/document.xml')?.async('string') ?? '';

    expect(documentXml).toContain('高亮标记');
    expect(documentXml).toContain('Ctrl');
    expect(documentXml).toContain('HTTP');
    expect(documentXml).not.toContain('&lt;mark');
    expect(documentXml).not.toContain('&lt;kbd');
    expect(documentXml).not.toContain('&lt;abbr');
    expect(documentXml).toContain('<w:shd w:fill="FFF3A3"');
    expect(documentXml).toContain('<w:bdr');
    expect(documentXml).toContain('<w:u w:val="dotted"');
  });

  it('renders Mermaid docx diagrams as png-first images with root-level non-html labels', async () => {
    fsMock.writeFile.mockClear();
    canvasRenderMock.render.mockClear();
    mermaidMock.initialize.mockClear();
    mermaidMock.render.mockResolvedValueOnce({
      svg: [
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 80">',
        '<g class="node" transform="translate(60,40)">',
        '<rect x="-40" y="-20" width="80" height="40"></rect>',
        '<g class="label" transform="translate(-18,-10)">',
        '<foreignObject width="36" height="20">',
        '<div xmlns="http://www.w3.org/1999/xhtml"><span class="nodeLabel"><p>节点</p></span></div>',
        '</foreignObject>',
        '</g>',
        '</g>',
        '</svg>',
      ].join(''),
    });

    await exportDocx(createInput({
      content: '# Mermaid\n\n```mermaid\ngraph TD\nA[节点]-->B[结束]\n```',
    }), '/tmp/mermaid.docx');

    const { default: JSZip } = await import('jszip');
    const bytes = fsMock.writeFile.mock.calls[0][1] as Uint8Array;
    const zip = await JSZip.loadAsync(bytes);
    const mediaFiles = Object.keys(zip.files).filter((filePath) => filePath.startsWith('word/media/'));
    const documentXml = await zip.file('word/document.xml')?.async('string');

    expect(mermaidMock.initialize).toHaveBeenCalledWith(expect.objectContaining({
      htmlLabels: false,
      flowchart: expect.objectContaining({ htmlLabels: false }),
    }));
    expect(documentXml).toContain('<w:drawing>');
    expect(mediaFiles.some((filePath) => /\.svg$/.test(filePath))).toBe(false);
    expect(mediaFiles.some((filePath) => /\.png$/.test(filePath))).toBe(true);
    expect(documentXml).not.toContain('graph TD');
    expect(canvasRenderMock.render).toHaveBeenCalledWith(expect.any(HTMLElement), expect.objectContaining({
      width: 760,
      backgroundColor: expect.any(String),
    }));
    expect(documentXml).toContain('wp:extent cx="6191250"');
  });

  it('rasterizes rendered math and sanitized html blocks for docx visual fallback', async () => {
    fsMock.writeFile.mockClear();

    await exportDocx(createInput({
      content: [
        '# Rich blocks',
        '',
        'Inline math $E = mc^2$ keeps a rendered visual fallback.',
        '',
        '$$',
        '\\int_0^1 x^2 dx = \\frac{1}{3}',
        '$$',
        '',
        '<div class="callout"><strong>HTML 卡片</strong><span>完整渲染</span></div>',
      ].join('\n'),
    }), '/tmp/rich-blocks.docx');

    const { default: JSZip } = await import('jszip');
    const bytes = fsMock.writeFile.mock.calls[0][1] as Uint8Array;
    const zip = await JSZip.loadAsync(bytes);
    const documentXml = await zip.file('word/document.xml')?.async('string') ?? '';
    const mediaFiles = Object.keys(zip.files).filter((filePath) => filePath.startsWith('word/media/'));

    expect(documentXml).toContain('Rich blocks');
    expect(documentXml).toContain('Inline math');
    expect(documentXml).toContain('<w:drawing>');
    expect((documentXml.match(/<w:drawing>/g) ?? [])).toHaveLength(3);
    expect(mediaFiles.some((filePath) => /\.png$/.test(filePath))).toBe(true);
  });

  it('normalizes docx drawing ids for WPS-compatible image rendering', async () => {
    fsMock.writeFile.mockClear();
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="120"><text>WPS 图像</text></svg>';
    fsMock.readFile.mockImplementation(async () => new TextEncoder().encode(svg));

    await exportDocx(createInput({
      content: [
        '# Images',
        '',
        '![One](assets/one.svg)',
        '',
        '![Two](assets/two.svg)',
        '',
        '```mermaid',
        'graph TD',
        'A[开始]-->B[结束]',
        '```',
      ].join('\n'),
      documentPath: '/tmp/prism-doc/article.md',
    } as Partial<ExportDocumentInput>), '/tmp/wps-images.docx');

    const { default: JSZip } = await import('jszip');
    const bytes = fsMock.writeFile.mock.calls[0][1] as Uint8Array;
    const zip = await JSZip.loadAsync(bytes);
    const documentXml = await zip.file('word/document.xml')?.async('string') ?? '';
    const docPrIds = Array.from(documentXml.matchAll(/<wp:docPr\b[^>]*\bid="(\d+)"/g), (match) => match[1]);
    const cNvPrIds = Array.from(documentXml.matchAll(/<pic:cNvPr\b[^>]*\bid="(\d+)"/g), (match) => match[1]);

    expect(docPrIds).toHaveLength(3);
    expect(cNvPrIds).toHaveLength(3);
    expect(docPrIds).toEqual(['1', '2', '3']);
    expect(cNvPrIds).toEqual(['1', '2', '3']);
  });

  it('reports diagnostic progress stages for docx export', async () => {
    fsMock.writeFile.mockClear();
    mermaidMock.render.mockClear();
    const onProgress = vi.fn();

    await exportDocx(createInput({
      content: '# Intro\n\n```mermaid\ngraph TD\nA-->B\n```',
      onProgress,
    }), '/tmp/progress.docx');

    expect(onProgress.mock.calls.map(([message]) => message)).toEqual([
      '正在解析 Markdown',
      '正在应用导出主题',
      '正在渲染图表',
      '正在生成 Word 文件',
      '正在写入 Word 文件',
    ]);
    expect(mermaidMock.render).toHaveBeenCalled();
  });

  it('isolates Mermaid parser error artifacts during docx image rendering retries', async () => {
    fsMock.writeFile.mockClear();
    mermaidMock.render.mockClear();
    let renderContainer: Element | undefined;
    let sandboxWasConnectedDuringRender = false;
    mermaidMock.render.mockImplementationOnce(async (_id, _code, container?: Element) => {
      renderContainer = container;
      sandboxWasConnectedDuringRender = container?.isConnected ?? false;
      const artifact = document.createElement('svg');
      artifact.dataset.testid = 'mermaid-docx-error-artifact';
      artifact.textContent = 'Syntax error in text';
      (container ?? document.body).appendChild(artifact);
      throw new Error('Syntax error in text');
    });

    await exportDocx(createInput({
      content: '# Intro\n\n```mermaid\ngraph TD\n  A --> B\n```',
    }), '/tmp/retry.docx');

    expect(renderContainer).toBeInstanceOf(HTMLElement);
    expect((renderContainer as HTMLElement).dataset.prismExportMermaidSandbox).toBe('true');
    expect(sandboxWasConnectedDuringRender).toBe(true);
    expect((renderContainer as HTMLElement).isConnected).toBe(false);
    expect(document.body.querySelector('[data-testid="mermaid-docx-error-artifact"]')).toBeNull();
    expect(mermaidMock.render).toHaveBeenCalledTimes(2);
    expect(fsMock.writeFile).toHaveBeenCalledTimes(1);
  });
});
