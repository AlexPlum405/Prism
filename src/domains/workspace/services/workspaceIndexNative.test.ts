import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildWorkspaceIndexNativeModel,
  cancelWorkspaceIndexJobNativeModel,
  getWorkspaceIndexJobNativeModel,
  queryWorkspaceBacklinksNativeModel,
  queryWorkspaceIndexNativeModel,
  queryWorkspaceRelationGraphNativeModel,
  startWorkspaceIndexJobNativeModel,
} from './workspaceIndexNative';

const nativeMock = vi.hoisted(() => ({
  buildWorkspaceIndexNative: vi.fn(),
  cancelWorkspaceIndexJobNative: vi.fn(),
  getWorkspaceIndexJobNative: vi.fn(),
  queryWorkspaceBacklinksNative: vi.fn(),
  queryWorkspaceIndexNative: vi.fn(),
  queryWorkspaceRelationGraphNative: vi.fn(),
  startWorkspaceIndexJobNative: vi.fn(),
}));

vi.mock('../../../platform/tauri/workspaceIndex', () => nativeMock);

describe('workspaceIndexNative', () => {
  beforeEach(() => {
    nativeMock.buildWorkspaceIndexNative.mockReset();
    nativeMock.cancelWorkspaceIndexJobNative.mockReset();
    nativeMock.getWorkspaceIndexJobNative.mockReset();
    nativeMock.queryWorkspaceBacklinksNative.mockReset();
    nativeMock.queryWorkspaceIndexNative.mockReset();
    nativeMock.queryWorkspaceRelationGraphNative.mockReset();
    nativeMock.startWorkspaceIndexJobNative.mockReset();
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

  it('normalizes native workspace index job payloads', async () => {
    nativeMock.startWorkspaceIndexJobNative.mockResolvedValue({
      id: 'workspace-index-1',
      rootPath: '/repo',
      status: 'completed',
      stage: 'completed',
      message: 'ready',
      progress: 1,
      createdAt: 10,
      updatedAt: 20,
      completedAt: 20,
      cancelRequested: false,
      index: {
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
      },
    });

    const job = await startWorkspaceIndexJobNativeModel({
      rootPath: '/repo',
      currentDocumentOverride: null,
      recentFiles: [],
    });

    expect(nativeMock.startWorkspaceIndexJobNative).toHaveBeenCalledWith({
      rootPath: '/repo',
      currentDocumentOverride: null,
      recentFiles: [],
    });
    expect(job).toMatchObject({
      id: 'workspace-index-1',
      status: 'completed',
      index: expect.any(Object),
    });
    expect(job?.index?.documents[0].title).toBe('Guide');
  });

  it('normalizes get and cancel workspace index job payloads', async () => {
    nativeMock.getWorkspaceIndexJobNative.mockResolvedValue({
      id: 'workspace-index-1',
      rootPath: '/repo',
      status: 'running',
      stage: 'build',
      message: 'building',
      progress: 0.2,
      createdAt: 10,
      updatedAt: 11,
      completedAt: null,
      cancelRequested: false,
      index: null,
    });
    nativeMock.cancelWorkspaceIndexJobNative.mockResolvedValue({
      id: 'workspace-index-1',
      rootPath: '/repo',
      status: 'cancelled',
      stage: 'cancel_requested',
      message: 'cancelled',
      progress: 1,
      createdAt: 10,
      updatedAt: 12,
      completedAt: 12,
      cancelRequested: true,
      index: null,
    });

    await expect(getWorkspaceIndexJobNativeModel('workspace-index-1'))
      .resolves.toMatchObject({ status: 'running' });
    await expect(cancelWorkspaceIndexJobNativeModel('workspace-index-1'))
      .resolves.toMatchObject({ status: 'cancelled', cancelRequested: true });
  });

  it('normalizes native backlink query results', async () => {
    nativeMock.queryWorkspaceBacklinksNative.mockResolvedValue([{
      path: '/repo/source.md',
      title: 'Source',
      line: 3,
      column: 5,
      excerpt: '[Current](current.md)',
    }]);

    await expect(queryWorkspaceBacklinksNativeModel({
      jobId: 'workspace-index-1',
      path: '/repo/current.md',
    })).resolves.toEqual([{
      path: '/repo/source.md',
      title: 'Source',
      line: 3,
      column: 5,
      excerpt: '[Current](current.md)',
    }]);
    expect(nativeMock.queryWorkspaceBacklinksNative).toHaveBeenCalledWith({
      jobId: 'workspace-index-1',
      path: '/repo/current.md',
    });
  });

  it('normalizes native relation graph query results', async () => {
    nativeMock.queryWorkspaceRelationGraphNative.mockResolvedValue({
      nodes: [{
        id: '/repo/current.md',
        path: '/repo/current.md',
        relativePath: 'current.md',
        title: 'Current',
        active: true,
        depth: 0,
        linkCount: 1,
        backlinkCount: 1,
      }],
      edges: [{
        id: '/repo/current.md->/repo/target.md',
        source: '/repo/current.md',
        target: '/repo/target.md',
      }],
    });

    const graph = await queryWorkspaceRelationGraphNativeModel({
      jobId: 'workspace-index-1',
      currentPath: '/repo/current.md',
      depth: 1,
      limit: 80,
      query: '',
      scope: 'current',
    });

    expect(graph?.nodes[0]).toMatchObject({
      path: '/repo/current.md',
      active: true,
    });
    expect(nativeMock.queryWorkspaceRelationGraphNative).toHaveBeenCalledWith({
      jobId: 'workspace-index-1',
      currentPath: '/repo/current.md',
      depth: 1,
      limit: 80,
      query: '',
      scope: 'current',
    });
  });
});
