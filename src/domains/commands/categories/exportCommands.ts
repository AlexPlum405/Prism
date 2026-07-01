import { basename } from '../../workspace/services/path';
import { flattenFiles } from '../../workspace/services/fileTree';
import {
  getExportFormatLabel,
  type ExportFormat,
} from '../../export/types';
import {
  completeExportJob,
  createExportJob,
  failExportJob,
  updateExportJob,
  type ExportJob,
} from '../../export/jobs/exportJobClient';
import { normalizeExportQualityScale } from '../../export/quality';
import { getActionableErrorDiagnostics } from '../../diagnostics/types';
import type { ExportHistoryEntry, ExportHistorySettings, SettingsState } from '../../settings/types';
import type { CommandContext, CommandDefinition } from '../types';
import { t } from '../../i18n';
import { emitAppEvent } from '../../../platform/events/appEvents';
import { openPathWithSystemNative } from '../../../platform/tauri/nativeCommands';
import { openPathWithDefaultApp, revealPathInFileManager } from '../../../platform/tauri/opener';
import type { PrismCommandError } from '../../../platform/tauri/result';
import { EXPORT_ACTION_TOAST_DURATION_MS } from '../../../lib/feedbackTiming';

function formatError(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (err instanceof Event) return err.type || t('common.unknownEventError');
  return String(err);
}

function createExportJobError(error: unknown, stage: string, path?: string | null): PrismCommandError {
  return {
    code: 'export_failed',
    message: formatError(error),
    path: path ?? null,
    stage,
  };
}

function getCurrentDocumentExportHistory(context: CommandContext): ExportHistoryEntry | null {
  const documentPath = context.documentStore.currentDocument?.path;
  if (!documentPath) return null;
  return context.settingsStore.exportHistory.find((entry) => entry.documentPath === documentPath) ?? null;
}

function hasCurrentDocumentExportHistory(context: CommandContext): boolean {
  return Boolean(
    context.documentStore.currentDocument?.profile?.supportsExport !== false
    && getCurrentDocumentExportHistory(context),
  );
}

function hasExportableDocument(context: CommandContext): boolean {
  return Boolean(
    context.documentStore.currentDocument
    && context.documentStore.currentDocument.profile?.supportsExport !== false,
  );
}

function createExportHistorySettings(settings: SettingsState): ExportHistorySettings {
  return {
    contentTheme: settings.contentTheme,
    htmlIncludeTheme: settings.exportDefaults.htmlIncludeTheme,
    pngScale: settings.exportDefaults.pngScale,
    pdfPaper: settings.exportDefaults.pdfPaper,
    pdfMargin: settings.exportDefaults.pdfMargin,
    pdfPageNumbers: settings.exportDefaults.pdfPageNumbers,
    pageHeaderFooter: settings.exportDefaults.pageHeaderFooter,
    pageHeaderText: settings.exportDefaults.pageHeaderText,
    pageFooterText: settings.exportDefaults.pageFooterText,
    templateId: settings.exportDefaults.templateId,
    frontMatterOverrides: settings.exportDefaults.frontMatterOverrides,
    toc: settings.exportDefaults.toc,
    defaultLocation: settings.exportDefaults.defaultLocation,
    docxFontPolicy: settings.exportDefaults.docxFontPolicy,
    docxCustomFontId: settings.exportDefaults.docxCustomFontId,
  };
}

function applyExportQualityScale(settings: SettingsState, qualityScale?: number): SettingsState {
  if (!qualityScale) return settings;
  return {
    ...settings,
    exportDefaults: {
      ...settings.exportDefaults,
      pngScale: normalizeExportQualityScale(qualityScale, settings.exportDefaults.pngScale),
    },
  };
}

