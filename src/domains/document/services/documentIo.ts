import { readTextFile, stat, writeTextFile } from '../../../platform/tauri/fileSystem';
import {
  getFileSnapshotNative,
  readDocumentFileNative,
  writeDocumentFileNative,
  type FileSnapshotDto,
} from '../../../platform/tauri/documentIo';
import { isNativeCommandUnavailableError } from '../../../platform/tauri/result';
import { basename } from '../../workspace/services/path';
import {
  snapshotFromFileInfo,
  type FileSnapshot,
} from '../fileSnapshot';

export interface DocumentFileSession {
  content: string;
  knownSnapshot: FileSnapshot;
  name: string;
  path: string;
}

export interface WriteDocumentFileSessionInput {
  content: string;
  createNew?: boolean;
  expectedSnapshot?: FileSnapshot | null;
  path: string;
}

function normalizeSnapshot(snapshot: FileSnapshotDto | FileSnapshot | null | undefined): FileSnapshot {
  return {
    mtimeMs: typeof snapshot?.mtimeMs === 'number' ? snapshot.mtimeMs : null,
    size: typeof snapshot?.size === 'number' ? snapshot.size : null,
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object');
}

function isFileSnapshotDto(value: unknown): value is FileSnapshotDto {
  if (!isObject(value)) return false;
  return (
    (typeof value.mtimeMs === 'number' || value.mtimeMs === null)
    && (typeof value.size === 'number' || value.size === null)
  );
}

function isDocumentFileSessionDto(value: unknown): value is Awaited<ReturnType<typeof readDocumentFileNative>> {
  if (!isObject(value)) return false;
  return (
    typeof value.path === 'string'
    && typeof value.name === 'string'
    && typeof value.content === 'string'
    && (value.knownSnapshot === null || isFileSnapshotDto(value.knownSnapshot))
  );
}

function isDocumentWriteResultDto(value: unknown): value is Awaited<ReturnType<typeof writeDocumentFileNative>> {
  return isObject(value) && typeof value.path === 'string' && isFileSnapshotDto(value.snapshot);
}

function shouldFallbackToTypeScript(error: unknown) {
  return isNativeCommandUnavailableError(error);
}

export async function getFileSnapshotNativeFirst(path: string): Promise<FileSnapshot> {
  try {
    const snapshot = await getFileSnapshotNative(path);
    if (isFileSnapshotDto(snapshot)) return normalizeSnapshot(snapshot);
  } catch (error) {
    if (!shouldFallbackToTypeScript(error)) throw error;
  }
  return snapshotFromFileInfo(await stat(path));
}

export async function getFileSnapshotOrNullNativeFirst(path: string): Promise<FileSnapshot | null> {
  try {
    return await getFileSnapshotNativeFirst(path);
  } catch {
    return null;
  }
}

export async function readDocumentFileSession(path: string): Promise<DocumentFileSession> {
  try {
    const session = await readDocumentFileNative(path);
    if (isDocumentFileSessionDto(session)) {
      return {
        path: session.path,
        name: session.name || basename(session.path || path),
        content: session.content,
        knownSnapshot: normalizeSnapshot(session.knownSnapshot),
      };
    }
  } catch (error) {
    if (!shouldFallbackToTypeScript(error)) throw error;
  }

  const content = await readTextFile(path);
  return {
    path,
    name: basename(path),
    content,
    knownSnapshot: await getFileSnapshotOrNullNativeFirst(path) ?? normalizeSnapshot(null),
  };
}

export async function writeDocumentFileSession(
  input: WriteDocumentFileSessionInput,
): Promise<FileSnapshot | null> {
  try {
    const result = await writeDocumentFileNative({
      path: input.path,
      content: input.content,
      expectedSnapshot: input.expectedSnapshot ? normalizeSnapshot(input.expectedSnapshot) : null,
      createNew: input.createNew,
    });
    if (isDocumentWriteResultDto(result)) return normalizeSnapshot(result.snapshot);
  } catch (error) {
    if (!shouldFallbackToTypeScript(error)) throw error;
  }

  if (input.createNew) {
    await writeTextFile(input.path, input.content, { createNew: true });
  } else {
    await writeTextFile(input.path, input.content);
  }
  return getFileSnapshotOrNullNativeFirst(input.path);
}
