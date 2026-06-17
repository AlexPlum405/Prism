import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useExportTaskUi } from './useExportTaskUi';

describe('useExportTaskUi', () => {
  beforeEach(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  it('tracks foreground and background export progress events', () => {
    const showToast = vi.fn();
    const { result } = renderHook(() => useExportTaskUi(showToast));

    act(() => {
      window.dispatchEvent(new CustomEvent('prism-export-progress', {
        detail: { visible: true, message: '正在生成 PDF' },
      }));
    });
    expect(result.current.exportProgress).toBe('正在生成 PDF');
    expect(result.current.exportProgressInBackground).toBe(false);

    act(() => {
      result.current.sendExportProgressToBackground();
    });
    expect(result.current.exportProgressInBackground).toBe(true);

    act(() => {
      result.current.showBackgroundExportProgress();
    });
    expect(result.current.exportProgressInBackground).toBe(false);

    act(() => {
      window.dispatchEvent(new CustomEvent('prism-export-progress', {
        detail: { visible: false },
      }));
    });
    expect(result.current.exportProgress).toBeNull();
    expect(result.current.exportProgressInBackground).toBe(false);
  });

  it('tracks export failure diagnostics and copies them to the clipboard', async () => {
    const showToast = vi.fn();
    const { result } = renderHook(() => useExportTaskUi(showToast));

    act(() => {
      window.dispatchEvent(new CustomEvent('prism-export-failure', {
        detail: {
          title: 'PDF 导出失败',
          diagnostic: 'stage: render',
          documentPath: '/tmp/report.md',
          format: 'pdf',
          message: 'disk full',
          nextSteps: '检查输出目录',
          outputPath: '/tmp/report.pdf',
          stage: '正在写入 PDF 文件',
        },
      }));
    });

    expect(result.current.exportFailure).toEqual({
      diagnostic: 'stage: render',
      documentPath: '/tmp/report.md',
      format: 'pdf',
      message: 'disk full',
      nextSteps: '检查输出目录',
      outputPath: '/tmp/report.pdf',
      stage: '正在写入 PDF 文件',
      title: 'PDF 导出失败',
    });

    await act(async () => {
      await result.current.copyExportFailureDiagnostic();
    });

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('stage: render');
    expect(showToast).toHaveBeenCalledWith('导出诊断文本已复制');

    act(() => {
      result.current.dismissExportFailure();
    });
    expect(result.current.exportFailure).toBeNull();
  });
});
