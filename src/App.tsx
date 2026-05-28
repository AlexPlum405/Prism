import { useRef, useState, useCallback } from 'react';
import { useDocumentStore } from './domains/document/store';
import { useSettingsStore } from './domains/settings/store';
import { useWorkspaceStore } from './domains/workspace/store';
import { useWorkspaceIndexModel } from './domains/workspace/hooks/useWorkspaceIndexModel';
import { useAppLifecycleModel } from './app/useAppLifecycleModel';
import { useAppCommandWiringModel } from './app/useAppCommandWiringModel';
import { useAppDocumentInsightModel } from './app/useAppDocumentInsightModel';
import { useAppFileActionsModel } from './app/useAppFileActionsModel';
import { useAppSaveConflictModel } from './app/useAppSaveConflictModel';
import { useAppWorkspaceContextMenu } from './app/useAppWorkspaceContextMenu';
import { useAppWritingStatsModel } from './app/useAppWritingStatsModel';
import { useAppAuxiliaryModalsModel } from './app/useAppAuxiliaryModalsModel';
import { useAppRecoveryModel, shouldShowRecoveryPrompt } from './app/useAppRecoveryModel';
import { useAppDocumentPropertiesModel } from './app/useAppDocumentPropertiesModel';
import { useSaveExportDialogModel } from './app/useSaveExportDialogModel';
import { ExportUiController } from './app/controllers/ExportUiController';
import { DocumentSafetyController } from './app/controllers/DocumentSafetyController';
import { DocumentPanelsController } from './app/controllers/DocumentPanelsController';
import { AppAuxiliaryModalsController } from './app/controllers/AppAuxiliaryModalsController';
import { AppWorkspaceViewController } from './app/controllers/AppWorkspaceViewController';
import { useAppToast } from './hooks/useAppToast';
import { useExportTaskUi } from './hooks/useExportTaskUi';
import { exists as fsExists } from '@tauri-apps/plugin-fs';
import { EditorPaneHandle } from './domains/editor/components/EditorPane';
import { WindowShell } from './components/shell/WindowShell';
import { TitleBar } from './components/shell/TitleBar';
import { MenuBar } from './components/shell/MenuBar';
import { SettingsModal } from './components/shell/SettingsModal';
import { t, useI18n } from './domains/i18n';

