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

const largePreviewRenderOptions = {
  autoDetectUnlabeledCode: false,
  frontMatterMode: 'metadata' as const,
  highlightCode: false,
  lightweightTables: true,
  renderMath: false,
};

function buildCommonFastPathMarkdown(targetLength = 320 * 1024) {
  const parts = [
    '---',
    'title: Common Fast Path',
    'tags: preview, benchmark',
    'status: draft',
    '---',
    '',
    '# Common Fast Path',
    '',
  ];

  let index = 1;
  while (parts.join('\n').length < targetLength) {
    parts.push(
      [
        `## 章节 ${index}`,
        '',
        `这是第 ${index} 段，包含 **加粗**、==高亮==、[[内部链接 ${index}|内部链接]]、[外部链接](https://example.com/docs/${index})、行内公式 $a_${index}^2=b_${index}^2$。`,
        '',
        '> [!NOTE] 提示',
        `> 这里是第 ${index} 个 callout。`,
        '',
        '- 第一项',
        '- 第二项',
        '',
        '| 项目 | 状态 |',
        '| --- | ---: |',
        `| 渲染 | 通过 ${index} |`,
        `| 校验 | 完成 ${index} |`,
        '',
        '```ts',
        `const section${index} = ${index};`,
        '```',
        '',
        index % 3 === 0
          ? ['```mermaid', `graph TD; A${index} --> B${index}`, '```'].join('\n')
          : '',
        '',
        index % 4 === 0 ? `![本地图片](assets/preview-${index}.png)` : '',
        '',
      ].join('\n'),
    );
    index += 1;
  }

  return parts.join('\n');
}

