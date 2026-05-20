import { afterEach, describe, expect, it } from 'vitest';
import { builtInThemeContracts } from './themeContract';
import {
  __themeRegistryTesting,
  getAvailableThemeEntries,
  getInvalidThemeEntries,
  getThemeContract,
  isRegisteredContentTheme,
} from './themeRegistry';
import type { ThemePackage } from './themePackage';

function createWarmPaperPackage(): ThemePackage {
  return {
    id: 'warm-paper',
    name: '暖纸',
    author: 'Prism QA',
    version: '1.0.0',
    description: '测试主题',
    isDark: false,
    directory: '/tmp/warm-paper',
    css: "html[data-content-theme='warm-paper'] { --theme-main-bg: #fbfaf6; }",
    contract: {
      ...builtInThemeContracts.miaoyan,
      id: 'warm-paper',
      label: '暖纸',
      preview: {
        ...builtInThemeContracts.miaoyan.preview,
        writeClass: 'markdown-body heti warm-paper-write',
      },
    },
    fonts: [],
  };
}

describe('theme registry', () => {
  afterEach(() => {
    __themeRegistryTesting.setRuntimeEntries([], []);
  });

  it('adds valid user themes to available entries', () => {
    __themeRegistryTesting.setRuntimeEntries([createWarmPaperPackage()], []);

    expect(isRegisteredContentTheme('warm-paper')).toBe(true);
    expect(getAvailableThemeEntries().some((entry) => entry.id === 'warm-paper')).toBe(true);
    expect(getThemeContract('warm-paper').preview.writeClass).toContain('warm-paper-write');
  });

  it('keeps invalid themes out of available entries and falls back to miaoyan', () => {
    __themeRegistryTesting.setRuntimeEntries([], [{
      id: 'broken-theme',
      name: 'Broken',
      directory: '/tmp/broken',
      error: 'theme.css 缺失',
    }]);

    expect(isRegisteredContentTheme('broken-theme')).toBe(false);
    expect(getInvalidThemeEntries()).toHaveLength(1);
    expect(getAvailableThemeEntries().some((entry) => entry.id === 'broken-theme')).toBe(false);
    expect(getThemeContract('broken-theme').id).toBe('miaoyan');
  });
});
