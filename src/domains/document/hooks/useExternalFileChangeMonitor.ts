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
  const markSaved = useDocumentStore((s) => s.markSaved);
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

      const activeDocument = useDocumentStore.getState().currentDocument;
      if (!activeDocument?.path || activeDocument.path !== documentPath) return;
      if (activeDocument.saveStatus === 'saving' || activeDocument.saveStatus === 'conflict') return;

      if (activeDocument.isDirty) {
        const snapshotIsIncomplete = knownSnapshot.mtimeMs === null || knownSnapshot.size === null;

        if (result.changed) {
          const diskSession = await readDocumentFileSession(documentPath);
          const latestDirtyDocument = useDocumentStore.getState().currentDocument;
          if (!latestDirtyDocument?.path || latestDirtyDocument.path !== documentPath) return;
          if (latestDirtyDocument.saveStatus === 'saving' || latestDirtyDocument.saveStatus === 'conflict') return;
          if (latestDirtyDocument.isDirty && diskSession.content === latestDirtyDocument.content) {
            markSaved(documentPath, diskSession.knownSnapshot, diskSession.content);
            return;
          }
          if (latestDirtyDocument.isDirty) {
            markSaveConflict(fileConflictDetector.message, documentPath);
          }
          return;
        }

        if (activeDocument.lastSavedContent != null && snapshotIsIncomplete) {
          const diskSession = await readDocumentFileSession(documentPath);
          const latestDirtyDocument = useDocumentStore.getState().currentDocument;
          if (!latestDirtyDocument?.path || latestDirtyDocument.path !== documentPath) return;
          if (latestDirtyDocument.saveStatus === 'saving' || latestDirtyDocument.saveStatus === 'conflict') return;
          if (latestDirtyDocument.isDirty && diskSession.content === latestDirtyDocument.content) {
            markSaved(documentPath, diskSession.knownSnapshot, diskSession.content);
            return;
          }
          if (latestDirtyDocument.isDirty && diskSession.content !== activeDocument.lastSavedContent) {
            markSaveConflict(fileConflictDetector.message, documentPath);
          }
          return;
        }

        return;
      }

      if (!result.changed) return;

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
    markSaved,
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
