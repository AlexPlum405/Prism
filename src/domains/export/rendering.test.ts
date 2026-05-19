import { describe, expect, it, vi } from 'vitest';
import {
  nextExportFrame,
  normalizeCssColorFunctionsForRaster,
  stripRasterUnsafeColorDeclarations,
  withExportTimeout,
} from './rendering';

describe('export rendering helpers', () => {
  it('normalizes WebKit color functions before raster renderers read computed styles', () => {
    expect(normalizeCssColorFunctionsForRaster('color(srgb 1 0.5 0 / 75%)')).toBe('rgba(255, 128, 0, 0.75)');
    expect(
      normalizeCssColorFunctionsForRaster('0 0 0 1px color(display-p3 0.1 0.2 0.3)'),
    ).toBe('0 0 0 1px rgb(26, 51, 77)');
  });

  it('strips raster-unsafe CSS color function declarations', () => {
    const css = `
      .a { color: #262626; background: color(display-p3 1 1 1); }
      .b { border: 1px solid #dddddd; box-shadow: 0 0 0 3px color-mix(in srgb, #1c5d33 18%, transparent); }
    `;

    const safeCss = stripRasterUnsafeColorDeclarations(css);

    expect(safeCss).not.toContain('color(display-p3');
    expect(safeCss).not.toContain('color-mix(');
    expect(safeCss).toContain('color: #262626;');
    expect(safeCss).toContain('border: 1px solid #dddddd;');
  });

  it('resolves frame waits through the timer fallback when requestAnimationFrame is unavailable', async () => {
    vi.useFakeTimers();
    const originalRequestAnimationFrame = globalThis.requestAnimationFrame;
    delete (globalThis as Partial<typeof globalThis>).requestAnimationFrame;

    try {
      const wait = nextExportFrame(25);
      await vi.advanceTimersByTimeAsync(25);
      await expect(wait).resolves.toBeUndefined();
    } finally {
      if (originalRequestAnimationFrame) {
        globalThis.requestAnimationFrame = originalRequestAnimationFrame;
      }
      vi.useRealTimers();
    }
  });

  it('rejects export promises that exceed their timeout', async () => {
    vi.useFakeTimers();
    const slowPromise = new Promise<string>(() => undefined);

    try {
      const timed = withExportTimeout(slowPromise, 25, '导出超时');
      const expectation = expect(timed).rejects.toThrow('导出超时');
      await vi.advanceTimersByTimeAsync(25);
      await expectation;
    } finally {
      vi.useRealTimers();
    }
  });
});
