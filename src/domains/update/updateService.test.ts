import { beforeEach, describe, expect, it, vi } from 'vitest';
import { check } from '@tauri-apps/plugin-updater';
import { checkForAppUpdate } from './updateService';

vi.mock('@tauri-apps/plugin-updater', () => ({
  check: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('checkForAppUpdate', () => {
  it('returns none when updater has no update', async () => {
    (check as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    await expect(checkForAppUpdate()).resolves.toEqual({ status: 'none' });
    expect(check).toHaveBeenCalledWith({ timeout: 15000 });
  });

  it('normalizes available update metadata', async () => {
    const mockUpdate = {
      currentVersion: '1.4.0',
      version: '1.4.1',
      date: '2026-05-14T00:00:00Z',
      body: 'Bug fixes',
      downloadAndInstall: vi.fn(),
    };
    (check as ReturnType<typeof vi.fn>).mockResolvedValue(mockUpdate);

    await expect(checkForAppUpdate()).resolves.toEqual({
      status: 'available',
      currentVersion: '1.4.0',
      version: '1.4.1',
      date: '2026-05-14T00:00:00Z',
      body: 'Bug fixes',
      update: mockUpdate,
    });
  });

  it('returns unavailable when the latest release has no valid updater manifest', async () => {
    (check as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('Could not fetch a valid release JSON from https://github.com/AlexPlum405/Prism/releases/latest/download/latest.json: Not Found'),
    );

    await expect(checkForAppUpdate()).resolves.toEqual({
      status: 'unavailable',
      reason: '当前发布通道暂未提供可用的更新清单，请稍后再试或前往 GitHub Releases 查看最新版本。',
    });
  });

  it('keeps unexpected updater failures visible to the caller', async () => {
    const error = new Error('signature verification failed');
    (check as ReturnType<typeof vi.fn>).mockRejectedValue(error);

    await expect(checkForAppUpdate()).rejects.toThrow(error);
  });
});