function applyExportHistorySettings(
  baseSettings: SettingsState,
  historySettings: ExportHistorySettings,
): SettingsState {
  return {
    ...baseSettings,
    contentTheme: historySettings.contentTheme,
    exportDefaults: {
      ...baseSettings.exportDefaults,
      htmlIncludeTheme: historySettings.htmlIncludeTheme,
      pngScale: historySettings.pngScale,
      pdfPaper: historySettings.pdfPaper,
      pdfMargin: historySettings.pdfMargin,
      pdfPageNumbers: historySettings.pdfPageNumbers,
      pageHeaderFooter: historySettings.pageHeaderFooter,
      pageHeaderText: historySettings.pageHeaderText,
      pageFooterText: historySettings.pageFooterText,
      templateId: historySettings.templateId,
      frontMatterOverrides: historySettings.frontMatterOverrides,
      toc: historySettings.toc,
      defaultLocation: historySettings.defaultLocation,
      docxFontPolicy: historySettings.docxFontPolicy,
      docxCustomFontId: historySettings.docxCustomFontId,
    },
  };
}

function emitExportFailure(input: {
  format: ExportFormat;
  diagnostic: string;
  documentPath?: string | null;
  message?: string;
  nextSteps?: string;
  outputPath?: string | null;
  stage?: string;
}) {
  emitAppEvent('export.failed', {
    diagnostic: input.diagnostic,
    documentPath: input.documentPath ?? null,
    format: input.format,
    message: input.message,
    nextSteps: input.nextSteps,
    outputPath: input.outputPath ?? null,
    stage: input.stage,
    title: t('export.failedTitle', { format: getExportFormatLabel(input.format) }),
  });
}

function emitExportResult(input: {
  format: ExportFormat;
  message?: string;
  outputPath?: string | null;
  status: 'success' | 'cancelled';
  title?: string;
}) {
  emitAppEvent('export.result', {
    format: input.format,
    message: input.message,
    outputPath: input.outputPath ?? null,
    status: input.status,
    title: input.title,
  });
}

function emitDocumentDiagnosticsOpen(diagnostics: ReturnType<typeof getActionableErrorDiagnostics>) {
  emitAppEvent('diagnostics.open', { diagnostics });
}

function showExportPathActionError(context: CommandContext, title: string, error: unknown) {
  context.showToast?.({
    tone: 'error',
    title,
    message: formatError(error),
    durationMs: 5200,
  });
}

async function openExportedPath(path: string) {
  try {
    await openPathWithSystemNative(path);
  } catch (nativeError) {
    try {
      await openPathWithDefaultApp(path);
    } catch (pluginError) {
      throw new Error(t('export.systemOpenFailed', {
        nativeError: formatError(nativeError),
        pluginError: formatError(pluginError),
      }));
    }
  }
}

function waitForExportProgressPaint(timeoutMs = 250) {
  return new Promise<void>((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      resolve();
    };
    const timeout = window.setTimeout(finish, timeoutMs);
    if (typeof window.requestAnimationFrame !== 'function') {
      finish();
      return;
    }
    window.requestAnimationFrame(() => window.requestAnimationFrame(finish));
  });
}

