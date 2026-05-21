import { useCallback, useEffect, useState } from 'react';
import type { ToastInput } from '../lib/toast';
import { t } from '../domains/i18n';
import { onAppEvent } from '../platform/events/appEvents';

export interface ExportFailureState {
  title: string;
  diagnostic: string;
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
        title: detail.title || t('export.failed'),
        diagnostic: detail.diagnostic,
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
