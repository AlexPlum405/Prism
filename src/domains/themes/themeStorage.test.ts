import { beforeEach, describe, expect, it, vi } from 'vitest';
import { exists, mkdir, readDir } from '../../platform/tauri/fileSystem';
import { openPathWithSystemNative } from '../../platform/tauri/nativeCommands';
import { openPathWithDefaultApp } from '../../platform/tauri/opener';
import {
  getThemesDirectoryNative,
  readThemePackageSourceNative,
  scanInstalledThemesNative,
} from '../../platform/tauri/themeStore';
import { openThemesDirectory, scanInstalledThemePackages } from './themeStorage';

vi.mock('../../platform/tauri/fileSystem', () => ({
  copyFile: vi.fn(),
  exists: vi.fn(),
  mkdir: vi.fn(),
  readDir: vi.fn(),
  readFile: vi.fn(),
  readTextFile: vi.fn(),
  remove: vi.fn(),
  stat: vi.fn(),
  writeFile: vi.fn(),
}));

vi.mock('../../platform/tauri/path', () => ({
  appDataDir: vi.fn(async () => '/Users/Alex/Library/Application Support/com.prism.editor.v1'),
}));

vi.mock('../../platform/tauri/nativeCommands', () => ({
  openPathWithSystemNative: vi.fn(),
}));

vi.mock('../../platform/tauri/opener', () => ({
  openPathWithDefaultApp: vi.fn(),
}));

vi.mock('../../platform/tauri/themeStore', () => ({
  deleteUserThemeNative: vi.fn(),
  getThemesDirectoryNative: vi.fn(),
  readThemePackageSourceNative: vi.fn(),
  scanInstalledThemesNative: vi.fn(),
}));

describe('themeStorage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getThemesDirectoryNative).mockResolvedValue('/Users/Alex/Library/Application Support/com.prism.editor.v1/themes');
    vi.mocked(readThemePackageSourceNative).mockRejectedValue(new Error('unknown command read_theme_package_source'));
    vi.mocked(scanInstalledThemesNative).mockRejectedValue(new Error('unknown command scan_installed_themes'));
    vi.mocked(exists).mockResolvedValue(true);
    vi.mocked(openPathWithSystemNative).mockResolvedValue(undefined);
    vi.mocked(openPathWithDefaultApp).mockResolvedValue(undefined);
  });

  it('opens the ensured themes directory through the system opener first', async () => {
    const directory = await openThemesDirectory();

    expect(directory).toBe('/Users/Alex/Library/Application Support/com.prism.editor.v1/themes');
    expect(openPathWithSystemNative).toHaveBeenCalledWith(directory);
    expect(openPathWithDefaultApp).not.toHaveBeenCalled();
  });

  it('creates the themes directory before opening it', async () => {
    vi.mocked(exists).mockResolvedValueOnce(false);

    await openThemesDirectory();

    expect(mkdir).toHaveBeenCalledWith(
      '/Users/Alex/Library/Application Support/com.prism.editor.v1/themes',
      { recursive: true },
    );
  });

  it('falls back to the Tauri opener when the system opener fails', async () => {
    vi.mocked(openPathWithSystemNative).mockRejectedValueOnce(new Error('open failed'));

    const directory = await openThemesDirectory();

    expect(directory).toBe('/Users/Alex/Library/Application Support/com.prism.editor.v1/themes');
    expect(openPathWithDefaultApp).toHaveBeenCalledWith(directory);
  });

  it('scans native valid and invalid user theme packages without falling back to directory walking', async () => {
    const source = {
      directory: '/Users/Alex/Library/Application Support/com.prism.editor.v1/themes/warm-paper',
      id: 'warm-paper',
      manifest: JSON.stringify({
        schemaVersion: 1,
        id: 'warm-paper',
        name: 'Warm Paper',
      }),
      css: "html[data-content-theme='warm-paper'] { --theme-main-bg: #fffaf2; }",
    };
    vi.mocked(scanInstalledThemesNative).mockResolvedValueOnce({
      valid: [source],
      invalid: [{
        id: 'broken-theme',
        name: 'Broken Theme',
        directory: '/Users/Alex/Library/Application Support/com.prism.editor.v1/themes/broken-theme',
        error: 'theme.css is missing',
      }],
    });
    vi.mocked(readThemePackageSourceNative).mockResolvedValueOnce(source);

    const result = await scanInstalledThemePackages();

    expect(result.valid.map((theme) => theme.id)).toEqual(['warm-paper']);
    expect(result.invalid).toEqual([{
      id: 'broken-theme',
      name: 'Broken Theme',
      directory: '/Users/Alex/Library/Application Support/com.prism.editor.v1/themes/broken-theme',
      error: 'theme.css is missing',
    }]);
    expect(readDir).not.toHaveBeenCalled();
  });
});