async function handleExport(
  format: ExportFormat,
  context: CommandContext,
  options: {
    outputPath?: string;
    suggestedPath?: string;
    settings?: SettingsState;
  } = {},
): Promise<void> {
  const doc = context.documentStore.currentDocument;
  if (!doc) {
    context.showToast?.(t('export.noDocument'));
    return;
  }

  let outputPath: string | null | undefined;
  let exportJob: ExportJob | null = null;
  let lastProgress = t('app.prepareExport');
  const exportSettings = options.settings ?? context.settingsStore;
  let resolvedExportSettings = exportSettings;
  const exportWarnings: string[] = [];
  const formatLabel = getExportFormatLabel(format);
  const syncExportJobProgress = (message: string, stage = message) => {
    if (!exportJob) return;
    void updateExportJob({
      id: exportJob.id,
      outputPath: outputPath ?? null,
      stage,
      message,
    })
      .then((job) => {
        exportJob = job;
      })
      .catch(() => undefined);
  };
  const setExportProgress = (message: string | null) => {
    emitAppEvent('export.progress', message ? { visible: true, message } : { visible: false });
    if (message) syncExportJobProgress(message);
  };

  try {
    const { buildExportPreflightDiagnostics } = await import('../../export/preflight');
    const preflightDiagnostics = getActionableErrorDiagnostics(await buildExportPreflightDiagnostics({
      content: doc.content,
      documentPath: doc.path,
      format,
      workspaceFiles: flattenFiles(context.workspaceStore.fileTree ?? [], context.workspaceStore.rootPath)
        .map(({ node }) => node.path),
      workspaceRoot: context.workspaceStore.rootPath,
    }));
    if (preflightDiagnostics.length > 0) {
      emitDocumentDiagnosticsOpen(preflightDiagnostics);
      context.showToast?.({
        tone: 'error',
        title: t('export.preflight.blockedTitle', { format: formatLabel }),
        message: t('export.preflight.blockedMessage', { count: preflightDiagnostics.length }),
        durationMs: 9000,
        actions: [
          {
            label: t('export.preflight.viewIssues'),
            dismissOnClick: false,
            onClick: () => emitDocumentDiagnosticsOpen(preflightDiagnostics),
          },
        ],
      });
      return;
    }

    if (!options.outputPath && !context.requestExportPath) {
      context.showToast?.(t('export.savePanelUnavailable'));
      return;
    }

    const requestedOutput = options.outputPath ?? await context.requestExportPath?.({
      format,
      filename: doc.name,
      documentPath: doc.path,
      suggestedPath: options.suggestedPath,
    });
    const selectedQualityScale = typeof requestedOutput === 'object' && requestedOutput
      ? requestedOutput.qualityScale
      : undefined;
    outputPath = typeof requestedOutput === 'string' ? requestedOutput : requestedOutput?.path;
    if (!outputPath) {
      emitExportResult({
        format,
        status: 'cancelled',
        title: t('export.cancelled'),
      });
      return;
    }
    resolvedExportSettings = applyExportQualityScale(exportSettings, selectedQualityScale);
    exportJob = await createExportJob({
      format,
      documentPath: doc.path ?? null,
      outputPath,
      stage: 'prepare',
      message: lastProgress,
    }).catch(() => null);

    setExportProgress(lastProgress);
    await waitForExportProgressPaint();

    const [
      { exportDocument },
      { resolveExportOptions },
    ] = await Promise.all([
      import('../../export/exportService'),
      import('../../export/templates'),
    ]);
    const exported = await exportDocument(resolveExportOptions({
      content: doc.content,
      filename: doc.name,
      documentPath: doc.path,
      settings: resolvedExportSettings,
      onProgress: (message) => {
        lastProgress = message;
        setExportProgress(message);
      },
      onWarning: (message) => {
        exportWarnings.push(message);
        context.showToast?.({
          tone: 'warning',
          title: t('export.warningTitle'),
          message,
          durationMs: 7200,
        });
      },
    }), format, outputPath);

    if (exported) {
      const completedOutputPath = outputPath;
      if (!completedOutputPath) return;
      if (exportJob) {
        try {
          exportJob = await completeExportJob({
            id: exportJob.id,
            outputPath: completedOutputPath,
            message: t('export.completedTitle', { format: formatLabel }),
          });
        } catch {
          // Export job state is diagnostic metadata; successful file output remains authoritative.
        }
      }

      if (doc.path) {
        context.settingsStore.recordExportHistory({
          documentPath: doc.path,
          documentName: doc.name,
          format,
          outputPath: completedOutputPath,
          settings: createExportHistorySettings(resolvedExportSettings),
        });
      }
      context.showToast?.({
        tone: 'success',
        title: t('export.completedTitle', { format: formatLabel }),
        message: basename(completedOutputPath),
        durationMs: EXPORT_ACTION_TOAST_DURATION_MS,
        actions: [
          {
            dismissOnClick: false,
            label: t('export.openAction'),
            onClick: async () => {
              try {
                await openExportedPath(completedOutputPath);
              } catch (error) {
                showExportPathActionError(context, t('export.openFailed'), error);
              }
            },
          },
          {
            dismissOnClick: false,
            label: t('export.revealAction'),
            onClick: async () => {
              try {
                await revealPathInFileManager(completedOutputPath);
              } catch (error) {
                showExportPathActionError(context, t('export.revealFailed'), error);
              }
            },
          },
        ],
      });
      emitExportResult({
        format,
        message: basename(completedOutputPath),
        outputPath: completedOutputPath,
        status: 'success',
        title: t('export.completedTitle', { format: formatLabel }),
      });
    }
  } catch (err) {
    if (exportJob) {
      try {
        exportJob = await failExportJob({
          id: exportJob.id,
          stage: lastProgress,
          message: formatError(err),
          error: createExportJobError(err, lastProgress, outputPath),
        });
      } catch {
        // Keep the existing export failure diagnostic path even if job state cannot be updated.
      }
    }
    const { buildExportFailureDiagnostic } = await import('../../export/diagnostics');
    const diagnostic = buildExportFailureDiagnostic({
      format,
      documentName: doc.name,
      documentPath: doc.path,
      outputPath,
      stage: lastProgress,
      settings: resolvedExportSettings,
      warnings: exportWarnings,
      error: err,
    });
    const failureEvent = {
      format,
      diagnostic,
      documentPath: doc.path ?? null,
      message: formatError(err),
      nextSteps: t('export.diagnostic.nextStepsText'),
      outputPath,
      stage: lastProgress,
    };
    emitExportFailure(failureEvent);
    context.showToast?.({
      tone: 'error',
      title: t('export.failedTitle', { format: formatLabel }),
      message: t('export.failureGenerated'),
      durationMs: 9000,
      actions: [
        {
          label: t('export.viewDiagnostic'),
          dismissOnClick: false,
          onClick: () => emitExportFailure(failureEvent),
        },
        {
          label: t('common.retry'),
          onClick: () => handleExport(format, context, {
            ...options,
            outputPath: outputPath ?? options.outputPath,
            settings: resolvedExportSettings,
          }),
        },
      ],
    });
  } finally {
    setExportProgress(null);
  }
}

