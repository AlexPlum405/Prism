import { useCallback, useEffect, useMemo } from 'react';
import {
  getMenuSections,
  isCommandId,
  runCommand,
  type CommandContext,
} from '../domains/commands';
import { useDocumentStore } from '../domains/document/store';
import { useSettingsStore } from '../domains/settings/store';
import type { RecentFileEntry, SettingsState, ShortcutStyle } from '../domains/settings/types';
import { useWorkspaceStore } from '../domains/workspace/store';
import type { WorkspaceIndex } from '../domains/workspace/services';
import { t } from '../domains/i18n';
import type { ToastInput } from '../lib/toast';
import type { FileActionInput } from '../lib/fileActions';
import { emitAppEvent, onAppEvent } from '../platform/events/appEvents';
import { listenForNativeCommands } from '../platform/tauri/nativeMenuEvents';
import {
  getSlashSnippet,
  isSlashSnippetCommand,
} from '../domains/editor/extensions/slashSnippets';

type RequestExportPath = NonNullable<CommandContext['requestExportPath']>;
type RequestSavePath = NonNullable<CommandContext['requestSavePath']>;

interface WorkspaceCommandSnapshot {
  fileTree: unknown;
  focusMode: boolean;
  isAlwaysOnTop: boolean;
  isFullscreen: boolean;
  rootPath: string | null;
  sidebarTab: string;
  sidebarVisible: boolean;
  statusBarVisible: boolean;
  typewriterMode: boolean;
}

interface DocumentCommandSnapshot {
  isDirty?: boolean;
  path?: string | null;
  viewMode?: string;
}

interface UseAppCommandContextInput {
  contentTheme: string;
  currentDocument: DocumentCommandSnapshot | null;
  exportDefaults: SettingsState['exportDefaults'];
  handleFileAction: (input: FileActionInput) => void | Promise<void>;
  locale: unknown;
  localePreference: unknown;
  openAbout: () => void;
  openBacklinks: () => void;
  openDocumentLinks: () => void;
  openDocumentProperties: () => void;
  openQuickOpen: () => void;
  openRelationGraph: () => void;
  openSettings: () => void;
  openShortcuts: () => void;
  openWorkspaceSearch: () => void;
  recentFiles: RecentFileEntry[];
  requestExportPath: RequestExportPath;
  requestSavePath: RequestSavePath;
  settingsLocale: unknown;
  shortcutStyle: ShortcutStyle;
  showToast: (toast: ToastInput) => void;
  themeRegistryVersion: number;
  wordWrap: boolean;
  workspace: WorkspaceCommandSnapshot;
  workspaceIndex: WorkspaceIndex | null;
}

export function useAppCommandContext({
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
  requestSavePath,
  settingsLocale,
  shortcutStyle,
  showToast,
  themeRegistryVersion,
  wordWrap,
  workspace,
  workspaceIndex,
}: UseAppCommandContextInput) {
  const createCommandContext = useCallback((): CommandContext => ({
    documentStore: useDocumentStore.getState(),
    settingsStore: useSettingsStore.getState(),
    workspaceStore: useWorkspaceStore.getState(),
    workspaceIndex,
    showToast,
    requestExportPath,
    requestSavePath,
    openAbout,
    openSettings,
    openShortcuts,
    openQuickOpen,
    openWorkspaceSearch,
    openDocumentProperties,
    openDocumentLinks,
    openBacklinks,
    openRelationGraph,
  }), [
    openAbout,
    openBacklinks,
    openDocumentLinks,
    openDocumentProperties,
    openQuickOpen,
    openRelationGraph,
    openSettings,
    openShortcuts,
    openWorkspaceSearch,
    requestExportPath,
    requestSavePath,
    showToast,
    workspaceIndex,
  ]);

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
    workspaceIndex,
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

    if (action.startsWith('insertSlashSnippet:')) {
      const command = decodeURIComponent(action.slice('insertSlashSnippet:'.length));
      if (!isSlashSnippetCommand(command)) {
        showToast(t('app.unknownCommand', { action }));
        return;
      }
      const snippet = getSlashSnippet(command);
      emitAppEvent('editor.command', {
        command: 'insertSnippet',
        insert: snippet.insert,
        selectionStart: snippet.selectionStart,
        selectionEnd: snippet.selectionEnd,
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

  useEffect(() => {
    return onAppEvent('command.run', ({ action }) => {
      if (action) handleCommandAction(action);
    });
  }, [handleCommandAction]);

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | null = null;

    void listenForNativeCommands((action) => {
      void handleCommandAction(action);
    }).then((nextUnlisten) => {
      if (disposed) {
        nextUnlisten();
        return;
      }
      unlisten = nextUnlisten;
    });

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [handleCommandAction]);

  useEffect(() => {
    return onAppEvent('file.action', (detail) => {
      void handleFileAction(detail);
    });
  }, [handleFileAction]);

  useEffect(() => {
    return onAppEvent('settings.open', openSettings);
  }, [openSettings]);

  return {
    commandContext,
    createCommandContext,
    handleCommandAction,
    menuSections,
  };
}
