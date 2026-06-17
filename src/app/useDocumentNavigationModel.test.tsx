import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { OpenDocument } from '../domains/document/types';
import { buildWorkspaceIndex, MARKDOWN_DOCUMENT_PROFILE, TEXT_DOCUMENT_PROFILE } from '../domains/workspace/services';
import { useDocumentNavigationModel } from './useDocumentNavigationModel';

const nativeWorkspaceIndexMock = vi.hoisted(() => ({
  queryWorkspaceBacklinksNativeModel: vi.fn(),
}));

vi.mock('../domains/workspace/services/workspaceIndexNative', () => nativeWorkspaceIndexMock);

function createDocument(overrides: Partial<OpenDocument> = {}): OpenDocument {
  return {
    path: '/repo/current.md',
    profile: MARKDOWN_DOCUMENT_PROFILE,
    name: 'current.md',
    content: '# 开始\n\n[跳转](#开始)',
    isDirty: false,
    lastSavedAt: 0,
    lastKnownMtime: null,
    lastKnownSize: null,
    saveStatus: 'saved',
    saveError: null,
    viewMode: 'split',
    scrollState: { editorRatio: 0, previewRatio: 0 },
    ...overrides,
  };
}

function renderNavigation(overrides: {
  currentDocument?: OpenDocument | null;
  rootPath?: string | null;
  workspaceIndex?: ReturnType<typeof buildWorkspaceIndex> | null;
  workspaceIndexJobId?: string | null;
} = {}) {
  const handleFileAction = vi.fn();
  const jumpToLine = vi.fn();
  const showToast = vi.fn();
  const hook = renderHook(() => useDocumentNavigationModel({
    currentDocument: overrides.currentDocument ?? createDocument(),
    fileTree: [],
    handleFileAction,
    jumpToLine,
    rootPath: overrides.rootPath ?? null,
    showToast,
    workspaceIndex: overrides.workspaceIndex ?? null,
    workspaceIndexJobId: overrides.workspaceIndexJobId ?? null,
  }));

  return {
    handleFileAction,
    jumpToLine,
    result: hook.result,
    showToast,
  };
}

describe('useDocumentNavigationModel', () => {
  beforeEach(() => {
    nativeWorkspaceIndexMock.queryWorkspaceBacklinksNativeModel.mockReset();
    nativeWorkspaceIndexMock.queryWorkspaceBacklinksNativeModel.mockResolvedValue(null);
  });

  it('jumps to same-document heading links without requiring a workspace', async () => {
    const { handleFileAction, jumpToLine, result, showToast } = renderNavigation();

    await act(async () => {
      await result.current.openDocumentLink('#开始', {
        kind: 'markdown',
        sourcePath: '/repo/current.md',
      });
    });

    expect(jumpToLine).toHaveBeenCalledWith(1);
    expect(handleFileAction).not.toHaveBeenCalled();
    expect(showToast).not.toHaveBeenCalled();
  });

  it('reports missing same-document heading links instead of opening a file', async () => {
    const { handleFileAction, jumpToLine, result, showToast } = renderNavigation();

    await act(async () => {
      await result.current.openDocumentLink('#不存在', {
        kind: 'markdown',
        sourcePath: '/repo/current.md',
      });
    });

    expect(jumpToLine).not.toHaveBeenCalled();
    expect(handleFileAction).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith('没有找到链接文档：#不存在');
  });

  it('selects same-document links from the document links panel model', async () => {
    const { handleFileAction, jumpToLine, result } = renderNavigation({
      currentDocument: createDocument({
        content: '# 开始\n\n正文\n\n[跳转](#开始)',
      }),
    });

    await act(async () => {
      await result.current.selectDocumentLink({
        column: 1,
        kind: 'markdown',
        label: '跳转',
        line: 5,
        target: '#开始',
      });
    });

    expect(jumpToLine).toHaveBeenCalledWith(1);
    expect(handleFileAction).not.toHaveBeenCalled();
  });

  it('uses native backlinks when a workspace index job id is available', async () => {
    const workspaceIndex = buildWorkspaceIndex({
      fileTree: [
        { path: '/repo/current.md', name: 'current.md', kind: 'file' },
        { path: '/repo/fallback.md', name: 'fallback.md', kind: 'file' },
      ],
      workspaceRoot: '/repo',
      documents: [
        { path: '/repo/current.md', content: '# Current' },
        { path: '/repo/fallback.md', content: '# Fallback\n[Current](current.md)' },
      ],
    });
    nativeWorkspaceIndexMock.queryWorkspaceBacklinksNativeModel.mockResolvedValue([{
      path: '/repo/native.md',
      title: 'Native',
      line: 7,
      column: 2,
      excerpt: 'native backlink',
    }]);

    const { result } = renderNavigation({
      rootPath: '/repo',
      workspaceIndex,
      workspaceIndexJobId: 'workspace-index-1',
    });

    expect(result.current.backlinks[0].path).toBe('/repo/fallback.md');
    await waitFor(() => {
      expect(result.current.backlinks[0]).toMatchObject({
        path: '/repo/native.md',
        title: 'Native',
      });
    });
    expect(nativeWorkspaceIndexMock.queryWorkspaceBacklinksNativeModel).toHaveBeenCalledWith({
      jobId: 'workspace-index-1',
      path: '/repo/current.md',
    });
  });

  it('does not expose Markdown link panels for text documents', async () => {
    const { handleFileAction, jumpToLine, result } = renderNavigation({
      currentDocument: createDocument({
        path: '/repo/query.sql',
        profile: TEXT_DOCUMENT_PROFILE,
        name: 'query.sql',
        content: 'select * from notes where body like "[[Current]]";',
      }),
    });

    expect(result.current.documentLinks).toEqual([]);
    expect(result.current.backlinks).toEqual([]);

    act(() => {
      result.current.openBacklinks();
      result.current.openDocumentLinks();
      result.current.openRelationGraph();
    });
    await act(async () => {
      await result.current.openDocumentLink('current.md', {
        kind: 'markdown',
        sourcePath: '/repo/query.sql',
      });
    });

    expect(result.current.backlinksVisible).toBe(false);
    expect(result.current.documentLinksVisible).toBe(false);
    expect(result.current.relationGraphVisible).toBe(false);
    expect(handleFileAction).not.toHaveBeenCalled();
    expect(jumpToLine).not.toHaveBeenCalled();
  });
});
