import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FileNode } from '../domains/workspace/types';
import { flattenFiles } from '../domains/workspace/services';
import type { useDocumentStore } from '../domains/document/store';
import {
  createMarkdownLinkWorkspaceFileSet,
  getLinkTargetPath,
  getLinkTargetPathCandidates,
  scanMarkdownLinks,
  type LinkDiagnostic,
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
  const [manualDiagnosticsOpen, setManualDiagnosticsOpen] = useState(false);
  const [imageDiagnostics, setImageDiagnostics] = useState<ImageDiagnostic[]>([]);
  const [renderDiagnostics, setRenderDiagnostics] = useState<PrismDiagnostic[]>([]);
  const [preflightDiagnostics, setPreflightDiagnostics] = useState<PrismDiagnostic[] | null>(null);
  const [typographyDiagnostics, setTypographyDiagnostics] = useState<ReturnType<typeof scanChineseTypography>>([]);
  const [typographyDiagnosticsVisible, setTypographyDiagnosticsVisible] = useState(false);
  const supportsMarkdownDiagnostics = currentDocument?.profile?.kind !== 'text';

  const workspaceFilePaths = useMemo(
    () => flattenFiles(fileTree, rootPath).map(({ node }) => node.path),
    [fileTree, rootPath],
  );

  const normalizedWorkspaceFiles = useMemo(
    () => createMarkdownLinkWorkspaceFileSet(workspaceFilePaths),
    [workspaceFilePaths],
  );

  const linkDiagnostics = useMemo(() => {
    if (!currentDocument || !supportsMarkdownDiagnostics) return [];
    return scanMarkdownLinks(currentDocument.content, {
      currentPath: currentDocument.path || undefined,
      normalizedWorkspaceFiles,
      workspaceRoot: rootPath,
    });
  }, [currentDocument?.content, currentDocument?.path, normalizedWorkspaceFiles, rootPath, supportsMarkdownDiagnostics]);

  /* 工作区文件树只索引可打开的文档类型，LICENSE、图片等真实存在的文件不在其中。
     索引未命中时再按绝对路径查一次磁盘，避免把「不在索引里」当成「文件不存在」。
     用目标集合的内容签名做依赖，文件树引用变化时不会把复核结果反复重置。 */
  const missingLinkTargetsKey = useMemo(() => [...new Set(
    linkDiagnostics
      .filter((diagnostic) => diagnostic.kind === 'missing-file')
      .map((diagnostic) => diagnostic.target),
  )].join('\u0000'), [linkDiagnostics]);
  const [diskExistingLinkTargets, setDiskExistingLinkTargets] = useState<{
    key: string;
    targets: Set<string>;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const missingTargets = missingLinkTargetsKey ? missingLinkTargetsKey.split('\u0000') : [];
    if (missingTargets.length === 0) {
      setDiskExistingLinkTargets({ key: missingLinkTargetsKey, targets: new Set() });
      return () => { cancelled = true; };
    }

    const timer = window.setTimeout(() => {
      void Promise.all(missingTargets.map(async (target) => {
        const candidates = getLinkTargetPathCandidates(getLinkTargetPath(target), {
          currentPath: currentDocument?.path || undefined,
          workspaceRoot: rootPath,
        });
        let answered = false;
        for (const candidate of candidates) {
          try {
            if (await existsPath(candidate)) return target;
            answered = true;
          } catch {
            // 单个候选查询失败时继续尝试其余候选
          }
        }
        // 全部查询失败时不臆断文件缺失，宁可漏报也不误报
        return answered ? null : target;
      })).then((existingTargets) => {
        if (!cancelled) {
          setDiskExistingLinkTargets({
            key: missingLinkTargetsKey,
            targets: new Set(existingTargets.filter((target): target is string => target !== null)),
          });
        }
      });
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [currentDocument?.path, existsPath, missingLinkTargetsKey, rootPath]);

  const confirmedLinkDiagnostics = useMemo<LinkDiagnostic[]>(() => {
    const diskTargets = diskExistingLinkTargets?.key === missingLinkTargetsKey
      ? diskExistingLinkTargets.targets
      : null;
    if (diskTargets === null) {
      return linkDiagnostics.filter((diagnostic) => diagnostic.kind !== 'missing-file');
    }
    return linkDiagnostics.filter(
      (diagnostic) => diagnostic.kind !== 'missing-file' || !diskTargets.has(diagnostic.target),
    );
  }, [diskExistingLinkTargets, linkDiagnostics, missingLinkTargetsKey]);

  const headingDiagnostics = useMemo(
    () => currentDocument && supportsMarkdownDiagnostics ? scanHeadingAnchorDiagnostics(currentDocument.content) : [],
    [currentDocument?.content, supportsMarkdownDiagnostics],
  );

  useEffect(() => {
    let cancelled = false;
    if (!currentDocument || !supportsMarkdownDiagnostics) {
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
  }, [currentDocument?.content, currentDocument?.path, existsPath, supportsMarkdownDiagnostics]);

  useEffect(() => {
    let cancelled = false;
    if (!currentDocument || !supportsMarkdownDiagnostics) {
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
  }, [currentDocument?.content, supportsMarkdownDiagnostics]);

  const tableDiagnostics = useMemo(
    () => currentDocument && supportsMarkdownDiagnostics ? scanMarkdownTableDiagnostics(currentDocument.content) : [],
    [currentDocument?.content, supportsMarkdownDiagnostics],
  );

  const documentDiagnostics = useMemo(() => [
    ...linkDiagnosticsToPrismDiagnostics(confirmedLinkDiagnostics),
    ...headingDiagnosticsToPrismDiagnostics(headingDiagnostics),
    ...imageDiagnosticsToPrismDiagnostics(imageDiagnostics),
    ...renderDiagnostics,
    ...tableDiagnosticsToPrismDiagnostics(tableDiagnostics),
  ], [confirmedLinkDiagnostics, headingDiagnostics, imageDiagnostics, renderDiagnostics, tableDiagnostics]);

  const actionableDiagnostics = useMemo(
    () => getActionableErrorDiagnostics(documentDiagnostics),
    [documentDiagnostics],
  );

  const openDocumentDiagnostics = useCallback(() => {
    if (!supportsMarkdownDiagnostics) return;
    setPreflightDiagnostics(null);
    setManualDiagnosticsOpen(true);
    setLinkDiagnosticsVisible(true);
  }, [supportsMarkdownDiagnostics]);

  const handleSelectDocumentDiagnostic = useCallback((line: number) => {
    setLinkDiagnosticsVisible(false);
    setManualDiagnosticsOpen(false);
    setPreflightDiagnostics(null);
    jumpToLine(line);
  }, [jumpToLine]);

  const closeDocumentDiagnostics = useCallback(() => {
    setLinkDiagnosticsVisible(false);
    setManualDiagnosticsOpen(false);
    setPreflightDiagnostics(null);
  }, []);

  useEffect(() => {
    return onAppEvent('diagnostics.open', ({ diagnostics }) => {
      if (!supportsMarkdownDiagnostics) return;
      if (diagnostics) setPreflightDiagnostics(diagnostics);
      setManualDiagnosticsOpen(false);
      setLinkDiagnosticsVisible(true);
    });
  }, [supportsMarkdownDiagnostics]);

  useEffect(() => {
    if (
      !manualDiagnosticsOpen
      && confirmedLinkDiagnostics.length + imageDiagnostics.length + headingDiagnostics.length + renderDiagnostics.length === 0
      && !preflightDiagnostics
    ) {
      setLinkDiagnosticsVisible(false);
    }
  }, [confirmedLinkDiagnostics.length, headingDiagnostics.length, imageDiagnostics.length, manualDiagnosticsOpen, preflightDiagnostics, renderDiagnostics.length]);

  useEffect(() => {
    setPreflightDiagnostics(null);
  }, [currentDocument?.content, currentDocument?.path]);

  const handleTypographyDiagnosticsClick = useCallback(() => {
    if (!currentDocument || !supportsMarkdownDiagnostics) return;
    setTypographyDiagnosticsVisible(true);
  }, [currentDocument, supportsMarkdownDiagnostics]);

  const handleSelectTypographyDiagnostic = useCallback((line: number) => {
    setTypographyDiagnosticsVisible(false);
    jumpToLine(line);
  }, [jumpToLine]);

  useEffect(() => {
    if (!currentDocument || !supportsMarkdownDiagnostics) {
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
  }, [currentDocument?.content, currentDocument?.path, supportsMarkdownDiagnostics, typographyDiagnosticsVisible]);

  return {
    actionableDiagnostics,
    closeDocumentDiagnostics,
    displayedDiagnostics: preflightDiagnostics ?? actionableDiagnostics,
    documentDiagnostics,
    firstTypographyDiagnostic: typographyDiagnostics[0] ?? null,
    handleSelectDocumentDiagnostic,
    handleSelectTypographyDiagnostic,
    handleTypographyDiagnosticsClick,
    linkDiagnosticsVisible,
    openDocumentDiagnostics,
    setTypographyDiagnosticsVisible,
    typographyDiagnostics,
    typographyDiagnosticsVisible,
  };
}
