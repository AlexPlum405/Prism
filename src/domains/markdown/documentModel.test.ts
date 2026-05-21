import { describe, expect, it } from 'vitest';
import {
  extractMarkdownDocumentBlocks,
  extractMarkdownDocumentHeadings,
  extractMarkdownDocumentImages,
  extractMarkdownDocumentLinks,
  parseMarkdownDocumentModel,
} from './documentModel';

describe('markdown document model', () => {
  it('parses front matter, headings, line offsets, and document links from one model', () => {
    const model = parseMarkdownDocumentModel([
      '---',
      'title: 入门指南',
      'tags: [guide, prism]',
      'status: draft',
      '---',
      '# 开始',
      '阅读 [API](api.md) 和 [[index|首页]]。',
      '![图](image.png)',
      '> [!TIP] 写作提示',
      '<details>',
      '```mermaid',
      'graph TD',
      '```',
      '$$',
      'x = y',
      '$$',
    ].join('\n'));

    expect(model.body).toBe([
      '# 开始',
      '阅读 [API](api.md) 和 [[index|首页]]。',
      '![图](image.png)',
      '> [!TIP] 写作提示',
      '<details>',
      '```mermaid',
      'graph TD',
      '```',
      '$$',
      'x = y',
      '$$',
    ].join('\n'));
    expect(model.frontMatter).toMatchObject({
      hasFrontMatter: true,
      title: '入门指南',
      status: 'draft',
      tags: ['guide', 'prism'],
    });
    expect(model.frontMatterLineOffset).toBe(5);
    expect(model.headings).toEqual([
      { level: 1, line: 6, slug: '开始', title: '开始' },
    ]);
    expect(model.links).toEqual([
      expect.objectContaining({
        kind: 'markdown',
        target: 'api.md',
        label: 'API',
        line: 7,
      }),
      expect.objectContaining({
        kind: 'wiki',
        target: 'index',
        label: '首页',
        line: 7,
      }),
    ]);
    expect(model.images).toEqual([
      expect.objectContaining({
        alt: '图',
        target: 'image.png',
        line: 8,
      }),
    ]);
    expect(model.blocks).toEqual([
      expect.objectContaining({ kind: 'callout', info: 'tip', line: 9, title: '写作提示' }),
      expect.objectContaining({ kind: 'details', line: 10 }),
      expect.objectContaining({ kind: 'mermaid', info: 'mermaid', line: 11 }),
      expect.objectContaining({ kind: 'katex', info: 'math', line: 14 }),
    ]);
  });

  it('keeps invalid front matter visible to downstream consumers', () => {
    const model = parseMarkdownDocumentModel([
      '---',
      'title: [broken',
      '---',
      '# 正文标题',
    ].join('\n'));

    expect(model.frontMatter.hasFrontMatter).toBe(true);
    expect(model.frontMatter.error).toBeTruthy();
    expect(model.frontMatterLineOffset).toBe(0);
    expect(model.headings).toEqual([
      { level: 1, line: 4, slug: '正文标题', title: '正文标题' },
    ]);
  });

  it('extracts headings with stable slugs and strips inline code marks', () => {
    expect(extractMarkdownDocumentHeadings([
      '## `API` 设计',
      'paragraph',
      '### 标题末尾!!!',
    ].join('\n'))).toEqual([
      { level: 2, line: 1, slug: 'api-设计', title: 'API 设计' },
      { level: 3, line: 3, slug: '标题末尾', title: '标题末尾!!!' },
    ]);
  });

  it('extracts markdown and wiki links without treating images as backlinks', () => {
    expect(extractMarkdownDocumentLinks([
      '[相对](docs/a.md#标题)',
      '![图片](docs/a.png)',
      '[[docs/b#标题|B 文档]]',
    ].join('\n'))).toEqual([
      expect.objectContaining({
        kind: 'markdown',
        target: 'docs/a.md#标题',
        label: '相对',
        line: 1,
        column: 1,
      }),
      expect.objectContaining({
        kind: 'wiki',
        target: 'docs/b',
        label: 'B 文档',
        line: 3,
        column: 1,
      }),
    ]);
  });

  it('extracts markdown image references separately from document links', () => {
    expect(extractMarkdownDocumentImages([
      '[链接](docs/a.md)',
      '![图片](docs/a.png "title")',
      '![空图]()',
    ].join('\n'))).toEqual([
      expect.objectContaining({
        alt: '图片',
        target: 'docs/a.png "title"',
        line: 2,
        column: 1,
      }),
      expect.objectContaining({
        alt: '空图',
        target: '',
        line: 3,
        column: 1,
      }),
    ]);
  });

  it('extracts callout, details, mermaid, and katex block placeholders', () => {
    expect(extractMarkdownDocumentBlocks([
      '> [!WARNING] 发布前确认',
      '<details><summary>更多</summary>',
      '```mermaid',
      'graph TD',
      '```',
      '$$',
      'E = mc^2',
      '$$',
    ].join('\n'))).toEqual([
      expect.objectContaining({ kind: 'callout', info: 'warning', title: '发布前确认', line: 1 }),
      expect.objectContaining({ kind: 'details', line: 2 }),
      expect.objectContaining({ kind: 'mermaid', info: 'mermaid', line: 3 }),
      expect.objectContaining({ kind: 'katex', info: 'math', line: 6 }),
    ]);
  });
});
