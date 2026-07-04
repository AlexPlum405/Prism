import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useDocumentStore } from '../domains/document/store';
import { executeFileAction } from '../lib/fileActions';
import { openSelectedDocument } from '../lib/openDocumentFlow';
import { useStartupFileOpen } from './useStartupFileOpen';
import { useAppFileActionsModel } from './useAppFileActionsModel';
import { invokeNativeCommand } from '../platform/tauri/nativeCommands';

vi.mock('../lib/fileActions', () => ({
  executeFileAction: vi.fn(),
}));

vi.mock('../lib/openDocumentFlow', () => ({
  openSelectedDocument: vi.fn(),
}));

vi.mock('./useStartupFileOpen', () => ({
  useStartupFileOpen: vi.fn(),
}));

vi.mock('../platform/tauri/nativeCommands', () => ({
  invokeNativeCommand: vi.fn(async () => undefined),
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

  it('opens startup files through the shared system-open document flow', async () => {
    vi.mocked(openSelectedDocument).mockResolvedValueOnce({ status: 'opened-current-window' });

    renderHook(() => useAppFileActionsModel({
      requestMarkdownSavePath,
      showToast,
    }));

    const input = vi.mocked(useStartupFileOpen).mock.calls[0][0];
    expect(input.enabled).toBe(true);
    expect(input.pendingFilePollDelays).toEqual([]);

    await act(async () => {
      await input.onOpenFilePath('/repo/startup.md');
    });

    expect(openSelectedDocument).toHaveBeenCalledWith(
      '/repo/startup.md',
      expect.objectContaining({
        requestSavePath: requestMarkdownSavePath,
        showToast,
      }),
      { entryPoint: 'system' },
    );
    expect(invokeNativeCommand).toHaveBeenCalledWith('reveal_current_window');
  });

  it('keeps native startup-file listening disabled until the app marks settings ready', () => {
    renderHook(() => useAppFileActionsModel({
      requestMarkdownSavePath,
      showToast,
      startupFileOpenEnabled: false,
    }));

    expect(vi.mocked(useStartupFileOpen).mock.calls[0][0]).toMatchObject({
      enabled: false,
      pendingFilePollDelays: [],
    });
  });

  it('routes running-app startup files through the system-open policy when a document is already active', async () => {
    useDocumentStore.getState().openDocument('/repo/current.md', 'current.md', '# Current');
    vi.mocked(openSelectedDocument).mockResolvedValueOnce({ status: 'opened-new-window' });

    renderHook(() => useAppFileActionsModel({
      requestMarkdownSavePath,
      showToast,
    }));

    const input = vi.mocked(useStartupFileOpen).mock.calls[0][0];

    await act(async () => {
      await input.onOpenFilePath('/repo/from-system.markdown');
    });

    expect(openSelectedDocument).toHaveBeenCalledWith(
      '/repo/from-system.markdown',
      expect.any(Object),
      { entryPoint: 'system' },
    );
    expect(executeFileAction).not.toHaveBeenCalled();
    expect(invokeNativeCommand).not.toHaveBeenCalled();
  });
});
