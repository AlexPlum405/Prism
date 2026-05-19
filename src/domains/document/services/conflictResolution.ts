import { basename } from '../../workspace/services/path';
import { addRecentFile } from '../../workspace/services/recentFiles';
import { useDocumentStore } from '../store';
import type { OpenDocument } from '../types';
import {
  readDocumentFileSession,
  recoverySnapshotStore,
  writeDocumentFileSession,
} from './fileSafety';

export interface RequestSavePathInput {
  filename: string;
  documentPath?: string;
}

export type RequestSavePath = (input: RequestSavePathInput) => Promise<string | null>;

export interface ConflictResolutionResult {
  resolved: boolean;
  path?: string;
}

function getCurrentConflictDocument(): OpenDocument | null {
  const doc = useDocumentStore.getState().currentDocument;
  if (!doc?.path || doc.saveStatus !== 'conflict') return null;
  return doc;
}

function markConflictFailure(doc: OpenDocument, error: unknown) {
  useDocumentStore.getState().markSaveConflict(error, doc.path);
}

export function getConflictCopyFilename(filename: string): string {
  const trimmed = filename.trim() || 'Untitled.md';
  const match = trimmed.match(/^(.*?)(\.(?:md|markdown))$/i);
  if (!match) return `${trimmed}-local.md`;
  const [, base, extension] = match;
  return `${base || 'Untitled'}-local${extension}`;
}

export async function reloadConflictedDocument(): Promise<ConflictResolutionResult> {
  const doc = getCurrentConflictDocument();
  if (!doc) return { resolved: false };

  try {
    const session = await readDocumentFileSession(doc.path);
    useDocumentStore.getState().openDocument(session.path, session.name, session.content, session.knownSnapshot);
    addRecentFile(doc.path, basename(doc.path));
    await recoverySnapshotStore.clearForDocument(doc.path).catch(() => undefined);
    return { resolved: true, path: doc.path };
  } catch (error) {
    markConflictFailure(doc, error);
    throw error;
  }
}

export async function saveConflictedDocumentAs(
  requestSavePath?: RequestSavePath,
): Promise<ConflictResolutionResult> {
  const doc = getCurrentConflictDocument();
  if (!doc) return { resolved: false };
  if (!requestSavePath) {
    const error = new Error('保存面板未就绪');
    markConflictFailure(doc, error);
    throw error;
  }

  const chosen = await requestSavePath({
    filename: getConflictCopyFilename(doc.name),
    documentPath: doc.path,
  });
  if (!chosen) return { resolved: false };

  try {
    useDocumentStore.getState().markSaving(doc.path);
    const snapshot = await writeDocumentFileSession({ path: chosen, content: doc.content });
    useDocumentStore.getState().openDocument(chosen, basename(chosen), doc.content, snapshot);
    addRecentFile(chosen, basename(chosen));
    await recoverySnapshotStore.clearForDocument(doc.path).catch(() => undefined);
    await recoverySnapshotStore.clearForDocument(chosen).catch(() => undefined);
    return { resolved: true, path: chosen };
  } catch (error) {
    markConflictFailure(doc, error);
    throw error;
  }
}

export async function overwriteConflictedDocument(): Promise<ConflictResolutionResult> {
  const doc = getCurrentConflictDocument();
  if (!doc) return { resolved: false };

  try {
    useDocumentStore.getState().markSaving(doc.path);
    const snapshot = await writeDocumentFileSession({ path: doc.path, content: doc.content });
    useDocumentStore.getState().markSaved(doc.path, snapshot);
    addRecentFile(doc.path, basename(doc.path));
    await recoverySnapshotStore.clearForDocument(doc.path).catch(() => undefined);
    return { resolved: true, path: doc.path };
  } catch (error) {
    markConflictFailure(doc, error);
    throw error;
  }
}
