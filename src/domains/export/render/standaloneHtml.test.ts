import { afterEach, describe, expect, it } from 'vitest';
import { buildStandaloneHtml } from './standaloneHtml';

describe('standaloneHtml', () => {
  afterEach(() => {
    document.body.className = '';
  });

  it('builds escaped standalone metadata without theme css when requested', async () => {
    const html = await buildStandaloneHtml({
      content: '# Hello',
      filename: 'draft.md',
      title: '<Title & "Meta">',
      author: 'Alex & Prism',
      date: '2026-05-21',
      contentTheme: 'miaoyan',
      locale: 'zh-CN',
    }, undefined, { includeTheme: false });

    expect(html).toContain('<html lang="zh-CN" data-content-theme="miaoyan">');
    expect(html).toContain('<title>&lt;Title &amp; &quot;Meta&quot;&gt;</title>');
    expect(html).toContain('<meta name="author" content="Alex &amp; Prism">');
    expect(html).toContain('<h1');
    expect(html).toContain('>Hello</h1>');
    expect(html).not.toContain('<style>');
  });

  it('clones a rendered root without fixed-position inline styles', async () => {
    document.body.classList.add('dark');
    const renderedRoot = document.createElement('div');
    renderedRoot.className = 'prism-export-document preview-compat preview-compat--miaoyan';
    renderedRoot.setAttribute('style', 'position: fixed; left: -12000px;');
    renderedRoot.innerHTML = '<div id="write"><p>Rendered</p></div>';

    const html = await buildStandaloneHtml({
      content: '# Ignored',
      filename: 'rendered.md',
      contentTheme: 'miaoyan',
    }, renderedRoot, { includeTheme: false });

    expect(html).toContain('<body class="dark">');
    expect(html).toContain('<div class="prism-export-document preview-compat preview-compat--miaoyan"><div id="write"><p>Rendered</p></div></div>');
    expect(html).not.toContain('position: fixed');
  });
});
