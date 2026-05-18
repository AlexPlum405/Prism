import { describe, expect, it } from 'vitest';
import { markdownToHtml } from './markdownToHtml';

function buildLongPreviewSmokeMarkdown() {
  const parts = ['# 预览同步 Smoke\n\n'];

  for (let section = 1; section <= 120; section += 1) {
    parts.push(`## 第 ${section} 节\n\n`);
    for (let paragraph = 1; paragraph <= 12; paragraph += 1) {
      parts.push(
        `这是第 ${section} 节第 ${paragraph} 段，用于验证长文滚动同步、源码行映射和预览刷新。` +
        `English words ${section}-${paragraph} 与中文混排，行内公式 $a_${section}${paragraph} + b = c$，` +
        '并包含足够长的正文来接近真实写作场景。\n\n',
      );
    }

    if (section % 15 === 0) {
      parts.push('```ts\nconst title = "Prism Preview Smoke";\nconsole.log(title);\n```\n\n');
    }
    if (section % 20 === 0) {
      parts.push('```mermaid\ngraph TD\n  A[源码] --> B[预览]\n  B --> C[点击跳转]\n```\n\n');
    }
  }

  parts.push('## KaTeX 错误\n\n$\\badcommand$\n');
  return parts.join('');
}

function buildMediaHeavyPreviewSmokeMarkdown() {
  const parts = ['# 重媒体预览 Smoke\n\n'];

  for (let section = 1; section <= 20; section += 1) {
    parts.push(`## 图文公式第 ${section} 节\n\n`);
    for (let paragraph = 1; paragraph <= 12; paragraph += 1) {
      parts.push(
        `这是第 ${section} 节第 ${paragraph} 段，包含中文长句、English words、` +
        `行内公式 $x_${section}_${paragraph} + y = z$，用于验证重媒体文档的基础预览解析。\n\n`,
      );
    }

    parts.push(`$$\nE_${section} = mc^2 + ${section}\n$$\n\n`);
    parts.push([
      '```mermaid',
      'graph TD',
      `  A${section}[Markdown] --> B${section}[Preview]`,
      `  B${section} --> C${section}[Source map]`,
      '```',
      '',
    ].join('\n'));

    const imageCount = section % 2 === 0 ? 2 : 3;
    for (let image = 1; image <= imageCount; image += 1) {
      parts.push(`![第 ${section}-${image} 张图](./assets/preview-${section}-${image}.png)\n\n`);
    }
  }

  return parts.join('');
}