describe('markdownToHtml compatibility modes', () => {
  const codeBlock = '```ts\nconst answer = 42;\n```';
  const compatibilityModes = ['miaoyan', 'inkstone', 'slate', 'mono', 'nocturne', 'carbon'] as const;

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

  it('can skip auto-detecting unlabeled fenced blocks for large preview renders', () => {
    const html = markdownToHtml('```\nconst answer = "42";\n```', {
      autoDetectUnlabeledCode: false,
      compatibilityMode: 'miaoyan',
    });

    expect(html).toContain('class="hljs"');
    expect(html).toContain('const answer = "42";');
    expect(html).not.toContain('hljs-string');
    expect(html).not.toContain('language-javascript');
  });

  it('still highlights explicit code languages when unlabeled auto-detect is disabled', () => {
    const html = markdownToHtml('```ts\nconst answer = "42";\n```', {
      autoDetectUnlabeledCode: false,
      compatibilityMode: 'miaoyan',
    });

    expect(html).toContain('class="hljs language-ts"');
    expect(html).toContain('hljs-string');
  });

  it('keeps Reveal-style fenced code metadata out of the language class', () => {
    const html = markdownToHtml('```swift [1|2-4]\nlet name = "Prism"\n```', {
      autoDetectUnlabeledCode: false,
      compatibilityMode: 'miaoyan',
    });

    expect(html).toContain('class="hljs language-swift"');
    expect(html).not.toContain('language-swift [1|2-4]');
  });

  it('can skip token-level code highlighting for large preview renders', () => {
    const html = markdownToHtml('```ts\nconst answer = "42";\n```', {
      autoDetectUnlabeledCode: false,
      compatibilityMode: 'miaoyan',
      highlightCode: false,
    });

    expect(html).toContain('class="hljs language-ts"');
    expect(html).toContain('const answer = "42";');
    expect(html).not.toContain('hljs-string');
  });

  it('marks preview blocks with source line attributes for scroll and click mapping', () => {
    const html = markdownToHtml('# Title\n\nParagraph');

    expect(html).toContain('data-source-line="1"');
    expect(html).toContain('data-line="1"');
    expect(html).toContain('data-source-line="3"');
    expect(html).toContain('data-line="3"');
    expect(html.match(/data-source-line="1"/g)).toHaveLength(1);
  });

  it('adds stable heading ids for same-document table of contents links', () => {
    const html = markdownToHtml('# API 设计\n\n## 文本格式\n\n## 文本格式');

    expect(html).toContain('id="api-设计"');
    expect(html).toContain('id="文本格式"');
    expect(html).toContain('id="文本格式-2"');
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

  it('renders MiaoYan-style subscript and superscript shorthand without breaking strikethrough', () => {
    const html = markdownToHtml('水分子为 H~2~O，约 16^世纪^末期。\n\n~~删除线~~');

    expect(html).toContain('H<sub>2</sub>O');
    expect(html).toContain('16<sup>世纪</sup>末期');
    expect(html).toContain('<del>删除线</del>');
  });

  it('keeps mermaid placeholders mapped to their source line', () => {
    const html = markdownToHtml('Intro\n\n```mermaid\ngraph TD\n```');

    expect(html).toContain('class="mermaid-placeholder"');
    expect(html).toContain('data-source-line="3"');
    expect(html).toContain('data-line="3"');
  });

  it('supports common Mermaid fenced-block language aliases', () => {
    const sequenceHtml = markdownToHtml('```sequence\nAlice->>Bob: hello\n```');
    const flowchartHtml = markdownToHtml('```flowchart\nTD\nA --> B\n```');

    expect(sequenceHtml).toContain('class="mermaid-placeholder"');
    expect(sequenceHtml).toContain(`data-mermaid="${encodeURIComponent('sequenceDiagram\nAlice->>Bob: hello')}"`);
    expect(sequenceHtml).not.toContain('language-sequence');
    expect(flowchartHtml).toContain(`data-mermaid="${encodeURIComponent('flowchart TD\nA --> B')}"`);
    expect(flowchartHtml).not.toContain('language-flowchart');
  });

  it('keeps Markmap placeholders mapped to their source line', () => {
    const source = [
      'Intro',
      '',
      '```markmap',
      '# 项目',
      '- 用户',
      '- 场景',
      '```',
    ].join('\n');
    const markmapSource = '# 项目\n- 用户\n- 场景';
    const html = markdownToHtml(source);

    expect(html).toContain('class="markmap-placeholder"');
    expect(html).toContain(`data-markmap="${encodeURIComponent(markmapSource)}"`);
    expect(html).toContain('data-source-line="3"');
    expect(html).toContain('data-line="3"');
    expect(html).not.toContain('language-markmap');
  });

  it('routes Markdown-outline mindmap fences to Markmap', () => {
    const source = [
      '```mindmap',
      '# Root',
      '- Branch A',
      '  - Leaf',
      '```',
    ].join('\n');
    const html = markdownToHtml(source);

    expect(html).toContain('class="markmap-placeholder"');
    expect(html).toContain(`data-markmap="${encodeURIComponent('# Root\n- Branch A\n  - Leaf')}"`);
    expect(html).not.toContain('class="mermaid-placeholder"');
    expect(html).not.toContain('language-mindmap');
  });

  it('routes Mermaid mindmap fences to Mermaid when the source is Mermaid syntax', () => {
    const html = markdownToHtml('```mindmap\nroot((Root))\n  Branch\n```');

    expect(html).toContain('class="mermaid-placeholder"');
    expect(html).toContain(`data-mermaid="${encodeURIComponent('mindmap\nroot((Root))\n  Branch')}"`);
    expect(html).not.toContain('class="markmap-placeholder"');
    expect(html).not.toContain('language-mindmap');
  });

  it('keeps PlantUML placeholders mapped to their source line', () => {
    const source = [
      'Intro',
      '',
      '```plantuml',
      '@startuml',
      'object "张三" as zhangsan',
      'object "项目 A" as projectA',
      'zhangsan --> projectA : 负责',
      '@enduml',
      '```',
    ].join('\n');
    const html = markdownToHtml(source);

    expect(html).toContain('class="plantuml-placeholder"');
    expect(html).toContain(`data-plantuml="${encodeURIComponent([
      '@startuml',
      'object "张三" as zhangsan',
      'object "项目 A" as projectA',
      'zhangsan --> projectA : 负责',
      '@enduml',
    ].join('\n'))}"`);
    expect(html).toContain('data-source-line="3"');
    expect(html).toContain('data-line="3"');
    expect(html).not.toContain('language-plantuml');
  });

  it('supports puml as a PlantUML fenced-block alias', () => {
    const html = markdownToHtml('```puml\n@startuml\nAlice -> Bob\n@enduml\n```');

    expect(html).toContain('class="plantuml-placeholder"');
    expect(html).toContain(`data-plantuml="${encodeURIComponent('@startuml\nAlice -> Bob\n@enduml')}"`);
    expect(html).not.toContain('language-puml');
  });

  it('keeps display math mapped to its source line for diagnostics', () => {
    const html = markdownToHtml('Intro\n\n$$\nx^2\n$$');

    expect(html).toContain('data-source-line="3"');
    expect(html).toContain('data-line="3"');
  });

  it('treats single-line double-dollar math as display math', () => {
    const html = markdownToHtml([
      'Intro',
      '',
      '$$\\phi = \\frac{1 + \\sqrt{5}}{2}$$',
      '',
      'Inline $a^2$.',
      '',
      '古人云："数学之美，在于：',
      '$$\\sum_{n=1}^{\\infty} \\frac{element_n}{time^n} = eternal\\_beauty$$',
    ].join('\n'));

    expect(html.match(/class="katex-display"/g)).toHaveLength(2);
    expect(html).toContain('data-source-line="3"');
    expect(html).toContain('data-source-line="8"');
    expect(html).toContain('data-line="3"');
    expect(html).toContain('\\phi = \\frac{1 + \\sqrt{5}}{2}');
    expect(html).toContain('\\sum_{n=1}^{\\infty} \\frac{element_n}{time^n} = eternal\\_beauty');
    expect(html).toContain('Inline <span class="katex"');
  });

  it('can defer KaTeX rendering for large preview renders', () => {
    const html = markdownToHtml('Inline $a^2$.\n\n$$\nx^2\n$$', {
      renderMath: false,
    });

    expect(html).toContain('class="katex-placeholder"');
    expect(html).toContain('class="katex-display katex-placeholder"');
    expect(html).toContain(`data-katex="${encodeURIComponent('a^2')}"`);
    expect(html).toContain(`data-katex="${encodeURIComponent('x^2')}"`);
    expect(html).toContain('data-source-line="3"');
    expect(html).not.toContain('katex-html');
  });

  it('renders Prism highlight marks without allowing raw HTML injection', () => {
    const html = markdownToHtml('==important & safe==');

    expect(html).toContain('<mark>');
    expect(html).toContain('important &#x26; safe');
    expect(html).not.toContain('<script>');
  });

  it('renders GFM tables when table syntax is present', () => {
    const html = markdownToHtml([
      '| 项目 | 状态 |',
      '| --- | --- |',
      '| 预览 | 通过 |',
    ].join('\n'));

    expect(html).toContain('<table');
    expect(html).toContain('<th>项目</th>');
    expect(html).toContain('<td>通过</td>');
  });

  it('can render plain tables through the lightweight large-preview table path', () => {
    const html = markdownToHtml([
      '| 项目 | 状态 |',
      '| --- | ---: |',
      '| 预览 | 通过 |',
      '| 滚动 | 顺滑 |',
      '',
      '# Next',
    ].join('\n'), {
      lightweightTables: true,
    });

    expect(html).toContain('<table data-source-line="1">');
    expect(html).toContain('<td style="text-align:right">通过</td>');
    expect(html).toContain('<tr><td>预览</td>');
    expect(html).toContain('<h1 data-source-line="6"');
  });

  it('uses the common large-preview fast path without dropping core preview features', () => {
    const markdown = buildCommonFastPathMarkdown();
    const html = markdownToHtml(markdown, largePreviewRenderOptions);

    expect(markdown.length).toBeGreaterThan(300 * 1024);
    expect(html).toContain('<!--prism-preview-source-map:flat:');
    expect(html).toContain('class="prism-frontmatter-preview"');
    expect(html).toContain('<h1 id="common-fast-path">Common Fast Path</h1>');
    expect(html).toContain('<strong>加粗</strong>');
    expect(html).toContain('<mark>高亮</mark>');
    expect(html).toContain('class="prism-wiki-link"');
    expect(html).toContain('<a href="https://example.com/docs/1">外部链接</a>');
    expect(html).toContain('class="katex-placeholder"');
    expect(html).toContain('class="prism-callout prism-callout--note"');
    expect(html).toContain('<ul><li>第一项</li><li>第二项</li></ul>');
    expect(html).toContain('class="prism-simple-table prism-simple-table--cols-2"');
    expect(html).toContain('class="hljs language-ts"');
    expect(html).toContain('class="mermaid-placeholder"');
    expect(html).toContain('<img src="assets/preview-');
    expect(html).not.toContain('PrismLargePreTablePlaceholder');
  });

  it('keeps PlantUML placeholders in the common large-preview fast path', () => {
    const markdown = [
      buildCommonFastPathMarkdown(),
      '',
      '```plantuml',
      '@startuml',
      'Alice -> Bob',
      '@enduml',
      '```',
    ].join('\n');
    const html = markdownToHtml(markdown, largePreviewRenderOptions);

    expect(markdown.length).toBeGreaterThan(300 * 1024);
    expect(html).toContain('class="plantuml-placeholder"');
    expect(html).toContain(`data-plantuml="${encodeURIComponent('@startuml\nAlice -> Bob\n@enduml')}"`);
    expect(html).not.toContain('language-plantuml');
  });

  it('keeps Markmap placeholders in the common large-preview fast path', () => {
    const markdown = [
      buildCommonFastPathMarkdown(),
      '',
      '```markmap',
      '# 项目',
      '- 用户',
      '- 场景',
      '```',
    ].join('\n');
    const html = markdownToHtml(markdown, largePreviewRenderOptions);

    expect(markdown.length).toBeGreaterThan(300 * 1024);
    expect(html).toContain('class="markmap-placeholder"');
    expect(html).toContain(`data-markmap="${encodeURIComponent('# 项目\n- 用户\n- 场景')}"`);
    expect(html).not.toContain('language-markmap');
  });

  it('renders common fast path plain tables as lightweight preview grids', () => {
    const html = markdownToHtml(buildCommonFastPathMarkdown(), largePreviewRenderOptions);

    expect(html).toContain('<div class="prism-simple-table prism-simple-table--cols-2">');
    expect(html).toContain('<span>项目</span>');
    expect(html).toContain('<span class="prism-simple-table__cell--right">状态</span>');
    expect(html).toContain('<span>渲染</span>');
    expect(html).not.toContain('<thead>');
    expect(html).not.toContain('<tbody>');
  });

  it('delegates only the raw HTML block and keeps the rest on the large-preview fast path', () => {
    const markdown = [
      buildCommonFastPathMarkdown(),
      '',
      '<details>',
      '<summary>点击展开</summary>',
      '',
      '折叠内容包含 **加粗**。',
      '',
      '</details>',
      '',
      '快速路径段落包含 **加粗**。',
    ].join('\n');
    const html = markdownToHtml(markdown, largePreviewRenderOptions);

    expect(html).toContain('<details>');
    expect(html).toContain('<summary>点击展开</summary>');
    expect(html).toContain('<strong>加粗</strong>');
    // 快速路径专属产物证明其余内容没有退回完整管线。
    expect(html).toContain('class="prism-simple-table prism-simple-table--cols-2"');
    expect(html).toContain('<p data-line="');
    expect(html).toContain('快速路径段落包含 <strong>加粗</strong>');
  });

  it('keeps a details block whole when a blank line separates its markdown body', () => {
    const markdown = [
      buildCommonFastPathMarkdown(),
      '',
      '<details>',
      '<summary>折叠</summary>',
      '',
      '第一段。',
      '',
      '第二段。',
      '',
      '</details>',
    ].join('\n');
    const html = markdownToHtml(markdown, largePreviewRenderOptions);

    expect(html.match(/<details>/g)).toHaveLength(1);
    expect(html.match(/<\/details>/g)).toHaveLength(1);
    const detailsBlock = html.slice(html.indexOf('<details>'), html.indexOf('</details>'));
    expect(detailsBlock).toContain('第一段。');
    expect(detailsBlock).toContain('第二段。');
  });

  it('rebases delegated chunk source lines onto the whole document', () => {
    const base = buildCommonFastPathMarkdown();
    const markdown = [base, '', '<details>', '<summary>折叠</summary>', '', '折叠正文。', '', '</details>'].join('\n');
    const html = markdownToHtml(markdown, largePreviewRenderOptions);
    // base 之后依次是空行、<details>、<summary>、空行，正文落在第 5 行。
    const bodyLine = base.split('\n').length + 5;

    // 委派块渲染时只看到自身，行号必须回写为全文行号。
    expect(html).toContain(`<p data-source-line="${bodyLine}" data-line="${bodyLine}">折叠正文。</p>`);
  });

  it('renders task lists inside the large-preview fast path with continuous checkbox indices', () => {
    const markdown = [
      buildCommonFastPathMarkdown(),
      '',
      '- [ ] 待办一',
      '- [x] 完成二 **加粗**',
      '- 普通项',
      '',
      '<div>委派块</div>',
      '',
      '- [ ] 待办三',
    ].join('\n');
    const html = markdownToHtml(markdown, largePreviewRenderOptions);

    expect(html).toContain('class="contains-task-list cb"');
    expect(html).toContain('class="task-list-item strike"');
    expect(html).toContain('data-task-checkbox-index="0"');
    expect(html).toContain('data-task-checkbox-index="1"');
    // 委派块之后的复选框需要接着编号，否则点击会改错行。
    expect(html).toContain('data-task-checkbox-index="2"');
    expect(html).toContain('<input type="checkbox" checked data-task-checkbox-index="1"');
    expect(html).toContain('完成二 <strong>加粗</strong>');
    expect(html).not.toContain('disabled');
  });

  it('renders emphasis, strikethrough and sub/sup inline syntax in the large-preview fast path', () => {
    const markdown = [
      buildCommonFastPathMarkdown(),
      '',
      '行内组合：*斜体*、_下划斜体_、~~删除~~、H~2~O、x^2^、**加粗**。',
      '',
      '不应变化：snake_case_word 与 2 * 3 * 4。',
    ].join('\n');
    const html = markdownToHtml(markdown, largePreviewRenderOptions);

    expect(html).toContain('<em>斜体</em>');
    expect(html).toContain('<em>下划斜体</em>');
    expect(html).toContain('<del>删除</del>');
    expect(html).toContain('H<sub>2</sub>O');
    expect(html).toContain('x<sup>2</sup>');
    expect(html).toContain('snake_case_word 与 2 * 3 * 4');
  });

  it('renders pandoc citations in the large-preview fast path', () => {
    const markdown = [
      buildCommonFastPathMarkdown(),
      '',
      '参见 [@smith2020, p. 3] 的论述。',
    ].join('\n');
    const html = markdownToHtml(markdown, largePreviewRenderOptions);

    expect(html).toContain('class="prism-citation"');
    expect(html).toContain('data-citekeys="smith2020"');
    expect(html).toContain('[@smith2020, p. 3]');
  });

  it('escapes raw HTML comments through the unified pipeline instead of emitting them inline', () => {
    const markdown = [buildCommonFastPathMarkdown(), '', '<!-- 隐藏说明 -->', '', '正文。'].join('\n');
    const html = markdownToHtml(markdown, largePreviewRenderOptions);

    // 注释交给完整管线处理，不能被当作普通段落转义输出。
    expect(html).not.toContain('&lt;!-- 隐藏说明 --&gt;');
    expect(html).toContain('正文。');
  });

  it('drops dangerous delegated HTML in the large-preview fast path', () => {
    const markdown = [
      buildCommonFastPathMarkdown(),
      '',
      '<script>window.stolen = 1;</script>',
      '',
      '<a href="javascript:alert(1)">点我</a>',
    ].join('\n');
    const html = markdownToHtml(markdown, largePreviewRenderOptions);

    expect(html).not.toContain('<script>');
    expect(html).not.toContain('javascript:alert(1)');
  });

  it('keeps raw HTML inside fenced code blocks on the fast path as literal text', () => {
    const markdown = [
      buildCommonFastPathMarkdown(),
      '',
      '```html',
      '<details><summary>示例</summary></details>',
      '```',
    ].join('\n');
    const html = markdownToHtml(markdown, largePreviewRenderOptions);

    expect(html).toContain('class="hljs language-html"');
    expect(html).toContain('&lt;details&gt;&lt;summary&gt;示例&lt;/summary&gt;&lt;/details&gt;');
  });

  it('delegates blocks whose raw HTML appears after the first line', () => {
    const base = buildCommonFastPathMarkdown();
    const cases = [
      ['段落文本。', '<div>紧随其后</div>'],
      ['- 列表一', '- 列表二', '<div>紧随列表</div>'],
      ['> 引用含 <kbd>Cmd</kbd>'],
    ];

    cases.forEach((block) => {
      const html = markdownToHtml([base, '', ...block].join('\n'), largePreviewRenderOptions);
      const expected = markdownToHtml(block.join('\n'), largePreviewRenderOptions);
      // 委派块的产物必须与完整管线一致，不能把 HTML 当成文本转义。
      expect(html).not.toContain('&lt;div&gt;');
      expect(html).not.toContain('&lt;kbd&gt;');
      expect(html).toContain(expected.split('\n').at(-1) ?? '');
    });
  });

  it('keeps math, mermaid and source lines usable in documents that delegate blocks', () => {
    const base = buildCommonFastPathMarkdown();
    const baseLines = base.split('\n').length;
    const html = markdownToHtml(
      [
        base,
        '',
        '<details><summary>折叠</summary>',
        '',
        '内部 $E=mc^2$ 公式。',
        '',
        '</details>',
        '',
        '块级公式：',
        '',
        '$$\\int_0^1 x dx$$',
        '',
        '```mermaid',
        'graph TD; A-->B',
        '```',
      ].join('\n'),
      largePreviewRenderOptions,
    );

    // 委派块内的行内公式与其后快速路径产物都要保留占位符与源码行，供滚动同步与源码定位使用。
    expect(html).toContain('<details><summary>折叠</summary>');
    expect(html).toContain(`data-katex="E%3Dmc%5E2"`);
    expect(html).toContain(`<p data-source-line="${baseLines + 4}" data-line="${baseLines + 4}">`);
    expect(html).toContain(`<p data-line="${baseLines + 8}">块级公式：</p>`);
    expect(html).toContain(`data-katex-display="true"`);
    expect(html).toContain(`data-mermaid="graph%20TD%3B%20A--%3EB"`);
  });

  it('emits the flat source map only when no chunk was delegated', () => {
    const clean = markdownToHtml(buildCommonFastPathMarkdown(), largePreviewRenderOptions);
    const delegated = markdownToHtml(
      [buildCommonFastPathMarkdown(), '', '<div>委派</div>'].join('\n'),
      largePreviewRenderOptions,
    );

    expect(clean).toContain('<!--prism-preview-source-map:flat:');
    // 混合文档的元素顺序无法与扁平侧车对齐，必须退回属性映射。
    expect(delegated).not.toContain('<!--prism-preview-source-map:flat:');
    expect(delegated).toContain('data-line="');
  });

  it('keeps complex tables on the normal GFM path when lightweight table extraction is enabled', () => {
    const html = markdownToHtml([
      '| 项目 | 状态 |',
      '| --- | --- |',
      '| **预览** | [通过](https://example.com) |',
    ].join('\n'), {
      lightweightTables: true,
    });

    expect(html).toContain('<strong>预览</strong>');
    expect(html).toContain('<a href="https://example.com">通过</a>');
  });

  it('falls back to the full unified pipeline for large preview complex tables', () => {
    const html = markdownToHtml([
      buildCommonFastPathMarkdown(),
      '',
      '| 项目 | 状态 |',
      '| --- | --- |',
      '| **预览** | [通过](https://example.com) |',
    ].join('\n'), largePreviewRenderOptions);

    expect(html).toContain('<table');
    expect(html).toContain('<strong>预览</strong>');
    expect(html).toContain('<a href="https://example.com">通过</a>');
    expect(html).not.toContain('prism-simple-table');
  });

  it('renders common GFM inline and list syntax only when needed', () => {
    const html = markdownToHtml([
      '- [x] 完成',
      '- [ ] 待办',
      '',
      '~~删除~~ https://example.com',
    ].join('\n'));

    expect(html).toContain('type="checkbox" checked');
    expect(html).toContain('data-task-checkbox-index="0"');
    expect(html).toContain('data-task-checkbox-index="1"');
    expect(html).toContain('class="task-list-item strike"');
    expect(html).toContain('class="contains-task-list cb"');
    expect(html).not.toContain('disabled');
    expect(html).toContain('<del>删除</del>');
    expect(html).toContain('<a href="https://example.com">https://example.com</a>');
  });

  it('promotes standalone single-dollar math to display math like MiaoYan preview', () => {
    const html = markdownToHtml([
      '婴宁的美貌可用数学公式表达：',
      '$Beauty = \\lim_{time \\to \\infty} \\frac{inner\\_beauty}{outer\\_beauty} = constant$',
    ].join('\n'));

    expect(html).toContain('婴宁的美貌可用数学公式表达：');
    expect(html).toContain('class="katex-display"');
    expect(html).toContain('data-source-line="2"');
  });

  it('keeps sentence inline single-dollar math inline', () => {
    const html = markdownToHtml('黄金比例 $\\phi$ 很美。');

    expect(html).toContain('class="katex"');
    expect(html).not.toContain('class="katex-display"');
  });

  it('renders Pandoc citekeys as preview citation placeholders', () => {
    const html = markdownToHtml('研究结论参考 [@doe2024; @smith-2023, p. 12]。');

    expect(html).toContain('class="prism-citation"');
    expect(html).toContain('data-citekeys="doe2024 smith-2023"');
    expect(html).toContain('title="引用占位：@doe2024, @smith-2023"');
    expect(html).toContain('[@doe2024; @smith-2023, p. 12]');
  });

  it('renders wiki document links as clickable preview anchors', () => {
    const html = markdownToHtml('关联 [[docs/manual-test|人工测试]] 和 [[linking-note]]。');

    expect(html).toContain('class="prism-wiki-link"');
    expect(html).toContain('data-prism-wiki-target="docs/manual-test"');
    expect(html).toContain('人工测试');
    expect(html).toContain('data-prism-wiki-target="linking-note"');
    expect(html).toContain('linking-note');
    expect(html).not.toContain('[[docs/manual-test');
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
      '',
      '> [!IMPORTANT]',
      '> 不要忽略这条结论。',
    ].join('\n'));

    expect(html).toContain('class="prism-callout prism-callout--warning"');
    expect(html).toContain('data-callout-kind="warning"');
    expect(html).toContain('data-callout-title="发布前确认"');
    expect(html).toContain('这段内容仍然是标准 Markdown 引用。');
    expect(html).toContain('class="prism-callout prism-callout--important"');
    expect(html).toContain('data-callout-kind="important"');
    expect(html).toContain('data-callout-title="Important"');
    expect(html).toContain('不要忽略这条结论。');
    expect(html).not.toContain('[!WARNING]');
    expect(html).not.toContain('[!IMPORTANT]');
  });

  it('preserves details/summary toggle blocks and parses their inner markdown', () => {
    const html = markdownToHtml([
      '<details>',
      '<summary>点击展开</summary>',
      '',
      '折叠内容包含 **加粗** 与 `代码`。',
      '',
      '</details>',
    ].join('\n'));

    expect(html).toContain('<details>');
    expect(html).toContain('</details>');
    expect(html).toContain('<summary>点击展开</summary>');
    expect(html).toContain('<strong>加粗</strong>');
    expect(html).toContain('<code>代码</code>');
  });

  it.each(compatibilityModes)('keeps %s toggle blocks intact through the safety pipeline', (compatibilityMode) => {
    const html = markdownToHtml([
      '<details>',
      '<summary>折叠标题</summary>',
      '',
      '主题内的折叠正文。',
      '',
      '</details>',
    ].join('\n'), { compatibilityMode });

    expect(html).toContain('<details>');
    expect(html).toContain('<summary>折叠标题</summary>');
    expect(html).toContain('主题内的折叠正文。');
  });

  it('strips event handlers from toggle blocks while keeping the disclosure structure', () => {
    const html = markdownToHtml([
      '<details onclick="alert(1)">',
      '<summary>不可信折叠</summary>',
      '',
      '正文',
      '',
      '</details>',
    ].join('\n'));

    expect(html).toContain('<details>');
    expect(html).toContain('<summary>不可信折叠</summary>');
    expect(html).not.toContain('onclick');
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

  it('renders very large multiline pre tables as lightweight preview blocks', () => {
    const rows = Array.from({ length: 90 }, (_, index) => [
      `| \`0:${String(index + 1).padStart(2, '0')}\` | <pre>  █`,
      ' █ ',
      `</pre> | \`${index}\` |`,
    ].join('\n'));
    const markdown = [
      '# 字符表',
      '',
      '| sel:cc | 字模 | 识别字符 |',
      '|--------|------|----------|',
      ...rows,
      '',
      '## 后续章节',
    ].join('\n');

    const html = markdownToHtml(markdown);
    const nextHeadingLine = 3 + 2 + rows.length * 3 + 1;

    expect(html).toContain('class="prism-large-pre-table"');
    expect(html).toContain('data-row-count="90"');
    expect(html).toContain('<pre>');
    expect(html).not.toContain('<table>');
    expect(html).toContain('data-source-line="5"');
    expect(html).toContain(`<h2 data-source-line="${nextHeadingLine}"`);
    expect(html).not.toContain('PrismLargePreTablePlaceholder');
  });

  it('renders medium multiline pre tables as lightweight preview blocks', () => {
    const rows = Array.from({ length: 24 }, (_, index) => [
      `| \`9:${String(index).padStart(2, '0')}\` | <pre>  █`,
      ' █ ',
      `</pre> | \`${index}\` |`,
    ].join('\n'));
    const html = markdownToHtml([
      '| sel:cc | 字模 | 识别字符 |',
      '|--------|------|----------|',
      ...rows,
    ].join('\n'));

    expect(html).toContain('class="prism-large-pre-table"');
    expect(html).toContain('data-row-count="24"');
    expect(html).not.toContain('<table>');
  });

  it('preserves source line offsets after multiple compacted multiline pre tables', () => {
    const buildRows = (prefix: string) => Array.from({ length: 24 }, (_, index) => [
      `| \`${prefix}:${String(index).padStart(2, '0')}\` | <pre>  █`,
      ' █ ',
      `</pre> | \`${index}\` |`,
    ].join('\n'));
    const firstRows = buildRows('a');
    const secondRows = buildRows('b');
    const markdown = [
      '# 字符表',
      '',
      '| sel:cc | 字模 | 识别字符 |',
      '|--------|------|----------|',
      ...firstRows,
      '',
      '## 第二组',
      '',
      '| sel:cc | 字模 | 识别字符 |',
      '|--------|------|----------|',
      ...secondRows,
      '',
      '## 后续章节',
    ].join('\n');

    const html = markdownToHtml(markdown);
    const finalHeadingLine = markdown.split('\n').findIndex((line) => line === '## 后续章节') + 1;

    expect(html.match(/class="prism-large-pre-table"/g)).toHaveLength(2);
    expect(html).toContain(`<h2 data-source-line="${finalHeadingLine}"`);
  });
});
