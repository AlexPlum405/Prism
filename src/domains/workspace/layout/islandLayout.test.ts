import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ISLAND_WIDTHS,
  fitIslandWidths,
  getIslandBudget,
  resizeEditor,
  resizeSidebar,
  resetIslandWidths,
  GUTTER_W,
  ISLAND_LIMITS,
  type IslandWidths,
} from './islandLayout';

const fullWindow = { available: 1404, paneCount: 2 as const, sidebarVisible: true };

describe('islandLayout', () => {
  it('keeps the 268 / 548 / 556 baseline at 1440', () => {
    const widths = fitIslandWidths({ ...DEFAULT_ISLAND_WIDTHS }, fullWindow);
    expect(widths).toEqual({ sidebar: 268, editor: 548, preview: 556 });
    expect(widths.sidebar + widths.editor + widths.preview + 2 * GUTTER_W).toBe(1404);
  });

  it('reserves one gutter per seam', () => {
    expect(getIslandBudget(fullWindow)).toBe(1372);
    expect(getIslandBudget({ ...fullWindow, paneCount: 1 })).toBe(1388);
    expect(getIslandBudget({ ...fullWindow, sidebarVisible: false })).toBe(1388);
  });

  it('shrinks proportionally when the window is too narrow', () => {
    const widths = fitIslandWidths({ ...DEFAULT_ISLAND_WIDTHS }, { ...fullWindow, available: 1200 - 36 });
    expect(widths.sidebar + widths.editor + widths.preview + 2 * GUTTER_W).toBe(1164);
    expect(widths.editor).toBeGreaterThanOrEqual(ISLAND_LIMITS.editor.min);
    expect(widths.preview).toBeGreaterThanOrEqual(ISLAND_LIMITS.preview.min);
  });

  it('restores the design ratio after a document-less pass zeroed the panes', () => {
    const zeroed: IslandWidths = { sidebar: 268, editor: 0, preview: 0 };
    const widths = fitIslandWidths(zeroed, fullWindow);
    expect(widths).toEqual({ sidebar: 268, editor: 548, preview: 556 });
  });

  it('clamps the sidebar to 200–360 and feeds the rest to the document area', () => {
    const narrow = resizeSidebar({ ...DEFAULT_ISLAND_WIDTHS }, 120, fullWindow);
    expect(narrow.sidebar).toBe(ISLAND_LIMITS.sidebar.min);

    const wide = resizeSidebar({ ...DEFAULT_ISLAND_WIDTHS }, 900, fullWindow);
    expect(wide.sidebar).toBe(ISLAND_LIMITS.sidebar.max);
    expect(wide.sidebar + wide.editor + wide.preview + 2 * GUTTER_W).toBe(1404);
  });

  it('moves the editor/preview boundary while keeping their sum', () => {
    const base = { ...DEFAULT_ISLAND_WIDTHS };
    const wider = resizeEditor(base, 600);
    expect(wider.editor).toBe(600);
    expect(wider.preview).toBe(base.editor + base.preview - 600);

    const tooWide = resizeEditor(base, 900);
    expect(tooWide.editor).toBeLessThanOrEqual(ISLAND_LIMITS.editor.max);
    expect(tooWide.preview).toBeGreaterThanOrEqual(ISLAND_LIMITS.preview.min);
  });

  it('grows both document panes proportionally on a 1920 window', () => {
    const widths = fitIslandWidths({ ...DEFAULT_ISLAND_WIDTHS }, { ...fullWindow, available: 1920 - 36 });
    expect(widths.sidebar).toBe(268);
    expect(widths.sidebar + widths.editor + widths.preview + 2 * GUTTER_W).toBe(1884);
    // 仍保持 548 : 556 的取向，编辑岛不会被预览吃掉
    expect(widths.editor / widths.preview).toBeCloseTo(548 / 556, 1);
  });

  it('resets back to the baseline', () => {
    const drifted = resizeEditor(resizeSidebar({ ...DEFAULT_ISLAND_WIDTHS }, 340, fullWindow), 700);
    expect(resetIslandWidths(fullWindow)).toEqual({ sidebar: 268, editor: 548, preview: 556 });
    expect(drifted).not.toEqual(resetIslandWidths(fullWindow));
  });
});
