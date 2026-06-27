import { describe, expect, it } from 'vitest';
import { getMarkmapOptions, getMarkmapPalette } from './markmap';

describe('Markmap theme options', () => {
  it('uses the MiaoYan bundled Markmap color palette for light diagrams', () => {
    const palette = getMarkmapPalette('miaoyan');
    const options = getMarkmapOptions('miaoyan');

    expect(palette.slice(0, 6)).toEqual([
      '#FF6B6B',
      '#4ECDC4',
      '#45B7D1',
      '#96CEB4',
      '#FFEAA7',
      '#DDA0DD',
    ]);
    expect(options.color({ state: { depth: 0 } })).toBe('#FF6B6B');
    expect(options.color({ state: { depth: 13 } })).toBe('#4ECDC4');
    expect(options.duration).toBe(300);
    expect(options.fitRatio).toBe(0.92);
    expect(options.lineWidth({ state: { depth: 1 } })).toBe(2);
    expect(options.maxInitialScale).toBe(1);
    expect(options.paddingX).toBe(16);
    expect(options.paddingY).toBe(16);
    expect(options.pan).toBe(false);
    expect(options.scrollForPan).toBe(false);
    expect(options.spacingHorizontal).toBe(20);
    expect(options.spacingVertical).toBe(20);
    expect(options.maxWidth).toBe(220);
  });

  it('uses per-theme diagram palettes for non-MiaoYan themes', () => {
    const palette = getMarkmapPalette('nocturne');
    const carbonPalette = getMarkmapPalette('carbon');
    const options = getMarkmapOptions('nocturne');

    expect(palette[0]).toBe('#D6A84F');
    expect(carbonPalette[0]).toBe('#7DD3FC');
    expect(options.color({ state: { depth: 0 } })).toBe('#D6A84F');
  });
});
