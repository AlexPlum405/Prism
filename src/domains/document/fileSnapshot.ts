import { stat, type FileInfo } from '../../platform/tauri/fileSystem';
import { getFileSnapshotNative, type FileSnapshotDto } from '../../platform/tauri/documentIo';
import { isNativeCommandUnavailableError } from '../../platform/tauri/result';
import { t } from '../i18n';

export interface FileSnapshot {
  mtimeMs: number | null;
  size: number | null;
}

export function snapshotFromFileInfo(info: Pick<FileInfo, 'mtime' | 'size'>): FileSnapshot {
  return {
    mtimeMs: info.mtime ? info.mtime.getTime() : null,
    size: info.size,
  };
}

function snapshotFromDto(snapshot: FileSnapshotDto): FileSnapshot {
  return {
    mtimeMs: typeof snapshot.mtimeMs === 'number' ? snapshot.mtimeMs : null,
    size: typeof snapshot.size === 'number' ? snapshot.size : null,
  };
}

function isFileSnapshotDto(snapshot: unknown): snapshot is FileSnapshotDto {
  return Boolean(
    snapshot
    && typeof snapshot === 'object'
    && ('mtimeMs' in snapshot)
    && ('size' in snapshot)
    && (typeof (snapshot as FileSnapshotDto).mtimeMs === 'number' || (snapshot as FileSnapshotDto).mtimeMs === null)
    && (typeof (snapshot as FileSnapshotDto).size === 'number' || (snapshot as FileSnapshotDto).size === null),
  );
}

export async function getFileSnapshot(path: string): Promise<FileSnapshot> {
  try {
    const snapshot = await getFileSnapshotNative(path);
    if (isFileSnapshotDto(snapshot)) return snapshotFromDto(snapshot);
  } catch (error) {
    if (!isNativeCommandUnavailableError(error)) throw error;
  }
  return snapshotFromFileInfo(await stat(path));
}

export async function getFileSnapshotOrNull(path: string): Promise<FileSnapshot | null> {
  try {
    return await getFileSnapshot(path);
  } catch {
    return null;
  }
}

export function hasFileSnapshotChanged(known: FileSnapshot, current: FileSnapshot): boolean {
  if (known.size === null || current.size === null) return false;
  if (known.mtimeMs === null || current.mtimeMs === null) {
    return known.size !== current.size;
  }
  return known.mtimeMs !== current.mtimeMs || known.size !== current.size;
}

export function getExternalChangeMessage() {
  return t('conflict.externalChangeMessage');
}
