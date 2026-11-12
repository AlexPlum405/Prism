import { describe, expect, it } from 'vitest';
import {
  createIslandPreference,
  DEFAULT_ISLAND_WIDTHS,
  fitIslandWidths,
  getIslandBudget,
  GUTTER_W,
  ISLAND_LIMITS,
  resizeEditorPreference,
  resizeSidebarPreference,
  type IslandPreference,
} from './islandLayout';

const fullWindow = { available: 1404, paneCount: 2 as const, sidebarVisible: true };
const pref = () => createIslandPreference();

describe('islandLayout', () => {
  it('keeps the 268 / 548 / 556 baseline at 1440', () => {
    const widths = fitIslandWidths(pref(), fullWindow);
    expect(widths).toEqual({ sidebar: 268, editor: 548, preview: 556 });
    expect(widths.sidebar + widths.editor + widths.preview + 2 * GUTTER_W).toBe(1404);
  });

  it('reserves one gutter per seam', () => {
    expect(getIslandBudget(fullWindow)).toBe(1372);
    expect(getIslandBudget({ ...fullWindow, paneCount: 1 })).toBe(1388);
    expect(getIslandBudget({ ...fullWindow, sidebarVisible: false })).toBe(1388);
  });

  it('squeezes the sidebar before the document panes at the 980 minimum width', () => {
    const widths = fitIslandWidths(pref(), { ...fullWindow, available: 980 - 36 });
    expect(widths.editor).toBeGreaterThanOrEqual(ISLAND_LIMITS.editor.min);
    expect(widths.preview).toBeGreaterThanOrEqual(ISLAND_LIMITS.preview.min);
    expect(widths.sidebar).toBeLessThan(DEFAULT_ISLAND_WIDTHS.sidebar);
    expect(widths.sidebar + widths.editor + widths.preview + 2 * GUTTER_W).toBe(944);
  });

  it('does not bake the squeeze into the preference, so widening restores 268', () => {
    const squeezed = fitIslandWidths(pref(), { ...fullWindow, available: 980 - 36 });
    expect(squeezed.sidebar).toBeLessThan(268);

    const restored = fitIslandWidths(pref(), fullWindow);
    expect(restored.sidebar).toBe(268);
    expect(restored).toEqual({ sidebar: 268, editor: 548, preview: 556 });
  });

  it('grows both document panes proportionally on a 1920 window', () => {
    const widths = fitIslandWidths(pref(), { ...fullWindow, available: 1920 - 36 });
    expect(widths.sidebar).toBe(268);
    expect(widths.sidebar + widths.editor + widths.preview + 2 * GUTTER_W).toBe(1884);
    expect(widths.editor / widths.preview).toBeCloseTo(548 / 556, 1);
  });

  it('clamps the dragged sidebar to 200–360 without touching the pane ratio', () => {
    const narrow = resizeSidebarPreference(pref(), 120);
    expect(fitIslandWidths(narrow, fullWindow).sidebar).toBe(ISLAND_LIMITS.sidebar.min);

    const wide = resizeSidebarPreference(pref(), 900);
    const widths = fitIslandWidths(wide, fullWindow);
    expect(widths.sidebar).toBe(ISLAND_LIMITS.sidebar.max);
    expect(widths.sidebar + widths.editor + widths.preview + 2 * GUTTER_W).toBe(1404);
    expect(widths.editor / (widths.editor + widths.preview)).toBeCloseTo(548 / 1104, 2);
  });

  it('moves the editor/preview boundary while keeping their sum', () => {
    const wider = fitIslandWidths(resizeEditorPreference(pref(), 600, fullWindow), fullWindow);
    expect(wider.editor).toBe(600);
    expect(wider.editor + wider.preview).toBe(1104);

    const tooWide = fitIslandWidths(resizeEditorPreference(pref(), 900, fullWindow), fullWindow);
    expect(tooWide.editor).toBeLessThanOrEqual(ISLAND_LIMITS.editor.max);
    expect(tooWide.preview).toBeGreaterThanOrEqual(ISLAND_LIMITS.preview.min);
  });

  it('reset returns to the baseline', () => {
    const drifted: IslandPreference = resizeEditorPreference(
      resizeSidebarPreference(pref(), 340),
      700,
      fullWindow,
    );
    expect(fitIslandWidths(drifted, fullWindow)).not.toEqual(fitIslandWidths(pref(), fullWindow));
    expect(fitIslandWidths(createIslandPreference(), fullWindow)).toEqual({
      sidebar: 268,
      editor: 548,
      preview: 556,
    });
  });
});
