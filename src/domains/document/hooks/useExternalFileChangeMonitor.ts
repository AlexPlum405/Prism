import { useCallback, useEffect } from 'react';
import {
  createKnownFileSnapshot,
  fileConflictDetector,
  getFileSafetyConflictMessage,
  readDocumentFileSession,
} from '../services/fileSafety';
import { useDocumentStore } from '../store';

export function useExternalFileChangeMonitor(interval = 15000, enabled = true) {
  const documentPath = useDocumentStore((s) => s.currentDocument?.path ?? '');
  const isDirty = useDocumentStore((s) => s.currentDocument?.isDirty ?? false);
  const saveStatus = useDocumentStore((s) => s.currentDocument?.saveStatus ?? 'saved');
  const lastKnownMtime = useDocumentStore((s) => s.currentDocument?.lastKnownMtime ?? null);
  const lastKnownSize = useDocumentStore((s) => s.currentDocument?.lastKnownSize ?? null);
  const markSaveConflict = useDocumentStore((s) => s.markSaveConflict);

  const checkForExternalChange = useCallback(async () => {
    if (!enabled || !documentPath || saveStatus === 'conflict' || saveStatus === 'saving') {
      return;
    }

    try {
      const knownSnapshot = createKnownFileSnapshot(lastKnownMtime, lastKnownSize);
      const result = await fileConflictDetector.inspect(documentPath, knownSnapshot);

      if (!result.changed) return;

      const activeDocument = useDocumentStore.getState().currentDocument;
      if (!activeDocument?.path || activeDocument.path !== documentPath) return;

      if (isDirty) {
        markSaveConflict(fileConflictDetector.message, documentPath);
        return;
      }

      const session = await readDocumentFileSession(documentPath);
      const latestDocument = useDocumentStore.getState().currentDocument;
      if (!latestDocument?.path || latestDocument.path !== documentPath || latestDocument.isDirty) return;
      useDocumentStore.getState().openDocument(session.path, session.name, session.content, session.knownSnapshot);
    } catch {
      markSaveConflict(getFileSafetyConflictMessage(), documentPath);
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

    const handleFocus = () => {
      void checkForExternalChange();
    };

    window.addEventListener('focus', handleFocus);
    const timer = window.setInterval(handleFocus, interval);

    return () => {
      window.removeEventListener('focus', handleFocus);
      window.clearInterval(timer);
    };
  }, [checkForExternalChange, enabled, interval]);
}
