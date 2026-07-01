import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { OpenDocument } from '../../document/types';
import type { RecentFileEntry } from '../../settings/types';
import { buildWorkspaceIndex, MARKDOWN_DOCUMENT_PROFILE } from '../services';
import {
  readWorkspaceIndexSourcesIncremental,
  readWorkspaceIndexSources,
  useWorkspaceIndexModel,
} from './useWorkspaceIndexModel';

const fsMock = vi.hoisted(() => ({
  readTextFile: vi.fn(),
}));
const nativeIndexMock = vi.hoisted(() => ({
  cancelWorkspaceIndexJobNativeModel: vi.fn(),
  getWorkspaceIndexJobNativeModel: vi.fn(),
  startWorkspaceIndexJobNativeModel: vi.fn(),
}));

vi.mock('@tauri-apps/plugin-fs', () => fsMock);
vi.mock('../services/workspaceIndexNative', () => nativeIndexMock);

function createDocument(overrides: Partial<OpenDocument> = {}): OpenDocument {
  return {
    path: '/workspace/current.md',
    profile: MARKDOWN_DOCUMENT_PROFILE,
    name: 'current.md',
    content: '# Current\n\n[[Other]]',
    isDirty: true,
    lastSavedAt: 0,
    lastKnownMtime: null,
    lastKnownSize: null,
    saveStatus: 'dirty',
    saveError: null,
    viewMode: 'edit',
    scrollState: { editorRatio: 0, previewRatio: 0 },
    ...overrides,
  };
}

