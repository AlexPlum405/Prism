import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useAppToast } from './useAppToast';

describe('useAppToast', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows and dismisses toast state with timer cleanup', async () => {
    vi.useFakeTimers();
    const { result, unmount } = renderHook(() => useAppToast());

    act(() => {
      result.current.showToast({ title: '保存完成', durationMs: 50 });
    });
    expect(result.current.toast?.title).toBe('保存完成');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });
    expect(result.current.toast).toBeNull();

    act(() => {
      result.current.showToast({ title: '保留', durationMs: null });
    });
    act(() => {
      result.current.dismissToast();
    });
    expect(result.current.toast).toBeNull();

    unmount();
  });

  it('listens for global prism-toast events', () => {
    const { result } = renderHook(() => useAppToast());

    act(() => {
      window.dispatchEvent(new CustomEvent('prism-toast', {
        detail: { tone: 'success', title: '导出完成' },
      }));
    });

    expect(result.current.toast?.title).toBe('导出完成');
    expect(result.current.toast?.tone).toBe('success');
  });
});
