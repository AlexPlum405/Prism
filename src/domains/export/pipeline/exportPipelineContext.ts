import { t } from '../../i18n';
import type { ExportDocumentInput } from '../types';

export type ExportFileLabel = 'HTML' | 'PDF' | 'PNG' | 'Word';

type PrismRuntimeWindow = Window & {
  __TAURI_INTERNALS__?: unknown;
  __PRISM_EXPORT_WORKER__?: boolean;
};

export const exportProgressMessages = {
  parseMarkdown: () => t('export.progress.parseMarkdown'),
  renderDiagrams: () => t('export.progress.renderDiagrams'),
  applyTheme: () => t('export.progress.applyTheme'),
  prepareNativePdf: () => t('export.progress.prepareNativePdf'),
  printNativePdf: () => t('export.progress.printNativePdf'),
  applyPdfChrome: () => t('export.progress.applyPdfChrome'),
  generateFile: (label: ExportFileLabel) => t('export.progress.generateFile', { label }),
  writeFile: (label: ExportFileLabel) => t('export.progress.writeFile', { label }),
} as const;

export function normalizeExportRasterScale(scale: unknown, fallback = 2) {
  if (typeof scale !== 'number' || !Number.isFinite(scale)) return fallback;
  return Math.min(4, Math.max(1, Math.round(scale)));
}

export function getPreviewBackgroundColor() {
  return getComputedStyle(document.documentElement).getPropertyValue('--bg-preview').trim() || '#ffffff';
}

export function stripMarkdownExtension(filename: string) {
  return filename.replace(/\.(md|markdown|txt)$/i, '') || 'Untitled';
}

export function getExportTitle(input: Pick<ExportDocumentInput, 'filename' | 'title'>) {
  return input.title?.trim() || stripMarkdownExtension(input.filename);
}

export function reportProgress(input: ExportDocumentInput, message: string) {
  input.onProgress?.(message);
}

export function reportWarning(input: ExportDocumentInput, message: string) {
  input.onWarning?.(message);
}

export function isTauriExportWorkerRuntime() {
  if (typeof window === 'undefined') return false;
  const runtimeWindow = window as PrismRuntimeWindow;
  return Boolean(runtimeWindow.__TAURI_INTERNALS__ && runtimeWindow.__PRISM_EXPORT_WORKER__);
}

export function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) return error.message.trim();
  if (typeof error === 'string' && error.trim()) return error.trim();
  return t('export.error.unknown');
}

export async function getExportOutputPath(outputPath?: string) {
  if (outputPath) return outputPath;
  return null;
}
