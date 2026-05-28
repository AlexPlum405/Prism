import {
  getExternalChangeMessage,
  getFileSnapshot,
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
import { PrismNativeError } from '../../../platform/tauri/result';
import {
  readDocumentFileSession as readDocumentFileSessionFromIo,
  writeDocumentFileSession as writeDocumentFileSessionFromIo,
  type DocumentFileSession,
  type WriteDocumentFileSessionInput,
} from './documentIo';

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
  if (error instanceof PrismNativeError) {
    if (error.code === 'file_not_found' || error.code === 'external_deleted') return 'missing';
    if (error.code === 'permission_denied') return 'permission-denied';
  }

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

export type { DocumentFileSession, WriteDocumentFileSessionInput };

export const readDocumentFileSession = readDocumentFileSessionFromIo;
export const writeDocumentFileSession: (input: WriteDocumentFileSessionInput) => Promise<FileSnapshot | null> =
  writeDocumentFileSessionFromIo;
