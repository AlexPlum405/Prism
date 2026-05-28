import { useDocumentStore } from '../domains/document/store';
import { useSettingsStore } from '../domains/settings/store';
import { useWorkspaceStore } from '../domains/workspace/store';
import { t, useI18n } from '../domains/i18n';

type SettingsStoreState = ReturnType<typeof useSettingsStore.getState>;

export interface AppSettingsSnapshot {
  autoSaveEnabled: SettingsStoreState['autoSaveEnabled'];
  autoSaveInterval: SettingsStoreState['autoSaveInterval'];
  contentTheme: SettingsStoreState['contentTheme'];
  exportDefaults: SettingsStoreState['exportDefaults'];
  loadSettings: SettingsStoreState['loadSettings'];
  locale: SettingsStoreState['locale'];
  recentFiles: SettingsStoreState['recentFiles'];
  shortcutStyle: SettingsStoreState['shortcutStyle'];
  themeRegistryVersion: SettingsStoreState['themeRegistryVersion'];
  wordWrap: SettingsStoreState['wordWrap'];
}

export function useAppStoreSnapshotModel() {
  const { locale, localePreference } = useI18n();
  const currentDocument = useDocumentStore((state) => state.currentDocument);
  const workspace = useWorkspaceStore();

  const settings: AppSettingsSnapshot = {
    autoSaveEnabled: useSettingsStore((state) => state.autoSaveEnabled),
    autoSaveInterval: useSettingsStore((state) => state.autoSaveInterval),
    contentTheme: useSettingsStore((state) => state.contentTheme),
    exportDefaults: useSettingsStore((state) => state.exportDefaults),
    loadSettings: useSettingsStore((state) => state.loadSettings),
    locale: useSettingsStore((state) => state.locale),
    recentFiles: useSettingsStore((state) => state.recentFiles),
    shortcutStyle: useSettingsStore((state) => state.shortcutStyle),
    themeRegistryVersion: useSettingsStore((state) => state.themeRegistryVersion),
    wordWrap: useSettingsStore((state) => state.wordWrap),
  };

  return {
    currentDocument,
    locale,
    localePreference,
    settings,
    titleDirty: currentDocument?.isDirty ?? false,
    titleDocName: currentDocument?.name ?? t('common.untitled'),
    workspace,
  };
}
