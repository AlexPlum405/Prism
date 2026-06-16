import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FileNode } from '../domains/workspace/types';
import { flattenFiles } from '../domains/workspace/services';
import type { useDocumentStore } from '../domains/document/store';
import {
  createMarkdownLinkWorkspaceFileSet,
  scanMarkdownLinks,
} from '../domains/editor/extensions/linkDiagnostics';
import { scanMarkdownImageDiagnostics, type ImageDiagnostic } from '../domains/editor/extensions/imageDiagnostics';
import { scanHeadingAnchorDiagnostics } from '../domains/editor/extensions/headingDiagnostics';
import { scanMarkdownTableDiagnostics } from '../domains/editor/extensions/tables';
import { scanChineseTypography } from '../domains/editor/extensions/typographyDiagnostics';
import {
  headingDiagnosticsToPrismDiagnostics,
  imageDiagnosticsToPrismDiagnostics,
  linkDiagnosticsToPrismDiagnostics,
  tableDiagnosticsToPrismDiagnostics,
} from '../domains/diagnostics/adapters';
import { getActionableErrorDiagnostics, type PrismDiagnostic } from '../domains/diagnostics/types';
import { onAppEvent } from '../platform/events/appEvents';

type CurrentDocument = ReturnType<typeof useDocumentStore.getState>['currentDocument'];

interface UseDocumentDiagnosticsModelInput {
  currentDocument: CurrentDocument;
  existsPath: (path: string) => Promise<boolean>;
  fileTree: FileNode[];
  jumpToLine: (line: number) => void;
  rootPath: string | null;
}

