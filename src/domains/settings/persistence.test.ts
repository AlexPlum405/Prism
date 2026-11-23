import { beforeEach, describe, expect, it, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { appDataDir } from '@tauri-apps/api/path';
import { exists } from '@tauri-apps/plugin-fs';
import { useSettingsStore } from './store';
import { DEFAULT_SETTINGS } from './types';

vi.mock('@tauri-apps/api/path', () => ({ appDataDir: vi.fn() }));

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));

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

vi.mock('../../platform/events/appEvents', () => ({ emitAppEvent: vi.fn() }));

function writtenConfig(): Record<string, unknown> {
  const call = (invoke as ReturnType<typeof vi.fn>).mock.calls
    .filter(([command]) => command === 'write_settings_file')
    .pop();
  if (!call) throw new Error('没有写出配置文件');
  const payload = call[1] as { contents: string };
  return JSON.parse(payload.contents) as Record<string, unknown>;
}

/**
 * 回归：saveSettings 用的是字段白名单，新加的设置项不写进白名单就会「改完即失」。
 * 真机验收时发现单窗预览、预览行宽、强调色都重启后丢失，因此在这里守住。
 */
describe('settings 持久化白名单', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (appDataDir as ReturnType<typeof vi.fn>).mockResolvedValue('/Users/Alex/Library/Application Support/com.prism.editor.v1');
    (exists as ReturnType<typeof vi.fn>).mockResolvedValue(true);
    (invoke as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    useSettingsStore.setState({
      ...DEFAULT_SETTINGS,
      themeRegistry: [],
      themeRegistryVersion: 0,
    });
  });

  it('把行宽与强调色写进配置文件', async () => {
    useSettingsStore.setState({
      previewLineWidth: 720,
      previewAccent: '#3366ff',
    });

    await useSettingsStore.getState().saveSettings();

    const config = writtenConfig();
    expect(config.previewLineWidth).toBe(720);
    expect(config.previewAccent).toBe('#3366ff');
  });

  it('默认值也会落盘，避免读回时缺字段', async () => {
    await useSettingsStore.getState().saveSettings();

    const config = writtenConfig();
    expect(config.previewLineWidth).toBe(DEFAULT_SETTINGS.previewLineWidth);
    expect(config.previewAccent).toBe(DEFAULT_SETTINGS.previewAccent);
  });
});
