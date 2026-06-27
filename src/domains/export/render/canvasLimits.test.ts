import { describe, expect, it } from 'vitest';
import {
  assertExportCanvasWithinLimits,
  getSafeExportCanvasScale,
  isExportCanvasWithinLimits,
  MAX_EXPORT_CANVAS_AREA,
  MAX_EXPORT_CANVAS_DIMENSION,
} from './canvasLimits';

describe('canvasLimits', () => {
  it('accepts dimensions within both dimension and area limits', () => {
    expect(isExportCanvasWithinLimits(1000, 1000, 2)).toBe(true);
    expect(() => assertExportCanvasWithinLimits(1000, 1000, 2, 'PNG')).not.toThrow();
  });

  it('rejects dimensions beyond the per-axis limit', () => {
    expect(isExportCanvasWithinLimits(MAX_EXPORT_CANVAS_DIMENSION + 1, 100, 1)).toBe(false);
    expect(() => assertExportCanvasWithinLimits(MAX_EXPORT_CANVAS_DIMENSION + 1, 100, 1, 'PNG'))
      .toThrow('PNG');
  });

  it('rejects dimensions beyond the total area limit', () => {
    const side = Math.ceil(Math.sqrt(MAX_EXPORT_CANVAS_AREA)) + 1;

    expect(isExportCanvasWithinLimits(side, side, 1)).toBe(false);
    expect(() => assertExportCanvasWithinLimits(side, side, 1, 'PDF')).toThrow('PDF');
  });

  it('finds the highest safe integer scale for long exports', () => {
    expect(getSafeExportCanvasScale(1027, 12007, 4)).toBe(1);
    expect(getSafeExportCanvasScale(1000, 1000, 4)).toBe(4);
    expect(getSafeExportCanvasScale(20_000, 1000, 4)).toBeNull();
  });
});
