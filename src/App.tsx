import { useRef, useState, useCallback } from 'react';
import { useWorkspaceIndexModel } from './domains/workspace/hooks/useWorkspaceIndexModel';
import { useAppStoreSnapshotModel } from './app/useAppStoreSnapshotModel';
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
import { useAppExportUiModel } from './app/useAppExportUiModel';
import { ExportUiController } from './app/controllers/ExportUiController';
import { DocumentSafetyController } from './app/controllers/DocumentSafetyController';
import { DocumentPanelsController } from './app/controllers/DocumentPanelsController';
import { AppAuxiliaryModalsController } from './app/controllers/AppAuxiliaryModalsController';
import { AppWorkspaceViewController } from './app/controllers/AppWorkspaceViewController';
import { EditorPaneHandle } from './domains/editor/components/EditorPane';
import { WindowShell } from './components/shell/WindowShell';
import { TitleBar } from './components/shell/TitleBar';
import { MenuBar } from './components/shell/MenuBar';
import { SettingsModal } from './components/shell/SettingsModal';

export { shouldShowRecoveryPrompt };

function App() {
  const {
    currentDocument,
    locale,
    localePreference,
    settings,
    titleDirty,
    titleDocName,
    workspace,
  } = useAppStoreSnapshotModel();

  const editorRef = useRef<EditorPaneHandle>(null);
  const [isSidebarHovered, setIsSidebarHovered] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [settingsInitialSection, setSettingsInitialSection] = useState<'general' | 'writing' | 'appearance' | 'export' | 'citation' | 'files'>('general');
  useAppLifecycleModel({
    autoSaveEnabled: settings.autoSaveEnabled,
    autoSaveInterval: settings.autoSaveInterval,
    currentDocument,
    loadSettings: settings.loadSettings,
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
    recentFiles: settings.recentFiles,
  });

  const {
    chooseSaveDirectory,
    closeSaveDialog,
    confirmSaveDialog,
    copyExportFailureDiagnostic,
    dismissExportFailure,
    dismissToast,
    exportProgress,
    exportProgressInBackground,
    exportFailure,
    requestExportPath,
    requestMarkdownSavePath,
    saveDialog,
    saveDialogOverwriteFilename,
    sendExportProgressToBackground,
    showToast,
    showBackgroundExportProgress,
    toast,
    updateSaveDialogFilename,
    updateSaveDialogQualityScale,
  } = useAppExportUiModel({
    exportDefaults: settings.exportDefaults,
    rootPath: workspace.rootPath,
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

  const documentInsight = useAppDocumentInsightModel({
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

  const openSettings = useCallback((section: 'general' | 'writing' | 'appearance' | 'export' | 'citation' | 'files' = 'general') => {
    setSettingsInitialSection(section);
    setSettingsVisible(true);
  }, []);

  const {
    createCommandContext,
    handleAboutCheckUpdate,
    handleCommandAction,
    menuSections,
  } = useAppCommandWiringModel({
    closeAbout,
    contentTheme: settings.contentTheme,
    currentDocument,
    exportDefaults: settings.exportDefaults,
    focusMode: workspace.focusMode,
    handleFileAction,
    locale,
    localePreference,
    openAbout,
    openBacklinks: documentInsight.openBacklinks,
    openDocumentLinks: documentInsight.openDocumentLinks,
    openDocumentProperties,
    openQuickOpen,
    openRelationGraph: documentInsight.openRelationGraph,
    openSettings,
    openShortcuts,
    openWorkspaceSearch,
    recentFiles: settings.recentFiles,
    requestExportPath,
    requestSavePath: requestMarkdownSavePath,
    settingsLocale: settings.locale,
    shortcutStyle: settings.shortcutStyle,
    showToast,
    themeRegistryVersion: settings.themeRegistryVersion,
    toggleFocusMode: workspace.toggleFocusMode,
    wordWrap: settings.wordWrap,
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

  return (
      <WindowShell>
      <TitleBar docName={titleDocName} isDirty={titleDirty} />
      <MenuBar sections={menuSections} onAction={handleCommandAction} />
      <AppWorkspaceViewController
        activePath={currentDocument?.path}
        actionableIssueCount={documentInsight.actionableDiagnostics.length}
        backlinkCount={documentInsight.backlinks.length}
        currentDocument={currentDocument}
        cursor={cursor}
        editorRef={editorRef}
        exportProgress={exportProgress}
        exportProgressInBackground={exportProgressInBackground}
        firstActionableMessage={documentInsight.firstActionableDiagnostic?.message}
        firstTypographyMessage={documentInsight.firstTypographyDiagnostic?.message}
        globalContextMenu={globalContextMenu}
        isSidebarHovered={isSidebarHovered}
        selectionWritingStats={selectionWritingStats}
        typographyIssueCount={documentInsight.typographyDiagnostics.length}
        workspace={workspace}
        workspaceIndex={workspaceIndex}
        writingStats={writingStats}
        onBacklinksClick={documentInsight.openBacklinks}
        onCloseContextMenu={closeGlobalContextMenu}
        onContextMenuAction={handleContextMenuAction}
        onCursorChange={setCursor}
        onExportMenu={handleExportContextMenu}
        onFileAction={handleFileAction}
        onFileClick={handleFileClick}
        onFolderContextMenu={handleFolderContextMenu}
        onLinkDiagnosticsClick={documentInsight.handleLinkDiagnosticsClick}
        onNotice={showToast}
        onOpenDocumentLink={documentInsight.openDocumentLink}
        onRelationGraphClick={documentInsight.openRelationGraph}
        onSelectionTextChange={setSelectionText}
        onSetSidebarHovered={setIsSidebarHovered}
        onShowExportProgress={showBackgroundExportProgress}
        onTypographyDiagnosticsClick={documentInsight.handleTypographyDiagnosticsClick}
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
        backlinks={documentInsight.backlinks}
        backlinksVisible={documentInsight.backlinksVisible}
        currentDocumentContent={currentDocument?.content ?? ''}
        currentDocumentPath={currentDocument?.path}
        displayedDiagnostics={documentInsight.displayedDiagnostics}
        documentLinks={documentInsight.documentLinks}
        documentLinksVisible={documentInsight.documentLinksVisible}
        documentPropertiesVisible={documentPropertiesVisible}
        linkDiagnosticsVisible={documentInsight.linkDiagnosticsVisible}
        relationGraphVisible={documentInsight.relationGraphVisible}
        typographyDiagnostics={documentInsight.typographyDiagnostics}
        typographyDiagnosticsVisible={documentInsight.typographyDiagnosticsVisible}
        workspaceIndex={workspaceIndex}
        onApplyDocumentProperties={handleApplyDocumentProperties}
        onBacklinkSelect={documentInsight.selectBacklink}
        onBacklinksClose={() => documentInsight.setBacklinksVisible(false)}
        onDocumentLinkSelect={documentInsight.selectDocumentLink}
        onDocumentLinksClose={() => documentInsight.setDocumentLinksVisible(false)}
        onDocumentPropertiesClose={closeDocumentProperties}
        onDocumentPropertiesNotice={showToast}
        onLinkDiagnosticSelect={documentInsight.handleSelectDocumentDiagnostic}
        onLinkDiagnosticsClose={documentInsight.closeDocumentDiagnostics}
        onRelationGraphClose={() => documentInsight.setRelationGraphVisible(false)}
        onRelationGraphSelect={(path) => {
          void handleFileAction({ action: 'openFile', path });
        }}
        onTypographyDiagnosticSelect={documentInsight.handleSelectTypographyDiagnostic}
        onTypographyDiagnosticsClose={() => documentInsight.setTypographyDiagnosticsVisible(false)}
      />

      <ExportUiController
        actionableIssueCount={documentInsight.actionableDiagnostics.length}
        chooseSaveDirectory={chooseSaveDirectory}
        closeSaveDialog={closeSaveDialog}
        confirmSaveDialog={confirmSaveDialog}
        copyExportFailureDiagnostic={copyExportFailureDiagnostic}
        dismissExportFailure={dismissExportFailure}
        dismissToast={dismissToast}
        exportFailure={exportFailure}
        exportProgress={exportProgress}
        exportProgressInBackground={exportProgressInBackground}
        exportPngScale={settings.exportDefaults.pngScale}
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
        currentDocument={currentDocument}
        files={workspace.fileTree}
        recentFiles={settings.recentFiles}
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
      <SettingsModal
        initialSection={settingsInitialSection}
        visible={settingsVisible}
        onClose={() => setSettingsVisible(false)}
      />
    </WindowShell>
  );
}

export default App;
