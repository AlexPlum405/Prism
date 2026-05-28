import { useCallback, useMemo, useState } from 'react';
import { downloadDir, homeDir } from '../platform/tauri/path';
import type { ExportFormat } from '../domains/export';
import { getExportFormatLabel } from '../domains/export';
import { normalizeExportQualityScale } from '../domains/export/quality';
import type { ExportDefaultLocation, SettingsState } from '../domains/settings/types';
import { t } from '../domains/i18n';
import { basename, dirname, joinPath } from '../domains/workspace/services';
import { grantWorkspaceDirectoryScope } from '../lib/fileSystemScope';
import { emitAppEvent } from '../platform/events/appEvents';
import { openDialog } from '../platform/tauri/dialogs';
import { useSettingsStore } from '../domains/settings/store';

const exportExtensionByFormat: Record<ExportFormat, string> = {
  html: 'html',
  pdf: 'pdf',
  docx: 'docx',
  png: 'png',
};

function stripMarkdownExtension(filename: string) {
  return filename.replace(/\.(md|markdown|txt)$/i, '') || 'Untitled';
}

function ensureExportExtension(filename: string, format: ExportFormat) {
  const extension = exportExtensionByFormat[format];
  const trimmed = filename.trim();
  if (!trimmed) return `Untitled.${extension}`;
  return trimmed.toLowerCase().endsWith(`.${extension}`) ? trimmed : `${trimmed}.${extension}`;
}

function ensureMarkdownExtension(filename: string) {
  const trimmed = filename.trim();
  if (!trimmed) return 'Untitled.md';
  return /\.(md|markdown)$/i.test(trimmed) ? trimmed : `${trimmed}.md`;
}

function defaultExportFilename(filename: string, format: ExportFormat) {
  return ensureExportExtension(stripMarkdownExtension(filename), format);
}

function emitExportProgress(message: string | null) {
  emitAppEvent('export.progress', message ? { visible: true, message } : { visible: false });
}

async function resolveDefaultExportDirectory(input: {
  defaultLocation: ExportDefaultLocation;
  customDirectory: string;
  documentPath?: string;
  existsPath: (path: string) => Promise<boolean>;
  rootPath?: string | null;
  showToast?: (message: string) => void;
}) {
  const fallback = input.documentPath
    ? dirname(input.documentPath)
    : input.rootPath || await homeDir();

  if (input.defaultLocation === 'ask' || input.defaultLocation === 'document') {
    return fallback;
  }

  if (input.defaultLocation === 'downloads') {
    try {
      return await downloadDir();
    } catch {
      return fallback;
    }
  }

  const customDirectory = input.customDirectory.trim();
  if (customDirectory) {
    try {
      await grantWorkspaceDirectoryScope(customDirectory);
      if (await input.existsPath(customDirectory)) return customDirectory;
    } catch {
      // Fall through to toast and fallback.
    }
  }

  input.showToast?.(t('app.defaultExportDirectoryUnavailable'));
  return fallback;
}

type SaveDialogKind = 'export' | 'markdown';

export interface SaveDialogState {
  kind: SaveDialogKind;
  format?: ExportFormat;
  directory: string;
  filename: string;
  qualityScale?: number;
  error: string | null;
  pendingOverwritePath: string | null;
  resolve: (result: string | { path: string; qualityScale?: number } | null) => void;
}

export function getSaveDialogTitle(dialog: SaveDialogState) {
  if (dialog.kind === 'export' && dialog.format) {
    return t('app.exportTitle', { format: getExportFormatLabel(dialog.format) });
  }
  return t('app.saveMarkdown');
}

export function getSaveDialogPrimaryLabel(dialog: SaveDialogState) {
  return dialog.kind === 'export' ? t('common.export') : t('common.save');
}

export function getSaveDialogOverwriteText(dialog: SaveDialogState) {
  return dialog.kind === 'export'
    ? t('app.exportOverwriteText')
    : t('app.saveOverwriteText');
}

interface UseSaveExportDialogModelInput {
  existsPath: (path: string) => Promise<boolean>;
  exportDefaults: SettingsState['exportDefaults'];
  rootPath: string | null;
  showToast: (message: string) => void;
}

