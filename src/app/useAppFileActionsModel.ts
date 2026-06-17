import { useCallback, useState } from 'react';
import { useDocumentStore } from '../domains/document/store';
import { useWorkspaceStore } from '../domains/workspace/store';
import { executeFileAction, type DirtyDocumentSwitchAction, type FileActionInput } from '../lib/fileActions';
import { openPrismWindow } from '../lib/openWindow';
import { useStartupFileOpen } from './useStartupFileOpen';

interface DirtySwitchPromptState {
  currentName: string;
  resolve: (action: DirtyDocumentSwitchAction) => void;
  targetName: string;
}

interface UseAppFileActionsModelInput {
  requestMarkdownSavePath: (input: { filename: string; documentPath?: string }) => Promise<string | null>;
  showToast: (message: string) => void;
}

export function useAppFileActionsModel({
  requestMarkdownSavePath,
  showToast,
}: UseAppFileActionsModelInput) {
  const [dirtySwitchPrompt, setDirtySwitchPrompt] = useState<DirtySwitchPromptState | null>(null);

  const requestDirtyDocumentAction = useCallback((input: {
    currentName: string;
    targetName: string;
    targetPath: string;
  }) => (
    new Promise<DirtyDocumentSwitchAction>((resolve) => {
      setDirtySwitchPrompt({
        currentName: input.currentName,
        targetName: input.targetName,
        resolve,
      });
    })
  ), []);

  const resolveDirtySwitchPrompt = useCallback((action: DirtyDocumentSwitchAction) => {
    setDirtySwitchPrompt((prompt) => {
      prompt?.resolve(action);
      return null;
    });
  }, []);

  const handleFileAction = useCallback(async (input: FileActionInput) => {
    await executeFileAction(input, {
      documentStore: useDocumentStore.getState(),
      requestDirtyDocumentAction,
      requestSavePath: requestMarkdownSavePath,
      workspaceStore: useWorkspaceStore.getState(),
      showToast,
    });
  }, [requestDirtyDocumentAction, requestMarkdownSavePath, showToast]);

  const handleStartupFileOpen = useCallback(async (path: string) => {
    if (useDocumentStore.getState().currentDocument) {
      await openPrismWindow({ filePath: path });
      return;
    }

    await handleFileAction({ action: 'openFile', path });
  }, [handleFileAction]);

  useStartupFileOpen({ onOpenFilePath: handleStartupFileOpen });

  const handleFileClick = useCallback(async (path: string) => {
    await handleFileAction({ action: 'openFile', path });
  }, [handleFileAction]);

  return {
    dirtySwitchPrompt,
    handleFileAction,
    handleFileClick,
    resolveDirtySwitchPrompt,
  };
}
