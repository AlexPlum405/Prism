import type { ExportDocumentInput, ExportFormat } from '../types';
import { t } from '../../i18n/runtime';

export type LocalExportAdapter = (
  input: ExportDocumentInput,
  outputPath?: string,
) => Promise<boolean>;

type LocalExportStrategyLoader = () => Promise<LocalExportAdapter>;

const localExportStrategyLoaders = {
  html: async () => {
    const { exportHtmlAdapter } = await import('../adapters/html');
    return exportHtmlAdapter;
  },
  pdf: async () => {
    const { exportPdfAdapter } = await import('../adapters/pdf');
    return exportPdfAdapter;
  },
  docx: async () => {
    const { exportDocxAdapter } = await import('../adapters/docx');
    return exportDocxAdapter;
  },
  png: async () => {
    const { exportPngAdapter } = await import('../adapters/png');
    return exportPngAdapter;
  },
} satisfies Record<ExportFormat, LocalExportStrategyLoader>;

export async function loadLocalExportStrategy(format: ExportFormat): Promise<LocalExportAdapter> {
  const loader = (localExportStrategyLoaders as Partial<Record<string, LocalExportStrategyLoader>>)[format];
  if (!loader) throw new Error(t('export.unsupportedFormat'));
  return loader();
}

export const __localExportStrategiesTesting = {
  localExportStrategyLoaders,
};
