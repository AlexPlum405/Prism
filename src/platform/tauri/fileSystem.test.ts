import { beforeEach, describe, expect, it, vi } from 'vitest';
import { appDataDir } from '@tauri-apps/api/path';
import { remove as nativeRemove } from '@tauri-apps/plugin-fs';
import {
  remove,
  removeAppDataPath,
  removeConfirmedUserPathPermanently,
} from './fileSystem';

vi.mock('@tauri-apps/api/path', () => ({
  appDataDir: vi.fn(),
}));

vi.mock('@tauri-apps/plugin-fs', () => ({
  copyFile: vi.fn(),
  exists: vi.fn(),
  mkdir: vi.fn(),
  readDir: vi.fn(),
  readFile: vi.fn(),
  readTextFile: vi.fn(),
  remove: vi.fn(async () => undefined),
  rename: vi.fn(),
  stat: vi.fn(),
  writeFile: vi.fn(),
  writeTextFile: vi.fn(),
}));

describe('fileSystem.remove guard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(appDataDir).mockResolvedValue('/Users/Alex/Library/Application Support/com.prism.editor.v1');
  });

  it('blocks direct removal of supported user document files outside app data', async () => {
    await expect(remove('/Users/Alex/Documents/Draft.md')).rejects.toThrow(
      'Blocked unscoped file removal for /Users/Alex/Documents/Draft.md',
    );

    expect(nativeRemove).not.toHaveBeenCalled();
  });

  it('blocks direct recursive removal outside app data', async () => {
    await expect(remove('/Users/Alex/Documents/Notes', { recursive: true })).rejects.toThrow(
      'Blocked unscoped file removal for /Users/Alex/Documents/Notes',
    );

    expect(nativeRemove).not.toHaveBeenCalled();
  });

  it('blocks direct removal of any user-space artifact outside app data', async () => {
    await expect(remove('/Users/Alex/Documents/report.webkit-capture-1.pdf')).rejects.toThrow(
      'Blocked unscoped file removal for /Users/Alex/Documents/report.webkit-capture-1.pdf',
    );

    expect(nativeRemove).not.toHaveBeenCalled();
  });

  it('allows confirmed permanent user deletion through the dedicated interface', async () => {
    await removeConfirmedUserPathPermanently('/Users/Alex/Documents/Draft.md', {
      reason: 'confirmed-permanent-delete',
    });

    expect(nativeRemove).toHaveBeenCalledWith('/Users/Alex/Documents/Draft.md');
  });

  it('allows cleanup inside Prism app data, including recovery JSON files', async () => {
    await removeAppDataPath('/Users/Alex/Library/Application Support/com.prism.editor.v1/recovery/abc/1000.json', {
      reason: 'recovery-prune',
    });

    expect(nativeRemove).toHaveBeenCalledWith(
      '/Users/Alex/Library/Application Support/com.prism.editor.v1/recovery/abc/1000.json',
    );
  });

  it('blocks recursive deletion of the app data root', async () => {
    await expect(removeAppDataPath(
      '/Users/Alex/Library/Application Support/com.prism.editor.v1',
      { recursive: true, reason: 'bad-cleanup' },
    )).rejects.toThrow(
      'Blocked recursive removal of Prism app data root',
    );

    expect(nativeRemove).not.toHaveBeenCalled();
  });
});
