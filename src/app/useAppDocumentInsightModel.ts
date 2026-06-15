import { useCallback, type RefObject } from 'react';
import { exists as fsExists } from '@tauri-apps/plugin-fs';
import type { EditorPaneHandle } from '../domains/editor/components/EditorPane';
import { useDocumentDiagnosticsModel } from './useDocumentDiagnosticsModel';
import { useDocumentNavigationModel } from './useDocumentNavigationModel';

type DocumentNavigationInput = Omit<
  Parameters<typeof useDocumentNavigationModel>[0],
  'jumpToLine'
>;

interface UseAppDocumentInsightModelInput extends DocumentNavigationInput {
  editorRef: RefObject<EditorPaneHandle | null>;
}

export function useAppDocumentInsightModel({
  currentDocument,
  editorRef,
  fileTree,
  handleFileAction,
  rootPath,
  showToast,
  workspaceIndex,
  workspaceIndexJobId,
}: UseAppDocumentInsightModelInput) {
  const jumpToEditorLine = useCallback((line: number) => {
    editorRef.current?.jumpToLine(line);
  }, [editorRef]);

  const diagnostics = useDocumentDiagnosticsModel({
    currentDocument,
    existsPath: fsExists,
    fileTree,
    jumpToLine: jumpToEditorLine,
    rootPath,
  });

  const navigation = useDocumentNavigationModel({
    currentDocument,
    fileTree,
    handleFileAction,
    jumpToLine: jumpToEditorLine,
    rootPath,
    showToast,
    workspaceIndex,
    workspaceIndexJobId,
  });

  return {
    ...diagnostics,
    ...navigation,
  };
}
