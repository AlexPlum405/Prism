import type { ExportDocumentInput } from '../types';

export async function exportHtmlAdapter(input: ExportDocumentInput, outputPath?: string) {
  const { exportHtml } = await import('../exportPipeline');
  return exportHtml(input, outputPath);
}