export { shouldShowRecoveryPrompt };

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
  const [isSidebarHovered, setIsSidebarHovered] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);
  useAppLifecycleModel({
    autoSaveEnabled,
    autoSaveInterval,
    currentDocument,
    loadSettings,
    workspace,
  });

  const {
    aboutVisible,
    closeAbout,
    closeCommandPalette,
    closeShortcutPanel,
    commandPaletteMode,
    commandPaletteVisible,
    openAbout,
    openQuickOpen,
    openShortcuts,
    openWorkspaceSearch,
    shortcutPanelVisible,
  } = useAppAuxiliaryModalsModel();

  const {
    cursor,
    selectionWritingStats,
    setCursor,
    setSelectionText,
    writingStats,
  } = useAppWritingStatsModel({ currentDocument });

  const {
    workspaceIndex,
    workspaceIndexing,
  } = useWorkspaceIndexModel({
    currentDocument,
    fileTree: workspace.fileTree,
    rootPath: workspace.rootPath,
    recentFiles,
  });

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
    actionableDiagnostics,
    backlinks,
    backlinksVisible,
    closeDocumentDiagnostics,
    displayedDiagnostics,
    documentLinks,
    documentLinksVisible,
    firstActionableDiagnostic,
    firstTypographyDiagnostic,
    handleLinkDiagnosticsClick,
    handleSelectDocumentDiagnostic,
    handleSelectTypographyDiagnostic,
    handleTypographyDiagnosticsClick,
    linkDiagnosticsVisible,
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
    setTypographyDiagnosticsVisible,
    typographyDiagnostics,
    typographyDiagnosticsVisible,
  } = useAppDocumentInsightModel({
    currentDocument,
    editorRef,
    fileTree: workspace.fileTree,
    handleFileAction,
    rootPath: workspace.rootPath,
    showToast,
    workspaceIndex,
  });

  const {
    closeDocumentProperties,
    documentPropertiesVisible,
    handleApplyDocumentProperties,
    openDocumentProperties,
  } = useAppDocumentPropertiesModel();

  const {
    conflictAction,
    hasSaveConflict,
    runConflictAction,
  } = useAppSaveConflictModel({
    currentDocument,
    requestMarkdownSavePath,
    showToast,
  });

  const {
    activeRecoverySnapshot,
    handleDiscardRecovery,
    handleRestoreRecovery,
    recoveryAction,
    recoveryPromptVisible,
  } = useAppRecoveryModel({
    hasSaveConflict,
    saveDialogVisible: Boolean(saveDialog),
    showToast,
  });

  const openSettings = useCallback(() => setSettingsVisible(true), []);

  const {
    createCommandContext,
    handleAboutCheckUpdate,
    handleCommandAction,
    menuSections,
  } = useAppCommandWiringModel({
    closeAbout,
    contentTheme,
    currentDocument,
    exportDefaults,
    focusMode: workspace.focusMode,
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
    toggleFocusMode: workspace.toggleFocusMode,
    wordWrap,
    workspace,
    workspaceIndex,
  });

  const {
    closeGlobalContextMenu,
    globalContextMenu,
    handleContextMenuAction,
    handleExportContextMenu,
    handleFolderContextMenu,
  } = useAppWorkspaceContextMenu({
    createCommandContext,
    fileSortMode: workspace.fileSortMode,
    fileTreeMode: workspace.fileTreeMode,
    handleCommandAction,
    handleFileAction,
  });

  const titleDocName = currentDocument?.name ?? t('common.untitled');
  const titleDirty = currentDocument?.isDirty ?? false;

  return (
      <WindowShell>
      <TitleBar docName={titleDocName} isDirty={titleDirty} />
      <MenuBar sections={menuSections} onAction={handleCommandAction} />
      <AppWorkspaceViewController
        activePath={currentDocument?.path}
        actionableIssueCount={actionableDiagnostics.length}
        backlinkCount={backlinks.length}
        currentDocument={currentDocument}
        cursor={cursor}
        editorRef={editorRef}
        exportProgress={exportProgress}
        exportProgressInBackground={exportProgressInBackground}
        firstActionableMessage={firstActionableDiagnostic?.message}
        firstTypographyMessage={firstTypographyDiagnostic?.message}
        globalContextMenu={globalContextMenu}
        isSidebarHovered={isSidebarHovered}
        selectionWritingStats={selectionWritingStats}
        typographyIssueCount={typographyDiagnostics.length}
        workspace={workspace}
        workspaceIndex={workspaceIndex}
        writingStats={writingStats}
        onBacklinksClick={openBacklinks}
        onCloseContextMenu={closeGlobalContextMenu}
        onContextMenuAction={handleContextMenuAction}
        onCursorChange={setCursor}
        onExportMenu={handleExportContextMenu}
        onFileAction={handleFileAction}
        onFileClick={handleFileClick}
        onFolderContextMenu={handleFolderContextMenu}
        onLinkDiagnosticsClick={handleLinkDiagnosticsClick}
        onNotice={showToast}
        onOpenDocumentLink={openDocumentLink}
        onRelationGraphClick={openRelationGraph}
        onSelectionTextChange={setSelectionText}
        onSetSidebarHovered={setIsSidebarHovered}
        onShowExportProgress={showBackgroundExportProgress}
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
        onDocumentPropertiesClose={closeDocumentProperties}
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

      <AppAuxiliaryModalsController
        aboutVisible={aboutVisible}
        commandPaletteMode={commandPaletteMode}
        commandPaletteVisible={commandPaletteVisible}
        files={workspace.fileTree}
        recentFiles={recentFiles}
        shortcutPanelVisible={shortcutPanelVisible}
        workspaceIndex={workspaceIndex}
        workspaceIndexing={workspaceIndexing}
        workspaceRoot={workspace.rootPath}
        onAboutCheckUpdate={handleAboutCheckUpdate}
        onAboutClose={closeAbout}
        onCommandPaletteClose={closeCommandPalette}
        onCommandPaletteExecute={(commandId) => handleCommandAction(commandId)}
        onShortcutPanelClose={closeShortcutPanel}
      />
      <SettingsModal visible={settingsVisible} onClose={() => setSettingsVisible(false)} />
    </WindowShell>
  );
}

export default App;
