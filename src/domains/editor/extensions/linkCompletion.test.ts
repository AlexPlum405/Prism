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
});
