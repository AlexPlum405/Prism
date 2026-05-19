import { useCallback, useEffect, useState } from 'react';
import type { ToastInput } from '../lib/toast';

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
        setExportProgress(detail.message ?? '正在导出');
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
        title: detail.title || '导出失败',
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
      showToast('导出诊断文本已复制');
    } catch {
      showToast('复制诊断文本失败');
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
