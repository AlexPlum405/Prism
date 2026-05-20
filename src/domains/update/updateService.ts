import { check } from '@tauri-apps/plugin-updater';
import { t } from '../i18n';

export interface AvailableUpdate {
  status: 'available';
  currentVersion: string;
  version: string;
  date?: string;
  body?: string;
}

export interface NoUpdate {
  status: 'none';
}

export interface UpdateUnavailable {
  status: 'unavailable';
  reason: string;
}

export type UpdateCheckResult = AvailableUpdate | NoUpdate | UpdateUnavailable;

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
  };
}
