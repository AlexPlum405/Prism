import type { ExportDocumentInput, ExportFormat } from './types';
import { loadLocalExportStrategy } from './formats/localExportStrategies';

export async function exportDocumentLocal(
  input: ExportDocumentInput,
  format: ExportFormat,
  outputPath?: string,
) {
  const exportStrategy = await loadLocalExportStrategy(format);
  return exportStrategy(input, outputPath);
}
