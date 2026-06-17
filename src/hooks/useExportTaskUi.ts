import { useCallback, useEffect, useRef, useState } from 'react';
import type { ToastInput } from '../lib/toast';
import { t } from '../domains/i18n';
import { onAppEvent } from '../platform/events/appEvents';

const EXPORT_TRANSIENT_FEEDBACK_MS = 2200;

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

export interface ExportFeedbackState {
  message?: string;
  status: 'success' | 'failed' | 'cancelled';
  title: string;
}

export function useExportTaskUi(showToast: (input: ToastInput) => void) {
  const [exportProgress, setExportProgress] = useState<string | null>(null);
  const [exportProgressInBackground, setExportProgressInBackground] = useState(false);
  const [exportFailure, setExportFailure] = useState<ExportFailureState | null>(null);
  const [exportFailureVisible, setExportFailureVisible] = useState(false);
  const [exportFeedback, setExportFeedback] = useState<ExportFeedbackState | null>(null);
  const transientFeedbackTimerRef = useRef<number | null>(null);

  const clearTransientFeedbackTimer = useCallback(() => {
    if (transientFeedbackTimerRef.current === null) return;
    window.clearTimeout(transientFeedbackTimerRef.current);
    transientFeedbackTimerRef.current = null;
  }, []);

  const scheduleTransientFeedbackClear = useCallback(() => {
    clearTransientFeedbackTimer();
    transientFeedbackTimerRef.current = window.setTimeout(() => {
      setExportFeedback((current) => (
        current?.status === 'success' || current?.status === 'cancelled' ? null : current
      ));
      transientFeedbackTimerRef.current = null;
    }, EXPORT_TRANSIENT_FEEDBACK_MS);
  }, [clearTransientFeedbackTimer]);

  useEffect(() => () => clearTransientFeedbackTimer(), [clearTransientFeedbackTimer]);

  useEffect(() => {
    return onAppEvent('export.progress', (detail) => {
      if (detail?.visible) {
        clearTransientFeedbackTimer();
        setExportFailure(null);
        setExportFailureVisible(false);
        setExportFeedback(null);
        setExportProgress(detail.message ?? t('export.progressDefault'));
        return;
      }
      setExportProgress(null);
      setExportProgressInBackground(false);
    });
  }, [clearTransientFeedbackTimer]);

  useEffect(() => {
    return onAppEvent('export.result', (detail) => {
      setExportProgress(null);
      setExportProgressInBackground(false);
      setExportFailure(null);
      setExportFailureVisible(false);
      setExportFeedback({
        message: detail.message,
        status: detail.status,
        title: detail.title ?? (detail.status === 'success' ? t('status.exported') : t('status.exportCancelled')),
      });
      scheduleTransientFeedbackClear();
    });
  }, [scheduleTransientFeedbackClear]);

  useEffect(() => {
    return onAppEvent('export.failed', (detail) => {
      if (!detail?.diagnostic) return;
      clearTransientFeedbackTimer();
      const failure = {
        diagnostic: detail.diagnostic,
        documentPath: detail.documentPath ?? null,
        format: detail.format,
        message: detail.message,
        nextSteps: detail.nextSteps,
        outputPath: detail.outputPath ?? null,
        stage: detail.stage,
        title: detail.title || t('export.failed'),
      };
      setExportProgress(null);
      setExportProgressInBackground(false);
      setExportFailure(failure);
      setExportFailureVisible(true);
      setExportFeedback({
        message: detail.message,
        status: 'failed',
        title: failure.title,
      });
    });
  }, [clearTransientFeedbackTimer]);

  const sendExportProgressToBackground = useCallback(() => {
    setExportProgressInBackground(true);
  }, []);

  const showBackgroundExportProgress = useCallback(() => {
    setExportProgressInBackground(false);
  }, []);

  const dismissExportFailure = useCallback(() => {
    setExportFailureVisible(false);
  }, []);

  const showExportFailureDetails = useCallback(() => {
    setExportFailureVisible((visible) => visible || Boolean(exportFailure));
  }, [exportFailure]);

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
    exportFailureVisible,
    exportFeedback,
    sendExportProgressToBackground,
    showBackgroundExportProgress,
    showExportFailureDetails,
    dismissExportFailure,
    copyExportFailureDiagnostic,
  };
}
