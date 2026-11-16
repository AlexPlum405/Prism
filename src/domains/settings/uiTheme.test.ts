import { afterEach, describe, expect, it } from 'vitest';
import { applyUiTheme, getUiThemeAppearance } from './uiTheme';

describe('uiTheme runtime', () => {
  afterEach(() => {
    document.documentElement.removeAttribute('data-ui-theme');
  });

  it('writes the selected interface theme to the root element', () => {
    applyUiTheme('warm-paper');
    expect(document.documentElement.getAttribute('data-ui-theme')).toBe('warm-paper');
  });

  it('locks the appearance mode for fixed themes', () => {
    expect(getUiThemeAppearance('islands')).toBeNull();
    expect(getUiThemeAppearance('miaoyan')).toBe('light');
    expect(getUiThemeAppearance('warm-paper')).toBe('light');
    expect(getUiThemeAppearance('daylight')).toBe('light');
    expect(getUiThemeAppearance('night-paper')).toBe('dark');
  });
});
