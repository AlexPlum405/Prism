import { useCallback, useEffect, useState } from 'react';
import type { ToastInput } from '../lib/toast';
import { t } from '../domains/i18n';
import { onAppEvent } from '../platform/events/appEvents';

export interface ExportFailureState {
  diagnostic: string;
  documentPath?: string | null;
  format?: string;
  message?: string;
  nextSteps?: string;
  outputPath?: string | null;
  stage?: string;
  title: string;
}

export function useExportTaskUi(showToast: (input: ToastInput) => void) {
  const [exportProgress, setExportProgress] = useState<string | null>(null);
  const [exportProgressInBackground, setExportProgressInBackground] = useState(false);
  const [exportFailure, setExportFailure] = useState<ExportFailureState | null>(null);

  useEffect(() => {
    return onAppEvent('export.progress', (detail) => {
      if (detail?.visible) {
        setExportFailure(null);
        setExportProgress(detail.message ?? t('export.progressDefault'));
        return;
      }
      setExportProgress(null);
      setExportProgressInBackground(false);
    });
  }, []);

  useEffect(() => {
    return onAppEvent('export.failed', (detail) => {
      if (!detail?.diagnostic) return;
      setExportFailure({
        diagnostic: detail.diagnostic,
        documentPath: detail.documentPath ?? null,
        format: detail.format,
        message: detail.message,
        nextSteps: detail.nextSteps,
        outputPath: detail.outputPath ?? null,
        stage: detail.stage,
        title: detail.title || t('export.failed'),
      });
    });
  }, []);

  const sendExportProgressToBackground = useCallback(() => {
    setExportProgressInBackground(true);
  }, []);

  const showBackgroundExportProgress = useCallback(() => {
    setExportProgressInBackground(false);
  }, []);

  const dismissExportFailure = useCallback(() => {
    setExportFailure(null);
  }, []);

  const copyExportFailureDiagnostic = useCallback(async () => {
    if (!exportFailure) return;
    try {
      await navigator.clipboard.writeText(exportFailure.diagnostic);
      showToast(t('export.diagnosticCopied'));
    } catch {
      showToast(t('export.diagnosticCopyFailed'));
    }
  }, [exportFailure, showToast]);

  return {
    exportProgress,
    exportProgressInBackground,
    exportFailure,
    sendExportProgressToBackground,
    showBackgroundExportProgress,
    dismissExportFailure,
    copyExportFailureDiagnostic,
  };
}
