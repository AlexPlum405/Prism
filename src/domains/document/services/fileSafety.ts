import { readTextFile, writeTextFile } from '../../../platform/tauri/fileSystem';
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
import type { DocumentSaveIssue } from '../types';
import { t } from '../../i18n';

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
  inspect: (path: string, knownSnapshot: FileSnapshot) => Promise<FileInspectionResult>;
  message: string;
}

export type FileAccessIssueKind = Exclude<DocumentSaveIssue, 'external-modified'>;

export type FileInspectionResult =
  | {
      changed: boolean;
      currentSnapshot: FileSnapshot;
      kind: 'ok';
    }
  | {
      kind: FileAccessIssueKind;
      message: string;
    };

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

export class FileAccessIssueError extends Error {
  issueKind: FileAccessIssueKind;

  path: string;

  constructor(issueKind: FileAccessIssueKind, path: string, message = getFileAccessIssueMessage(issueKind, path)) {
    super(message);
    this.name = 'FileAccessIssueError';
    this.issueKind = issueKind;
    this.path = path;
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

export function isFileAccessIssueError(error: unknown): error is FileAccessIssueError {
  return error instanceof FileAccessIssueError;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'string') return error;
  return String(error);
}

export function classifyFileAccessIssue(error: unknown): FileAccessIssueKind {
  const message = getErrorMessage(error);
  if (/enoent|not\s+found|no\s+such\s+file|os\s+error\s+2/i.test(message)) return 'missing';
  if (/eacces|eperm|permission\s+denied|not\s+permitted|os\s+error\s+13/i.test(message)) {
    return 'permission-denied';
  }
  return 'unavailable';
}

export function getFileAccessIssueMessage(kind: FileAccessIssueKind, path: string, detail?: string) {
  if (kind === 'missing') return t('conflict.missingMessage', { path });
  if (kind === 'permission-denied') return t('conflict.permissionMessage', { path, message: detail ?? '' });
  return t('conflict.unavailableMessage', { path, message: detail ?? '' });
}

export function getFileSafetyConflictMessage(error?: unknown, path?: string) {
  if (error !== undefined && path) {
    const issueKind = classifyFileAccessIssue(error);
    if (issueKind !== 'unavailable') {
      return getFileAccessIssueMessage(issueKind, path, getErrorMessage(error));
    }
  }
  return getExternalChangeMessage();
}

export const fileConflictDetector: FileConflictDetector = {
  message: getExternalChangeMessage(),
  hasChanged: hasFileSnapshotChanged,
  async inspect(path, knownSnapshot) {
    let currentSnapshot: FileSnapshot;
    try {
      currentSnapshot = await getFileSnapshot(path);
    } catch (error) {
      const issueKind = classifyFileAccessIssue(error);
      return {
        kind: issueKind,
        message: getFileAccessIssueMessage(issueKind, path, getErrorMessage(error)),
      };
    }
    return {
      kind: 'ok',
      changed: hasFileSnapshotChanged(knownSnapshot, currentSnapshot),
      currentSnapshot,
    };
  },
  async ensureUnchanged(path, knownSnapshot) {
    const result = await this.inspect(path, knownSnapshot);
    if (result.kind !== 'ok') {
      throw new FileAccessIssueError(result.kind, path, result.message);
    }
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
