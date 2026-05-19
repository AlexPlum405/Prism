import { describe, expect, it, vi } from 'vitest';
import type { FileNode } from '../types';
import { buildWorkspaceIndex, rankWorkspaceIndexDocuments, searchWorkspaceIndex } from './workspaceIndex';

const fileTree: FileNode[] = [
  {
    path: '/repo/docs',
    name: 'docs',
    kind: 'directory',
    children: [
      { path: '/repo/docs/guide.md', name: 'guide.md', kind: 'file', modifiedAt: 20, size: 120 },
      { path: '/repo/docs/api.md', name: 'api.md', kind: 'file', modifiedAt: 30, size: 160 },
      { path: '/repo/docs/image.png', name: 'image.png', kind: 'file' },
    ],
  },
  { path: '/repo/index.md', name: 'index.md', kind: 'file', modifiedAt: 40, size: 90 },
];

describe('workspace index', () => {
  it('indexes markdown files, headings, front matter, links, backlinks, and recents', () => {
    vi.spyOn(Date, 'now').mockReturnValue(123456);

    const index = buildWorkspaceIndex({
      fileTree,
      workspaceRoot: '/repo',
      documents: [
        {
          path: '/repo/docs/guide.md',
          content: [
            '---',
            'title: 入门指南',
            'tags: [guide, prism]',
            'description: 快速了解 Prism',
            'status: draft',
            '---',
            '# 开始',
            '阅读 [API](api.md) 和 [[index]]。',
          ].join('\n'),
        },
        {
          path: '/repo/docs/api.md',
          content: [
            '# API 设计',
            '被 guide 引用。',
          ].join('\n'),
        },
        {
          path: '/repo/index.md',
          content: [
            '# 首页',
            '回到 [[docs/guide]]。',
          ].join('\n'),
        },
      ],
      recentFiles: [
        { path: '/repo/index.md', lastOpened: 200 },
        { path: '/repo/docs/guide.md', lastOpened: 100 },
      ],
    });

    expect(index.generatedAt).toBe(123456);
    expect(index.documents.map((document) => document.relativePath)).toEqual([
      'docs/api.md',
      'docs/guide.md',
      'index.md',
    ]);
    expect(index.documents.map((document) => document.name)).not.toContain('image.png');

    const guide = index.documentByPath.get('/repo/docs/guide.md');
    expect(guide).toMatchObject({
      title: '入门指南',
      relativePath: 'docs/guide.md',
      recentRank: 1,
      lastOpened: 100,
      frontMatter: {
        description: '快速了解 Prism',
        status: 'draft',
        tags: ['guide', 'prism'],
        title: '入门指南',
      },
    });
    expect(guide?.headings).toEqual([
      { level: 1, line: 7, slug: '开始', title: '开始' },
    ]);
    expect(guide?.links).toEqual([
      expect.objectContaining({
        kind: 'markdown',
        target: 'api.md',
        resolvedPath: '/repo/docs/api.md',
      }),
      expect.objectContaining({
        kind: 'wiki',
        target: 'index',
        resolvedPath: '/repo/index.md',
      }),
    ]);
    expect(index.recentDocuments.map((document) => document.relativePath)).toEqual([
      'index.md',
      'docs/guide.md',
    ]);
    expect(index.backlinksByPath.get('/repo/docs/api.md')).toEqual([
      expect.objectContaining({
        path: '/repo/docs/guide.md',
        title: '入门指南',
        line: 8,
      }),
    ]);
    expect(index.backlinksByPath.get('/repo/docs/guide.md')).toEqual([
      expect.objectContaining({
        path: '/repo/index.md',
        title: '首页',
        line: 2,
      }),
    ]);

    vi.restoreAllMocks();
  });

  it('searches title, path, heading, content, and empty recent results', () => {
    const index = buildWorkspaceIndex({
      fileTree,
      workspaceRoot: '/repo',
      documents: [
        { path: '/repo/docs/guide.md', content: '# 入门指南\n包含 Prism 快速开始。' },
        { path: '/repo/docs/api.md', content: '# API 设计\ninvoke contract' },
        { path: '/repo/index.md', content: '# 首页\n最近编辑' },
      ],
      recentFiles: [
        { path: '/repo/index.md', lastOpened: 200 },
        { path: '/repo/docs/api.md', lastOpened: 100 },
      ],
    });

    expect(searchWorkspaceIndex(index, '').map((result) => result.document.relativePath)).toEqual([
      'index.md',
      'docs/api.md',
    ]);
    expect(searchWorkspaceIndex(index, 'API')[0]).toMatchObject({
      match: 'title',
      document: expect.objectContaining({ relativePath: 'docs/api.md' }),
    });
    expect(searchWorkspaceIndex(index, '快速开始')[0]).toMatchObject({
      match: 'content',
      document: expect.objectContaining({ relativePath: 'docs/guide.md' }),
    });
    expect(searchWorkspaceIndex(index, 'docs/guide')[0]).toMatchObject({
      match: 'path',
      document: expect.objectContaining({ relativePath: 'docs/guide.md' }),
    });
    expect(rankWorkspaceIndexDocuments(index, '').map((result) => result.document.relativePath)).toEqual([
      'index.md',
      'docs/api.md',
      'docs/guide.md',
    ]);
    expect(rankWorkspaceIndexDocuments(index, '入门')[0]).toMatchObject({
      match: 'title',
      document: expect.objectContaining({ relativePath: 'docs/guide.md' }),
    });
  });
});
