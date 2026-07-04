import { beforeEach, describe, expect, it, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { appDataDir } from '@tauri-apps/api/path';
import { exists, readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';
import { __fontServiceTesting } from './fontService';
import { __settingsStoreTesting, useSettingsStore } from './store';
import { DEFAULT_SETTINGS } from './types';

const emitAppEventMock = vi.hoisted(() => vi.fn());

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

vi.mock('../../platform/events/appEvents', () => ({
  emitAppEvent: emitAppEventMock,
}));

describe('settings app data paths', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSettingsStore.setState({
      ...DEFAULT_SETTINGS,
      themeRegistry: [],
      themeRegistryVersion: 0,
    });
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
    (invoke as ReturnType<typeof vi.fn>).mockImplementation(async (command: string) => {
      if (command === 'read_settings_file' || command === 'write_settings_file') {
        throw new Error(`unknown command ${command}`);
      }
      if (command === 'read_legacy_settings_config') {
        return JSON.stringify({
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
        });
      }
      return null;
    });
    (exists as ReturnType<typeof vi.fn>).mockResolvedValue(true);
    (writeTextFile as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    await useSettingsStore.getState().loadSettings();

    expect(useSettingsStore.getState().theme).toBe('dark');
    expect(useSettingsStore.getState().recentFiles[0]?.name).toBe('legacy.md');
    expect(useSettingsStore.getState().lastSession).toBeNull();
    expect(writeTextFile).toHaveBeenCalledWith(
      '/Users/Alex/Library/Application Support/com.prism.editor.v1/config.json',
      expect.stringContaining('legacy.md'),
    );
    expect(writeTextFile).toHaveBeenCalledWith(
      '/Users/Alex/Library/Application Support/com.prism.editor.v1/config.json',
      expect.not.stringContaining('"lastSession":{"filePath":"/Users/Alex/notes/legacy.md"'),
    );
  });

  it('surfaces settings write failures without crashing or falling through to the legacy writer', async () => {
    (invoke as ReturnType<typeof vi.fn>).mockImplementation(async (command: string) => {
      if (command === 'write_settings_file') {
        throw {
          code: 'settings_write_failed',
          message: 'permission denied',
          stage: 'settings_store',
          path: '/Users/Alex/Library/Application Support/com.prism.editor.v1/config.json',
        };
      }
      return null;
    });

    useSettingsStore.setState({ theme: 'dark' });

    await expect(useSettingsStore.getState().saveSettings()).resolves.toBeUndefined();

    expect(useSettingsStore.getState().theme).toBe('dark');
    expect(writeTextFile).not.toHaveBeenCalled();
    expect(emitAppEventMock).toHaveBeenCalledWith('toast.show', {
      tone: 'error',
      title: 'Settings save failed',
      message: 'permission denied',
    });
  });
});
