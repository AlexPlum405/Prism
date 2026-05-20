import { useCallback, useEffect, useState } from 'react';
import type { ToastInput } from '../lib/toast';
import { t } from '../domains/i18n';

export interface ExportFailureState {
  title: string;
  diagnostic: string;
}

export function useExportTaskUi(showToast: (input: ToastInput) => void) {
  const [exportProgress, setExportProgress] = useState<string | null>(null);
  const [exportProgressInBackground, setExportProgressInBackground] = useState(false);
  const [exportFailure, setExportFailure] = useState<ExportFailureState | null>(null);

  useEffect(() => {
    const handleExportProgress = (event: Event) => {
      const detail = (event as CustomEvent<{ visible?: boolean; message?: string }>).detail;
      if (detail?.visible) {
        setExportFailure(null);
        setExportProgress(detail.message ?? t('export.progressDefault'));
        return;
      }
      setExportProgress(null);
      setExportProgressInBackground(false);
    };
    window.addEventListener('prism-export-progress', handleExportProgress);
    return () => window.removeEventListener('prism-export-progress', handleExportProgress);
  }, []);

  useEffect(() => {
    const handleExportFailure = (event: Event) => {
      const detail = (event as CustomEvent<ExportFailureState>).detail;
      if (!detail?.diagnostic) return;
      setExportFailure({
        title: detail.title || t('export.failed'),
        diagnostic: detail.diagnostic,
      });
    };
    window.addEventListener('prism-export-failure', handleExportFailure);
    return () => window.removeEventListener('prism-export-failure', handleExportFailure);
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
