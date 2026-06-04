import { useCallback, useEffect, useState } from 'react';
import type { SaveConflictAction } from '../domains/document/components/SaveConflictModal';
import {
  discardConflictedDocument,
  overwriteConflictedDocument,
  reloadConflictedDocument,
  saveConflictedDocumentAs,
} from '../domains/document/services/conflictResolution';
import type { OpenDocument } from '../domains/document/types';
import { useDocumentStore } from '../domains/document/store';
import { t } from '../domains/i18n';

interface UseAppSaveConflictModelInput {
  currentDocument: OpenDocument | null;
  requestMarkdownSavePath: (input: { filename: string; documentPath?: string }) => Promise<string | null>;
  showToast: (message: string) => void;
}

function formatAppError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error instanceof Event) return error.type || t('common.unknownEventError');
  return String(error);
}

export function useAppSaveConflictModel({
  currentDocument,
  requestMarkdownSavePath,
  showToast,
}: UseAppSaveConflictModelInput) {
  const [conflictAction, setConflictAction] = useState<SaveConflictAction | null>(null);
  const hasSaveConflict = currentDocument?.saveStatus === 'conflict' && Boolean(currentDocument.path);

  const runConflictAction = useCallback(async (action: SaveConflictAction) => {
    if (conflictAction) return;
    setConflictAction(action);
    try {
      let result: { resolved: boolean; path?: string };
      const issueKind = useDocumentStore.getState().currentDocument?.saveIssue ?? null;
      if (action === 'reload') {
        result = await reloadConflictedDocument();
        if (result.resolved) showToast(t('app.reloadedDiskVersion'));
      } else if (action === 'saveAs') {
        result = await saveConflictedDocumentAs(requestMarkdownSavePath);
        if (result.resolved) showToast(t('app.savedCurrentVersionAs'));
      } else if (action === 'discard') {
        result = await discardConflictedDocument();
        if (result.resolved) showToast(t('app.discardedMissingFileCopy'));
      } else {
        result = await overwriteConflictedDocument();
        if (result.resolved) {
          showToast(issueKind === 'missing' ? t('app.recreatedMissingFile') : t('app.overwroteDiskVersion'));
        }
      }
    } catch (error) {
      showToast(t('app.conflictActionFailed', { message: formatAppError(error) }));
    } finally {
      setConflictAction(null);
    }
  }, [conflictAction, requestMarkdownSavePath, showToast]);

  useEffect(() => {
    if (currentDocument?.saveStatus !== 'conflict' && conflictAction) {
      setConflictAction(null);
    }
  }, [conflictAction, currentDocument?.saveStatus]);

  return {
    conflictAction,
    hasSaveConflict,
    runConflictAction,
  };
}
