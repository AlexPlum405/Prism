import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createToastState, TOAST_TIMER_MIN_MS } from '../../lib/toast';
import { Toast } from './Toast';

describe('Toast', () => {
  it('renders structured copy and runs actions', () => {
    const onDismiss = vi.fn();
    const onOpen = vi.fn();

    render(
      <Toast
        toast={createToastState({
          tone: 'success',
          title: 'PDF 导出完成',
          message: 'report.pdf',
          actions: [{ label: '打开', onClick: onOpen }],
        })}
        onDismiss={onDismiss}
      />,
    );

    expect(screen.getByRole('status')).toHaveTextContent('PDF 导出完成');
    expect(screen.getByRole('status')).toHaveTextContent('report.pdf');

    fireEvent.click(screen.getByRole('button', { name: '打开' }));

    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('keeps the toast visible when an action opts out of dismissal', () => {
    const onDismiss = vi.fn();
    const onInspect = vi.fn();

    render(
      <Toast
        toast={createToastState({
          tone: 'error',
          title: '导出失败',
          actions: [{ label: '查看诊断', onClick: onInspect, dismissOnClick: false }],
        })}
        onDismiss={onDismiss}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '查看诊断' }));

    expect(onDismiss).not.toHaveBeenCalled();
    expect(onInspect).toHaveBeenCalledTimes(1);
  });

  it('picks the icon from the semantic tone rather than the text', () => {
    const { container, rerender } = render(
      <Toast toast={createToastState('路径已复制到剪贴板', 'success')} onDismiss={vi.fn()} />,
    );

    // success 用对勾（path），不退化回 neutral 的实心圆点
    expect(container.querySelector('.prism-toast--success')).not.toBeNull();
    expect(container.querySelector('.prism-toast-icon path')).not.toBeNull();
    expect(container.querySelector('.prism-toast-icon circle.prism-toast-icon-dot')).toBeNull();

    rerender(<Toast toast={createToastState('路径已复制到剪贴板')} onDismiss={vi.fn()} />);
    expect(container.querySelector('.prism-toast--neutral')).not.toBeNull();
  });

  it('only renders the timer line for notices that last long enough', () => {
    const { container, rerender } = render(
      <Toast
        toast={createToastState({ title: '短提示', durationMs: TOAST_TIMER_MIN_MS - 400 })}
        onDismiss={vi.fn()}
      />,
    );
    expect(container.querySelector('.prism-toast-timer')).toBeNull();

    rerender(
      <Toast
        toast={createToastState({ title: '长提示', durationMs: TOAST_TIMER_MIN_MS + 1600 })}
        onDismiss={vi.fn()}
      />,
    );
    const timer = container.querySelector('.prism-toast-timer i') as HTMLElement | null;
    expect(timer).not.toBeNull();
    expect(timer?.style.animationDuration).toBe(`${TOAST_TIMER_MIN_MS + 1600}ms`);
  });

  it('marks the card as leaving so the exit animation can run', () => {
    const { container } = render(
      <Toast toast={createToastState('已保存')} onDismiss={vi.fn()} leaving />,
    );
    expect(container.querySelector('.prism-toast.is-leaving')).not.toBeNull();
  });
});
