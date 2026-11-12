import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useRecoveryQueue } from './useRecoveryQueue';
import {
  deleteRecoverySnapshot,
  listRecoverySnapshots,
  restoreRecoverySnapshot,
  type RecoverySnapshot,
} from '../services/recovery';

vi.mock('../services/recovery', () => ({
  deleteRecoverySnapshot: vi.fn(),
  listRecoverySnapshots: vi.fn(),
  restoreRecoverySnapshot: vi.fn(),
}));

const firstSnapshot: RecoverySnapshot = {
  id: 'doc:2000',
  documentId: 'doc',
  documentPath: '/tmp/a.md',
  documentName: 'a.md',
  content: '# Recovered A',
  createdAt: 2000,
  reason: 'autosave',
  filePath: '/app/recovery/doc/2000.json',
};

const secondSnapshot: RecoverySnapshot = {
  id: 'doc:1000',
  documentId: 'doc',
  documentPath: '/tmp/a.md',
  documentName: 'a.md',
  content: '# Recovered B',
  createdAt: 1000,
  reason: 'manual-save',
  filePath: '/app/recovery/doc/1000.json',
};

describe('useRecoveryQueue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (listRecoverySnapshots as ReturnType<typeof vi.fn>).mockResolvedValue([
      firstSnapshot,
      secondSnapshot,
    ]);
    (restoreRecoverySnapshot as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    (deleteRecoverySnapshot as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
  });

  it('loads the newest startup recovery snapshot as the active prompt', async () => {
    const showToast = vi.fn();
    const { result } = renderHook(() => useRecoveryQueue({ showToast }));

    await waitFor(() => {
      expect(result.current.activeRecoverySnapshot).toEqual(firstSnapshot);
    });

    expect(listRecoverySnapshots).toHaveBeenCalledTimes(1);
    expect(result.current.recoveryAction).toBeNull();
  });

  it('restores the active snapshot, removes it from this session queue, and keeps the next snapshot visible', async () => {
    const showToast = vi.fn();
    const { result } = renderHook(() => useRecoveryQueue({ showToast }));

    await waitFor(() => {
      expect(result.current.activeRecoverySnapshot).toEqual(firstSnapshot);
    });

    await act(async () => {
      await result.current.handleRestoreRecovery();
    });

    expect(restoreRecoverySnapshot).toHaveBeenCalledWith(firstSnapshot);
    expect(result.current.activeRecoverySnapshot).toEqual(secondSnapshot);
    expect(showToast).toHaveBeenCalledWith('已恢复本地快照', 'success');
  });

  it('discards only the active snapshot and leaves newer document recovery contract intact', async () => {
    const showToast = vi.fn();
    const { result } = renderHook(() => useRecoveryQueue({ showToast }));

    await waitFor(() => {
      expect(result.current.activeRecoverySnapshot).toEqual(firstSnapshot);
    });

    await act(async () => {
      await result.current.handleDiscardRecovery();
    });

    expect(deleteRecoverySnapshot).toHaveBeenCalledWith(firstSnapshot);
    expect(result.current.activeRecoverySnapshot).toEqual(secondSnapshot);
    expect(showToast).toHaveBeenCalledWith('已丢弃恢复快照', 'success');
  });

  it('keeps the active snapshot available when restore fails', async () => {
    const showToast = vi.fn();
    (restoreRecoverySnapshot as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('disk denied'));
    const { result } = renderHook(() => useRecoveryQueue({ showToast }));

    await waitFor(() => {
      expect(result.current.activeRecoverySnapshot).toEqual(firstSnapshot);
    });

    await act(async () => {
      await result.current.handleRestoreRecovery();
    });

    expect(result.current.activeRecoverySnapshot).toEqual(firstSnapshot);
    expect(showToast).toHaveBeenCalledWith('恢复失败: disk denied', 'error');
  });

  it('keeps the active snapshot available when discard fails', async () => {
    const showToast = vi.fn();
    (deleteRecoverySnapshot as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('disk denied'));
    const { result } = renderHook(() => useRecoveryQueue({ showToast }));

    await waitFor(() => {
      expect(result.current.activeRecoverySnapshot).toEqual(firstSnapshot);
    });

    await act(async () => {
      await result.current.handleDiscardRecovery();
    });

    expect(result.current.activeRecoverySnapshot).toEqual(firstSnapshot);
    expect(showToast).toHaveBeenCalledWith('丢弃失败: disk denied', 'error');
  });

  it('does not update state after unmounting while startup recovery scan is pending', async () => {
    let resolveSnapshots!: (snapshots: RecoverySnapshot[]) => void;
    (listRecoverySnapshots as ReturnType<typeof vi.fn>).mockReturnValue(
      new Promise<RecoverySnapshot[]>((resolve) => {
        resolveSnapshots = resolve;
      }),
    );

    const showToast = vi.fn();
    const { result, unmount } = renderHook(() => useRecoveryQueue({ showToast }));
    unmount();

    await act(async () => {
      resolveSnapshots([firstSnapshot]);
      await Promise.resolve();
    });

    expect(result.current.activeRecoverySnapshot).toBeNull();
  });
});