describe('useWorkspaceIndexModel', () => {
  beforeEach(() => {
    fsMock.readTextFile.mockReset();
    nativeIndexMock.cancelWorkspaceIndexJobNativeModel.mockReset();
    nativeIndexMock.getWorkspaceIndexJobNativeModel.mockReset();
    nativeIndexMock.startWorkspaceIndexJobNativeModel.mockReset();
    nativeIndexMock.cancelWorkspaceIndexJobNativeModel.mockResolvedValue(null);
    nativeIndexMock.getWorkspaceIndexJobNativeModel.mockResolvedValue(null);
    nativeIndexMock.startWorkspaceIndexJobNativeModel.mockResolvedValue(null);
  });

  it('builds a workspace index from markdown files and overlays the current unsaved document', async () => {
    const fileTree = [
      { path: '/workspace/current.md', name: 'current.md', kind: 'file' as const },
      { path: '/workspace/other.md', name: 'other.md', kind: 'file' as const },
      { path: '/workspace/image.png', name: 'image.png', kind: 'file' as const },
    ];
    fsMock.readTextFile.mockImplementation(async (path: string) => {
      if (path.endsWith('current.md')) return '# Stale disk title';
      if (path.endsWith('other.md')) return '# Other\n\n[Current](current.md)';
      return '';
    });

    const { result } = renderHook(() => useWorkspaceIndexModel({
      currentDocument: createDocument(),
      rootPath: '/workspace',
      fileTree,
      recentFiles: [],
    }));

    await waitFor(() => expect(result.current.workspaceIndexing).toBe(false));

    expect(fsMock.readTextFile).toHaveBeenCalledTimes(2);
    expect(result.current.workspaceIndex?.documents).toHaveLength(2);
    expect(result.current.workspaceIndex?.documents.find((document) => document.name === 'current.md')?.title)
      .toBe('Current');
    expect(result.current.workspaceIndex?.backlinksByPath.get('/workspace/current.md')?.[0]?.path)
      .toBe('/workspace/other.md');
  });

  it('clears index state when no workspace root is open', async () => {
    const fileTree: [] = [];
    const recentFiles: [] = [];
    const { result } = renderHook(() => useWorkspaceIndexModel({
      currentDocument: null,
      rootPath: null,
      fileTree,
      recentFiles,
    }));

    await waitFor(() => expect(result.current.workspaceIndexing).toBe(false));
    expect(result.current.workspaceIndex).toBeNull();
    expect(fsMock.readTextFile).not.toHaveBeenCalled();
  });

  it('reads large workspace indexes in bounded batches and skips unreadable files', async () => {
    const files = Array.from({ length: 5 }, (_, index) => ({
      path: `/workspace/doc-${index + 1}.md`,
    }));
    const batchBreaks: string[][] = [];
    fsMock.readTextFile.mockImplementation(async (path: string) => {
      if (path.endsWith('doc-3.md')) throw new Error('permission denied');
      return `# ${path}`;
    });

    const sources = await readWorkspaceIndexSources(files, {
      batchSize: 2,
      batchThreshold: 2,
      yieldBetweenBatches: async () => {
        batchBreaks.push(fsMock.readTextFile.mock.calls.map(([path]) => path));
      },
    });

    expect(batchBreaks).toEqual([
      ['/workspace/doc-1.md', '/workspace/doc-2.md'],
      ['/workspace/doc-1.md', '/workspace/doc-2.md', '/workspace/doc-3.md', '/workspace/doc-4.md'],
    ]);
    expect(sources.map((source) => source.path)).toEqual([
      '/workspace/doc-1.md',
      '/workspace/doc-2.md',
      '/workspace/doc-4.md',
      '/workspace/doc-5.md',
    ]);
  });

  it('reuses cached source content while file metadata stays stable', async () => {
    const files = [
      { path: '/workspace/a.md', modifiedAt: 10, size: 12 },
      { path: '/workspace/b.md', modifiedAt: 20, size: 18 },
    ];
    const cache = new Map();
    fsMock.readTextFile.mockImplementation(async (path: string) => `# ${path}`);

    const first = await readWorkspaceIndexSourcesIncremental(files, cache);
    expect(first.map((source) => source.path)).toEqual(['/workspace/a.md', '/workspace/b.md']);
    expect(fsMock.readTextFile).toHaveBeenCalledTimes(2);

    const second = await readWorkspaceIndexSourcesIncremental(files, cache);
    expect(second.map((source) => source.content)).toEqual(first.map((source) => source.content));
    expect(fsMock.readTextFile).toHaveBeenCalledTimes(2);

    await readWorkspaceIndexSourcesIncremental([
      files[0],
      { path: '/workspace/b.md', modifiedAt: 21, size: 19 },
    ], cache);

    expect(fsMock.readTextFile).toHaveBeenCalledTimes(3);
    expect(fsMock.readTextFile).toHaveBeenLastCalledWith('/workspace/b.md');
  });

  it('does not restart the native index job when only current document or recents change', async () => {
    const fileTree = [
      { path: '/workspace/current.md', name: 'current.md', kind: 'file' as const, modifiedAt: 1, size: 10 },
      { path: '/workspace/other.md', name: 'other.md', kind: 'file' as const, modifiedAt: 2, size: 20 },
    ];
    const baseIndex = buildWorkspaceIndex({
      fileTree,
      workspaceRoot: '/workspace',
      documents: [
        { path: '/workspace/current.md', content: '# Stale Current' },
        { path: '/workspace/other.md', content: '# Other\n\n[Current](current.md)' },
      ],
    });
    nativeIndexMock.startWorkspaceIndexJobNativeModel.mockResolvedValue({
      id: 'workspace-index-1',
      rootPath: '/workspace',
      status: 'completed',
      stage: 'completed',
      message: 'ready',
      progress: 1,
      createdAt: 1,
      updatedAt: 2,
      completedAt: 2,
      index: baseIndex,
      error: null,
      cancelRequested: false,
    });

    const { result, rerender } = renderHook((props: {
      currentDocument: OpenDocument;
      recentFiles: RecentFileEntry[];
    }) => useWorkspaceIndexModel({
      currentDocument: props.currentDocument,
      rootPath: '/workspace',
      fileTree,
      recentFiles: props.recentFiles,
    }), {
      initialProps: {
        currentDocument: createDocument({ content: '# Unsaved Current\n\n[[Other]]' }),
        recentFiles: [] as RecentFileEntry[],
      },
    });

    await waitFor(() => expect(result.current.workspaceIndexing).toBe(false));
    expect(nativeIndexMock.startWorkspaceIndexJobNativeModel).toHaveBeenCalledTimes(1);
    expect(nativeIndexMock.startWorkspaceIndexJobNativeModel).toHaveBeenLastCalledWith({
      rootPath: '/workspace',
      currentDocumentOverride: null,
      recentFiles: [],
    });
    expect(result.current.workspaceIndex?.documentByPath.get('/workspace/current.md')?.title)
      .toBe('Unsaved Current');
    expect(result.current.workspaceIndexJobId).toBe('workspace-index-1');

    rerender({
      currentDocument: createDocument({
        path: '/workspace/other.md',
        name: 'other.md',
        content: '# Unsaved Other',
      }),
      recentFiles: [{ path: '/workspace/other.md', name: 'other.md', lastOpened: 200 }],
    });

    await waitFor(() => {
      expect(result.current.workspaceIndex?.documentByPath.get('/workspace/other.md')?.title)
        .toBe('Unsaved Other');
    });
    expect(result.current.workspaceIndex?.recentDocuments.map((document) => document.path))
      .toEqual(['/workspace/other.md']);
    expect(nativeIndexMock.startWorkspaceIndexJobNativeModel).toHaveBeenCalledTimes(1);
  });

  it('uses a native index job for large workspaces instead of the metadata fallback', async () => {
    const fileTree = Array.from({ length: 501 }, (_, index) => ({
      path: `/workspace/doc-${index + 1}.md`,
      name: `doc-${index + 1}.md`,
      kind: 'file' as const,
      modifiedAt: index + 1,
      size: 10,
    }));
    const nativeIndex = buildWorkspaceIndex({
      fileTree,
      workspaceRoot: '/workspace',
      documents: fileTree.map((file) => ({
        path: file.path,
        content: `# Native ${file.name}`,
      })),
    });
    nativeIndexMock.startWorkspaceIndexJobNativeModel.mockResolvedValue({
      id: 'workspace-index-large',
      rootPath: '/workspace',
      status: 'completed',
      stage: 'completed',
      message: 'ready',
      progress: 1,
      createdAt: 1,
      updatedAt: 2,
      completedAt: 2,
      index: nativeIndex,
      error: null,
      cancelRequested: false,
    });

    const { result } = renderHook(() => useWorkspaceIndexModel({
      currentDocument: null,
      rootPath: '/workspace',
      fileTree,
      recentFiles: [],
    }));

    await waitFor(() => expect(result.current.workspaceIndexing).toBe(false));

    expect(nativeIndexMock.startWorkspaceIndexJobNativeModel).toHaveBeenCalledTimes(1);
    expect(fsMock.readTextFile).not.toHaveBeenCalled();
    expect(result.current.workspaceIndex?.documents).toHaveLength(501);
    expect(result.current.workspaceIndex?.documents[0]).toMatchObject({
      name: 'doc-1.md',
      title: 'Native doc-1.md',
      hasContent: true,
    });
    expect(result.current.workspaceIndexJobId).toBe('workspace-index-large');
  });

  it('uses a lightweight metadata index for large workspaces when native jobs are unavailable', async () => {
    const fileTree = Array.from({ length: 501 }, (_, index) => ({
      path: `/workspace/doc-${index + 1}.md`,
      name: `doc-${index + 1}.md`,
      kind: 'file' as const,
      modifiedAt: index + 1,
      size: 10,
    }));

    const { result } = renderHook(() => useWorkspaceIndexModel({
      currentDocument: null,
      rootPath: '/workspace',
      fileTree,
      recentFiles: [],
    }));

    await waitFor(() => expect(result.current.workspaceIndexing).toBe(false));

    expect(nativeIndexMock.startWorkspaceIndexJobNativeModel).toHaveBeenCalledTimes(1);
    expect(fsMock.readTextFile).not.toHaveBeenCalled();
    expect(result.current.workspaceIndex?.documents).toHaveLength(501);
    expect(result.current.workspaceIndex?.documents[0]).toMatchObject({
      name: 'doc-1.md',
      title: 'doc-1',
      hasContent: false,
    });
    expect(result.current.workspaceIndexJobId).toBeNull();
  });

  it('polls a running native index job until it completes', async () => {
    const fileTree = [
      { path: '/workspace/current.md', name: 'current.md', kind: 'file' as const, modifiedAt: 1, size: 10 },
    ];
    const nativeIndex = buildWorkspaceIndex({
      fileTree,
      workspaceRoot: '/workspace',
      documents: [{ path: '/workspace/current.md', content: '# Native Current' }],
    });
    nativeIndexMock.startWorkspaceIndexJobNativeModel.mockResolvedValue({
      id: 'workspace-index-running',
      rootPath: '/workspace',
      status: 'running',
      stage: 'build',
      message: 'building',
      progress: 0.2,
      createdAt: 1,
      updatedAt: 1,
      completedAt: null,
      index: null,
      error: null,
      cancelRequested: false,
    });
    nativeIndexMock.getWorkspaceIndexJobNativeModel.mockResolvedValue({
      id: 'workspace-index-running',
      rootPath: '/workspace',
      status: 'completed',
      stage: 'completed',
      message: 'ready',
      progress: 1,
      createdAt: 1,
      updatedAt: 2,
      completedAt: 2,
      index: nativeIndex,
      error: null,
      cancelRequested: false,
    });

    const { result } = renderHook(() => useWorkspaceIndexModel({
      currentDocument: null,
      rootPath: '/workspace',
      fileTree,
      recentFiles: [],
    }));

    await waitFor(() => expect(result.current.workspaceIndexing).toBe(false));

    expect(nativeIndexMock.getWorkspaceIndexJobNativeModel).toHaveBeenCalledWith('workspace-index-running');
    expect(result.current.workspaceIndex?.documents[0].title).toBe('Native Current');
    expect(result.current.workspaceIndexJobId).toBe('workspace-index-running');
  });

  it('cancels the previous native index job when the workspace root changes', async () => {
    const firstTree = [
      { path: '/workspace-a/a.md', name: 'a.md', kind: 'file' as const, modifiedAt: 1, size: 10 },
    ];
    const secondTree = [
      { path: '/workspace-b/b.md', name: 'b.md', kind: 'file' as const, modifiedAt: 2, size: 20 },
    ];
    const secondIndex = buildWorkspaceIndex({
      fileTree: secondTree,
      workspaceRoot: '/workspace-b',
      documents: [{ path: '/workspace-b/b.md', content: '# Workspace B' }],
    });
    nativeIndexMock.startWorkspaceIndexJobNativeModel.mockImplementation(async (input: { rootPath: string }) => {
      if (input.rootPath === '/workspace-a') {
        return {
          id: 'workspace-index-a',
          rootPath: '/workspace-a',
          status: 'running',
          stage: 'build',
          message: 'building workspace A',
          progress: 0.2,
          createdAt: 1,
          updatedAt: 1,
          completedAt: null,
          index: null,
          error: null,
          cancelRequested: false,
        };
      }
      return {
        id: 'workspace-index-b',
        rootPath: '/workspace-b',
        status: 'completed',
        stage: 'completed',
        message: 'ready',
        progress: 1,
        createdAt: 2,
        updatedAt: 3,
        completedAt: 3,
        index: secondIndex,
        error: null,
        cancelRequested: false,
      };
    });
    nativeIndexMock.getWorkspaceIndexJobNativeModel.mockResolvedValue({
      id: 'workspace-index-a',
      rootPath: '/workspace-a',
      status: 'cancelled',
      stage: 'cancel_requested',
      message: 'cancelled',
      progress: 1,
      createdAt: 1,
      updatedAt: 2,
      completedAt: 2,
      index: null,
      error: null,
      cancelRequested: true,
    });

    const { result, rerender } = renderHook((props: {
      fileTree: typeof firstTree;
      rootPath: string;
    }) => useWorkspaceIndexModel({
      currentDocument: null,
      rootPath: props.rootPath,
      fileTree: props.fileTree,
      recentFiles: [],
    }), {
      initialProps: {
        rootPath: '/workspace-a',
        fileTree: firstTree,
      },
    });

    await waitFor(() => expect(nativeIndexMock.startWorkspaceIndexJobNativeModel).toHaveBeenCalledTimes(1));

    rerender({
      rootPath: '/workspace-b',
      fileTree: secondTree,
    });

    await waitFor(() => expect(nativeIndexMock.cancelWorkspaceIndexJobNativeModel)
      .toHaveBeenCalledWith('workspace-index-a'));
    await waitFor(() => expect(result.current.workspaceIndexing).toBe(false));

    expect(nativeIndexMock.startWorkspaceIndexJobNativeModel).toHaveBeenCalledTimes(2);
    expect(result.current.workspaceIndexJobId).toBe('workspace-index-b');
    expect(result.current.workspaceIndex?.rootPath).toBe('/workspace-b');
    expect(result.current.workspaceIndex?.documentByPath.has('/workspace-a/a.md')).toBe(false);
    expect(result.current.workspaceIndex?.documentByPath.get('/workspace-b/b.md')?.title)
      .toBe('Workspace B');
  });
});
