import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { exists as fsExists } from '@tauri-apps/plugin-fs';
import { DEFAULT_SETTINGS } from '../domains/settings/types';
import { useAppToast } from '../hooks/useAppToast';
import { useExportTaskUi } from '../hooks/useExportTaskUi';
import { useAppExportUiModel } from './useAppExportUiModel';
import { useSaveExportDialogModel } from './useSaveExportDialogModel';

vi.mock('@tauri-apps/plugin-fs', () => ({
  exists: vi.fn(),
}));

vi.mock('../hooks/useAppToast', () => ({
  useAppToast: vi.fn(),
}));

vi.mock('../hooks/useExportTaskUi', () => ({
  useExportTaskUi: vi.fn(),
}));

vi.mock('./useSaveExportDialogModel', () => ({
  useSaveExportDialogModel: vi.fn(),
}));

const toastModel = {
  toast: { message: '已导出' },
  showToast: vi.fn(),
  dismissToast: vi.fn(),
} as unknown as ReturnType<typeof useAppToast>;

const exportTaskUi = {
  exportProgress: null,
  exportProgressInBackground: false,
  exportFailure: null,
  sendExportProgressToBackground: vi.fn(),
  showBackgroundExportProgress: vi.fn(),
  dismissExportFailure: vi.fn(),
  copyExportFailureDiagnostic: vi.fn(),
} as unknown as ReturnType<typeof useExportTaskUi>;

const saveExportDialog = {
  chooseSaveDirectory: vi.fn(),
  closeSaveDialog: vi.fn(),
  confirmSaveDialog: vi.fn(),
  requestExportPath: vi.fn(),
  requestMarkdownSavePath: vi.fn(),
  saveDialog: null,
  saveDialogOverwriteFilename: null,
  updateSaveDialogDirectory: vi.fn(),
  updateSaveDialogFilename: vi.fn(),
  updateSaveDialogQualityScale: vi.fn(),
} as unknown as ReturnType<typeof useSaveExportDialogModel>;

describe('useAppExportUiModel', () => {
  it('wires toast, export progress, and save/export dialog models', () => {
    vi.mocked(useAppToast).mockReturnValue(toastModel);
    vi.mocked(useExportTaskUi).mockReturnValue(exportTaskUi);
    vi.mocked(useSaveExportDialogModel).mockReturnValue(saveExportDialog);

    const { result } = renderHook(() => useAppExportUiModel({
      exportDefaults: DEFAULT_SETTINGS.exportDefaults,
      rootPath: '/workspace',
    }));

    expect(useExportTaskUi).toHaveBeenCalledWith(toastModel.showToast);
    expect(useSaveExportDialogModel).toHaveBeenCalledWith({
      existsPath: fsExists,
      exportDefaults: DEFAULT_SETTINGS.exportDefaults,
      rootPath: '/workspace',
      showToast: toastModel.showToast,
    });
    expect(result.current.toast).toBe(toastModel.toast);
    expect(result.current.showToast).toBe(toastModel.showToast);
    expect(result.current.exportProgress).toBe(exportTaskUi.exportProgress);
    expect(result.current.requestExportPath).toBe(saveExportDialog.requestExportPath);
  });
});
