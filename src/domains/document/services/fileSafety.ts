import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';
import { basename } from '../../workspace/services/path';
import {
  getExternalChangeMessage,
  getFileSnapshot,
  getFileSnapshotOrNull,
  hasFileSnapshotChanged,
  type FileSnapshot,
} from '../fileSnapshot';
import type { OpenDocument } from '../types';
import {
  clearRecoverySnapshotsForDocument,
  createRecoverySnapshot,
  type RecoverySnapshot,
  type RecoverySnapshotReason,
} from './recovery';

export interface DocumentFileSession {
  content: string;
  knownSnapshot: FileSnapshot;
  name: string;
  path: string;
}

export interface WorkspaceFileSession {
  activeDocumentPath?: string;
  rootPath: string;
}

export interface FileConflictDetector {
  ensureUnchanged: (path: string, knownSnapshot: FileSnapshot) => Promise<FileSnapshot>;
  hasChanged: (knownSnapshot: FileSnapshot, currentSnapshot: FileSnapshot) => boolean;
  inspect: (path: string, knownSnapshot: FileSnapshot) => Promise<{
    changed: boolean;
    currentSnapshot: FileSnapshot;
  }>;
  message: string;
}

export interface RecoverySnapshotStore {
  clearForDocument: (documentPath: string) => Promise<void>;
  create: (input: {
    content: string;
    documentName: string;
    documentPath: string;
    reason: RecoverySnapshotReason;
  }) => Promise<RecoverySnapshot | null>;
}

export class FileConflictError extends Error {
  constructor(message = getExternalChangeMessage()) {
    super(message);
    this.name = 'FileConflictError';
  }
}

export function createKnownFileSnapshot(mtimeMs: number | null, size: number | null): FileSnapshot {
  return { mtimeMs, size };
}

export function createDocumentFileSession(document: OpenDocument | null | undefined): DocumentFileSession | null {
  if (!document?.path) return null;
  return {
    path: document.path,
    name: document.name,
    content: document.content,
    knownSnapshot: createKnownFileSnapshot(document.lastKnownMtime, document.lastKnownSize),
  };
}

export function createWorkspaceFileSession(rootPath: string, activeDocumentPath?: string): WorkspaceFileSession | null {
  if (!rootPath) return null;
  return {
    rootPath,
    ...(activeDocumentPath ? { activeDocumentPath } : {}),
  };
}

export function isFileConflictError(error: unknown): error is FileConflictError {
  return error instanceof FileConflictError;
}

export function getFileSafetyConflictMessage() {
  return getExternalChangeMessage();
}

export const fileConflictDetector: FileConflictDetector = {
  message: getExternalChangeMessage(),
  hasChanged: hasFileSnapshotChanged,
  async inspect(path, knownSnapshot) {
    const currentSnapshot = await getFileSnapshot(path);
    return {
      changed: hasFileSnapshotChanged(knownSnapshot, currentSnapshot),
      currentSnapshot,
    };
  },
  async ensureUnchanged(path, knownSnapshot) {
    const result = await this.inspect(path, knownSnapshot);
    if (result.changed) {
      throw new FileConflictError(this.message);
    }
    return result.currentSnapshot;
  },
};

export const recoverySnapshotStore: RecoverySnapshotStore = {
  create: createRecoverySnapshot,
  clearForDocument: clearRecoverySnapshotsForDocument,
};

export async function readDocumentFileSession(path: string): Promise<DocumentFileSession> {
  const content = await readTextFile(path);
  return {
    path,
    name: basename(path),
    content,
    knownSnapshot: await getFileSnapshotOrNull(path) ?? createKnownFileSnapshot(null, null),
  };
}

export async function writeDocumentFileSession(input: {
  content: string;
  path: string;
}): Promise<FileSnapshot | null> {
  await writeTextFile(input.path, input.content);
  return getFileSnapshotOrNull(input.path);
}
