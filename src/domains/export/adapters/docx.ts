import type { ExportDocumentInput } from '../types';

export async function exportDocxAdapter(input: ExportDocumentInput, outputPath?: string) {
  const { exportDocx } = await import('../exportPipeline');
  return exportDocx(input, outputPath);
}
