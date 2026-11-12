import { mkdir, removeAppDataPath } from '../../../platform/tauri/fileSystem';
import { appDataDir } from '../../../platform/tauri/path';
import { joinPath } from '../../workspace/services/path';

export const PDF_CAPTURE_TEMP_ROOT_NAME = 'export-captures';

export interface PdfCaptureTempSession {
  directory: string;
  getCapturePath: (batchIndex: number) => string;
  cleanup: () => Promise<void>;
}

function createSessionId(): string {
  const randomId = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return randomId.replace(/[^a-zA-Z0-9._-]/g, '-');
}

function getCaptureFilename(batchIndex: number): string {
  return `capture-${batchIndex + 1}.pdf`;
}

export async function createPdfCaptureTempSession(): Promise<PdfCaptureTempSession> {
  const root = joinPath(await appDataDir(), PDF_CAPTURE_TEMP_ROOT_NAME);
  const directory = joinPath(root, createSessionId());
  await mkdir(directory, { recursive: true });

  return {
    directory,
    getCapturePath: (batchIndex) => joinPath(directory, getCaptureFilename(batchIndex)),
    cleanup: () => removeAppDataPath(directory, {
      recursive: true,
      reason: 'pdf-capture-temp-session-cleanup',
    }),
  };
}
