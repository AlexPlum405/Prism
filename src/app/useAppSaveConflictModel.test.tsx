import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  overwriteConflictedDocument,
  reloadConflictedDocument,
  saveConflictedDocumentAs,
} from '../domains/document/services/conflictResolution';
import { useDocumentStore } from '../domains/document/store';
import type { OpenDocument } from '../domains/document/types';
import { useAppSaveConflictModel } from './useAppSaveConflictModel';

vi.mock('../domains/document/services/conflictResolution', () => ({
  overwriteConflictedDocument: vi.fn(),
  reloadConflictedDocument: vi.fn(),
  saveConflictedDocumentAs: vi.fn(),
}));

function createDocument(overrides: Partial<OpenDocument> = {}): OpenDocument {
  return {
    path: '/repo/current.md',
    name: 'current.md',
    content: '# Current',
    isDirty: true,
    lastSavedAt: 0,
    lastKnownMtime: null,
    lastKnownSize: null,
    saveStatus: 'conflict',
    saveError: null,
    saveIssue: 'external-modified',
    viewMode: 'split',
    scrollState: { editorRatio: 0, previewRatio: 0 },
    ...overrides,
  };
}

describe('useAppSaveConflictModel', () => {
  const requestMarkdownSavePath = vi.fn();
  const showToast = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    useDocumentStore.setState({ currentDocument: createDocument() });
    vi.mocked(reloadConflictedDocument).mockResolvedValue({ resolved: true });
    vi.mocked(saveConflictedDocumentAs).mockResolvedValue({ resolved: true, path: '/repo/copy.md' });
    vi.mocked(overwriteConflictedDocument).mockResolvedValue({ resolved: true });
  });

  it('reloads the disk version for reload conflict actions', async () => {
    const { result } = renderHook(() => useAppSaveConflictModel({
      currentDocument: createDocument(),
      requestMarkdownSavePath,
      showToast,
    }));

    await act(async () => {
      await result.current.runConflictAction('reload');
    });

    expect(reloadConflictedDocument).toHaveBeenCalledTimes(1);
    expect(showToast).toHaveBeenCalledWith('已重新加载磁盘版本');
    expect(result.current.conflictAction).toBeNull();
  });

  it('uses save-as conflict resolution with the current save path requester', async () => {
    const { result } = renderHook(() => useAppSaveConflictModel({
      currentDocument: createDocument(),
      requestMarkdownSavePath,
      showToast,
    }));

    await act(async () => {
      await result.current.runConflictAction('saveAs');
    });

    expect(saveConflictedDocumentAs).toHaveBeenCalledWith(requestMarkdownSavePath);
    expect(showToast).toHaveBeenCalledWith('已保留当前版本并另存为');
  });

  it('uses the missing-file success message when overwriting a missing original file', async () => {
    useDocumentStore.setState({ currentDocument: createDocument({ saveIssue: 'missing' }) });
    const { result } = renderHook(() => useAppSaveConflictModel({
      currentDocument: createDocument({ saveIssue: 'missing' }),
      requestMarkdownSavePath,
      showToast,
    }));

    await act(async () => {
      await result.current.runConflictAction('overwrite');
    });

    expect(overwriteConflictedDocument).toHaveBeenCalledTimes(1);
    expect(showToast).toHaveBeenCalledWith('已在原路径重新创建文件');
  });

  it('reports conflict resolution failures as toast messages', async () => {
    vi.mocked(reloadConflictedDocument).mockRejectedValueOnce(new Error('disk denied'));
    const { result } = renderHook(() => useAppSaveConflictModel({
      currentDocument: createDocument(),
      requestMarkdownSavePath,
      showToast,
    }));

    await act(async () => {
      await result.current.runConflictAction('reload');
    });

    expect(showToast).toHaveBeenCalledWith('冲突处理失败: disk denied');
  });
});
