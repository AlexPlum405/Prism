import { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { useDocumentStore } from './domains/document/store';
import { useSettingsStore } from './domains/settings/store';
import { useWorkspaceStore } from './domains/workspace/store';
import { useWorkspaceFocusRefresh } from './domains/workspace/hooks/useWorkspaceFocusRefresh';
import { useAutoSave } from './domains/document/hooks/useAutoSave';
import { useExternalFileChangeMonitor } from './domains/document/hooks/useExternalFileChangeMonitor';
import { useRecoveryQueue } from './domains/document/hooks/useRecoveryQueue';
import { useWorkspaceIndexModel } from './domains/workspace/hooks/useWorkspaceIndexModel';
import { useAppToast } from './hooks/useAppToast';
import { useExportTaskUi } from './hooks/useExportTaskUi';
import { DocumentView } from './domains/document/components/DocumentView';
import { RecoveryModal } from './domains/document/components/RecoveryModal';
import { SaveConflictModal, type SaveConflictAction } from './domains/document/components/SaveConflictModal';
import {
  overwriteConflictedDocument,
  reloadConflictedDocument,
  saveConflictedDocumentAs,
} from './domains/document/services/conflictResolution';
import { StatusBar } from './domains/workspace/components/StatusBar';
import { Sidebar } from './domains/workspace/components/Sidebar';
import { BacklinksPanel } from './domains/workspace/components/BacklinksPanel';
import { DocumentLinksPanel } from './domains/workspace/components/DocumentLinksPanel';
import { RelationGraphPanel } from './domains/workspace/components/RelationGraphPanel';
import { createFileTreeContextMenuItems } from './domains/workspace/components/fileTreeContextMenu';
import { useBootstrap } from './hooks/useBootstrap';
import { exists as fsExists } from '@tauri-apps/plugin-fs';
import { open } from '@tauri-apps/plugin-dialog';
import { downloadDir, homeDir } from '@tauri-apps/api/path';
import { emitAppEvent, onAppEvent } from './platform/events/appEvents';
import { EditorPaneHandle } from './domains/editor/components/EditorPane';
import { DocumentPropertiesPanel } from './domains/editor/components/DocumentPropertiesPanel';
import { DocumentDiagnosticsPanel } from './domains/editor/components/DocumentDiagnosticsPanel';
import { TypographyDiagnosticsPanel } from './domains/editor/components/TypographyDiagnosticsPanel';
import { scanMarkdownLinks } from './domains/editor/extensions/linkDiagnostics';
import { scanMarkdownImageDiagnostics, type ImageDiagnostic } from './domains/editor/extensions/imageDiagnostics';
import { scanHeadingAnchorDiagnostics } from './domains/editor/extensions/headingDiagnostics';
import { scanMarkdownTableDiagnostics } from './domains/editor/extensions/tables';
import { scanChineseTypography } from './domains/editor/extensions/typographyDiagnostics';
import {
  headingDiagnosticsToPrismDiagnostics,
  imageDiagnosticsToPrismDiagnostics,
  linkDiagnosticsToPrismDiagnostics,
  tableDiagnosticsToPrismDiagnostics,
  typographyDiagnosticsToPrismDiagnostics,
} from './domains/diagnostics/adapters';
import { getActionableErrorDiagnostics, type PrismDiagnostic } from './domains/diagnostics/types';
import type { ExportFormat } from './domains/export';
import { getExportFormatLabel } from './domains/export';
import { scanMarkdownRenderDiagnostics } from './domains/export/preflight';
import {
  getLocalizedExportQualityPreset,
  getLocalizedExportQualityPresets,
  normalizeExportQualityScale,
} from './domains/export/quality';
import { WindowShell } from './components/shell/WindowShell';
import { TitleBar } from './components/shell/TitleBar';
import { MenuBar } from './components/shell/MenuBar';
import { executeFileAction, FileActionInput } from './lib/fileActions';
import { grantWorkspaceDirectoryScope } from './lib/fileSystemScope';
import { ContextMenu, type ContextMenuItem } from './components/shell/ContextMenu';
import { ShortcutPanel } from './components/shell/ShortcutPanel';
import { CommandPalette, type CommandPaletteMode } from './components/shell/CommandPalette';
import { AboutModal } from './components/shell/AboutModal';
import { SettingsModal } from './components/shell/SettingsModal';
import { Toast } from './components/shell/Toast';
import {
  findCommandByKeyboardEvent,
  getCommandMenuItems,
  getMenuSections,
  isCommandId,
  runCommand,
  type CommandContext,
} from './domains/commands';
import {
  basename,
  type BacklinkReference,
  computeWritingStats,
  dirname,
  extractDocumentLinks,
  flattenFiles,
  getWorkspaceIndexBacklinks,
  getWorkspaceIndexLinkFiles,
  getRuntimePlatform,
  isSamePath,
  joinPath,
  type DocumentLinkReference,
  resolveDocumentLinkTarget,
} from './domains/workspace/services';
import type { ExportDefaultLocation } from './domains/settings/types';
import { t, useI18n } from './domains/i18n';

const exportExtensionByFormat: Record<ExportFormat, string> = {
  html: 'html',
  pdf: 'pdf',
  docx: 'docx',
  png: 'png',
};

const MARKDOWN_FILE_RE = /\.(md|markdown|txt)$/i;

function stripMarkdownExtension(filename: string) {
  return filename.replace(/\.(md|markdown|txt)$/i, '') || 'Untitled';
}

function ensureExportExtension(filename: string, format: ExportFormat) {
  const extension = exportExtensionByFormat[format];
  const trimmed = filename.trim();
  if (!trimmed) return `Untitled.${extension}`;
  return trimmed.toLowerCase().endsWith(`.${extension}`) ? trimmed : `${trimmed}.${extension}`;
}

function ensureMarkdownExtension(filename: string) {
  const trimmed = filename.trim();
  if (!trimmed) return 'Untitled.md';
  return /\.(md|markdown)$/i.test(trimmed) ? trimmed : `${trimmed}.md`;
}

function defaultExportFilename(filename: string, format: ExportFormat) {
  return ensureExportExtension(stripMarkdownExtension(filename), format);
}

function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function emitExportProgress(message: string | null) {
  emitAppEvent('export.progress', message ? { visible: true, message } : { visible: false });
}

async function resolveDefaultExportDirectory(input: {
  defaultLocation: ExportDefaultLocation;
  customDirectory: string;
  documentPath?: string;
  rootPath?: string | null;
  showToast?: (message: string) => void;
}) {
  const fallback = input.documentPath
    ? dirname(input.documentPath)
    : input.rootPath || await homeDir();

  if (input.defaultLocation === 'ask' || input.defaultLocation === 'document') {
    return fallback;
  }

  if (input.defaultLocation === 'downloads') {
    try {
      return await downloadDir();
    } catch {
      return fallback;
    }
  }

  const customDirectory = input.customDirectory.trim();
  if (customDirectory) {
    try {
      await grantWorkspaceDirectoryScope(customDirectory);
      if (await fsExists(customDirectory)) return customDirectory;
    } catch {
      // Fall through to toast and fallback.
    }
  }

  input.showToast?.(t('app.defaultExportDirectoryUnavailable'));
  return fallback;
}

type SaveDialogKind = 'export' | 'markdown';

interface SaveDialogState {
  kind: SaveDialogKind;
  format?: ExportFormat;
  directory: string;
  filename: string;
  qualityScale?: number;
  error: string | null;
  pendingOverwritePath: string | null;
  resolve: (result: string | { path: string; qualityScale?: number } | null) => void;
}

interface RecoveryPromptVisibilityInput {
  hasSnapshot: boolean;
  hasSaveDialog: boolean;
  hasSaveConflict: boolean;
}

export function shouldShowRecoveryPrompt({
  hasSnapshot,
  hasSaveDialog,
  hasSaveConflict,
}: RecoveryPromptVisibilityInput) {
  return hasSnapshot && !hasSaveDialog && !hasSaveConflict;
}

function getSaveDialogTitle(dialog: SaveDialogState) {
  if (dialog.kind === 'export' && dialog.format) {
    return t('app.exportTitle', { format: getExportFormatLabel(dialog.format) });
  }
  return t('app.saveMarkdown');
}

function getSaveDialogPrimaryLabel(dialog: SaveDialogState) {
  return dialog.kind === 'export' ? t('common.export') : t('common.save');
}

function getSaveDialogOverwriteText(dialog: SaveDialogState) {
  return dialog.kind === 'export'
    ? t('app.exportOverwriteText')
    : t('app.saveOverwriteText');
}

function formatAppError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error instanceof Event) return error.type || t('common.unknownEventError');
  return String(error);
}