describe('markdownToHtml compatibility modes', () => {
  const codeBlock = '```ts\nconst answer = 42;\n```';
  const compatibilityModes = ['miaoyan', 'inkstone', 'slate', 'mono', 'nocturne'] as const;

  it('keeps code blocks free of legacy Prism preview chrome by default', () => {
    const html = markdownToHtml(codeBlock);

    expect(html).toContain('<pre');
    expect(html).toContain('class="hljs language-ts"');
    expect(html).not.toContain('class="code-block"');
    expect(html).not.toContain('class="code-header"');
    expect(html).not.toContain('class="code-copy"');
  });

  it.each(compatibilityModes)('keeps %s code blocks in compatibility mode', (compatibilityMode) => {
    const html = markdownToHtml(codeBlock, { compatibilityMode });

    expect(html).toContain('<pre');
    expect(html).toContain('class="hljs language-ts"');
    expect(html).not.toContain('class="code-block"');
    expect(html).not.toContain('class="code-header"');
    expect(html).not.toContain('class="code-copy"');
  });

  it('auto-detects unlabeled fenced blocks like MiaoYan Highlightr', () => {
    const html = markdownToHtml('```\nconst answer = "42";\n```', { compatibilityMode: 'miaoyan' });

    expect(html).toContain('class="hljs');
    expect(html).toContain('hljs-string');
  });

  it('marks preview blocks with source line attributes for scroll and click mapping', () => {
    const html = markdownToHtml('# Title\n\nParagraph');

    expect(html).toContain('data-source-line="1"');
    expect(html).toContain('data-line="1"');
    expect(html).toContain('data-source-line="3"');
    expect(html).toContain('data-line="3"');
    expect(html.match(/data-source-line="1"/g)).toHaveLength(1);
  });

  it('can hide YAML front matter from preview while preserving source line offsets', () => {
    const html = markdownToHtml([
      '---',
      'title: Notion 增强人工测试',
      'tags:',
      '  - prism',
      '  - smoke',
      'description: 用于验证斜杠菜单、Callout、反链、属性面板和块级源码操作',
      'author: Alex',
      'date: 2026-05-18',
      'status: draft',
      'export: theme',
      '---',
      '',
      '# Notion 增强人工测试',
    ].join('\n'), { stripFrontMatter: true });

    expect(html).not.toContain('title: Notion');
    expect(html).not.toContain('description:');
    expect(html).toContain('<h1 data-source-line="13"');
    expect(html).toContain('Notion 增强人工测试');
  });

  it('renders YAML front matter as structured preview metadata while preserving source line offsets', () => {
    const html = markdownToHtml([
      '---',
      'title: Notion 增强人工测试',
      'tags:',
      '  - prism',
      '  - smoke',
      'description: 用于验证斜杠菜单、Callout、反链、属性面板和块级源码操作',
      'author: Alex',
      'date: 2026-05-18',
      'status: draft',
      'export:',
      '  template: theme',
      '---',
      '',
      '# Notion 增强人工测试',
    ].join('\n'), { frontMatterMode: 'metadata' });

    expect(html).toContain('class="prism-frontmatter-preview"');
    expect(html).toContain('文档属性');
    expect(html).toContain('Notion 增强人工测试');
    expect(html).toContain('prism-frontmatter-preview__tag">prism');
    expect(html).toContain('prism-frontmatter-preview__tag">smoke');
    expect(html).toContain('用于验证斜杠菜单');
    expect(html).toContain('template: theme');
    expect(html).not.toContain('title: Notion 增强人工测试');
    expect(html).not.toContain('tags:');
    expect(html).toContain('<h1 data-source-line="14"');
  });

  it('keeps YAML front matter in ordinary markdown output unless preview stripping is requested', () => {
    const html = markdownToHtml('---\ntitle: Draft\n---\n\n# Draft');

    expect(html).toContain('title: Draft');
    expect(html).toContain('<h1 data-source-line="5"');
  });

  it('keeps mermaid placeholders mapped to their source line', () => {
    const html = markdownToHtml('Intro\n\n```mermaid\ngraph TD\n```');

    expect(html).toContain('class="mermaid-placeholder"');
    expect(html).toContain('data-source-line="3"');
    expect(html).toContain('data-line="3"');
  });

  it('keeps display math mapped to its source line for diagnostics', () => {
    const html = markdownToHtml('Intro\n\n$$\nx^2\n$$');

    expect(html).toContain('data-source-line="3"');
    expect(html).toContain('data-line="3"');
  });

  it('renders Prism highlight marks without allowing raw HTML injection', () => {
    const html = markdownToHtml('==important & safe==');

    expect(html).toContain('<mark>');
    expect(html).toContain('important &#x26; safe');
    expect(html).not.toContain('<script>');
  });

  it('renders Pandoc citekeys as preview citation placeholders', () => {
    const html = markdownToHtml('研究结论参考 [@doe2024; @smith-2023, p. 12]。');

    expect(html).toContain('class="prism-citation"');
    expect(html).toContain('data-citekeys="doe2024 smith-2023"');
    expect(html).toContain('title="引用占位：@doe2024, @smith-2023"');
    expect(html).toContain('[@doe2024; @smith-2023, p. 12]');
  });

  it('renders suppress-author and richer Pandoc citekeys as citation placeholders', () => {
    const html = markdownToHtml('研究结论参考 [-@doe/2024; @team+paper_2026]。');

    expect(html).toContain('class="prism-citation"');
    expect(html).toContain('data-citekeys="doe/2024 team+paper_2026"');
    expect(html).toContain('title="引用占位：@doe/2024, @team+paper_2026"');
  });

  it('does not render citekeys inside links or code as citation placeholders', () => {
    const html = markdownToHtml([
      '[link @doe2024](https://example.com) `[@smith2023]`',
      '',
      '```md',
      'literal citation [@code2026]',
      '```',
    ].join('\n'));

    expect(html).not.toContain('class="prism-citation"');
    expect(html).toContain('<a href="https://example.com">link @doe2024</a>');
    expect(html).toContain('<code>[@smith2023]</code>');
    expect(html).toContain('literal citation [@code2026]');
  });

  it('keeps user-authored inline HTML but strips dangerous attributes and tags', () => {
    const html = markdownToHtml('<img src=x onerror="alert(1)">\n\n<script>alert(1)</script>\n\n<div style="color:red">styled</div>');

    expect(html).not.toContain('onerror');
    expect(html).not.toContain('<script>');
    expect(html).toContain('style="color:red"');
    expect(html).toContain('styled');
  });

  it('does not preserve javascript hrefs in generated preview links', () => {
    const html = markdownToHtml('[bad](javascript:alert(1)) [ok](https://example.com)');

    expect(html).not.toContain('javascript:');
    expect(html).toContain('<a href="https://example.com">ok</a>');
  });

  it('does not preserve whitespace-obfuscated javascript hrefs', () => {
    const html = markdownToHtml('[bad](java\nscript:alert(1)) [also bad](java script:alert(1))');

    expect(html).not.toContain('href="java');
  });

  it('does not preserve unsafe image source protocols in generated preview media', () => {
    const html = markdownToHtml('![bad](javascript:alert(1)) ![ok](./assets/image.png)');

    expect(html).not.toContain('javascript:');
    expect(html).toContain('<img src="./assets/image.png" alt="ok">');
  });

  it('renders supported callout blockquotes with scoped metadata classes', () => {
    const html = markdownToHtml([
      '> [!WARNING] 发布前确认',
      '> 这段内容仍然是标准 Markdown 引用。',
    ].join('\n'));

    expect(html).toContain('class="prism-callout prism-callout--warning"');
    expect(html).toContain('data-callout-kind="warning"');
    expect(html).toContain('data-callout-title="发布前确认"');
    expect(html).toContain('这段内容仍然是标准 Markdown 引用。');
    expect(html).not.toContain('[!WARNING]');
  });

  it('renders the long preview smoke fixture with source anchors inside a bounded time', () => {
    const markdown = buildLongPreviewSmokeMarkdown();
    const startedAt = performance.now();
    const html = markdownToHtml(markdown);
    const durationMs = performance.now() - startedAt;
    const sourceAnchorCount = html.match(/data-source-line="/g)?.length ?? 0;
    const mermaidPlaceholderCount = html.match(/class="mermaid-placeholder"/g)?.length ?? 0;

    expect(markdown.length).toBeGreaterThan(100_000);
    expect(durationMs).toBeLessThan(5000);
    expect(sourceAnchorCount).toBeGreaterThan(1500);
    expect(mermaidPlaceholderCount).toBe(6);
    expect(html).toContain('\\badcommand');
    expect(html).not.toContain('<script>');
  });

  it('renders the media-heavy preview smoke fixture without losing anchors or media placeholders', () => {
    const markdown = buildMediaHeavyPreviewSmokeMarkdown();
    const startedAt = performance.now();
    const html = markdownToHtml(markdown);
    const durationMs = performance.now() - startedAt;
    const sourceAnchorCount = html.match(/data-source-line="/g)?.length ?? 0;
    const imageCount = html.match(/<img /g)?.length ?? 0;
    const mermaidPlaceholderCount = html.match(/class="mermaid-placeholder"/g)?.length ?? 0;
    const displayMathCount = html.match(/class="katex-display"/g)?.length ?? 0;

    expect(markdown.length).toBeGreaterThan(20_000);
    expect(durationMs).toBeLessThan(5000);
    expect(sourceAnchorCount).toBeGreaterThan(180);
    expect(imageCount).toBe(50);
    expect(mermaidPlaceholderCount).toBe(20);
    expect(displayMathCount).toBe(20);
    expect(html).not.toContain('<script>');
  });
});
