import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { OpenDocument } from '../domains/document/types';
import { useDocumentNavigationModel } from './useDocumentNavigationModel';

function createDocument(overrides: Partial<OpenDocument> = {}): OpenDocument {
  return {
    path: '/repo/current.md',
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
    workspaceIndex: null,
  }));

  return {
    handleFileAction,
    jumpToLine,
    result: hook.result,
    showToast,
  };
}

describe('useDocumentNavigationModel', () => {
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
});
