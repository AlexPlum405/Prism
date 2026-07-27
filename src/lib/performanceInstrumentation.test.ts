import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getPerfTrace,
  hasPendingPerfFlushForTest,
  initPerfInstrumentation,
  isPerfInstrumentationEnabled,
  markPerf,
  markPerfDuration,
  resetPerfInstrumentationForTest,
} from './performanceInstrumentation';

afterEach(() => {
  resetPerfInstrumentationForTest();
  vi.useRealTimers();
});

describe('performanceInstrumentation', () => {
  it('stays disabled unless the config flag is exactly true', () => {
    initPerfInstrumentation(undefined);
    expect(isPerfInstrumentationEnabled()).toBe(false);

    initPerfInstrumentation(false);
    expect(isPerfInstrumentationEnabled()).toBe(false);

    initPerfInstrumentation(true);
    expect(isPerfInstrumentationEnabled()).toBe(true);
  });

  it('records nothing while disabled', () => {
    initPerfInstrumentation(false);
    markPerf('a');
    markPerfDuration('b', 12);
    expect(getPerfTrace().marks).toEqual([]);
    expect(hasPendingPerfFlushForTest()).toBe(false);
  });

  it('records marks with offsets relative to init', () => {
    initPerfInstrumentation(true);
    markPerf('document_read_done', { contentLength: 42 });
    markPerfDuration('preview_markdown_render', 84.44, { mode: 'worker' });

    const { marks } = getPerfTrace();
    expect(marks.map((mark) => mark.name)).toEqual([
      'document_read_done',
      'preview_markdown_render',
    ]);
    expect(marks[0].meta).toEqual({ contentLength: 42 });
    expect(marks[0].atMs).toBeGreaterThanOrEqual(0);
    // 保留一位小数，避免报告出现虚假精度。
    expect(marks[1].durationMs).toBe(84.4);
  });

  it('coalesces flushes so write cost does not land inside a measured stage', () => {
    vi.useFakeTimers();
    initPerfInstrumentation(true);

    markPerf('one');
    expect(hasPendingPerfFlushForTest()).toBe(true);

    vi.advanceTimersByTime(200);
    markPerf('two');
    vi.advanceTimersByTime(200);
    // 第二个 mark 重置了计时器，此时仍未落盘。
    expect(hasPendingPerfFlushForTest()).toBe(true);
    expect(getPerfTrace().marks).toHaveLength(2);
  });

  it('resets accumulated marks when a new trace starts', () => {
    initPerfInstrumentation(true);
    markPerf('first');
    expect(getPerfTrace().marks).toHaveLength(1);

    initPerfInstrumentation(true);
    expect(getPerfTrace().marks).toHaveLength(0);
  });
});
