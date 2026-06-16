import type { ExportDocumentInput } from '../types';

export async function exportPngAdapter(input: ExportDocumentInput, outputPath?: string) {
  const { exportPng } = await import('../exportPipeline');
  return exportPng(input, outputPath);
}
