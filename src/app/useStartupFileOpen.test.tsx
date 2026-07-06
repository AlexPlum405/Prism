import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { selectNewStartupFilePaths, useStartupFileOpen } from './useStartupFileOpen';
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

  it('opens every pending startup file after the poll delay', async () => {
    const onOpenFilePath = vi.fn();
    vi.mocked(getPendingStartupFiles).mockResolvedValue([
      '/tmp/from-finder.md',
      '/tmp/second file.markdown',
    ]);

    renderHook(() => useStartupFileOpen({
      onOpenFilePath,
      pendingFilePollDelays: [0],
      wait,
    }));

    await waitFor(() => {
      expect(onOpenFilePath).toHaveBeenCalledWith('/tmp/from-finder.md');
    });
    expect(onOpenFilePath).toHaveBeenCalledWith('/tmp/second file.markdown');
    expect(onOpenFilePath).toHaveBeenCalledTimes(2);
  });

  it('deduplicates repeated pending startup files before opening', async () => {
    const onOpenFilePath = vi.fn();
    vi.mocked(getPendingStartupFiles).mockResolvedValue([
      '/tmp/from-finder.md',
      '/tmp/from-finder.md',
      '/tmp/notes.txt',
    ]);

    renderHook(() => useStartupFileOpen({
      onOpenFilePath,
      pendingFilePollDelays: [0],
      wait,
    }));

    await waitFor(() => {
      expect(onOpenFilePath).toHaveBeenCalledWith('/tmp/from-finder.md');
    });
    expect(onOpenFilePath).toHaveBeenCalledWith('/tmp/notes.txt');
    expect(onOpenFilePath).toHaveBeenCalledTimes(2);
  });

  it('tracks recently opened startup files with a short TTL', () => {
    const recent = new Map<string, number>();

    expect(selectNewStartupFilePaths(['/tmp/a.md', '/tmp/a.md'], recent, 1000)).toEqual(['/tmp/a.md']);
    expect(selectNewStartupFilePaths(['/tmp/a.md'], recent, 1200)).toEqual([]);
    expect(selectNewStartupFilePaths(['/tmp/a.md'], recent, 4000)).toEqual(['/tmp/a.md']);
  });

  it('does not poll or listen while disabled', async () => {
    renderHook(() => useStartupFileOpen({
      enabled: false,
      onOpenFilePath: vi.fn(),
      pendingFilePollDelays: [0],
      wait,
    }));

    expect(listenForStartupFiles).not.toHaveBeenCalled();
    expect(getPendingStartupFiles).not.toHaveBeenCalled();
  });

  it('opens every file delivered by the native file-opened event', async () => {
    const onOpenFilePath = vi.fn();

    renderHook(() => useStartupFileOpen({
      onOpenFilePath,
      pendingFilePollDelays: [],
      wait,
    }));

    await waitFor(() => expect(openedHandler).not.toBeNull());
    await openedHandler?.(['/tmp/event.md', '/tmp/事件 二.markdown']);

    expect(onOpenFilePath).toHaveBeenCalledWith('/tmp/event.md');
    expect(onOpenFilePath).toHaveBeenCalledWith('/tmp/事件 二.markdown');
    expect(onOpenFilePath).toHaveBeenCalledTimes(2);
  });

  it('deduplicates native file-opened event payloads and clears consumed pending files', async () => {
    const onOpenFilePath = vi.fn();

    renderHook(() => useStartupFileOpen({
      onOpenFilePath,
      pendingFilePollDelays: [],
      wait,
    }));

    await waitFor(() => expect(openedHandler).not.toBeNull());
    await openedHandler?.(['/tmp/event.md', '/tmp/event.md', '/tmp/event.txt']);

    expect(onOpenFilePath).toHaveBeenCalledWith('/tmp/event.md');
    expect(onOpenFilePath).toHaveBeenCalledWith('/tmp/event.txt');
    expect(onOpenFilePath).toHaveBeenCalledTimes(2);
    await waitFor(() => expect(getPendingStartupFiles).toHaveBeenCalledTimes(1));
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
