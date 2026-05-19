import { invoke } from '@tauri-apps/api/core';
import { openPath, revealItemInDir } from '@tauri-apps/plugin-opener';
import { basename } from '../../workspace/services';
import {
  exportDocument,
  getExportFormatLabel,
  resolveExportOptions,
  type ExportFormat,
} from '../../export';
import { buildExportFailureDiagnostic } from '../../export/diagnostics';
import { normalizeExportQualityScale } from '../../export/quality';
import type { ExportHistoryEntry, ExportHistorySettings, SettingsState } from '../../settings/types';
import type { CommandContext, CommandDefinition } from '../types';

function formatError(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (err instanceof Event) return err.type || '未知事件错误';
  return String(err);
}

function getCurrentDocumentExportHistory(context: CommandContext): ExportHistoryEntry | null {
  const documentPath = context.documentStore.currentDocument?.path;
  if (!documentPath) return null;
  return context.settingsStore.exportHistory.find((entry) => entry.documentPath === documentPath) ?? null;
}

function hasCurrentDocumentExportHistory(context: CommandContext): boolean {
  return Boolean(getCurrentDocumentExportHistory(context));
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
}) {
  window.dispatchEvent(new CustomEvent('prism-export-failure', {
    detail: {
      title: `${getExportFormatLabel(input.format)} 导出失败`,
      diagnostic: input.diagnostic,
    },
  }));
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
    await invoke('open_path_with_system', { path });
  } catch (nativeError) {
    try {
      await openPath(path);
    } catch (pluginError) {
      throw new Error(`系统打开失败: ${formatError(nativeError)}；备用打开失败: ${formatError(pluginError)}`);
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
    context.showToast?.('没有可导出的文档');
    return;
  }

  const setExportProgress = (message: string | null) => {
    window.dispatchEvent(new CustomEvent('prism-export-progress', {
      detail: message ? { visible: true, message } : { visible: false },
    }));
  };
  let outputPath: string | null | undefined;
  let lastProgress = '准备导出';
  const exportSettings = options.settings ?? context.settingsStore;
  let resolvedExportSettings = exportSettings;
  const exportWarnings: string[] = [];
  const formatLabel = getExportFormatLabel(format);

  try {
    if (!options.outputPath && !context.requestExportPath) {
      context.showToast?.('导出保存面板未就绪');
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
    if (!outputPath) return;
    resolvedExportSettings = applyExportQualityScale(exportSettings, selectedQualityScale);

    setExportProgress(lastProgress);
    await waitForExportProgressPaint();

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
          title: '导出提示',
          message,
          durationMs: 7200,
        });
      },
    }), format, outputPath);

    if (exported) {
      const completedOutputPath = outputPath;
      if (!completedOutputPath) return;

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
        title: `${formatLabel} 导出完成`,
        message: basename(completedOutputPath),
        durationMs: 7200,
        actions: [
          {
            label: '打开',
            onClick: async () => {
              try {
                await openExportedPath(completedOutputPath);
              } catch (error) {
                showExportPathActionError(context, '打开导出文件失败', error);
              }
            },
          },
          {
            label: '显示位置',
            onClick: async () => {
              try {
                await revealItemInDir(completedOutputPath);
              } catch (error) {
                showExportPathActionError(context, '显示导出位置失败', error);
              }
            },
          },
        ],
      });
    }
  } catch (err) {
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
    emitExportFailure({ format, diagnostic });
    context.showToast?.({
      tone: 'error',
      title: `${formatLabel} 导出失败`,
      message: '已生成诊断文本，可查看后重试。',
      durationMs: 9000,
      actions: [
        {
          label: '查看诊断',
          dismissOnClick: false,
          onClick: () => emitExportFailure({ format, diagnostic }),
        },
        {
          label: '重试',
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
    context.showToast?.('当前文档没有上次导出记录');
    return;
  }

  const settings = applyExportHistorySettings(context.settingsStore, history.settings);
  await handleExport(history.format, context, {
    settings,
    outputPath: overwrite ? history.outputPath : undefined,
    suggestedPath: history.outputPath,
  });
}

export function createExportCommands(deps: {
  hasDocument: (context: CommandContext) => boolean;
}): CommandDefinition[] {
  const { hasDocument } = deps;

  return [
    {
      id: 'exportPdf',
      label: '导出为 PDF',
      category: '文件',
      keywords: ['export', 'pdf'],
      enabled: hasDocument,
      run: (context) => handleExport('pdf', context),
    },
    {
      id: 'exportDocx',
      label: '导出为 Word (.docx)',
      category: '文件',
      keywords: ['export', 'word', 'docx'],
      enabled: hasDocument,
      run: (context) => handleExport('docx', context),
    },
    {
      id: 'exportHtml',
      label: '导出为 HTML',
      category: '文件',
      keywords: ['export', 'html'],
      enabled: hasDocument,
      run: (context) => handleExport('html', context),
    },
    {
      id: 'exportPng',
      label: '导出为 PNG 图像',
      category: '文件',
      keywords: ['export', 'png', 'image'],
      enabled: hasDocument,
      run: (context) => handleExport('png', context),
    },
    {
      id: 'exportWithPrevious',
      label: '按上次设置导出',
      category: '文件',
      keywords: ['export', 'last', 'previous'],
      enabled: hasCurrentDocumentExportHistory,
      run: (context) => handleExportWithPrevious(context, false),
    },
    {
      id: 'exportOverwritePrevious',
      label: '覆盖上次导出文件',
      category: '文件',
      keywords: ['export', 'overwrite', 'last'],
      enabled: hasCurrentDocumentExportHistory,
      run: (context) => handleExportWithPrevious(context, true),
    },
  ] satisfies CommandDefinition[];
}
