import { lazy, Suspense, useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { useDocumentStore } from './domains/document/store';
import { useSettingsStore } from './domains/settings/store';
import { useWorkspaceStore } from './domains/workspace/store';
import { useWorkspaceFocusRefresh } from './domains/workspace/hooks/useWorkspaceFocusRefresh';
import { useAutoSave } from './domains/document/hooks/useAutoSave';
import { useExternalFileChangeMonitor } from './domains/document/hooks/useExternalFileChangeMonitor';
import { useRecoveryQueue } from './domains/document/hooks/useRecoveryQueue';
import { useWorkspaceIndexModel } from './domains/workspace/hooks/useWorkspaceIndexModel';
import { useAppCommandContext } from './app/useAppCommandContext';
import { useAppShortcuts } from './app/useAppShortcuts';
import { useDocumentDiagnosticsModel } from './app/useDocumentDiagnosticsModel';
import { useDocumentNavigationModel } from './app/useDocumentNavigationModel';
import {
  getSaveDialogOverwriteText,
  getSaveDialogPrimaryLabel,
  getSaveDialogTitle,
  useSaveExportDialogModel,
} from './app/useSaveExportDialogModel';
import { useStartupFileOpen } from './app/useStartupFileOpen';
import { useAppToast } from './hooks/useAppToast';
import { useExportTaskUi } from './hooks/useExportTaskUi';
import { DocumentView } from './domains/document/components/DocumentView';
import { DirtyDocumentSwitchModal } from './domains/document/components/DirtyDocumentSwitchModal';
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
import { createFileTreeContextMenuItems } from './domains/workspace/components/fileTreeContextMenu';
import { useBootstrap } from './hooks/useBootstrap';
import { exists as fsExists } from '@tauri-apps/plugin-fs';
import { EditorPaneHandle } from './domains/editor/components/EditorPane';
import { DocumentPropertiesPanel } from './domains/editor/components/DocumentPropertiesPanel';
import { DocumentDiagnosticsPanel } from './domains/editor/components/DocumentDiagnosticsPanel';
import { TypographyDiagnosticsPanel } from './domains/editor/components/TypographyDiagnosticsPanel';
import { getExportFormatLabel } from './domains/export';
import {
  getLocalizedExportQualityPreset,
  getLocalizedExportQualityPresets,
  normalizeExportQualityScale,
} from './domains/export/quality';
import { WindowShell } from './components/shell/WindowShell';
import { TitleBar } from './components/shell/TitleBar';
import { MenuBar } from './components/shell/MenuBar';
import { executeFileAction, FileActionInput, type DirtyDocumentSwitchAction } from './lib/fileActions';
import { ContextMenu, type ContextMenuItem } from './components/shell/ContextMenu';
import { ShortcutPanel } from './components/shell/ShortcutPanel';
import { CommandPalette, type CommandPaletteMode } from './components/shell/CommandPalette';
import { AboutModal } from './components/shell/AboutModal';
import { SettingsModal } from './components/shell/SettingsModal';
import { Toast } from './components/shell/Toast';
import {
  getCommandMenuItems,
} from './domains/commands';
import {
  computeWritingStats,
  getRuntimePlatform,
} from './domains/workspace/services';
import { t, useI18n } from './domains/i18n';

const RelationGraphPanel = lazy(() => import('./domains/workspace/components/RelationGraphPanel')
  .then((module) => ({ default: module.RelationGraphPanel })));

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
  const [shortcutPanelVisible, setShortcutPanelVisible] = useState(false);
  const [commandPaletteVisible, setCommandPaletteVisible] = useState(false);
  const [commandPaletteMode, setCommandPaletteMode] = useState<CommandPaletteMode>('files');
  const [aboutVisible, setAboutVisible] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [documentPropertiesVisible, setDocumentPropertiesVisible] = useState(false);
  const [conflictAction, setConflictAction] = useState<SaveConflictAction | null>(null);
  const [dirtySwitchPrompt, setDirtySwitchPrompt] = useState<{
    currentName: string;
    resolve: (action: DirtyDocumentSwitchAction) => void;
    targetName: string;
  } | null>(null);
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

  const jumpToEditorLine = useCallback((line: number) => {
    editorRef.current?.jumpToLine(line);
  }, []);

  const {
    actionableDiagnostics,
    closeDocumentDiagnostics,
    displayedDiagnostics,
    firstActionableDiagnostic,
    firstTypographyDiagnostic,
    handleLinkDiagnosticsClick,
    handleSelectDocumentDiagnostic,
    handleSelectTypographyDiagnostic,
    handleTypographyDiagnosticsClick,
    linkDiagnosticsVisible,
    setTypographyDiagnosticsVisible,
    typographyDiagnostics,
    typographyDiagnosticsVisible,
  } = useDocumentDiagnosticsModel({
    currentDocument,
    existsPath: fsExists,
    fileTree: workspace.fileTree,
    jumpToLine: jumpToEditorLine,
    rootPath: workspace.rootPath,
  });

  const handleApplyDocumentProperties = useCallback((content: string) => {
    useDocumentStore.getState().updateContent(content);
  }, []);

  const {
    chooseSaveDirectory,
    closeSaveDialog,
    confirmSaveDialog,
    requestExportPath,
    requestMarkdownSavePath,
    saveDialog,
    saveDialogOverwriteFilename,
    updateSaveDialogFilename,
    updateSaveDialogQualityScale,
  } = useSaveExportDialogModel({
    existsPath: fsExists,
    exportDefaults,
    rootPath: workspace.rootPath,
    showToast,
  });

  const requestDirtyDocumentAction = useCallback((input: {
    currentName: string;
    targetName: string;
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

  const handleStartupFileOpen = useCallback((path: string) => {
    return handleFileAction({ action: 'openFile', path });
  }, [handleFileAction]);

  useStartupFileOpen({ onOpenFilePath: handleStartupFileOpen });

  const handleFileClick = useCallback(async (path: string) => {
    await handleFileAction({ action: 'openFile', path });
  }, [handleFileAction]);

  const {
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
  } = useDocumentNavigationModel({
    currentDocument,
    fileTree: workspace.fileTree,
    handleFileAction,
    jumpToLine: jumpToEditorLine,
    rootPath: workspace.rootPath,
    showToast,
    workspaceIndex,
  });

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

  const openAbout = useCallback(() => setAboutVisible(true), []);
  const openSettings = useCallback(() => setSettingsVisible(true), []);
  const openShortcuts = useCallback(() => setShortcutPanelVisible(true), []);
  const openQuickOpen = useCallback(() => {
    setCommandPaletteMode('files');
    setCommandPaletteVisible(true);
  }, []);
  const openWorkspaceSearch = useCallback(() => {
    setCommandPaletteMode('search');
    setCommandPaletteVisible(true);
  }, []);
  const openDocumentProperties = useCallback(() => setDocumentPropertiesVisible(true), []);

  const {
    createCommandContext,
    handleCommandAction,
    menuSections,
  } = useAppCommandContext({
    contentTheme,
    currentDocument,
    exportDefaults,
    handleFileAction,
    locale,
    localePreference,
    openAbout,
    openBacklinks,
    openDocumentLinks,
    openDocumentProperties,
    openQuickOpen,
    openRelationGraph,
    openSettings,
    openShortcuts,
    openWorkspaceSearch,
    recentFiles,
    requestExportPath,
    requestSavePath: requestMarkdownSavePath,
    settingsLocale,
    shortcutStyle,
    showToast,
    themeRegistryVersion,
    wordWrap,
    workspace,
    workspaceIndex,
  });

  const handleAboutCheckUpdate = useCallback(() => {
    setAboutVisible(false);
    void handleCommandAction('checkUpdate');
  }, [handleCommandAction]);

  useAppShortcuts({
    createCommandContext,
    focusMode: workspace.focusMode,
    toggleFocusMode: workspace.toggleFocusMode,
  });

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
          onOpenDocumentLink={openDocumentLink}
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
            onBacklinksClick={openBacklinks}
            onDocumentPropertiesClick={() => setDocumentPropertiesVisible(true)}
            typographyIssueCount={typographyDiagnostics.length}
            typographyIssueTitle={firstTypographyDiagnostic?.message}
            onTypographyDiagnosticsClick={handleTypographyDiagnosticsClick}
            onRelationGraphClick={openRelationGraph}
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

      <DirtyDocumentSwitchModal
        visible={Boolean(dirtySwitchPrompt)}
        currentName={dirtySwitchPrompt?.currentName ?? ''}
        targetName={dirtySwitchPrompt?.targetName ?? ''}
        onAction={resolveDirtySwitchPrompt}
      />

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
        issueKind={currentDocument?.saveIssue ?? null}
        busyAction={conflictAction}
        onReload={() => runConflictAction('reload')}
        onSaveAs={() => runConflictAction('saveAs')}
        onOverwrite={() => runConflictAction('overwrite')}
      />

      <DocumentDiagnosticsPanel
        visible={linkDiagnosticsVisible}
        diagnostics={displayedDiagnostics}
        onClose={closeDocumentDiagnostics}
        onSelect={handleSelectDocumentDiagnostic}
      />

      <BacklinksPanel
        visible={backlinksVisible}
        backlinks={backlinks}
        onClose={() => setBacklinksVisible(false)}
        onSelect={selectBacklink}
      />

      <DocumentLinksPanel
        visible={documentLinksVisible}
        links={documentLinks}
        onClose={() => setDocumentLinksVisible(false)}
        onSelect={selectDocumentLink}
      />

      {relationGraphVisible && (
        <Suspense fallback={null}>
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
        </Suspense>
      )}

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
                  onChange={(event) => updateSaveDialogFilename(event.target.value)}
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
                      onChange={(event) => updateSaveDialogQualityScale(Number(event.target.value))}
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
                    {t('app.fileAlreadyExists', { filename: saveDialogOverwriteFilename ?? saveDialog.filename })}
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
