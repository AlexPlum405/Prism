import { describe, expect, it } from 'vitest';
import {
  getMarkdownHeadingCompletionOptions,
  getMarkdownLinkTrigger,
  getWorkspaceFileCompletionOptions,
  getWikiHeadingCompletionOptions,
  getWikiLinkCompletionOptions,
  getWikiLinkTrigger,
} from './linkCompletion';

describe('markdown link completion', () => {
  it('activates only inside markdown link targets', () => {
    expect(getMarkdownLinkTrigger('[Read more](')).toEqual({ fromOffset: 12, query: '' });
    expect(getMarkdownLinkTrigger('[Read more](docs/')).toEqual({ fromOffset: 12, query: 'docs/' });
    expect(getMarkdownLinkTrigger('plain text')).toBeNull();
  });

  it('activates only inside wiki link targets', () => {
    expect(getWikiLinkTrigger('[[')).toEqual({ fromOffset: 2, query: '' });
    expect(getWikiLinkTrigger('[[docs/gu')).toEqual({ fromOffset: 2, query: 'docs/gu' });
    expect(getWikiLinkTrigger('[[closed]]')).toBeNull();
    expect(getWikiLinkTrigger('[Read more](')).toBeNull();
  });

  it('suggests current-document heading anchors', () => {
    expect(getMarkdownHeadingCompletionOptions([
      '# API 设计',
      'body',
      '## Hello `Prism` World',
      '### 发布计划（第一版）!',
    ].join('\n'))).toEqual([
      { label: '#api-设计', type: 'keyword', detail: 'API 设计' },
      { label: '#hello-prism-world', type: 'keyword', detail: 'Hello `Prism` World' },
      { label: '#发布计划第一版', type: 'keyword', detail: '发布计划（第一版）!' },
    ]);
  });

  it('suggests workspace markdown files relative to the current document', () => {
    expect(getWorkspaceFileCompletionOptions({
      currentDocumentPath: '/repo/docs/current.md',
      workspaceRootPath: '/repo',
      workspaceFiles: [
        { path: '/repo/docs/guide.md', name: 'guide.md' },
        { path: '/repo/README.md', name: 'README.md' },
        { path: '/repo/image.png', name: 'image.png' },
      ],
    })).toEqual([
      { label: 'guide.md', type: 'file', detail: 'guide.md' },
      { label: '../README.md', type: 'file', detail: 'README.md' },
    ]);
  });

  it('suggests wiki link targets from workspace markdown files without extensions', () => {
    const options = getWikiLinkCompletionOptions({
      workspaceRootPath: '/repo',
      workspaceFiles: [
        { path: '/repo/docs/guide.md', name: 'guide.md' },
        { path: '/repo/docs/api.markdown', name: 'api.markdown' },
        { path: '/repo/README.md', name: 'README.md' },
        { path: '/repo/image.png', name: 'image.png' },
      ],
    });

    expect(options).toEqual([
      expect.objectContaining({ label: 'docs/guide', type: 'file', detail: 'guide.md' }),
      expect.objectContaining({ label: 'docs/api', type: 'file', detail: 'api.markdown' }),
      expect.objectContaining({ label: 'README', type: 'file', detail: 'README.md' }),
    ]);
    expect(options.every((option) => typeof option.apply === 'function')).toBe(true);
  });

  it('suggests indexed document titles and headings for wiki-triggered Markdown links', () => {
    const options = getWikiLinkCompletionOptions({
      currentDocumentPath: '/repo/docs/current.md',
      workspaceRootPath: '/repo',
      workspaceFiles: [
        {
          path: '/repo/docs/guide.md',
          name: 'guide.md',
          title: '入门指南',
          headings: [{ title: '安装步骤', slug: '安装步骤' }],
        },
      ],
    });

    expect(options).toEqual([
      expect.objectContaining({
        label: 'docs/guide',
        type: 'file',
        detail: '入门指南',
      }),
      expect.objectContaining({
        label: '入门指南',
        type: 'file',
        detail: 'docs/guide.md',
      }),
      expect.objectContaining({
        label: '安装步骤',
        type: 'keyword',
        detail: 'docs/guide.md#安装步骤',
      }),
    ]);
    expect(options.every((option) => typeof option.apply === 'function')).toBe(true);
  });

  it('suggests current document headings as wiki-triggered Markdown links', () => {
    const options = getWikiHeadingCompletionOptions([
      '# API 设计',
      'body',
      '## 发布计划',
    ].join('\n'));

    expect(options).toEqual([
      expect.objectContaining({ label: '#api-设计', type: 'keyword', detail: 'API 设计' }),
      expect.objectContaining({ label: '#发布计划', type: 'keyword', detail: '发布计划' }),
    ]);
    expect(options.every((option) => typeof option.apply === 'function')).toBe(true);
  });

  it('inserts a standard Markdown link (not a private wiki link) when a wiki suggestion is applied', () => {
    const options = getWikiLinkCompletionOptions({
      currentDocumentPath: '/repo/docs/current.md',
      workspaceRootPath: '/repo',
      workspaceFiles: [
        {
          path: '/repo/docs/guide.md',
          name: 'guide.md',
          title: '入门指南',
          headings: [{ title: '安装步骤', slug: '安装步骤' }],
        },
      ],
    });

    const headingOption = options.find((option) => option.label === '安装步骤');
    expect(headingOption).toBeDefined();

    // 模拟用户在编辑器中输入 "[[安" 后选中标题建议；apply 应替换掉 "[[" 并写入标准 Markdown 链接
    const dispatched: Array<Record<string, unknown>> = [];
    const fakeView = { dispatch: (spec: Record<string, unknown>) => dispatched.push(spec) };
    const from = 5; // "[[" 之后查询起点
    const to = 7;
    (headingOption!.apply as (view: unknown, completion: unknown, from: number, to: number) => void)(
      fakeView,
      headingOption,
      from,
      to,
    );

    expect(dispatched).toHaveLength(1);
    const change = (dispatched[0].changes as { from: number; to: number; insert: string });
    expect(change.from).toBe(from - 2); // 连同 "[[" 一起替换
    expect(change.to).toBe(to);
    expect(change.insert).toBe('[安装步骤](guide.md#安装步骤)');
    expect(change.insert).not.toContain('[[');
  });
});
