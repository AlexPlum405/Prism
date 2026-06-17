import { useCallback, useEffect, useMemo, useState } from 'react';
import type { useDocumentStore } from '../domains/document/store';
import { useDocumentStore as useDocumentStoreRuntime } from '../domains/document/store';
import type { WorkspaceIndex } from '../domains/workspace/services/workspaceIndex';
import {
  extractDocumentLinks,
  resolveDocumentLinkTarget,
  type DocumentLinkReference,
} from '../domains/workspace/services/documentLinks';
import type { BacklinkReference } from '../domains/workspace/services/backlinks';
import { flattenFiles } from '../domains/workspace/services/fileTree';
import { isSamePath } from '../domains/workspace/services/path';
import {
  getWorkspaceIndexBacklinks,
  getWorkspaceIndexLinkFiles,
} from '../domains/workspace/services/workspaceIndexQuery';
import { queryWorkspaceBacklinksNativeModel } from '../domains/workspace/services/workspaceIndexNative';
import type { FileNode } from '../domains/workspace/types';
import type { FileActionInput } from '../lib/fileActions';
import type { ToastInput } from '../lib/toast';
import { t } from '../domains/i18n';
import { extractMarkdownDocumentHeadings } from '../domains/markdown/headings';

const MARKDOWN_FILE_RE = /\.(md|markdown)$/i;

function safeDecodeURIComponent(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function getSameDocumentHeadingTarget(target: string): string | null {
  const trimmed = target.trim();
  const normalized = trimmed.startsWith('<') && trimmed.endsWith('>')
    ? trimmed.slice(1, -1).trim()
    : trimmed;
  if (!normalized.startsWith('#')) return null;
  const slug = safeDecodeURIComponent(normalized.slice(1)).trim();
  return slug || null;
}

function findSameDocumentHeadingLine(content: string, target: string): number | null {
  const slug = getSameDocumentHeadingTarget(target);
  if (!slug) return null;
  return extractMarkdownDocumentHeadings(content).find((heading) => heading.slug === slug)?.line ?? null;
}

type CurrentDocument = ReturnType<typeof useDocumentStore.getState>['currentDocument'];

interface UseDocumentNavigationModelInput {
  currentDocument: CurrentDocument;
  fileTree: FileNode[];
  handleFileAction: (input: FileActionInput) => void | Promise<void>;
  jumpToLine: (line: number) => void;
  rootPath: string | null;
  showToast: (toast: ToastInput) => void;
  workspaceIndex: WorkspaceIndex | null;
  workspaceIndexJobId?: string | null;
}

export function useDocumentNavigationModel({
  currentDocument,
  fileTree,
  handleFileAction,
  jumpToLine,
  rootPath,
  showToast,
  workspaceIndex,
  workspaceIndexJobId = null,
}: UseDocumentNavigationModelInput) {
  const [documentLinksVisible, setDocumentLinksVisible] = useState(false);
  const [backlinksVisible, setBacklinksVisible] = useState(false);
  const [relationGraphVisible, setRelationGraphVisible] = useState(false);
  const [backlinks, setBacklinks] = useState<BacklinkReference[]>([]);
  const [pendingBacklinkJump, setPendingBacklinkJump] = useState<{
    line: number;
    path: string;
  } | null>(null);
  const supportsMarkdownLinks = currentDocument?.profile?.supportsMarkdownLinks !== false;

  const documentLinks = useMemo(
    () => currentDocument && supportsMarkdownLinks ? extractDocumentLinks(currentDocument.content) : [],
    [currentDocument?.content, supportsMarkdownLinks],
  );

  useEffect(() => {
    if (!currentDocument?.path || !supportsMarkdownLinks) {
      setBacklinks([]);
      return;
    }

    let cancelled = false;
    const fallbackBacklinks = workspaceIndex
      ? getWorkspaceIndexBacklinks(workspaceIndex, currentDocument.path)
      : [];
    setBacklinks(fallbackBacklinks);

    if (!workspaceIndexJobId) {
      return () => {
        cancelled = true;
      };
    }

    void queryWorkspaceBacklinksNativeModel({
      jobId: workspaceIndexJobId,
      path: currentDocument.path,
    })
      .then((nativeBacklinks) => {
        if (!cancelled && nativeBacklinks) {
          setBacklinks(nativeBacklinks);
        }
      })
      .catch((error) => {
        console.warn('[useDocumentNavigationModel] Native backlinks query unavailable, using TypeScript fallback:', error);
      });

    return () => {
      cancelled = true;
    };
  }, [currentDocument?.path, supportsMarkdownLinks, workspaceIndex, workspaceIndexJobId]);

  const openBacklinks = useCallback(() => {
    if (!supportsMarkdownLinks) return;
    setBacklinksVisible(true);
  }, [supportsMarkdownLinks]);

  const openDocumentLinks = useCallback(() => {
    if (!supportsMarkdownLinks) return;
    setDocumentLinksVisible(true);
  }, [supportsMarkdownLinks]);

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
    if (!supportsMarkdownLinks) return;

    if (options.kind === 'markdown' && currentDocument) {
      const headingSlug = getSameDocumentHeadingTarget(target);
      if (headingSlug) {
        const line = findSameDocumentHeadingLine(currentDocument.content, target);
        if (line) {
          jumpToLine(line);
        } else {
          showToast(t('app.linkDocumentNotFound', { target }));
        }
        return;
      }
    }

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
    currentDocument?.content,
    fileTree,
    handleFileAction,
    jumpToLine,
    rootPath,
    showToast,
    workspaceIndex,
    supportsMarkdownLinks,
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
    if (currentDocument?.profile?.supportsRelationGraph === false) return;
    const hasMarkdownDocuments = workspaceIndex?.documents.some((document) => document.profile === 'markdown');
    if (!workspaceIndex || !hasMarkdownDocuments) {
      showToast(t('app.openMarkdownWorkspaceFirst'));
      return;
    }
    setRelationGraphVisible(true);
  }, [currentDocument?.profile?.supportsRelationGraph, showToast, workspaceIndex]);

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
