import type { ExportDocumentInput } from '../types';

export async function exportPdfAdapter(input: ExportDocumentInput, outputPath?: string) {
  const { exportPdf } = await import('../exportPipeline');
  return exportPdf(input, outputPath);
}
