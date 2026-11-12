/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { readFileMock } = vi.hoisted(() => ({ readFileMock: vi.fn() }));

vi.mock('../../../platform/tauri/fileSystem', () => ({
  readFile: readFileMock,
}));

import { buildPreviewClipboardHtml, stripPreviewInternalAttributes } from './previewClipboardHtml';

// td/th 上的完整内联样式（与实现对齐），拼四种对齐组合。
const CLIP_TH_STYLE = 'border:1px solid #d5d5d5;padding:4px 10px;background:#f2f2f2;vertical-align:top';
const CLIP_TD_STYLE = 'border:1px solid #d5d5d5;padding:4px 10px;vertical-align:top';

describe('buildPreviewClipboardHtml', () => {
  beforeEach(() => {
    readFileMock.mockReset();
  });

  it('inlines local preview images as data URLs and strips internal attributes', async () => {
    readFileMock.mockResolvedValue(new Uint8Array([1, 2, 3]));
    const html = '<p data-source-line="1">图文</p>'
      + '<img src="blob:prism-1" alt="示意图" class="md-img" data-prism-original-src="a.png" data-prism-file-src="/docs/a.png">';

    const result = await buildPreviewClipboardHtml(html);

    expect(readFileMock).toHaveBeenCalledWith('/docs/a.png');
    expect(result).toContain('src="data:image/png;base64,AQID"');
    expect(result).toContain('alt="示意图"');
    expect(result).toContain('class="md-img"');
    expect(result).not.toContain('blob:prism-1');
    expect(result).not.toContain('data-prism-');
    expect(result).not.toContain('data-source-line');
  });

  it('keeps the original src when the file cannot be read', async () => {
    readFileMock.mockRejectedValue(new Error('denied'));
    const html = '<img src="blob:prism-2" data-prism-file-src="/missing.png">';

    const result = await buildPreviewClipboardHtml(html);

    expect(result).toContain('src="blob:prism-2"');
    expect(result).not.toContain('data-prism-file-src');
  });

  it('keeps the original src when the image exceeds the inline size limit', async () => {
    readFileMock.mockResolvedValue(new Uint8Array(10 * 1024 * 1024 + 1));
    const html = '<img src="blob:prism-3" data-prism-file-src="/big.png">';

    const result = await buildPreviewClipboardHtml(html);

    expect(result).toContain('src="blob:prism-3"');
  });

  it('leaves external and data-URL images untouched without reading files', async () => {
    const html = '<img src="https://example.com/a.png"><img src="data:image/png;base64,AAAA">';

    const result = await buildPreviewClipboardHtml(html);

    expect(result).toContain('src="https://example.com/a.png"');
    expect(result).toContain('src="data:image/png;base64,AAAA"');
    expect(readFileMock).not.toHaveBeenCalled();
  });

  it('returns an empty string for blank input', async () => {
    expect(await buildPreviewClipboardHtml('')).toBe('');
    expect(await buildPreviewClipboardHtml('   ')).toBe('');
  });

  it('converts fast-path simple-table grids back to real tables', async () => {
    readFileMock.mockResolvedValue(new Uint8Array());
    const html = '<div class="prism-simple-table prism-simple-table--cols-3" data-line="12">'
      + '<span class="prism-simple-table__cell--left">项目</span>'
      + '<span class="prism-simple-table__cell--center">规则</span>'
      + '<span>备注</span>'
      + '<span class="prism-simple-table__cell--right">续发周期</span>'
      + '<span class="prism-simple-table__cell--center">1个自然年</span>'
      + '<span>按首次起算时间划分</span>'
      + '</div>';

    const result = await buildPreviewClipboardHtml(html);

    expect(result).not.toContain('prism-simple-table');
    expect(result).toContain('<table style="border-collapse:collapse">');
    expect(result).toContain('<thead><tr><th style=');
    expect(result).toContain(`<th style="text-align:left;${CLIP_TH_STYLE}">项目</th>`);
    expect(result).toContain(`<th style="text-align:center;${CLIP_TH_STYLE}">规则</th>`);
    expect(result).toContain(`<th style="${CLIP_TH_STYLE}">备注</th>`);
    expect(result).toContain(`<td style="text-align:right;${CLIP_TD_STYLE}">续发周期</td>`);
    expect(result).toContain(`<td style="text-align:center;${CLIP_TD_STYLE}">1个自然年</td>`);
    expect(result).toContain(`<td style="${CLIP_TD_STYLE}">按首次起算时间划分</td>`);
    expect(result).not.toContain('data-line');
  });

  it('applies minimal inline styles for paste targets without Prism CSS', async () => {
    readFileMock.mockResolvedValue(new Uint8Array());
    const html = '<table><thead><tr><th>列A</th></tr></thead><tbody><tr><td>单元格</td></tr></tbody></table>'
      + '<pre><code>const x = 1;</code></pre>'
      + '<p>行内 <code>x</code> 代码</p>'
      + '<blockquote>引用内容</blockquote>'
      + '<img src="https://example.com/a.png">';

    const result = await buildPreviewClipboardHtml(html);

    expect(result).toContain('<table style="border-collapse:collapse"');
    expect(result).toContain(`<th style="${CLIP_TH_STYLE}">列A</th>`);
    expect(result).toContain(`<td style="${CLIP_TD_STYLE}">单元格</td>`);
    expect(result).toContain('<pre style="background:#f6f8fa');
    expect(result).toContain('<p>行内 <code style="font-family:monospace');
    expect(result).toContain('<blockquote style="border-left:4px solid #d5d5d5');
    expect(result).toContain('src="https://example.com/a.png" style="max-width:100%"');
  });

  it('hardens pasted svg sizes from viewBox ratios', async () => {
    readFileMock.mockResolvedValue(new Uint8Array());
    const html = '<svg width="100%" style="max-width:490px" viewBox="0 0 490 678">'
      + '<path d="M0 0"></path></svg>';

    const result = await buildPreviewClipboardHtml(html);

    expect(result).toContain('width="490"');
    expect(result).toContain('height="678"');
  });

  it('gives viewbox-less svg a fallback height to avoid paste collapse', async () => {
    readFileMock.mockResolvedValue(new Uint8Array());
    const html = '<svg class="markmap-svg"><path d="M0 0"></path></svg>';

    const result = await buildPreviewClipboardHtml(html);

    expect(result).toContain('height="450"');
    expect(result).toContain('width="100%"');
  });

  it('leaves malformed simple-table grids untouched', async () => {
    readFileMock.mockResolvedValue(new Uint8Array());
    const html = '<div class="prism-simple-table prism-simple-table--cols-3">'
      + '<span>只有</span><span>两个</span>'
      + '</div>';

    const result = await buildPreviewClipboardHtml(html);

    expect(result).toContain('prism-simple-table');
  });
});

describe('stripPreviewInternalAttributes', () => {
  it('removes internal attributes while keeping content attributes', () => {
    const html = '<h1 data-source-line="1" data-line="1" id="标题">标题</h1>'
      + '<p data-katex="x%5E2">行内公式</p>'
      + '<div class="mermaid-placeholder" data-mermaid="graph%20TD"><svg viewBox="0 0 10 10"></svg></div>'
      + '<img src="blob:x" data-prism-original-src="a.png">';

    const cleaned = stripPreviewInternalAttributes(html);

    expect(cleaned).toContain('<h1 id="标题">标题</h1>');
    expect(cleaned).toContain('<p>行内公式</p>');
    expect(cleaned).toContain('<div class="mermaid-placeholder"><svg viewBox="0 0 10 10"></svg></div>');
    expect(cleaned).toContain('<img src="blob:x">');
    expect(cleaned).not.toContain('data-source-line');
    expect(cleaned).not.toContain('data-katex');
    expect(cleaned).not.toContain('data-mermaid');
    expect(cleaned).not.toContain('data-prism-');
  });
});
