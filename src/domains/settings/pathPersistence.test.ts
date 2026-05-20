import { beforeEach, describe, expect, it, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { appDataDir } from '@tauri-apps/api/path';
import { exists, readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';
import { __fontServiceTesting } from './fontService';
import { __settingsStoreTesting, useSettingsStore } from './store';

vi.mock('@tauri-apps/api/path', () => ({
  appDataDir: vi.fn(),
}));

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

vi.mock('@tauri-apps/plugin-fs', () => ({
  copyFile: vi.fn(),
  exists: vi.fn(),
  mkdir: vi.fn(),
  readFile: vi.fn(),
  readDir: vi.fn(async () => []),
  readTextFile: vi.fn(),
  remove: vi.fn(),
  writeTextFile: vi.fn(),
}));

describe('settings app data paths', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('keeps config.json inside appData when appDataDir has no trailing slash', async () => {
    (appDataDir as ReturnType<typeof vi.fn>).mockResolvedValue('/Users/Alex/Library/Application Support/com.prism.editor.v1');

    await expect(__settingsStoreTesting.getConfigPath()).resolves.toBe(
      '/Users/Alex/Library/Application Support/com.prism.editor.v1/config.json',
    );
  });

  it('keeps imported fonts inside appData when appDataDir has no trailing slash', async () => {
    (appDataDir as ReturnType<typeof vi.fn>).mockResolvedValue('/Users/Alex/Library/Application Support/com.prism.editor.v1');

    await expect(__fontServiceTesting.getFontsDir()).resolves.toBe(
      '/Users/Alex/Library/Application Support/com.prism.editor.v1/fonts',
    );
  });

  it('migrates the legacy config path into appData when the new config is missing', async () => {
    (appDataDir as ReturnType<typeof vi.fn>).mockResolvedValue('/Users/Alex/Library/Application Support/com.prism.editor.v1');
    (readTextFile as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('not found'));
    (invoke as ReturnType<typeof vi.fn>).mockResolvedValue(JSON.stringify({
      theme: 'dark',
      recentFiles: [{
        path: '/Users/Alex/notes/legacy.md',
        name: 'legacy.md',
        lastOpened: 1,
      }],
      lastSession: {
        filePath: '/Users/Alex/notes/legacy.md',
        viewMode: 'preview',
        updatedAt: 2,
      },
    }));
    (exists as ReturnType<typeof vi.fn>).mockResolvedValue(true);
    (writeTextFile as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    await useSettingsStore.getState().loadSettings();

    expect(useSettingsStore.getState().theme).toBe('dark');
    expect(useSettingsStore.getState().recentFiles[0]?.name).toBe('legacy.md');
    expect(writeTextFile).toHaveBeenCalledWith(
      '/Users/Alex/Library/Application Support/com.prism.editor.v1/config.json',
      expect.stringContaining('legacy.md'),
    );
  });
});
