import { useCallback, useEffect, useRef } from 'react';
import {
  classifyFileAccessIssue,
  createKnownFileSnapshot,
  fileConflictDetector,
  getFileSafetyConflictMessage,
  readDocumentFileSession,
} from '../services/fileSafety';
import { useDocumentStore } from '../store';

export function useExternalFileChangeMonitor(interval = 15000, enabled = true) {
  const checkInFlightRef = useRef(false);
  const documentPath = useDocumentStore((s) => s.currentDocument?.path ?? '');
  const isDirty = useDocumentStore((s) => s.currentDocument?.isDirty ?? false);
  const saveStatus = useDocumentStore((s) => s.currentDocument?.saveStatus ?? 'saved');
  const lastKnownMtime = useDocumentStore((s) => s.currentDocument?.lastKnownMtime ?? null);
  const lastKnownSize = useDocumentStore((s) => s.currentDocument?.lastKnownSize ?? null);
  const markSaveConflict = useDocumentStore((s) => s.markSaveConflict);

  const checkForExternalChange = useCallback(async () => {
    if (!enabled || !documentPath || saveStatus === 'conflict' || saveStatus === 'saving' || checkInFlightRef.current) {
      return;
    }

    const activeAtStart = useDocumentStore.getState().currentDocument;
    if (!activeAtStart?.path || activeAtStart.path !== documentPath) return;

    checkInFlightRef.current = true;
    try {
      const knownSnapshot = createKnownFileSnapshot(
        activeAtStart.lastKnownMtime ?? lastKnownMtime,
        activeAtStart.lastKnownSize ?? lastKnownSize,
      );
      const result = await fileConflictDetector.inspect(documentPath, knownSnapshot);

      if (result.kind !== 'ok') {
        markSaveConflict(result.message, documentPath, result.kind);
        return;
      }

      if (!result.changed) return;

      const activeDocument = useDocumentStore.getState().currentDocument;
      if (!activeDocument?.path || activeDocument.path !== documentPath) return;

      if (activeDocument.isDirty) {
        markSaveConflict(fileConflictDetector.message, documentPath);
        return;
      }

      const session = await readDocumentFileSession(documentPath);
      const latestDocument = useDocumentStore.getState().currentDocument;
      if (!latestDocument?.path || latestDocument.path !== documentPath || latestDocument.isDirty) return;
      useDocumentStore.getState().openDocument(session.path, session.name, session.content, session.knownSnapshot);
    } catch (error) {
      const issueKind = classifyFileAccessIssue(error);
      markSaveConflict(
        getFileSafetyConflictMessage(error, documentPath),
        documentPath,
        issueKind === 'unavailable' ? 'external-modified' : issueKind,
      );
    } finally {
      checkInFlightRef.current = false;
    }
  }, [
    documentPath,
    enabled,
    isDirty,
    lastKnownMtime,
    lastKnownSize,
    markSaveConflict,
    saveStatus,
  ]);

  useEffect(() => {
    if (!enabled) return undefined;

    const handleExternalChangeCheck = () => {
      void checkForExternalChange();
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void checkForExternalChange();
      }
    };

    window.addEventListener('focus', handleExternalChangeCheck);
    window.addEventListener('pageshow', handleExternalChangeCheck);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    const timer = window.setInterval(handleExternalChangeCheck, interval);
    const dirtyTimer = isDirty
      ? window.setInterval(handleExternalChangeCheck, Math.min(interval, 1000))
      : null;

    return () => {
      window.removeEventListener('focus', handleExternalChangeCheck);
      window.removeEventListener('pageshow', handleExternalChangeCheck);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.clearInterval(timer);
      if (dirtyTimer !== null) window.clearInterval(dirtyTimer);
    };
  }, [checkForExternalChange, enabled, interval, isDirty]);
}
