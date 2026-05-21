import { useCallback, useEffect, useMemo, useState } from 'react';
import type { useDocumentStore } from '../domains/document/store';
import { useDocumentStore as useDocumentStoreRuntime } from '../domains/document/store';
import type { WorkspaceIndex } from '../domains/workspace/services';
import {
  type BacklinkReference,
  type DocumentLinkReference,
  extractDocumentLinks,
  flattenFiles,
  getWorkspaceIndexBacklinks,
  getWorkspaceIndexLinkFiles,
  isSamePath,
  resolveDocumentLinkTarget,
} from '../domains/workspace/services';
import type { FileNode } from '../domains/workspace/types';
import type { FileActionInput } from '../lib/fileActions';
import type { ToastInput } from '../lib/toast';
import { t } from '../domains/i18n';

const MARKDOWN_FILE_RE = /\.(md|markdown|txt)$/i;

type CurrentDocument = ReturnType<typeof useDocumentStore.getState>['currentDocument'];

interface UseDocumentNavigationModelInput {
  currentDocument: CurrentDocument;
  fileTree: FileNode[];
  handleFileAction: (input: FileActionInput) => void | Promise<void>;
  jumpToLine: (line: number) => void;
  rootPath: string | null;
  showToast: (toast: ToastInput) => void;
  workspaceIndex: WorkspaceIndex | null;
}

export function useDocumentNavigationModel({
  currentDocument,
  fileTree,
  handleFileAction,
  jumpToLine,
  rootPath,
  showToast,
  workspaceIndex,
}: UseDocumentNavigationModelInput) {
  const [documentLinksVisible, setDocumentLinksVisible] = useState(false);
  const [backlinksVisible, setBacklinksVisible] = useState(false);
  const [relationGraphVisible, setRelationGraphVisible] = useState(false);
  const [backlinks, setBacklinks] = useState<BacklinkReference[]>([]);
  const [pendingBacklinkJump, setPendingBacklinkJump] = useState<{
    line: number;
    path: string;
  } | null>(null);

  const documentLinks = useMemo(
    () => currentDocument ? extractDocumentLinks(currentDocument.content) : [],
    [currentDocument?.content],
  );

  useEffect(() => {
    if (!currentDocument?.path || !workspaceIndex) {
      setBacklinks([]);
      return;
    }

    setBacklinks(getWorkspaceIndexBacklinks(workspaceIndex, currentDocument.path));
  }, [currentDocument?.path, workspaceIndex]);

  const openBacklinks = useCallback(() => {
    setBacklinksVisible(true);
  }, []);

  const openDocumentLinks = useCallback(() => {
    setDocumentLinksVisible(true);
  }, []);

  useEffect(() => {
    if (backlinks.length === 0) {
      setBacklinksVisible(false);
    }
  }, [backlinks.length]);

  useEffect(() => {
    if (!pendingBacklinkJump || !currentDocument?.path) return;
    if (!isSamePath(currentDocument.path, pendingBacklinkJump.path)) return;

    const { line, path } = pendingBacklinkJump;
    const frame = window.requestAnimationFrame(() => {
      jumpToLine(line);
      setPendingBacklinkJump((pending) => (
        pending && pending.line === line && isSamePath(pending.path, path) ? null : pending
      ));
    });

    return () => window.cancelAnimationFrame(frame);
  }, [currentDocument?.path, jumpToLine, pendingBacklinkJump]);

  const openDocumentLink = useCallback(async (
    target: string,
    options: { kind: 'markdown' | 'wiki'; sourcePath?: string },
  ) => {
    if (!rootPath) {
      showToast(t('app.openWorkspaceFirst'));
      return;
    }

    const workspaceFiles = workspaceIndex
      ? getWorkspaceIndexLinkFiles(workspaceIndex)
      : flattenFiles(fileTree, rootPath)
          .map(({ node }) => ({ name: node.name, path: node.path }))
          .filter((file) => MARKDOWN_FILE_RE.test(file.name));
    const resolved = resolveDocumentLinkTarget({
      kind: options.kind,
      target,
      sourcePath: options.sourcePath ?? currentDocument?.path,
      workspaceFiles,
      workspaceRoot: rootPath,
    });

    if (!resolved) {
      showToast(t('app.linkDocumentNotFound', { target }));
      return;
    }

    await handleFileAction({ action: 'openFile', path: resolved.path });
  }, [
    currentDocument?.path,
    fileTree,
    handleFileAction,
    rootPath,
    showToast,
    workspaceIndex,
  ]);

  const selectDocumentLink = useCallback(async (link: DocumentLinkReference) => {
    setDocumentLinksVisible(false);
    await openDocumentLink(link.target, {
      kind: link.kind,
      sourcePath: currentDocument?.path,
    });
  }, [currentDocument?.path, openDocumentLink]);

  const selectBacklink = useCallback(async (reference: BacklinkReference) => {
    setBacklinksVisible(false);
    setPendingBacklinkJump({ path: reference.path, line: reference.line });
    await handleFileAction({ action: 'openFile', path: reference.path });
    const opened = useDocumentStoreRuntime.getState().currentDocument;
    if (!opened?.path || !isSamePath(opened.path, reference.path)) {
      setPendingBacklinkJump(null);
    }
  }, [handleFileAction]);

  const openRelationGraph = useCallback(() => {
    if (!workspaceIndex || workspaceIndex.documents.length === 0) {
      showToast(t('app.openMarkdownWorkspaceFirst'));
      return;
    }
    setRelationGraphVisible(true);
  }, [showToast, workspaceIndex]);

  return {
    backlinks,
    backlinksVisible,
    documentLinks,
    documentLinksVisible,
    openBacklinks,
    openDocumentLink,
    openDocumentLinks,
    openRelationGraph,
    relationGraphVisible,
    selectBacklink,
    selectDocumentLink,
    setBacklinksVisible,
    setDocumentLinksVisible,
    setRelationGraphVisible,
  };
}