export function useDocumentDiagnosticsModel({
  currentDocument,
  existsPath,
  fileTree,
  jumpToLine,
  rootPath,
}: UseDocumentDiagnosticsModelInput) {
  const [linkDiagnosticsVisible, setLinkDiagnosticsVisible] = useState(false);
  const [imageDiagnostics, setImageDiagnostics] = useState<ImageDiagnostic[]>([]);
  const [renderDiagnostics, setRenderDiagnostics] = useState<PrismDiagnostic[]>([]);
  const [preflightDiagnostics, setPreflightDiagnostics] = useState<PrismDiagnostic[] | null>(null);
  const [typographyDiagnostics, setTypographyDiagnostics] = useState<ReturnType<typeof scanChineseTypography>>([]);
  const [typographyDiagnosticsVisible, setTypographyDiagnosticsVisible] = useState(false);

  const workspaceFilePaths = useMemo(
    () => flattenFiles(fileTree, rootPath).map(({ node }) => node.path),
    [fileTree, rootPath],
  );

  const normalizedWorkspaceFiles = useMemo(
    () => createMarkdownLinkWorkspaceFileSet(workspaceFilePaths),
    [workspaceFilePaths],
  );

  const linkDiagnostics = useMemo(() => {
    if (!currentDocument) return [];
    return scanMarkdownLinks(currentDocument.content, {
      currentPath: currentDocument.path || undefined,
      normalizedWorkspaceFiles,
      workspaceRoot: rootPath,
    });
  }, [currentDocument?.content, currentDocument?.path, normalizedWorkspaceFiles, rootPath]);

  const headingDiagnostics = useMemo(
    () => currentDocument ? scanHeadingAnchorDiagnostics(currentDocument.content) : [],
    [currentDocument?.content],
  );

  useEffect(() => {
    let cancelled = false;
    if (!currentDocument) {
      setImageDiagnostics([]);
      return () => {
        cancelled = true;
      };
    }

    void scanMarkdownImageDiagnostics(currentDocument.content, {
      documentPath: currentDocument.path || undefined,
      existsPath,
    }).then((diagnostics) => {
      if (!cancelled) setImageDiagnostics(diagnostics);
    });

    return () => {
      cancelled = true;
    };
  }, [currentDocument?.content, currentDocument?.path, existsPath]);

  useEffect(() => {
    let cancelled = false;
    if (!currentDocument) {
      setRenderDiagnostics([]);
      return () => {
        cancelled = true;
      };
    }

    const timer = window.setTimeout(() => {
      void import('../domains/export/preflight')
        .then(({ scanMarkdownRenderDiagnostics }) => scanMarkdownRenderDiagnostics(currentDocument.content, {
          includePreviewRenderCheck: false,
        }))
        .then((diagnostics) => {
          if (!cancelled) setRenderDiagnostics(diagnostics);
        })
        .catch(() => {
          if (!cancelled) setRenderDiagnostics([]);
        });
    }, 350);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [currentDocument?.content]);

  const handleLinkDiagnosticsClick = useCallback(() => {
    if (linkDiagnostics.length + imageDiagnostics.length + headingDiagnostics.length + renderDiagnostics.length === 0) return;
    setLinkDiagnosticsVisible(true);
  }, [headingDiagnostics.length, imageDiagnostics.length, linkDiagnostics.length, renderDiagnostics.length]);

  const handleSelectDocumentDiagnostic = useCallback((line: number) => {
    setLinkDiagnosticsVisible(false);
    setPreflightDiagnostics(null);
    jumpToLine(line);
  }, [jumpToLine]);

  const closeDocumentDiagnostics = useCallback(() => {
    setLinkDiagnosticsVisible(false);
    setPreflightDiagnostics(null);
  }, []);

  useEffect(() => {
    return onAppEvent('diagnostics.open', ({ diagnostics }) => {
      if (diagnostics) setPreflightDiagnostics(diagnostics);
      setLinkDiagnosticsVisible(true);
    });
  }, []);

  useEffect(() => {
    if (
      linkDiagnostics.length + imageDiagnostics.length + headingDiagnostics.length + renderDiagnostics.length === 0
      && !preflightDiagnostics
    ) {
      setLinkDiagnosticsVisible(false);
    }
  }, [headingDiagnostics.length, imageDiagnostics.length, linkDiagnostics.length, preflightDiagnostics, renderDiagnostics.length]);

  useEffect(() => {
    setPreflightDiagnostics(null);
  }, [currentDocument?.content, currentDocument?.path]);

  const tableDiagnostics = useMemo(
    () => currentDocument ? scanMarkdownTableDiagnostics(currentDocument.content) : [],
    [currentDocument?.content],
  );

  const documentDiagnostics = useMemo(() => [
    ...linkDiagnosticsToPrismDiagnostics(linkDiagnostics),
    ...headingDiagnosticsToPrismDiagnostics(headingDiagnostics),
    ...imageDiagnosticsToPrismDiagnostics(imageDiagnostics),
    ...renderDiagnostics,
    ...tableDiagnosticsToPrismDiagnostics(tableDiagnostics),
  ], [headingDiagnostics, imageDiagnostics, linkDiagnostics, renderDiagnostics, tableDiagnostics]);

  const actionableDiagnostics = useMemo(
    () => getActionableErrorDiagnostics(documentDiagnostics),
    [documentDiagnostics],
  );

  const handleTypographyDiagnosticsClick = useCallback(() => {
    if (!currentDocument) return;
    setTypographyDiagnosticsVisible(true);
  }, [currentDocument]);

  const handleSelectTypographyDiagnostic = useCallback((line: number) => {
    setTypographyDiagnosticsVisible(false);
    jumpToLine(line);
  }, [jumpToLine]);

  useEffect(() => {
    if (!currentDocument) {
      setTypographyDiagnostics([]);
      setTypographyDiagnosticsVisible(false);
      return;
    }
    if (!typographyDiagnosticsVisible) {
      setTypographyDiagnostics([]);
      return;
    }
    const diagnostics = scanChineseTypography(currentDocument.content);
    setTypographyDiagnostics(diagnostics);
    if (diagnostics.length === 0) {
      setTypographyDiagnosticsVisible(false);
    }
  }, [currentDocument?.content, currentDocument?.path, typographyDiagnosticsVisible]);

  return {
    actionableDiagnostics,
    closeDocumentDiagnostics,
    displayedDiagnostics: preflightDiagnostics ?? actionableDiagnostics,
    documentDiagnostics,
    firstActionableDiagnostic: actionableDiagnostics[0] ?? null,
    firstTypographyDiagnostic: typographyDiagnostics[0] ?? null,
    handleLinkDiagnosticsClick,
    handleSelectDocumentDiagnostic,
    handleSelectTypographyDiagnostic,
    handleTypographyDiagnosticsClick,
    linkDiagnosticsVisible,
    setTypographyDiagnosticsVisible,
    typographyDiagnostics,
    typographyDiagnosticsVisible,
  };
}
