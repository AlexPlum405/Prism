import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getErrorMessage,
  getExportOutputPath,
  getExportTitle,
  getPreviewBackgroundColor,
  isTauriExportWorkerRuntime,
  normalizeExportRasterScale,
  reportProgress,
  reportWarning,
} from './exportPipelineContext';

type PrismRuntimeWindow = Window & {
  __TAURI_INTERNALS__?: unknown;
  __PRISM_EXPORT_WORKER__?: boolean;
};

describe('exportPipelineContext', () => {
  beforeEach(() => {
    document.documentElement.style.removeProperty('--bg-preview');
    delete (window as PrismRuntimeWindow).__TAURI_INTERNALS__;
    delete (window as PrismRuntimeWindow).__PRISM_EXPORT_WORKER__;
  });

  it('normalizes raster scales without auto-downscaling', () => {
    expect(normalizeExportRasterScale(undefined)).toBe(2);
    expect(normalizeExportRasterScale(0.4)).toBe(1);
    expect(normalizeExportRasterScale(2.4)).toBe(2);
    expect(normalizeExportRasterScale(5)).toBe(4);
  });

  it('derives export titles from explicit title or markdown filename', () => {
    expect(getExportTitle({ title: '  Quarterly Notes ', filename: 'draft.md' })).toBe('Quarterly Notes');
    expect(getExportTitle({ filename: 'draft.markdown' })).toBe('draft');
    expect(getExportTitle({ filename: '.md' })).toBe('Untitled');
  });

  it('reports progress and warnings through the input callbacks', () => {
    const onProgress = vi.fn();
    const onWarning = vi.fn();

    reportProgress({ content: '', filename: 'a.md', contentTheme: 'miaoyan', onProgress }, 'progress');
    reportWarning({ content: '', filename: 'a.md', contentTheme: 'miaoyan', onWarning }, 'warning');

    expect(onProgress).toHaveBeenCalledWith('progress');
    expect(onWarning).toHaveBeenCalledWith('warning');
  });

  it('detects only the isolated export worker runtime', () => {
    expect(isTauriExportWorkerRuntime()).toBe(false);

    (window as PrismRuntimeWindow).__TAURI_INTERNALS__ = {};
    expect(isTauriExportWorkerRuntime()).toBe(false);

    (window as PrismRuntimeWindow).__PRISM_EXPORT_WORKER__ = true;
    expect(isTauriExportWorkerRuntime()).toBe(true);
  });

  it('normalizes error and output path helpers', async () => {
    expect(getErrorMessage(new Error(' Failed '))).toBe('Failed');
    expect(getErrorMessage(' message ')).toBe('message');
    expect(await getExportOutputPath('/tmp/out.pdf')).toBe('/tmp/out.pdf');
    expect(await getExportOutputPath()).toBeNull();
  });

  it('uses the preview background token with a white fallback', () => {
    expect(getPreviewBackgroundColor()).toBe('#ffffff');

    document.documentElement.style.setProperty('--bg-preview', '#f7f3eb');
    expect(getPreviewBackgroundColor()).toBe('#f7f3eb');
  });
});
