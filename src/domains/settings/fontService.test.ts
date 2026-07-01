import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { copyFile, exists, mkdir, readFile } from '../../platform/tauri/fileSystem';
import { openDialog } from '../../platform/tauri/dialogs';
import { importCustomFont, registerCustomFonts } from './fontService';

vi.mock('../../platform/tauri/dialogs', () => ({
  openDialog: vi.fn(),
}));

vi.mock('../../platform/tauri/path', () => ({
  appDataDir: vi.fn(async () => '/Users/Alex/Library/Application Support/com.prism.editor.v1'),
}));

vi.mock('../../platform/tauri/fileSystem', () => ({
  copyFile: vi.fn(),
  exists: vi.fn(),
  mkdir: vi.fn(),
  readFile: vi.fn(),
  remove: vi.fn(),
}));

describe('fontService', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(Date, 'now').mockReturnValue(1710000000000);
    vi.mocked(exists).mockResolvedValue(true);
    vi.mocked(readFile).mockResolvedValue(new Uint8Array([1, 2, 3]));

    class MockFontFace {
      family: string;
      source: string;

      constructor(family: string, source: string) {
        this.family = family;
        this.source = source;
      }

      async load() {
        return this;
      }
    }

    vi.stubGlobal('FontFace', MockFontFace);
    Object.defineProperty(document, 'fonts', {
      configurable: true,
      value: { add: vi.fn() },
    });
  });

  it('imports a user font into appData/fonts and registers it from local bytes', async () => {
    vi.mocked(openDialog).mockResolvedValue('/Users/Alex/Downloads/My Font!.woff2');

    const result = await importCustomFont();

    expect(result?.sourcePath).toBe('/Users/Alex/Downloads/My Font!.woff2');
    expect(result?.targetPath).toBe(
      '/Users/Alex/Library/Application Support/com.prism.editor.v1/fonts/1710000000000-My-Font-.woff2',
    );
    expect(copyFile).toHaveBeenCalledWith(
      '/Users/Alex/Downloads/My Font!.woff2',
      '/Users/Alex/Library/Application Support/com.prism.editor.v1/fonts/1710000000000-My-Font-.woff2',
    );
    expect(readFile).toHaveBeenCalledWith(result?.targetPath);
    expect(document.fonts.add).toHaveBeenCalledTimes(1);
    expect(result?.font).toMatchObject({
      id: 'my-font--1710000000000',
      family: 'Prism My Font!',
      displayName: 'My Font!',
      filename: '1710000000000-My-Font-.woff2',
      format: 'woff2',
    });
  });

  it('creates the fonts directory before importing when it is missing', async () => {
    vi.mocked(openDialog).mockResolvedValue('/Users/Alex/Downloads/Serif.otf');
    vi.mocked(exists).mockResolvedValueOnce(false);

    await importCustomFont();

    expect(mkdir).toHaveBeenCalledWith(
      '/Users/Alex/Library/Application Support/com.prism.editor.v1/fonts',
      { recursive: true },
    );
  });

  it('registers saved custom fonts without remote resources', async () => {
    await registerCustomFonts([{
      id: 'font-1',
      family: 'Prism Local Font',
      displayName: 'Local Font',
      filename: 'LocalFont.woff2',
      path: '/Users/Alex/Library/Application Support/com.prism.editor.v1/fonts/LocalFont.woff2',
      format: 'woff2',
      importedAt: 1,
    }]);

    expect(readFile).toHaveBeenCalledWith(
      '/Users/Alex/Library/Application Support/com.prism.editor.v1/fonts/LocalFont.woff2',
    );
    expect(document.fonts.add).toHaveBeenCalledTimes(1);
  });
});
