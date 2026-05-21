import type { ExportDocumentInput, ExportFormat } from './types';
import { exportDocumentLocal } from './localExport';

type PrismExportWindow = Window & {
  __TAURI_INTERNALS__?: unknown;
  __PRISM_EXPORT_WORKER__?: boolean;
};

function shouldUseIsolatedExportWebview(outputPath?: string) {
  if (!outputPath || typeof window === 'undefined') return false;
  const runtimeWindow = window as PrismExportWindow;
  return Boolean(runtimeWindow.__TAURI_INTERNALS__) && !runtimeWindow.__PRISM_EXPORT_WORKER__;
}

export async function exportDocument(
  input: ExportDocumentInput,
  format: ExportFormat,
  outputPath?: string,
) {
  if (shouldUseIsolatedExportWebview(outputPath)) {
    const { exportDocumentInIsolatedWebview } = await import('./isolatedWebviewExport');
    return exportDocumentInIsolatedWebview(input, format, outputPath);
  }
  return exportDocumentLocal(input, format, outputPath);
}

export const __exportServiceTesting = {
  shouldUseIsolatedExportWebview,
};
