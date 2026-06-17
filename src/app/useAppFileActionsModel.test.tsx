import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useDocumentStore } from '../domains/document/store';
import { executeFileAction } from '../lib/fileActions';
import { openPrismWindow } from '../lib/openWindow';
import { useStartupFileOpen } from './useStartupFileOpen';
import { useAppFileActionsModel } from './useAppFileActionsModel';

vi.mock('../lib/fileActions', () => ({
  executeFileAction: vi.fn(),
}));

vi.mock('../lib/openWindow', () => ({
  openPrismWindow: vi.fn(),
}));

vi.mock('./useStartupFileOpen', () => ({
  useStartupFileOpen: vi.fn(),
}));

describe('useAppFileActionsModel', () => {
  const requestMarkdownSavePath = vi.fn();
  const showToast = vi.fn();

  beforeEach(() => {
    useDocumentStore.setState({ currentDocument: null });
    vi.clearAllMocks();
  });

  it('delegates file actions with app stores and save/toast callbacks', async () => {
    const { result } = renderHook(() => useAppFileActionsModel({
      requestMarkdownSavePath,
      showToast,
    }));

    await act(async () => {
      await result.current.handleFileAction({ action: 'openFile', path: '/repo/readme.md' });
    });

    expect(executeFileAction).toHaveBeenCalledWith(
      { action: 'openFile', path: '/repo/readme.md' },
      expect.objectContaining({
        requestSavePath: requestMarkdownSavePath,
        showToast,
      }),
    );
  });

  it('keeps dirty document switch prompt state until the user resolves it', async () => {
    const { result } = renderHook(() => useAppFileActionsModel({
      requestMarkdownSavePath,
      showToast,
    }));

    await act(async () => {
      await result.current.handleFileAction('openFile:/repo/next.md');
    });

    const context = vi.mocked(executeFileAction).mock.calls[0][1];
    let promptResult: Promise<unknown>;

    act(() => {
      promptResult = context.requestDirtyDocumentAction?.({
        currentName: 'current.md',
        targetName: 'next.md',
        targetPath: '/repo/next.md',
      }) ?? Promise.resolve(null);
    });

    expect(result.current.dirtySwitchPrompt).toMatchObject({
      currentName: 'current.md',
      targetName: 'next.md',
    });

    act(() => {
      result.current.resolveDirtySwitchPrompt('discard');
    });

    await expect(promptResult!).resolves.toBe('discard');
    expect(result.current.dirtySwitchPrompt).toBeNull();
  });

  it('opens startup files through the same file action path', async () => {
    renderHook(() => useAppFileActionsModel({
      requestMarkdownSavePath,
      showToast,
    }));

    const input = vi.mocked(useStartupFileOpen).mock.calls[0][0];

    await act(async () => {
      await input.onOpenFilePath('/repo/startup.md');
    });

    expect(executeFileAction).toHaveBeenCalledWith(
      { action: 'openFile', path: '/repo/startup.md' },
      expect.any(Object),
    );
  });

  it('opens running-app startup files in a new window when a document is already active', async () => {
    useDocumentStore.getState().openDocument('/repo/current.md', 'current.md', '# Current');

    renderHook(() => useAppFileActionsModel({
      requestMarkdownSavePath,
      showToast,
    }));

    const input = vi.mocked(useStartupFileOpen).mock.calls[0][0];

    await act(async () => {
      await input.onOpenFilePath('/repo/from-system.markdown');
    });

    expect(openPrismWindow).toHaveBeenCalledWith({ filePath: '/repo/from-system.markdown' });
    expect(executeFileAction).not.toHaveBeenCalled();
  });
});
