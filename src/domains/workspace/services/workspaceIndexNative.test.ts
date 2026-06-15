import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildWorkspaceIndexNativeModel,
  queryWorkspaceIndexNativeModel,
} from './workspaceIndexNative';

const nativeMock = vi.hoisted(() => ({
  buildWorkspaceIndexNative: vi.fn(),
  queryWorkspaceIndexNative: vi.fn(),
}));

vi.mock('../../../platform/tauri/workspaceIndex', () => nativeMock);

describe('workspaceIndexNative', () => {
  beforeEach(() => {
    nativeMock.buildWorkspaceIndexNative.mockReset();
    nativeMock.queryWorkspaceIndexNative.mockReset();
  });

  it('normalizes a native workspace index dto', async () => {
    nativeMock.buildWorkspaceIndexNative.mockResolvedValue({
      backlinksByPath: {},
      documents: [{
        content: '# Guide',
        frontMatter: {
          author: '',
          date: '',
          description: '',
          error: null,
          exportRaw: '',
          hasFrontMatter: false,
          status: '',
          tags: [],
          title: '',
        },
        hasContent: true,
        headings: [],
        links: [],
        name: 'guide.md',
        path: '/repo/guide.md',
        relativePath: 'guide.md',
        title: 'Guide',
      }],
      generatedAt: 123,
      recentDocuments: [],
      rootPath: '/repo',
    });

    const index = await buildWorkspaceIndexNativeModel({
      rootPath: '/repo',
      currentDocumentOverride: null,
      recentFiles: [],
    });

    expect(index?.documentByPath.get('/repo/guide.md')?.title).toBe('Guide');
    expect(index?.generatedAt).toBe(123);
  });

  it('normalizes native workspace query results', async () => {
    nativeMock.queryWorkspaceIndexNative.mockResolvedValue([{
      document: {
        content: '# Guide',
        frontMatter: {
          author: '',
          date: '',
          description: '',
          error: null,
          exportRaw: '',
          hasFrontMatter: false,
          status: '',
          tags: [],
          title: '',
        },
        hasContent: true,
        headings: [],
        links: [],
        name: 'guide.md',
        path: '/repo/guide.md',
        relativePath: 'guide.md',
        title: 'Guide',
      },
      match: 'title',
      score: 120,
      snippet: 'guide.md',
    }]);

    const results = await queryWorkspaceIndexNativeModel({
      rootPath: '/repo',
      query: 'guide',
      limit: 30,
      mode: 'quickOpen',
      currentDocumentOverride: { path: '/repo/current.md', content: '# Current' },
      recentFiles: [{ path: '/repo/guide.md', lastOpened: 10 }],
    });

    expect(nativeMock.queryWorkspaceIndexNative).toHaveBeenCalledWith({
      rootPath: '/repo',
      query: 'guide',
      limit: 30,
      mode: 'quickOpen',
      currentDocumentOverride: { path: '/repo/current.md', content: '# Current' },
      recentFiles: [{ path: '/repo/guide.md', lastOpened: 10 }],
    });
    expect(results?.[0]).toMatchObject({
      match: 'title',
      score: 120,
      document: { path: '/repo/guide.md' },
    });
  });

  it('returns null for invalid native query payloads', async () => {
    nativeMock.queryWorkspaceIndexNative.mockResolvedValue([{ match: 'unknown' }]);

    await expect(queryWorkspaceIndexNativeModel({
      rootPath: '/repo',
      query: 'guide',
      limit: 30,
      mode: 'fullText',
      currentDocumentOverride: null,
      recentFiles: [],
    })).resolves.toBeNull();
  });
});
