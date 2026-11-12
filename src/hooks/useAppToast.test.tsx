import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useAppToast } from './useAppToast';
import { TOAST_EXIT_MS } from '../lib/toast';
import { TOAST_ERROR_DURATION_MS, TOAST_STRING_DURATION_MS } from '../lib/feedbackTiming';

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

    // 自动消失同样走退场动画：停留时长 + 200ms 淡出后才卸载
    await act(async () => {
      await vi.advanceTimersByTimeAsync(50 + TOAST_EXIT_MS);
    });
    expect(result.current.toast).toBeNull();

    act(() => {
      result.current.showToast({ title: '保留', durationMs: null });
    });
    act(() => {
      result.current.dismissToast();
    });
    // 退场动画期间仍保留节点，避免视觉瞬断
    expect(result.current.toast?.title).toBe('保留');
    expect(result.current.leaving).toBe(true);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(TOAST_EXIT_MS);
    });
    expect(result.current.toast).toBeNull();
    expect(result.current.leaving).toBe(false);

    unmount();
  });

  it('passes an explicit tone through to the toast state', () => {
    const { result } = renderHook(() => useAppToast());

    act(() => {
      result.current.showToast('路径已复制到剪贴板', 'success');
    });

    expect(result.current.toast?.tone).toBe('success');
    expect(result.current.toast?.title).toBe('路径已复制到剪贴板');
  });

  it('defaults plain-text toasts to the neutral tone', () => {
    const { result } = renderHook(() => useAppToast());

    act(() => {
      result.current.showToast('缩放 120%');
    });

    expect(result.current.toast?.tone).toBe('neutral');
  });

  it('keeps error notices on screen longer than ordinary ones', () => {
    const { result } = renderHook(() => useAppToast());

    act(() => {
      result.current.showToast('操作失败: 文件已被外部修改', 'error');
    });
    expect(result.current.toast?.durationMs).toBe(TOAST_ERROR_DURATION_MS);

    act(() => {
      result.current.showToast('路径已复制到剪贴板', 'success');
    });
    expect(result.current.toast?.durationMs).toBe(TOAST_STRING_DURATION_MS);
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
