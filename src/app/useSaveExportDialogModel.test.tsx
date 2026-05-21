import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS } from '../domains/settings/types';
import { useSettingsStore } from '../domains/settings/store';
import { openDialog } from '../platform/tauri/dialogs';
import { useSaveExportDialogModel } from './useSaveExportDialogModel';

vi.mock('@tauri-apps/api/path', () => ({
  downloadDir: vi.fn(async () => '/Users/alex/Downloads'),
  homeDir: vi.fn(async () => '/Users/alex'),
}));

vi.mock('../lib/fileSystemScope', () => ({
  grantWorkspaceDirectoryScope: vi.fn(async () => undefined),
}));

vi.mock('../platform/tauri/dialogs', () => ({
  openDialog: vi.fn(),
}));

describe('useSaveExportDialogModel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSettingsStore.setState({
      ...DEFAULT_SETTINGS,
      saveSettings: vi.fn().mockResolvedValue(undefined),
      setExportPngScale: vi.fn(),
    });
  });

  it('resolves markdown save paths with a markdown extension', async () => {
    const existsPath = vi.fn(async () => false);
    const { result } = renderHook(() => useSaveExportDialogModel({
      existsPath,
      exportDefaults: DEFAULT_SETTINGS.exportDefaults,
      rootPath: '/workspace',
      showToast: vi.fn(),
    }));

    let savePromise: Promise<string | null>;
    await act(async () => {
      savePromise = result.current.requestMarkdownSavePath({
        filename: 'Draft',
        documentPath: '/workspace/source.md',
      });
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(result.current.saveDialog).toMatchObject({
        kind: 'markdown',
        directory: '/workspace',
        filename: 'Draft.md',
      });
    });

    await act(async () => {
      await result.current.confirmSaveDialog();
    });

    await expect(savePromise!).resolves.toBe('/workspace/Draft.md');
    expect(existsPath).toHaveBeenCalledWith('/workspace/Draft.md');
  });

  it('keeps export overwrite confirmation and png quality persistence in the dialog model', async () => {
    const existsPath = vi.fn(async (path: string) => path === '/docs/Report.png');
    const exportDefaults = {
      ...DEFAULT_SETTINGS.exportDefaults,
      pngScale: 2,
    };
    const progressEvents: unknown[] = [];
    const onProgress = (event: Event) => {
      progressEvents.push((event as CustomEvent).detail);
    };
    window.addEventListener('prism-export-progress', onProgress);

    try {
      const { result } = renderHook(() => useSaveExportDialogModel({
        existsPath,
        exportDefaults,
        rootPath: '/docs',
        showToast: vi.fn(),
      }));

      let exportPromise: Promise<string | { path: string; qualityScale?: number } | null>;
      await act(async () => {
        exportPromise = result.current.requestExportPath({
          format: 'png',
          filename: 'Report.md',
          documentPath: '/docs/Report.md',
        });
        await Promise.resolve();
      });

      await waitFor(() => {
        expect(result.current.saveDialog).toMatchObject({
          kind: 'export',
          directory: '/docs',
          filename: 'Report.png',
          qualityScale: 2,
        });
      });

      await act(async () => {
        await result.current.confirmSaveDialog();
      });

      expect(result.current.saveDialog?.pendingOverwritePath).toBe('/docs/Report.png');

      act(() => {
        result.current.updateSaveDialogQualityScale(4);
      });
      await act(async () => {
        await result.current.confirmSaveDialog(true);
      });

      await expect(exportPromise!).resolves.toEqual({
        path: '/docs/Report.png',
        qualityScale: 4,
      });
      expect(useSettingsStore.getState().setExportPngScale).toHaveBeenCalledWith(4);
      expect(progressEvents.at(-1)).toMatchObject({ visible: true });
    } finally {
      window.removeEventListener('prism-export-progress', onProgress);
    }
  });

  it('chooses a save directory through the platform dialog adapter', async () => {
    vi.mocked(openDialog).mockResolvedValue('/chosen');
    const { result } = renderHook(() => useSaveExportDialogModel({
      existsPath: vi.fn(async () => false),
      exportDefaults: DEFAULT_SETTINGS.exportDefaults,
      rootPath: '/workspace',
      showToast: vi.fn(),
    }));

    await act(async () => {
      void result.current.requestMarkdownSavePath({
        filename: 'Draft.md',
        documentPath: '/workspace/source.md',
      });
      await Promise.resolve();
    });

    await act(async () => {
      await result.current.chooseSaveDirectory();
    });

    expect(openDialog).toHaveBeenCalledWith({
      directory: true,
      multiple: false,
      defaultPath: '/workspace',
    });
    expect(result.current.saveDialog?.directory).toBe('/chosen');
  });
});
