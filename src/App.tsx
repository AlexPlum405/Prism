import { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { useDocumentStore } from './domains/document/store';
import { useSettingsStore } from './domains/settings/store';
import { useWorkspaceStore } from './domains/workspace/store';
import { useRecoveryQueue } from './domains/document/hooks/useRecoveryQueue';
import { useWorkspaceIndexModel } from './domains/workspace/hooks/useWorkspaceIndexModel';
import { useAppLifecycleModel } from './app/useAppLifecycleModel';
import { useAppCommandContext } from './app/useAppCommandContext';
import { useAppShortcuts } from './app/useAppShortcuts';
import { useDocumentDiagnosticsModel } from './app/useDocumentDiagnosticsModel';
import { useAppFileActionsModel } from './app/useAppFileActionsModel';
import { useDocumentNavigationModel } from './app/useDocumentNavigationModel';
import { useSaveExportDialogModel } from './app/useSaveExportDialogModel';
import { ExportUiController } from './app/controllers/ExportUiController';
import { DocumentSafetyController } from './app/controllers/DocumentSafetyController';
import { DocumentPanelsController } from './app/controllers/DocumentPanelsController';
import { WorkspaceController, type WorkspaceContextMenuState } from './app/controllers/WorkspaceController';
import { useAppToast } from './hooks/useAppToast';
import { useExportTaskUi } from './hooks/useExportTaskUi';
import { DocumentView } from './domains/document/components/DocumentView';
import type { SaveConflictAction } from './domains/document/components/SaveConflictModal';
import {
  overwriteConflictedDocument,
  reloadConflictedDocument,
  saveConflictedDocumentAs,
} from './domains/document/services/conflictResolution';
import { createFileTreeContextMenuItems } from './domains/workspace/components/fileTreeContextMenu';
import { exists as fsExists } from '@tauri-apps/plugin-fs';
import { EditorPaneHandle } from './domains/editor/components/EditorPane';
import { WindowShell } from './components/shell/WindowShell';
import { TitleBar } from './components/shell/TitleBar';
import { MenuBar } from './components/shell/MenuBar';
import type { ContextMenuItem } from './components/shell/ContextMenu';
import { ShortcutPanel } from './components/shell/ShortcutPanel';
import { CommandPalette, type CommandPaletteMode } from './components/shell/CommandPalette';
import { AboutModal } from './components/shell/AboutModal';
import { SettingsModal } from './components/shell/SettingsModal';
import {
  getCommandMenuItems,
} from './domains/commands';
import {
  computeWritingStats,
} from './domains/workspace/services';
import { t, useI18n } from './domains/i18n';

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
  const [globalContextMenu, setGlobalContextMenu] = useState<WorkspaceContextMenuState | null>(null);
  const [shortcutPanelVisible, setShortcutPanelVisible] = useState(false);
  const [commandPaletteVisible, setCommandPaletteVisible] = useState(false);
  const [commandPaletteMode, setCommandPaletteMode] = useState<CommandPaletteMode>('files');
  const [aboutVisible, setAboutVisible] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [documentPropertiesVisible, setDocumentPropertiesVisible] = useState(false);
  const [conflictAction, setConflictAction] = useState<SaveConflictAction | null>(null);
  useAppLifecycleModel({
    autoSaveEnabled,
    autoSaveInterval,
    currentDocument,
    loadSettings,
    workspace,
  });

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
    setSelectionText('');
  }, [currentDocument?.path]);

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

  const {
    dirtySwitchPrompt,
    handleFileAction,
    handleFileClick,
    resolveDirtySwitchPrompt,
  } = useAppFileActionsModel({
    requestMarkdownSavePath,
    showToast,
  });

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
      <WorkspaceController
        activePath={currentDocument?.path}
        actionableIssueCount={actionableDiagnostics.length}
        backlinkCount={backlinks.length}
        cursor={cursor}
        documentContent={currentDocument?.content ?? ''}
        documentView={(
          <DocumentView
            key={currentDocument?.path || 'new-doc'}
            ref={editorRef}
            onCursorChange={setCursor}
            onOpenDocumentLink={openDocumentLink}
            onSelectionTextChange={setSelectionText}
            onNotice={showToast}
            workspaceIndex={workspaceIndex}
          />
        )}
        exportProgress={exportProgress}
        exportProgressInBackground={exportProgressInBackground}
        fileTree={workspace.fileTree}
        firstActionableMessage={firstActionableDiagnostic?.message}
        firstTypographyMessage={firstTypographyDiagnostic?.message}
        globalContextMenu={globalContextMenu}
        hasSavedPath={Boolean(currentDocument?.path)}
        isSidebarHovered={isSidebarHovered}
        selectionWritingStats={selectionWritingStats}
        sidebarTab={workspace.sidebarTab}
        sidebarVisible={workspace.sidebarVisible}
        statusBarVisible={Boolean(currentDocument && workspace.statusBarVisible)}
        typographyIssueCount={typographyDiagnostics.length}
        workspaceIndex={workspaceIndex}
        writingStats={writingStats}
        onBacklinksClick={openBacklinks}
        onCloseContextMenu={() => setGlobalContextMenu(null)}
        onContextMenuAction={(action, kind) => {
          if (kind === 'file') {
            handleFileAction(action);
          } else {
            handleCommandAction(action);
          }
        }}
        onCursorChange={setCursor}
        onExportMenu={handleExportContextMenu}
        onFileClick={handleFileClick}
        onFolderContextMenu={handleFolderContextMenu}
        onLinkDiagnosticsClick={handleLinkDiagnosticsClick}
        onNewFile={() => handleFileAction('newFile')}
        onNotice={showToast}
        onOpenDocumentLink={openDocumentLink}
        onOutlineClick={(line) => editorRef.current?.jumpToLine(line)}
        onRelationGraphClick={openRelationGraph}
        onSelectionTextChange={setSelectionText}
        onSetSidebarHovered={setIsSidebarHovered}
        onSetSidebarTab={workspace.setSidebarTab}
        onShowExportProgress={showBackgroundExportProgress}
        onToggleFileTreeMode={() => handleFileAction(workspace.fileTreeMode === 'tree' ? 'viewList' : 'viewTree')}
        onToggleFocusMode={() => workspace.toggleFocusMode()}
        onToggleSidebar={() => workspace.toggleSidebar()}
        onTypographyDiagnosticsClick={handleTypographyDiagnosticsClick}
      />

      <DocumentSafetyController
        activeRecoverySnapshot={activeRecoverySnapshot}
        conflictAction={conflictAction}
        currentDocumentName={currentDocument?.name}
        dirtySwitchPrompt={dirtySwitchPrompt}
        hasSaveConflict={hasSaveConflict}
        recoveryAction={recoveryAction}
        recoveryPromptVisible={recoveryPromptVisible}
        saveDialogVisible={Boolean(saveDialog)}
        saveError={currentDocument?.saveError ?? null}
        saveIssue={currentDocument?.saveIssue ?? null}
        onDiscardRecovery={handleDiscardRecovery}
        onRestoreRecovery={handleRestoreRecovery}
        onResolveDirtySwitch={resolveDirtySwitchPrompt}
        onRunConflictAction={runConflictAction}
      />

      <DocumentPanelsController
        backlinks={backlinks}
        backlinksVisible={backlinksVisible}
        currentDocumentContent={currentDocument?.content ?? ''}
        currentDocumentPath={currentDocument?.path}
        displayedDiagnostics={displayedDiagnostics}
        documentLinks={documentLinks}
        documentLinksVisible={documentLinksVisible}
        documentPropertiesVisible={documentPropertiesVisible}
        linkDiagnosticsVisible={linkDiagnosticsVisible}
        relationGraphVisible={relationGraphVisible}
        typographyDiagnostics={typographyDiagnostics}
        typographyDiagnosticsVisible={typographyDiagnosticsVisible}
        workspaceIndex={workspaceIndex}
        onApplyDocumentProperties={handleApplyDocumentProperties}
        onBacklinkSelect={selectBacklink}
        onBacklinksClose={() => setBacklinksVisible(false)}
        onDocumentLinkSelect={selectDocumentLink}
        onDocumentLinksClose={() => setDocumentLinksVisible(false)}
        onDocumentPropertiesClose={() => setDocumentPropertiesVisible(false)}
        onDocumentPropertiesNotice={showToast}
        onLinkDiagnosticSelect={handleSelectDocumentDiagnostic}
        onLinkDiagnosticsClose={closeDocumentDiagnostics}
        onRelationGraphClose={() => setRelationGraphVisible(false)}
        onRelationGraphSelect={(path) => {
          void handleFileAction({ action: 'openFile', path });
        }}
        onTypographyDiagnosticSelect={handleSelectTypographyDiagnostic}
        onTypographyDiagnosticsClose={() => setTypographyDiagnosticsVisible(false)}
      />

      <ExportUiController
        actionableIssueCount={actionableDiagnostics.length}
        chooseSaveDirectory={chooseSaveDirectory}
        closeSaveDialog={closeSaveDialog}
        confirmSaveDialog={confirmSaveDialog}
        copyExportFailureDiagnostic={copyExportFailureDiagnostic}
        dismissExportFailure={dismissExportFailure}
        dismissToast={dismissToast}
        exportFailure={exportFailure}
        exportProgress={exportProgress}
        exportProgressInBackground={exportProgressInBackground}
        exportPngScale={exportDefaults.pngScale}
        saveDialog={saveDialog}
        saveDialogOverwriteFilename={saveDialogOverwriteFilename}
        sendExportProgressToBackground={sendExportProgressToBackground}
        toast={toast}
        updateSaveDialogFilename={updateSaveDialogFilename}
        updateSaveDialogQualityScale={updateSaveDialogQualityScale}
      />

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
