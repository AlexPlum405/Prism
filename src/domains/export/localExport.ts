import type { ExportDocumentInput, ExportFormat } from './types';
import { t } from '../i18n';

export async function exportDocumentLocal(
  input: ExportDocumentInput,
  format: ExportFormat,
  outputPath?: string,
) {
  switch (format) {
    case 'html': {
      const { exportHtmlAdapter } = await import('./adapters/html');
      return exportHtmlAdapter(input, outputPath);
    }
    case 'pdf': {
      const { exportPdfAdapter } = await import('./adapters/pdf');
      return exportPdfAdapter(input, outputPath);
    }
    case 'docx': {
      const { exportDocxAdapter } = await import('./adapters/docx');
      return exportDocxAdapter(input, outputPath);
    }
    case 'png': {
      const { exportPngAdapter } = await import('./adapters/png');
      return exportPngAdapter(input, outputPath);
    }
    default:
      throw new Error(t('export.unsupportedFormat'));
  }
}
