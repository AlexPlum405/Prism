import { check, type Update } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { t } from '../i18n';

export interface AvailableUpdate {
  status: 'available';
  currentVersion: string;
  version: string;
  date?: string;
  body?: string;
  update: Update;
}

export interface NoUpdate {
  status: 'none';
}

export interface UpdateUnavailable {
  status: 'unavailable';
  reason: string;
}

export type UpdateCheckResult = AvailableUpdate | NoUpdate | UpdateUnavailable;

export interface DownloadProgress {
  chunkLength: number;
  contentLength: number | null;
}

function getUpdateErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (error instanceof Event) return error.type || t('common.unknownEventError');
  return String(error);
}

function isMissingOrInvalidReleaseManifestError(message: string) {
  return /valid release json|latest\.json|not found|404|invalid json|unexpected token/i.test(message);
}

export async function checkForAppUpdate(): Promise<UpdateCheckResult> {
  let update: Awaited<ReturnType<typeof check>>;
  try {
    update = await check({ timeout: 15000 });
  } catch (error) {
    const message = getUpdateErrorMessage(error);
    if (isMissingOrInvalidReleaseManifestError(message)) {
      return {
        status: 'unavailable',
        reason: t('update.manifestUnavailable'),
      };
    }
    throw error;
  }

  if (!update) return { status: 'none' };

  return {
    status: 'available',
    currentVersion: update.currentVersion,
    version: update.version,
    date: update.date,
    body: update.body,
    update,
  };
}

export async function downloadAndInstallUpdate(
  update: Update,
  onProgress?: (progress: DownloadProgress) => void,
): Promise<void> {
  await update.downloadAndInstall((event) => {
    switch (event.event) {
      case 'Started':
        onProgress?.({ chunkLength: 0, contentLength: event.data.contentLength ?? null });
        break;
      case 'Progress':
        onProgress?.({ chunkLength: event.data.chunkLength, contentLength: null });
        break;
      case 'Finished':
        break;
    }
  });

  await relaunch();
}