async function handleExportWithPrevious(context: CommandContext, overwrite: boolean): Promise<void> {
  const history = getCurrentDocumentExportHistory(context);
  if (!history) {
    context.showToast?.(t('export.noPreviousHistory'));
    return;
  }

  const settings = applyExportHistorySettings(context.settingsStore, history.settings);
  await handleExport(history.format, context, {
    settings,
    outputPath: overwrite ? history.outputPath : undefined,
    suggestedPath: history.outputPath,
  });
}

export function createExportCommands(_deps: {
  hasDocument: (context: CommandContext) => boolean;
}): CommandDefinition[] {
  return [
    {
      id: 'exportPdf',
      category: 'file',
      keywords: ['export', 'pdf'],
      enabled: hasExportableDocument,
      run: (context) => handleExport('pdf', context),
    },
    {
      id: 'exportDocx',
      category: 'file',
      keywords: ['export', 'word', 'docx'],
      enabled: hasExportableDocument,
      run: (context) => handleExport('docx', context),
    },
    {
      id: 'exportHtml',
      category: 'file',
      keywords: ['export', 'html'],
      enabled: hasExportableDocument,
      run: (context) => handleExport('html', context),
    },
    {
      id: 'exportPng',
      category: 'file',
      keywords: ['export', 'png', 'image'],
      enabled: hasExportableDocument,
      run: (context) => handleExport('png', context),
    },
    {
      id: 'exportWithPrevious',
      category: 'file',
      keywords: ['export', 'last', 'previous'],
      enabled: hasCurrentDocumentExportHistory,
      run: (context) => handleExportWithPrevious(context, false),
    },
    {
      id: 'exportOverwritePrevious',
      category: 'file',
      keywords: ['export', 'overwrite', 'last'],
      enabled: hasCurrentDocumentExportHistory,
      run: (context) => handleExportWithPrevious(context, true),
    },
    {
      id: 'exportSettings',
      category: 'file',
      keywords: ['export', 'settings', 'preferences'],
      run: (context) => context.openSettings?.('export'),
    },
  ] satisfies CommandDefinition[];
}
