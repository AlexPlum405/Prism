import { useEffect, useRef } from 'react';
import {
  createKnownFileSnapshot,
  fileConflictDetector,
  isFileAccessIssueError,
  isFileConflictError,
  recoverySnapshotStore,
  writeDocumentFileSession,
} from '../services/fileSafety';
import { useDocumentStore } from '../store';

export function useAutoSave(interval = 2000, enabled = true) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const documentPath = useDocumentStore((s) => s.currentDocument?.path ?? '');
  const documentName = useDocumentStore((s) => s.currentDocument?.name ?? '');
  const documentContent = useDocumentStore((s) => s.currentDocument?.content ?? '');
  const isDirty = useDocumentStore((s) => s.currentDocument?.isDirty ?? false);
  const saveStatus = useDocumentStore((s) => s.currentDocument?.saveStatus ?? 'saved');
  const lastKnownMtime = useDocumentStore((s) => s.currentDocument?.lastKnownMtime ?? null);
  const lastKnownSize = useDocumentStore((s) => s.currentDocument?.lastKnownSize ?? null);
  const markSaving = useDocumentStore((s) => s.markSaving);
  const markSaved = useDocumentStore((s) => s.markSaved);
  const markSaveFailed = useDocumentStore((s) => s.markSaveFailed);
  const markSaveConflict = useDocumentStore((s) => s.markSaveConflict);

  useEffect(() => {
    if (!isDirty || !documentPath || saveStatus === 'conflict') {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(async () => {
      try {
        await recoverySnapshotStore.create({
          documentPath,
          documentName,
          content: documentContent,
          reason: 'autosave',
        }).catch(() => undefined);
        if (enabled) {
          const knownSnapshot = createKnownFileSnapshot(lastKnownMtime, lastKnownSize);
          await fileConflictDetector.ensureUnchanged(documentPath, knownSnapshot);
          markSaving(documentPath);
          markSaved(documentPath, await writeDocumentFileSession({
            path: documentPath,
            content: documentContent,
          }));
          await recoverySnapshotStore.clearForDocument(documentPath).catch(() => undefined);
        }
      } catch (err) {
        if (isFileConflictError(err)) {
          markSaveConflict(err.message, documentPath);
          return;
        }
        if (isFileAccessIssueError(err)) {
          markSaveConflict(err.message, documentPath, err.issueKind);
          return;
        }
        markSaveFailed(err, documentPath);
      } finally {
        timerRef.current = null;
      }
    }, interval);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [
    documentContent,
    documentName,
    documentPath,
    enabled,
    interval,
    isDirty,
    lastKnownMtime,
    lastKnownSize,
    markSaveConflict,
    markSaveFailed,
    markSaved,
    markSaving,
    saveStatus,
  ]);
}
