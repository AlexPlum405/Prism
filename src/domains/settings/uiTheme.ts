import type { AppearanceMode, UiTheme } from './types';

const FIXED_MODE: Partial<Record<UiTheme, AppearanceMode>> = {
  miaoyan: 'light',
  'warm-paper': 'light',
  daylight: 'light',
  'night-paper': 'dark',
};

export function applyUiTheme(uiTheme: UiTheme): void {
  document.documentElement.setAttribute('data-ui-theme', uiTheme);
}

export function getUiThemeAppearance(uiTheme: UiTheme): AppearanceMode | null {
  return FIXED_MODE[uiTheme] ?? null;
}
