import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useStartupFileOpen } from './useStartupFileOpen';
import { getPendingStartupFiles, listenForStartupFiles } from '../platform/tauri/startupFiles';

vi.mock('../platform/tauri/startupFiles', () => ({
  getPendingStartupFiles: vi.fn(),
  listenForStartupFiles: vi.fn(),
}));

describe('useStartupFileOpen', () => {
  const wait = vi.fn(async () => undefined);
  const unlisten = vi.fn();
  let openedHandler: ((paths: string[]) => void | Promise<void>) | null = null;

  beforeEach(() => {
    vi.clearAllMocks();
    openedHandler = null;
    vi.mocked(getPendingStartupFiles).mockResolvedValue([]);
    vi.mocked(listenForStartupFiles).mockImplementation(async (handler) => {
      openedHandler = handler;
      return unlisten;
    });
  });

  it('opens the first pending startup file after the poll delay', async () => {
    const onOpenFilePath = vi.fn();
    vi.mocked(getPendingStartupFiles).mockResolvedValue(['/tmp/from-finder.md']);

    renderHook(() => useStartupFileOpen({
      onOpenFilePath,
      pendingFilePollDelays: [0],
      wait,
    }));

    await waitFor(() => {
      expect(onOpenFilePath).toHaveBeenCalledWith('/tmp/from-finder.md');
    });
  });

  it('opens files delivered by the native file-opened event', async () => {
    const onOpenFilePath = vi.fn();

    renderHook(() => useStartupFileOpen({
      onOpenFilePath,
      pendingFilePollDelays: [],
      wait,
    }));

    await waitFor(() => expect(openedHandler).not.toBeNull());
    await openedHandler?.(['/tmp/event.md']);

    expect(onOpenFilePath).toHaveBeenCalledWith('/tmp/event.md');
  });

  it('removes the native listener on unmount', async () => {
    const { unmount } = renderHook(() => useStartupFileOpen({
      onOpenFilePath: vi.fn(),
      pendingFilePollDelays: [],
      wait,
    }));

    unmount();

    await waitFor(() => {
      expect(unlisten).toHaveBeenCalled();
    });
  });
});