export function useSaveExportDialogModel({
  existsPath,
  exportDefaults,
  rootPath,
  showToast,
}: UseSaveExportDialogModelInput) {
  const [saveDialog, setSaveDialog] = useState<SaveDialogState | null>(null);

  const requestExportPath = useCallback(async (input: {
    format: ExportFormat;
    filename: string;
    documentPath?: string;
    suggestedPath?: string;
  }) => {
    const initialDirectory = await resolveDefaultExportDirectory({
      defaultLocation: exportDefaults.defaultLocation,
      customDirectory: exportDefaults.customDirectory,
      documentPath: input.documentPath,
      existsPath,
      rootPath,
      showToast,
    });

    return new Promise<string | { path: string; qualityScale?: number } | null>((resolve) => {
      setSaveDialog({
        kind: 'export',
        format: input.format,
        directory: input.suggestedPath ? dirname(input.suggestedPath) : initialDirectory,
        filename: input.suggestedPath ? basename(input.suggestedPath) : defaultExportFilename(input.filename, input.format),
        qualityScale: normalizeExportQualityScale(exportDefaults.pngScale),
        error: null,
        pendingOverwritePath: null,
        resolve,
      });
    });
  }, [
    existsPath,
    exportDefaults.customDirectory,
    exportDefaults.defaultLocation,
    exportDefaults.pngScale,
    rootPath,
    showToast,
  ]);

  const requestMarkdownSavePath = useCallback(async (input: {
    filename: string;
    documentPath?: string;
  }) => {
    const initialDirectory = input.documentPath
      ? dirname(input.documentPath)
      : rootPath || await homeDir();

    return new Promise<string | null>((resolve) => {
      setSaveDialog({
        kind: 'markdown',
        directory: initialDirectory,
        filename: ensureMarkdownExtension(input.filename),
        error: null,
        pendingOverwritePath: null,
        resolve: (result) => resolve(typeof result === 'string' ? result : null),
      });
    });
  }, [rootPath]);

  const closeSaveDialog = useCallback((result: string | { path: string; qualityScale?: number } | null = null) => {
    setSaveDialog((dialog) => {
      dialog?.resolve(result);
      return null;
    });
  }, []);

  const chooseSaveDirectory = useCallback(async () => {
    if (!saveDialog) return;
    const selected = await openDialog({
      directory: true,
      multiple: false,
      defaultPath: saveDialog.directory,
    });
    if (!selected || Array.isArray(selected)) return;
    setSaveDialog((dialog) => dialog ? {
      ...dialog,
      directory: selected,
      error: null,
      pendingOverwritePath: null,
    } : null);
  }, [saveDialog]);

  const updateSaveDialogDirectory = useCallback((directory: string) => {
    setSaveDialog((dialog) => dialog ? {
      ...dialog,
      directory,
      error: null,
      pendingOverwritePath: null,
    } : null);
  }, []);

  const updateSaveDialogFilename = useCallback((filename: string) => {
    setSaveDialog((dialog) => dialog ? {
      ...dialog,
      filename,
      error: null,
      pendingOverwritePath: null,
    } : null);
  }, []);

  const updateSaveDialogQualityScale = useCallback((qualityScale: number) => {
    setSaveDialog((dialog) => dialog ? {
      ...dialog,
      qualityScale: normalizeExportQualityScale(qualityScale, dialog.qualityScale),
      error: null,
      pendingOverwritePath: null,
    } : null);
  }, []);

  const confirmSaveDialog = useCallback(async (allowOverwrite = false) => {
    if (!saveDialog) return;
    let filename: string;
    if (saveDialog.kind === 'export') {
      const format = saveDialog.format;
      if (!format) {
        setSaveDialog((dialog) => dialog ? {
          ...dialog,
          error: t('app.missingExportFormat'),
          pendingOverwritePath: null,
        } : null);
        return;
      }
      filename = ensureExportExtension(saveDialog.filename, format);
    } else {
      filename = ensureMarkdownExtension(saveDialog.filename);
    }
    if (/[\\/]/.test(filename)) {
      setSaveDialog((dialog) => dialog ? {
        ...dialog,
        error: t('app.filenameCannotContainSeparator'),
        pendingOverwritePath: null,
      } : null);
      return;
    }

    const targetPath = joinPath(saveDialog.directory, filename);
    if (!allowOverwrite) {
      try {
        if (await existsPath(targetPath)) {
          setSaveDialog((dialog) => dialog ? {
            ...dialog,
            filename,
            error: null,
            pendingOverwritePath: targetPath,
          } : null);
          return;
        }
      } catch {
        // If existence check fails, let the actual write surface the error.
      }
    }

    if (saveDialog.kind === 'export') {
      const qualityScale = normalizeExportQualityScale(saveDialog.qualityScale, exportDefaults.pngScale);
      useSettingsStore.getState().setExportPngScale(qualityScale);
      emitExportProgress(t('app.prepareExport'));
      closeSaveDialog({ path: targetPath, qualityScale });
      return;
    }
    closeSaveDialog(targetPath);
  }, [closeSaveDialog, existsPath, exportDefaults.pngScale, saveDialog]);

  const saveDialogOverwriteFilename = useMemo(
    () => saveDialog?.pendingOverwritePath ? basename(saveDialog.pendingOverwritePath) : null,
    [saveDialog?.pendingOverwritePath],
  );

  return {
    chooseSaveDirectory,
    closeSaveDialog,
    confirmSaveDialog,
    requestExportPath,
    requestMarkdownSavePath,
    saveDialog,
    saveDialogOverwriteFilename,
    updateSaveDialogDirectory,
    updateSaveDialogFilename,
    updateSaveDialogQualityScale,
  };
}