function App() {
  const { locale, localePreference } = useI18n();
  const currentDocument = useDocumentStore((s) => s.currentDocument);

  const loadSettings = useSettingsStore((s) => s.loadSettings);
  const contentTheme = useSettingsStore((s) => s.contentTheme);
  const settingsLocale = useSettingsStore((s) => s.locale);
  const shortcutStyle = useSettingsStore((s) => s.shortcutStyle);
  const autoSaveInterval = useSettingsStore((s) => s.autoSaveInterval);
  const autoSaveEnabled = useSettingsStore((s) => s.autoSaveEnabled);
  const wordWrap = useSettingsStore((s) => s.wordWrap);
  const exportDefaults = useSettingsStore((s) => s.exportDefaults);
  const recentFiles = useSettingsStore((s) => s.recentFiles);
  const themeRegistryVersion = useSettingsStore((s) => s.themeRegistryVersion);
  const workspace = useWorkspaceStore();

  const editorRef = useRef<EditorPaneHandle>(null);
  const [cursor, setCursor] = useState({ line: 1, column: 1 });
  const [selectionText, setSelectionText] = useState('');
  const [isSidebarHovered, setIsSidebarHovered] = useState(false);
  const [globalContextMenu, setGlobalContextMenu] = useState<{
    x: number;
    y: number;
    items: ContextMenuItem[];
    kind: 'file' | 'menu';
  } | null>(null);
  const [saveDialog, setSaveDialog] = useState<SaveDialogState | null>(null);
  const [shortcutPanelVisible, setShortcutPanelVisible] = useState(false);
  const [commandPaletteVisible, setCommandPaletteVisible] = useState(false);
  const [commandPaletteMode, setCommandPaletteMode] = useState<CommandPaletteMode>('files');
  const [aboutVisible, setAboutVisible] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [linkDiagnosticsVisible, setLinkDiagnosticsVisible] = useState(false);
  const [imageDiagnostics, setImageDiagnostics] = useState<ImageDiagnostic[]>([]);
  const [renderDiagnostics, setRenderDiagnostics] = useState<PrismDiagnostic[]>([]);
  const [preflightDiagnostics, setPreflightDiagnostics] = useState<PrismDiagnostic[] | null>(null);
  const [documentLinksVisible, setDocumentLinksVisible] = useState(false);
  const [backlinksVisible, setBacklinksVisible] = useState(false);
  const [relationGraphVisible, setRelationGraphVisible] = useState(false);
  const [backlinks, setBacklinks] = useState<BacklinkReference[]>([]);
  const [pendingBacklinkJump, setPendingBacklinkJump] = useState<{
    line: number;
    path: string;
  } | null>(null);
  const [documentPropertiesVisible, setDocumentPropertiesVisible] = useState(false);
  const [typographyDiagnosticsVisible, setTypographyDiagnosticsVisible] = useState(false);
  const [conflictAction, setConflictAction] = useState<SaveConflictAction | null>(null);
  const [settingsReady, setSettingsReady] = useState(false);
  useBootstrap(settingsReady);
  useAutoSave(autoSaveInterval, autoSaveEnabled);
  useExternalFileChangeMonitor();
  useWorkspaceFocusRefresh(settingsReady);

  const {
    workspaceIndex,
    workspaceIndexing,
  } = useWorkspaceIndexModel({
    currentDocument,
    fileTree: workspace.fileTree,
    rootPath: workspace.rootPath,
    recentFiles,
  });

  useEffect(() => {
    const platform = getRuntimePlatform();
    document.documentElement.setAttribute('data-platform', platform);
    document.body.classList.add(`platform-${platform}`);

    return () => {
      if (document.documentElement.getAttribute('data-platform') === platform) {
        document.documentElement.removeAttribute('data-platform');
      }
      document.body.classList.remove(`platform-${platform}`);
    };
  }, []);

  useEffect(() => {
    setSelectionText('');
  }, [currentDocument?.path]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    let changed = false;
    if (currentDocument?.path) {
      if (params.get('file') !== currentDocument.path) {
        params.set('file', currentDocument.path);
        changed = true;
      }
    }
    if (workspace.rootPath) {
      if (params.get('folder') !== workspace.rootPath) {
        params.set('folder', workspace.rootPath);
        changed = true;
      }
    }
    if (changed) {
      const newUrl = `${window.location.pathname}?${params.toString()}`;
      window.history.replaceState({ path: newUrl }, '', newUrl);
    }
  }, [currentDocument?.path, workspace.rootPath]);

  useEffect(() => {
    let cancelled = false;
    setSettingsReady(false);
    loadSettings()
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setSettingsReady(true);
      });

    return () => {
      cancelled = true;
    };
  }, [loadSettings]);

  useEffect(() => {
    document.body.classList.toggle('focus-mode', workspace.focusMode);
  }, [workspace.focusMode]);

  useEffect(() => {
    document.body.classList.toggle('typewriter-mode', workspace.typewriterMode);
  }, [workspace.typewriterMode]);

  useEffect(() => {
    if (!settingsReady) return;

    const timer = window.setTimeout(() => {
      const doc = useDocumentStore.getState().currentDocument;
      const ws = useWorkspaceStore.getState();
      useSettingsStore.getState().setLastSession(
        doc?.path || ws.rootPath
          ? {
              filePath: doc?.path || undefined,
              folderPath: ws.rootPath || undefined,
              viewMode: doc?.viewMode,
              scrollState: doc?.scrollState,
              sidebarVisible: ws.sidebarVisible,
              sidebarTab: ws.sidebarTab,
              updatedAt: Date.now(),
            }
          : null,
      );
    }, 500);

    return () => window.clearTimeout(timer);
  }, [
    currentDocument?.path,
    currentDocument?.scrollState?.editorRatio,
    currentDocument?.scrollState?.previewRatio,
    currentDocument?.viewMode,
    settingsReady,
    workspace.rootPath,
    workspace.sidebarTab,
    workspace.sidebarVisible,
  ]);

  const { toast, showToast, dismissToast } = useAppToast();
  const {
    exportProgress,
    exportProgressInBackground,
    exportFailure,
    sendExportProgressToBackground,
    showBackgroundExportProgress,
    dismissExportFailure,
    copyExportFailureDiagnostic,
  } = useExportTaskUi(showToast);

  const {
    activeRecoverySnapshot,
    recoveryAction,
    handleRestoreRecovery,
    handleDiscardRecovery,
  } = useRecoveryQueue({ showToast });

  const linkDiagnostics = useMemo(() => {
    if (!currentDocument) return [];
    return scanMarkdownLinks(currentDocument.content, {
      currentPath: currentDocument.path || undefined,
      workspaceFiles: flattenFiles(workspace.fileTree, workspace.rootPath).map(({ node }) => node.path),
      workspaceRoot: workspace.rootPath,
    });
  }, [currentDocument, workspace.fileTree, workspace.rootPath]);
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
      existsPath: fsExists,
    }).then((diagnostics) => {
      if (!cancelled) setImageDiagnostics(diagnostics);
    });

    return () => {
      cancelled = true;
    };
  }, [currentDocument?.content, currentDocument?.path]);

  useEffect(() => {
    let cancelled = false;
    if (!currentDocument) {
      setRenderDiagnostics([]);
      return () => {
        cancelled = true;
      };
    }

    const timer = window.setTimeout(() => {
      void scanMarkdownRenderDiagnostics(currentDocument.content)
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

  const documentLinks = useMemo(
    () => currentDocument ? extractDocumentLinks(currentDocument.content) : [],
    [currentDocument?.content],
  );

  const handleLinkDiagnosticsClick = useCallback(() => {
    if (linkDiagnostics.length + imageDiagnostics.length + headingDiagnostics.length + renderDiagnostics.length === 0) return;
    setLinkDiagnosticsVisible(true);
  }, [headingDiagnostics.length, imageDiagnostics.length, linkDiagnostics.length, renderDiagnostics.length]);

  const handleSelectDocumentDiagnostic = useCallback((line: number) => {
    setLinkDiagnosticsVisible(false);
    setPreflightDiagnostics(null);
    editorRef.current?.jumpToLine(line);
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

  useEffect(() => {
    if (!currentDocument?.path || !workspaceIndex) {
      setBacklinks([]);
      return;
    }

    setBacklinks(getWorkspaceIndexBacklinks(workspaceIndex, currentDocument.path));
  }, [currentDocument?.path, workspaceIndex]);

  const handleBacklinksClick = useCallback(() => {
    setBacklinksVisible(true);
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
      editorRef.current?.jumpToLine(line);
      setPendingBacklinkJump((pending) => (
        pending && pending.line === line && isSamePath(pending.path, path) ? null : pending
      ));
    });

    return () => window.cancelAnimationFrame(frame);
  }, [currentDocument?.path, pendingBacklinkJump]);

  const handleApplyDocumentProperties = useCallback((content: string) => {
    useDocumentStore.getState().updateContent(content);
  }, []);

  const typographyDiagnostics = useMemo(
    () => currentDocument ? scanChineseTypography(currentDocument.content) : [],
    [currentDocument?.content],
  );
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
    ...typographyDiagnosticsToPrismDiagnostics(typographyDiagnostics),
  ], [headingDiagnostics, imageDiagnostics, linkDiagnostics, renderDiagnostics, tableDiagnostics, typographyDiagnostics]);
  const actionableDiagnostics = useMemo(
    () => getActionableErrorDiagnostics(documentDiagnostics),
    [documentDiagnostics],
  );
  const firstActionableDiagnostic = actionableDiagnostics[0] ?? null;
  const displayedDiagnostics = preflightDiagnostics ?? actionableDiagnostics;

  const firstTypographyDiagnostic = typographyDiagnostics[0] ?? null;
  const handleTypographyDiagnosticsClick = useCallback(() => {
    if (typographyDiagnostics.length === 0) return;
    setTypographyDiagnosticsVisible(true);
  }, [typographyDiagnostics.length]);

  const handleSelectTypographyDiagnostic = useCallback((line: number) => {
    setTypographyDiagnosticsVisible(false);
    editorRef.current?.jumpToLine(line);
  }, []);

  useEffect(() => {
    if (typographyDiagnostics.length === 0) {
      setTypographyDiagnosticsVisible(false);
    }
  }, [typographyDiagnostics.length]);

  const handleFileAction = useCallback(async (input: FileActionInput) => {
    await executeFileAction(input, {
      documentStore: useDocumentStore.getState(),
      workspaceStore: useWorkspaceStore.getState(),
      showToast,
    });
  }, [showToast]);

  useEffect(() => {
    let mounted = true;
    const openPendingFiles = async () => {
      try {
        const paths = await invoke<string[]>('get_pending_files');
        if (paths.length > 0 && mounted) {
          await handleFileAction({ action: 'openFile', path: paths[0] });
          return true;
        }
      } catch {
        // Pending file integration is best effort.
      }
      return false;
    };

    const unlisten = listen<string[]>('file-opened', (event) => {
      const paths = event.payload;
      if (paths.length > 0 && mounted) {
        handleFileAction({ action: 'openFile', path: paths[0] });
      }
    });

    void (async () => {
      for (const waitMs of [200, 800]) {
        await delay(waitMs);
        if (!mounted) return;
        if (await openPendingFiles()) return;
      }
    })();

    return () => {
      mounted = false;
      unlisten.then(fn => fn());
    };
  }, [handleFileAction]);

  const handleFileClick = useCallback(async (path: string) => {
    await handleFileAction({ action: 'openFile', path });
  }, [handleFileAction]);

  const handleOpenDocumentLink = useCallback(async (
    target: string,
    options: { kind: 'markdown' | 'wiki'; sourcePath?: string },
  ) => {
    if (!workspace.rootPath) {
      showToast(t('app.openWorkspaceFirst'));
      return;
    }

    const workspaceFiles = workspaceIndex
      ? getWorkspaceIndexLinkFiles(workspaceIndex)
      : flattenFiles(workspace.fileTree, workspace.rootPath)
          .map(({ node }) => ({ name: node.name, path: node.path }))
          .filter((file) => MARKDOWN_FILE_RE.test(file.name));
    const resolved = resolveDocumentLinkTarget({
      kind: options.kind,
      target,
      sourcePath: options.sourcePath ?? currentDocument?.path,
      workspaceFiles,
      workspaceRoot: workspace.rootPath,
    });

    if (!resolved) {
      showToast(t('app.linkDocumentNotFound', { target }));
      return;
    }

    await handleFileAction({ action: 'openFile', path: resolved.path });
  }, [
    currentDocument?.path,
    handleFileAction,
    showToast,
    workspaceIndex,
    workspace.fileTree,
    workspace.rootPath,
  ]);

  const handleSelectDocumentLink = useCallback(async (link: DocumentLinkReference) => {
    setDocumentLinksVisible(false);
    await handleOpenDocumentLink(link.target, {
      kind: link.kind,
      sourcePath: currentDocument?.path,
    });
  }, [currentDocument?.path, handleOpenDocumentLink]);

  const handleSelectBacklink = useCallback(async (reference: BacklinkReference) => {
    setBacklinksVisible(false);
    setPendingBacklinkJump({ path: reference.path, line: reference.line });
    await handleFileAction({ action: 'openFile', path: reference.path });
    const opened = useDocumentStore.getState().currentDocument;
    if (!opened?.path || !isSamePath(opened.path, reference.path)) {
      setPendingBacklinkJump(null);
    }
  }, [handleFileAction]);

  const requestExportPath = useCallback(async (input: {
    format: ExportFormat;
    filename: string;
    documentPath?: string;
    suggestedPath?: string;
  }) => {
    const initialDirectory = await resolveDefaultExportDirectory({
      defaultLocation: exportDefaults.defaultLocation,
      customDirectory: exportDefaults.customDirectory,
      documentPath: input.documentPath,
      rootPath: workspace.rootPath,
      showToast,
    });

    return new Promise<string | { path: string; qualityScale?: number } | null>((resolve) => {
      setSaveDialog({
        kind: 'export',
        format: input.format,
        directory: input.suggestedPath ? dirname(input.suggestedPath) : initialDirectory,
        filename: input.suggestedPath ? basename(input.suggestedPath) : defaultExportFilename(input.filename, input.format),
        qualityScale: normalizeExportQualityScale(exportDefaults.pngScale),
        error: null,
        pendingOverwritePath: null,
        resolve,
      });
    });
  }, [
    exportDefaults.customDirectory,
    exportDefaults.defaultLocation,
    exportDefaults.pngScale,
    showToast,
    workspace.rootPath,
  ]);

  const requestMarkdownSavePath = useCallback(async (input: {
    filename: string;
    documentPath?: string;
  }) => {
    const initialDirectory = input.documentPath
      ? dirname(input.documentPath)
      : workspace.rootPath || await homeDir();

    return new Promise<string | null>((resolve) => {
      setSaveDialog({
        kind: 'markdown',
        directory: initialDirectory,
        filename: ensureMarkdownExtension(input.filename),
        error: null,
        pendingOverwritePath: null,
        resolve: (result) => resolve(typeof result === 'string' ? result : null),
      });
    });
  }, [workspace.rootPath]);

  const closeSaveDialog = useCallback((result: string | { path: string; qualityScale?: number } | null = null) => {
    setSaveDialog((dialog) => {
      dialog?.resolve(result);
      return null;
    });
  }, []);

  const chooseSaveDirectory = useCallback(async () => {
    if (!saveDialog) return;
    const selected = await open({
      directory: true,
      multiple: false,
      defaultPath: saveDialog.directory,
    });
    if (!selected || Array.isArray(selected)) return;
    setSaveDialog((dialog) => dialog ? {
      ...dialog,
      directory: selected,
      error: null,
      pendingOverwritePath: null,
    } : null);
  }, [saveDialog]);

  const confirmSaveDialog = useCallback(async (allowOverwrite = false) => {
    if (!saveDialog) return;
    let filename: string;
    if (saveDialog.kind === 'export') {
      const format = saveDialog.format;
      if (!format) {
        setSaveDialog((dialog) => dialog ? {
          ...dialog,
          error: t('app.missingExportFormat'),
          pendingOverwritePath: null,
        } : null);
        return;
      }
      filename = ensureExportExtension(saveDialog.filename, format);
    } else {
      filename = ensureMarkdownExtension(saveDialog.filename);
    }
    if (/[\\/]/.test(filename)) {
      setSaveDialog((dialog) => dialog ? {
        ...dialog,
        error: t('app.filenameCannotContainSeparator'),
        pendingOverwritePath: null,
      } : null);
      return;
    }

    const targetPath = joinPath(saveDialog.directory, filename);
    if (!allowOverwrite) {
      try {
        if (await fsExists(targetPath)) {
          setSaveDialog((dialog) => dialog ? {
            ...dialog,
            filename,
            error: null,
            pendingOverwritePath: targetPath,
          } : null);
          return;
        }
      } catch {
        // If existence check fails, let the actual write surface the error.
      }
    }

    if (saveDialog.kind === 'export') {
      const qualityScale = normalizeExportQualityScale(saveDialog.qualityScale, exportDefaults.pngScale);
      useSettingsStore.getState().setExportPngScale(qualityScale);
      emitExportProgress(t('app.prepareExport'));
      closeSaveDialog({ path: targetPath, qualityScale });
      return;
    }
    closeSaveDialog(targetPath);
  }, [closeSaveDialog, exportDefaults.pngScale, saveDialog]);

  const runConflictAction = useCallback(async (action: SaveConflictAction) => {
    if (conflictAction) return;
    setConflictAction(action);
    try {
      let result: { resolved: boolean; path?: string };
      if (action === 'reload') {
        result = await reloadConflictedDocument();
        if (result.resolved) showToast(t('app.reloadedDiskVersion'));
      } else if (action === 'saveAs') {
        result = await saveConflictedDocumentAs(requestMarkdownSavePath);
        if (result.resolved) showToast(t('app.savedCurrentVersionAs'));
      } else {
        result = await overwriteConflictedDocument();
        if (result.resolved) showToast(t('app.overwroteDiskVersion'));
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

  const createCommandContext = useCallback((): CommandContext => ({
      documentStore: useDocumentStore.getState(),
      settingsStore: useSettingsStore.getState(),
      workspaceStore: useWorkspaceStore.getState(),
      showToast,
      requestExportPath,
      requestSavePath: requestMarkdownSavePath,
      openAbout: () => setAboutVisible(true),
      openSettings: () => setSettingsVisible(true),
      openShortcuts: () => setShortcutPanelVisible(true),
      openQuickOpen: () => {
        setCommandPaletteMode('files');
        setCommandPaletteVisible(true);
      },
      openWorkspaceSearch: () => {
        setCommandPaletteMode('search');
        setCommandPaletteVisible(true);
      },
      openDocumentProperties: () => setDocumentPropertiesVisible(true),
      openDocumentLinks: () => setDocumentLinksVisible(true),
      openBacklinks: handleBacklinksClick,
      openRelationGraph: () => {
        if (!workspaceIndex || workspaceIndex.documents.length === 0) {
          showToast(t('app.openMarkdownWorkspaceFirst'));
          return;
        }
        setRelationGraphVisible(true);
      },
  }), [handleBacklinksClick, requestExportPath, requestMarkdownSavePath, showToast, workspaceIndex]);

  const commandContext = useMemo(() => createCommandContext(), [
    createCommandContext,
    currentDocument?.path,
    currentDocument?.isDirty,
    currentDocument?.viewMode,
    workspace.rootPath,
    workspace.fileTree,
    workspace.sidebarVisible,
    workspace.sidebarTab,
    workspace.statusBarVisible,
    workspace.focusMode,
    workspace.typewriterMode,
    workspace.isFullscreen,
    workspace.isAlwaysOnTop,
    contentTheme,
    themeRegistryVersion,
    shortcutStyle,
    wordWrap,
    exportDefaults,
    locale,
    localePreference,
    settingsLocale,
    recentFiles,
  ]);

  const menuSections = useMemo(
    () => getMenuSections(commandContext),
    [commandContext],
  );

  const handleCommandAction = useCallback(async (action: string) => {
    if (action.startsWith('setTheme:')) {
      await useSettingsStore.getState().setContentTheme(decodeURIComponent(action.slice('setTheme:'.length)));
      return;
    }

    if (action.startsWith('openRecentFile:')) {
      await handleFileAction({
        action: 'openFile',
        path: decodeURIComponent(action.slice('openRecentFile:'.length)),
      });
      return;
    }

    if (action.startsWith('openWorkspaceFile:')) {
      await handleFileAction({
        action: 'openFile',
        path: decodeURIComponent(action.slice('openWorkspaceFile:'.length)),
      });
      return;
    }

    if (!isCommandId(action)) {
      console.warn(`[Command] Unknown command id: ${action}`);
      showToast(t('app.unknownCommand', { action }));
      return;
    }

    await runCommand(action, createCommandContext());
  }, [createCommandContext, handleFileAction, showToast]);

  const handleAboutCheckUpdate = useCallback(() => {
    setAboutVisible(false);
    void handleCommandAction('checkUpdate');
  }, [handleCommandAction]);

  useEffect(() => {
    return onAppEvent('command.run', ({ action }) => {
      if (action) handleCommandAction(action);
    });
  }, [handleCommandAction]);

  useEffect(() => {
    return onAppEvent('file.action', (detail) => {
      handleFileAction(detail);
    });
  }, [handleFileAction]);

  useEffect(() => {
    return onAppEvent('settings.open', () => setSettingsVisible(true));
  }, []);

  const handleKeyDown = useCallback(async (e: KeyboardEvent) => {
    if (e.key === 'Escape' && workspace.focusMode) {
      workspace.toggleFocusMode();
      return;
    }

    const command = findCommandByKeyboardEvent(e);
    if (command) {
      e.preventDefault();
      await runCommand(command.id, createCommandContext());
    }
  }, [createCommandContext, workspace]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const handleFolderContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    const items = createFileTreeContextMenuItems({
      fileTreeMode: workspace.fileTreeMode,
      fileSortMode: workspace.fileSortMode,
      includeOpenNewWindow: true,
    });
    setGlobalContextMenu({ x: e.clientX, y: e.clientY, items, kind: 'file' });
  };

  const handleExportContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    const items = getCommandMenuItems(
      ['exportWithPrevious', 'exportOverwritePrevious', 'exportPdf', 'exportDocx', 'exportHtml', 'exportPng'],
      createCommandContext(),
    ) as ContextMenuItem[];
    setGlobalContextMenu({ x: e.clientX, y: e.clientY, items, kind: 'menu' });
  };

  const titleDocName = currentDocument?.name ?? t('common.untitled');
  const titleDirty = currentDocument?.isDirty ?? false;
  const hasSaveConflict = currentDocument?.saveStatus === 'conflict' && Boolean(currentDocument.path);
  const recoveryPromptVisible = shouldShowRecoveryPrompt({
    hasSnapshot: Boolean(activeRecoverySnapshot),
    hasSaveDialog: Boolean(saveDialog),
    hasSaveConflict,
  });
  const writingStats = useMemo(
    () => computeWritingStats(currentDocument?.content ?? ''),
    [currentDocument?.content],
  );
  const selectionWritingStats = useMemo(
    () => selectionText.trim() ? computeWritingStats(selectionText) : null,
    [selectionText],
  );

  return (
      <WindowShell>
      <TitleBar docName={titleDocName} isDirty={titleDirty} />
      <MenuBar sections={menuSections} onAction={handleCommandAction} />
      <div className="app-main" style={{ flex: 1, display: 'flex', minHeight: 0, minWidth: 0 }}>
        {workspace.sidebarVisible && (
          <div
            className="app-sidebar"
            onMouseEnter={() => setIsSidebarHovered(true)}
            onMouseLeave={() => setIsSidebarHovered(false)}
            style={{ display: 'flex', flexDirection: 'column' }}
          >
            <Sidebar
              fileTree={workspace.fileTree}
              sidebarTab={workspace.sidebarTab}
              setSidebarTab={workspace.setSidebarTab}
              documentContent={currentDocument?.content ?? ''}
              activePath={currentDocument?.path}
              onFileClick={handleFileClick}
              onOutlineClick={(line) => editorRef.current?.jumpToLine(line)}
            />
          </div>
        )}
        <DocumentView
          key={currentDocument?.path || 'new-doc'}
          ref={editorRef}
          onCursorChange={setCursor}
          onOpenDocumentLink={handleOpenDocumentLink}
          onSelectionTextChange={setSelectionText}
          onNotice={showToast}
          workspaceIndex={workspaceIndex}
        />
      </div>

      {currentDocument && workspace.statusBarVisible && (
        <div className="app-statusbar">
          <StatusBar
            writingStats={writingStats}
            selectionStats={selectionWritingStats}
            cursor={cursor}
            sidebarVisible={workspace.sidebarVisible}
            isSidebarHovered={isSidebarHovered}
            onMouseEnter={() => setIsSidebarHovered(true)}
            onMouseLeave={() => setIsSidebarHovered(false)}
            onExportMenu={handleExportContextMenu}
            onToggleFocusMode={() => workspace.toggleFocusMode()}
            onToggleSidebar={() => workspace.toggleSidebar()}
            onFolderContextMenu={handleFolderContextMenu}
            onNewFile={() => handleFileAction('newFile')}
            onToggleFileTreeMode={() => handleFileAction(workspace.fileTreeMode === 'tree' ? 'viewList' : 'viewTree')}
            linkIssueCount={actionableDiagnostics.length}
            linkIssueTitle={firstActionableDiagnostic?.message}
            onLinkDiagnosticsClick={handleLinkDiagnosticsClick}
            backlinkCount={backlinks.length}
            onBacklinksClick={handleBacklinksClick}
            onDocumentPropertiesClick={() => setDocumentPropertiesVisible(true)}
            typographyIssueCount={typographyDiagnostics.length}
            typographyIssueTitle={firstTypographyDiagnostic?.message}
            onTypographyDiagnosticsClick={handleTypographyDiagnosticsClick}
            onRelationGraphClick={() => setRelationGraphVisible(true)}
            hasSavedPath={Boolean(currentDocument?.path)}
            exportProgress={exportProgress}
            exportProgressInBackground={exportProgressInBackground}
            onShowExportProgress={showBackgroundExportProgress}
          />
        </div>
      )}

      {globalContextMenu && (
        <ContextMenu
          x={globalContextMenu.x}
          y={globalContextMenu.y}
          items={globalContextMenu.items}
          onAction={(action) => {
            if (globalContextMenu.kind === 'file') {
              handleFileAction(action);
            } else {
              handleCommandAction(action);
            }
          }}
          onClose={() => setGlobalContextMenu(null)}
        />
      )}

      <RecoveryModal
        visible={recoveryPromptVisible}
        snapshot={activeRecoverySnapshot}
        busyAction={recoveryAction}
        onRestore={handleRestoreRecovery}
        onDiscard={handleDiscardRecovery}
      />

      <SaveConflictModal
        visible={Boolean(hasSaveConflict && !saveDialog)}
        documentName={currentDocument?.name ?? t('common.untitled')}
        error={currentDocument?.saveError ?? null}
        busyAction={conflictAction}
        onReload={() => runConflictAction('reload')}
        onSaveAs={() => runConflictAction('saveAs')}
        onOverwrite={() => runConflictAction('overwrite')}
      />

      <DocumentDiagnosticsPanel
        visible={linkDiagnosticsVisible}
        diagnostics={displayedDiagnostics}
        onClose={() => {
          setLinkDiagnosticsVisible(false);
          setPreflightDiagnostics(null);
        }}
        onSelect={handleSelectDocumentDiagnostic}
      />

      <BacklinksPanel
        visible={backlinksVisible}
        backlinks={backlinks}
        onClose={() => setBacklinksVisible(false)}
        onSelect={handleSelectBacklink}
      />

      <DocumentLinksPanel
        visible={documentLinksVisible}
        links={documentLinks}
        onClose={() => setDocumentLinksVisible(false)}
        onSelect={handleSelectDocumentLink}
      />

      <RelationGraphPanel
        visible={relationGraphVisible}
        index={workspaceIndex}
        currentPath={currentDocument?.path}
        onClose={() => setRelationGraphVisible(false)}
        onSelect={(path) => {
          setRelationGraphVisible(false);
          void handleFileAction({ action: 'openFile', path });
        }}
      />

      <DocumentPropertiesPanel
        visible={documentPropertiesVisible}
        content={currentDocument?.content ?? ''}
        onClose={() => setDocumentPropertiesVisible(false)}
        onApply={handleApplyDocumentProperties}
        onNotice={showToast}
      />

      <TypographyDiagnosticsPanel
        visible={typographyDiagnosticsVisible}
        diagnostics={typographyDiagnostics}
        onClose={() => setTypographyDiagnosticsVisible(false)}
        onSelect={handleSelectTypographyDiagnostic}
      />

      {saveDialog && (
        <>
          <div className="modal-overlay" onClick={() => closeSaveDialog(null)} />
          <div className="modal prism-export-save-modal" role="dialog" aria-label={getSaveDialogTitle(saveDialog)}>
            <div className="modal-header">
              <div className="modal-title">{getSaveDialogTitle(saveDialog)}</div>
              <button className="modal-close" onClick={() => closeSaveDialog(null)} aria-label={t('common.close')}>×</button>
            </div>
            <div className="modal-body prism-export-save-body">
              <label className="prism-export-save-field">
                <span>{t('app.filename')}</span>
                <input
                  autoFocus
                  value={saveDialog.filename}
                  onChange={(event) => setSaveDialog((dialog) => dialog ? {
                    ...dialog,
                    filename: event.target.value,
                    error: null,
                    pendingOverwritePath: null,
                  } : null)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      confirmSaveDialog(false);
                    }
                  }}
                />
              </label>

              <div className="prism-export-save-field">
                <span>{t('app.location')}</span>
                <div className="prism-export-save-location">
                  <div title={saveDialog.directory}>{saveDialog.directory}</div>
                  <button type="button" onClick={chooseSaveDirectory}>{t('common.change')}</button>
                </div>
              </div>

              {saveDialog.kind === 'export' && (
                <>
                  <label className="prism-export-save-field">
                    <span>{t('app.exportQuality')}</span>
                    <select
                      value={normalizeExportQualityScale(saveDialog.qualityScale, exportDefaults.pngScale)}
                      onChange={(event) => setSaveDialog((dialog) => dialog ? {
                        ...dialog,
                        qualityScale: normalizeExportQualityScale(Number(event.target.value), exportDefaults.pngScale),
                        error: null,
                      } : null)}
                    >
                      {getLocalizedExportQualityPresets().map((preset) => (
                        <option key={preset.scale} value={preset.scale}>
                          {preset.shortLabel}
                        </option>
                      ))}
                    </select>
                    <small>
                      {getLocalizedExportQualityPreset(
                        normalizeExportQualityScale(saveDialog.qualityScale, exportDefaults.pngScale),
                      ).description}
                    </small>
                  </label>
                  <div className="prism-export-quality-note">
                    {t('app.exportQualityNote')}
                  </div>
                  <div className="prism-export-preflight" aria-label={t('app.exportPreflight')}>
                    <div className="prism-export-preflight-row">
                      <span>{t('app.target')}</span>
                      <b>{saveDialog.format ? getExportFormatLabel(saveDialog.format) : t('common.export')} · {saveDialog.filename}</b>
                    </div>
                    <div className="prism-export-preflight-row">
                      <span>{t('app.quality')}</span>
                      <b>
                        {getLocalizedExportQualityPreset(
                          normalizeExportQualityScale(saveDialog.qualityScale, exportDefaults.pngScale),
                        ).shortLabel}
                      </b>
                    </div>
                    <div className="prism-export-preflight-row">
                      <span>{t('app.risk')}</span>
                      <b>{actionableDiagnostics.length > 0 ? t('app.errorRisk', { count: actionableDiagnostics.length }) : t('app.noBlockingDocumentErrors')}</b>
                    </div>
                  </div>
                </>
              )}

              {saveDialog.error && (
                <div className="prism-export-save-error">{saveDialog.error}</div>
              )}

              {saveDialog.pendingOverwritePath && (
                <div className="prism-export-overwrite">
                  <div className="prism-export-overwrite-title">
                    {t('app.fileAlreadyExists', { filename: basename(saveDialog.pendingOverwritePath) })}
                  </div>
                  <div className="prism-export-overwrite-text">
                    {getSaveDialogOverwriteText(saveDialog)}
                  </div>
                </div>
              )}
            </div>
            <div className="prism-export-save-footer">
              <button type="button" onClick={() => closeSaveDialog(null)}>{t('common.cancel')}</button>
              {saveDialog.pendingOverwritePath ? (
                <button type="button" className="danger" onClick={() => confirmSaveDialog(true)}>
                  {t('app.replaceAndAction', { action: getSaveDialogPrimaryLabel(saveDialog) })}
                </button>
              ) : (
                <button type="button" className="primary" onClick={() => confirmSaveDialog(false)}>
                  {getSaveDialogPrimaryLabel(saveDialog)}
                </button>
              )}
            </div>
          </div>
        </>
      )}

      {(toast || (exportProgress && !exportProgressInBackground)) && (
        <div className="prism-toast-region">
          {toast && <Toast toast={toast} onDismiss={dismissToast} />}

          {exportProgress && !exportProgressInBackground && (
            <div role="status" aria-live="polite" className="prism-toast prism-toast--loading prism-export-progress">
              <span className="prism-toast-icon prism-export-spinner" aria-hidden="true" />
              <span className="prism-toast-copy">
                <span className="prism-toast-title">{t('app.exportingForeground')}</span>
                <span className="prism-toast-message">{exportProgress}</span>
                <span className="prism-toast-message prism-toast-message--secondary">{t('app.exportBackgroundHint')}</span>
              </span>
              <span className="prism-toast-actions">
                <button
                  type="button"
                  className="prism-toast-action"
                  onClick={sendExportProgressToBackground}
                >
                  {t('app.background')}
                </button>
              </span>
              <span className="prism-toast-progressbar" aria-hidden="true"><span /></span>
            </div>
          )}
        </div>
      )}

      {exportFailure && (
        <>
          <div className="modal-overlay" onClick={dismissExportFailure} />
          <div className="modal prism-export-failure-modal" role="dialog" aria-label={exportFailure.title}>
            <div className="modal-header">
              <div className="modal-title">{exportFailure.title}</div>
              <button className="modal-close" onClick={dismissExportFailure} aria-label={t('common.close')}>×</button>
            </div>
            <div className="modal-body prism-export-failure-body">
              <div className="prism-export-failure-summary">
                {t('app.exportFailureSummary')}
              </div>
              <div className="prism-export-failure-actions">
                <span>{t('app.recoveryAdvice')}</span>
                <b>{t('app.recoveryAdviceText')}</b>
              </div>
              <textarea readOnly value={exportFailure.diagnostic} />
            </div>
            <div className="prism-export-save-footer">
              <button type="button" onClick={dismissExportFailure}>{t('common.close')}</button>
              <button type="button" className="primary" onClick={copyExportFailureDiagnostic}>
                {t('app.copyDiagnostic')}
              </button>
            </div>
          </div>
        </>
      )}

      <ShortcutPanel
        visible={shortcutPanelVisible}
        onClose={() => setShortcutPanelVisible(false)}
      />

      <CommandPalette
        visible={commandPaletteVisible}
        files={workspace.fileTree}
        workspaceRoot={workspace.rootPath}
        recentFiles={recentFiles}
        workspaceIndex={workspaceIndex}
        workspaceIndexing={workspaceIndexing}
        mode={commandPaletteMode}
        onClose={() => setCommandPaletteVisible(false)}
        onExecute={(commandId) => handleCommandAction(commandId)}
      />

      <AboutModal
        visible={aboutVisible}
        onClose={() => setAboutVisible(false)}
        onCheckUpdate={handleAboutCheckUpdate}
      />
      <SettingsModal visible={settingsVisible} onClose={() => setSettingsVisible(false)} />
    </WindowShell>
  );
}

export default App;
