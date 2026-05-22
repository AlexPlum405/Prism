import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { OpenDocument } from '../../document/types';
import {
  readWorkspaceIndexSources,
  useWorkspaceIndexModel,
} from './useWorkspaceIndexModel';

const fsMock = vi.hoisted(() => ({
  readTextFile: vi.fn(),
}));

vi.mock('@tauri-apps/plugin-fs', () => fsMock);

function createDocument(overrides: Partial<OpenDocument> = {}): OpenDocument {
  return {
    path: '/workspace/current.md',
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
});
