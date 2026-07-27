import { create } from 'zustand';
import {
  SettingsState,
  DEFAULT_SETTINGS,
  LocalePreference,
  ContentTheme,
  AppearanceMode,
  DefaultViewMode,
  ExportDefaultFormat,
  ShortcutStyle,
  AutoSaveStrategy,
  CitationSettings,
  CustomFont,
  DocxFontPolicy,
  ExportDefaultLocation,
  ExportHistoryEntry,
  ExportTemplateId,
  FontSource,
  LastSessionState,
  PandocSettings,
  PdfMargin,
  PdfPaper,
  RecentFileEntry,
} from './types';
import { applyLocaleRuntime, t } from '../i18n';
import {
  normalizeCitationSettings,
  normalizeExportHistory,
  normalizePandocSettings,
  normalizeRecentFiles,
  normalizeSettings,
} from './normalize';
import {
  applyThemeRuntime,
  initializeThemeRegistry,
  isRegisteredContentTheme,
  reloadThemeRegistry,
  type ThemeRegistryEntry,
} from '../themes';
import {
  exists,
  mkdir,
  readTextFile,
  writeTextFile,
} from '../../platform/tauri/fileSystem';
import { appDataDir } from '../../platform/tauri/path';
import { invokeNativeCommand } from '../../platform/tauri/nativeCommands';
import { isNativeCommandUnavailableError } from '../../platform/tauri/result';
import { readSettingsFileNative, writeSettingsFileNative } from '../../platform/tauri/settingsStorage';
import { emitAppEvent } from '../../platform/events/appEvents';
import { initPerfInstrumentation, markPerf } from '../../lib/performanceInstrumentation';
import { joinPath } from '../workspace/services/path';

const CONFIG_FILENAME = 'config.json';
const LEGACY_RECENT_FILES_KEY = 'prism_recent_files';

export const autoSaveIntervalByStrategy: Record<AutoSaveStrategy, number> = {
  instant: 500,
  balanced: 2000,
  battery: 8000,
};

async function getConfigPath(): Promise<string> {
  const appData = await appDataDir();
  return joinPath(appData, CONFIG_FILENAME);
}

async function readSettingsFile(): Promise<string | null> {
  try {
    const raw = await readSettingsFileNative();
    if (typeof raw === 'string' || raw === null) return raw;
  } catch (error) {
    if (!isNativeCommandUnavailableError(error)) throw error;
  }

  try {
    return await readTextFile(await getConfigPath());
  } catch {
    return null;
  }
}

async function writeSettingsFile(contents: string): Promise<void> {
  try {
    await writeSettingsFileNative(contents);
    return;
  } catch (error) {
    if (!isNativeCommandUnavailableError(error)) throw error;
  }

  const appData = await appDataDir();
  const dirExists = await exists(appData);
  if (!dirExists) {
    await mkdir(appData, { recursive: true });
  }
  await writeTextFile(await getConfigPath(), contents);
}

async function loadLegacySettingsConfig(): Promise<Partial<SettingsState> | null> {
  const raw = await invokeNativeCommand<string | null>('read_legacy_settings_config');
  if (!raw) return null;
  return JSON.parse(raw) as Partial<SettingsState>;
}

function applyAppearanceTheme(theme: AppearanceMode) {
  let actualTheme: 'light' | 'dark' = 'light';
  if (theme === 'auto') {
    actualTheme = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  } else {
    actualTheme = theme;
  }

  const classes = Array.from(document.body.classList).filter(c => c !== 'light' && c !== 'dark');
  document.body.className = [...classes, actualTheme].join(' ');
}

function migrateLegacyRecentFiles(limit: number): RecentFileEntry[] {
  try {
    const stored = localStorage.getItem(LEGACY_RECENT_FILES_KEY);
    if (!stored) return [];
    return normalizeRecentFiles(JSON.parse(stored), limit);
  } catch {
    return [];
  }
}

async function applyContentTheme(contentTheme: ContentTheme) {
  return applyThemeRuntime(contentTheme);
}

function resolveFontFamily(source: FontSource, customFonts: CustomFont[], fallback: string): string {
  if (source.kind === 'theme') return fallback;
  if (source.kind === 'custom') {
    return customFonts.find((font) => font.id === source.value)?.family ?? fallback;
  }
  return source.value || fallback;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  if (typeof error === 'string' && error.trim()) return error;
  return t('settings.pandocDetectionFailed');
}

function getPersistenceErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  if (typeof error === 'string' && error.trim()) return error;
  return t('common.unknownEventError');
}

function showSettingsSaveFailed(error: unknown) {
  if (typeof window === 'undefined') return;
  emitAppEvent('toast.show', {
    tone: 'error',
    title: t('settings.saveFailed'),
    message: getPersistenceErrorMessage(error),
  });
}

async function registerLoadedCustomFonts(customFonts: CustomFont[]) {
  if (customFonts.length === 0) return;
  const { registerCustomFonts } = await import('./fontService');
  await registerCustomFonts(customFonts);
}

interface SettingsStore extends SettingsState {
  themeRegistryVersion: number;
  themeRegistry: ThemeRegistryEntry[];
  setLocale: (locale: LocalePreference) => void;
  setTheme: (theme: AppearanceMode) => void;
  setContentTheme: (theme: ContentTheme) => Promise<void>;
  reloadThemeRegistry: () => Promise<ThemeRegistryEntry[]>;
  setFontSize: (size: number) => void;
  setEditorFontFamily: (family: string) => void;
  setEditorLineHeight: (lineHeight: number) => void;
  setPreviewFontFamily: (family: string) => void;
  setPreviewFontSize: (size: number) => void;
  setEditorFontSource: (source: FontSource) => void;
  setPreviewFontSource: (source: FontSource) => void;
  addCustomFont: (font: CustomFont) => void;
  removeCustomFont: (fontId: string) => void;
  setDefaultViewMode: (viewMode: DefaultViewMode) => void;
  setExportDefaultFormat: (format: ExportDefaultFormat) => void;
  setExportPngScale: (scale: number) => void;
  setExportHtmlIncludeTheme: (includeTheme: boolean) => void;
  setExportPdfPaper: (paper: PdfPaper) => void;
  setExportPdfMargin: (margin: PdfMargin) => void;
  setExportPdfPageNumbers: (enabled: boolean) => void;
  setExportPageHeaderFooter: (enabled: boolean) => void;
  setExportPageHeaderText: (text: string) => void;
  setExportPageFooterText: (text: string) => void;
  setExportTemplateId: (templateId: ExportTemplateId) => void;
  setExportFrontMatterOverrides: (enabled: boolean) => void;
  setExportToc: (enabled: boolean) => void;
  setExportDefaultLocation: (location: ExportDefaultLocation) => void;
  setExportCustomDirectory: (directory: string) => void;
  setExportDocxFontPolicy: (policy: DocxFontPolicy) => void;
  setExportDocxCustomFontId: (fontId: string) => void;
  setPandocPath: (path: string) => void;
  setPandocDetection: (pandoc: PandocSettings) => void;
  detectPandoc: () => Promise<PandocSettings>;
  setCitationBibliographyPath: (path: string) => void;
  setCitationCslStylePath: (path: string) => void;
  setCitationSettings: (citation: CitationSettings) => void;
  setShortcutStyle: (style: ShortcutStyle) => void;
  setAutoSaveEnabled: (enabled: boolean) => void;
  setAutoSaveInterval: (interval: number) => void;
  setAutoSaveStrategy: (strategy: AutoSaveStrategy) => void;
  setShowLineNumbers: (show: boolean) => void;
  setWordWrap: (wordWrap: boolean) => void;
  addRecentFile: (path: string, name: string) => void;
  clearRecentFiles: () => void;
  setRecentFilesLimit: (limit: number) => void;
  recordExportHistory: (entry: Omit<ExportHistoryEntry, 'exportedAt'> & { exportedAt?: number }) => void;
  setRestoreLastSession: (restore: boolean) => void;
  setLastSession: (session: LastSessionState | null) => void;
  loadSettings: () => Promise<void>;
  saveSettings: () => Promise<void>;
}

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  ...DEFAULT_SETTINGS,
  themeRegistryVersion: 0,
  themeRegistry: [],

  setLocale: (locale) => {
    set({ locale });
    applyLocaleRuntime(locale);
    get().saveSettings();
  },

  setTheme: (theme) => {
    set({ theme });
    applyAppearanceTheme(theme);
    get().saveSettings();
  },

  setContentTheme: async (contentTheme) => {
    const result = await applyContentTheme(contentTheme);
    set({ contentTheme: result.themeId });
    await get().saveSettings();
  },

  reloadThemeRegistry: async () => {
    const themeRegistry = await reloadThemeRegistry();
    set((state) => ({
      themeRegistry,
      themeRegistryVersion: state.themeRegistryVersion + 1,
    }));
    return themeRegistry;
  },

  setFontSize: (fontSize) => {
    set({ fontSize });
    get().saveSettings();
  },

  setEditorFontFamily: (editorFontFamily) => {
    set({
      editorFontFamily,
      editorFontSource: { kind: 'builtin', value: editorFontFamily },
    });
    get().saveSettings();
  },

  setEditorLineHeight: (editorLineHeight) => {
    set({ editorLineHeight });
    get().saveSettings();
  },

  setPreviewFontFamily: (previewFontFamily) => {
    set({
      previewFontFamily,
      previewFontSource: previewFontFamily === 'inherit'
        ? { kind: 'theme', value: '' }
        : { kind: 'builtin', value: previewFontFamily },
    });
    get().saveSettings();
  },

  setPreviewFontSize: (previewFontSize) => {
    set({ previewFontSize });
    get().saveSettings();
  },

  setEditorFontSource: (editorFontSource) => {
    const state = get();
    set({
      editorFontSource,
      editorFontFamily: resolveFontFamily(
        editorFontSource,
        state.customFonts,
        DEFAULT_SETTINGS.editorFontFamily,
      ),
    });
    get().saveSettings();
  },

  setPreviewFontSource: (previewFontSource) => {
    const state = get();
    set({
      previewFontSource,
      previewFontFamily: previewFontSource.kind === 'theme'
        ? 'inherit'
        : resolveFontFamily(previewFontSource, state.customFonts, DEFAULT_SETTINGS.previewFontFamily),
    });
    get().saveSettings();
  },

  addCustomFont: (font) => {
    set((state) => ({
      customFonts: [
        font,
        ...state.customFonts.filter((item) => item.id !== font.id && item.path !== font.path),
      ],
    }));
    get().saveSettings();
  },

  removeCustomFont: (fontId) => {
    set((state) => {
      const customFonts = state.customFonts.filter((font) => font.id !== fontId);
      const editorFontSource = state.editorFontSource.kind === 'custom' && state.editorFontSource.value === fontId
        ? DEFAULT_SETTINGS.editorFontSource
        : state.editorFontSource;
      const previewFontSource = state.previewFontSource.kind === 'custom' && state.previewFontSource.value === fontId
        ? DEFAULT_SETTINGS.previewFontSource
        : state.previewFontSource;
      const docxCustomFontId = state.exportDefaults.docxCustomFontId === fontId
        ? ''
        : state.exportDefaults.docxCustomFontId;

      return {
        customFonts,
        editorFontSource,
        previewFontSource,
        editorFontFamily: resolveFontFamily(editorFontSource, customFonts, DEFAULT_SETTINGS.editorFontFamily),
        previewFontFamily: previewFontSource.kind === 'theme'
          ? 'inherit'
          : resolveFontFamily(previewFontSource, customFonts, DEFAULT_SETTINGS.previewFontFamily),
        exportDefaults: { ...state.exportDefaults, docxCustomFontId },
      };
    });
    get().saveSettings();
  },

  setDefaultViewMode: (defaultViewMode) => {
    set({ defaultViewMode });
    get().saveSettings();
  },

  setExportDefaultFormat: (format) => {
    set((state) => ({ exportDefaults: { ...state.exportDefaults, format } }));
    get().saveSettings();
  },

  setExportPngScale: (pngScale) => {
    set((state) => ({ exportDefaults: { ...state.exportDefaults, pngScale } }));
    get().saveSettings();
  },

  setExportHtmlIncludeTheme: (htmlIncludeTheme) => {
    set((state) => ({ exportDefaults: { ...state.exportDefaults, htmlIncludeTheme } }));
    get().saveSettings();
  },

  setExportPdfPaper: (pdfPaper) => {
    set((state) => ({ exportDefaults: { ...state.exportDefaults, pdfPaper } }));
    get().saveSettings();
  },

  setExportPdfMargin: (pdfMargin) => {
    set((state) => ({ exportDefaults: { ...state.exportDefaults, pdfMargin } }));
    get().saveSettings();
  },

  setExportPdfPageNumbers: (pdfPageNumbers) => {
    set((state) => ({ exportDefaults: { ...state.exportDefaults, pdfPageNumbers } }));
    get().saveSettings();
  },

  setExportPageHeaderFooter: (pageHeaderFooter) => {
    set((state) => ({ exportDefaults: { ...state.exportDefaults, pageHeaderFooter } }));
    get().saveSettings();
  },

  setExportPageHeaderText: (pageHeaderText) => {
    set((state) => ({ exportDefaults: { ...state.exportDefaults, pageHeaderText } }));
    get().saveSettings();
  },

  setExportPageFooterText: (pageFooterText) => {
    set((state) => ({ exportDefaults: { ...state.exportDefaults, pageFooterText } }));
    get().saveSettings();
  },

  setExportTemplateId: (templateId) => {
    set((state) => ({ exportDefaults: { ...state.exportDefaults, templateId } }));
    get().saveSettings();
  },

  setExportFrontMatterOverrides: (frontMatterOverrides) => {
    set((state) => ({ exportDefaults: { ...state.exportDefaults, frontMatterOverrides } }));
    get().saveSettings();
  },

  setExportToc: (toc) => {
    set((state) => ({ exportDefaults: { ...state.exportDefaults, toc } }));
    get().saveSettings();
  },

  setExportDefaultLocation: (defaultLocation) => {
    set((state) => ({ exportDefaults: { ...state.exportDefaults, defaultLocation } }));
    get().saveSettings();
  },

  setExportCustomDirectory: (customDirectory) => {
    set((state) => ({ exportDefaults: { ...state.exportDefaults, customDirectory } }));
    get().saveSettings();
  },

  setExportDocxFontPolicy: (docxFontPolicy) => {
    set((state) => ({ exportDefaults: { ...state.exportDefaults, docxFontPolicy } }));
    get().saveSettings();
  },

  setExportDocxCustomFontId: (docxCustomFontId) => {
    set((state) => ({ exportDefaults: { ...state.exportDefaults, docxCustomFontId } }));
    get().saveSettings();
  },

  setPandocPath: (path) => {
    set((state) => ({
      pandoc: {
        ...state.pandoc,
        path,
        detected: false,
        version: '',
        lastCheckedAt: null,
        lastError: '',
      },
    }));
    get().saveSettings();
  },

  setPandocDetection: (pandoc) => {
    set({ pandoc: normalizePandocSettings(pandoc) });
    get().saveSettings();
  },

  detectPandoc: async () => {
    try {
      const result = await invokeNativeCommand<PandocSettings>('detect_pandoc', {
        path: get().pandoc.path || null,
      });
      const pandoc = normalizePandocSettings(result);
      set({ pandoc });
      await get().saveSettings();
      return pandoc;
    } catch (error) {
      const pandoc: PandocSettings = {
        ...get().pandoc,
        detected: false,
        version: '',
        lastCheckedAt: Date.now(),
        lastError: getErrorMessage(error),
      };
      set({ pandoc });
      await get().saveSettings();
      return pandoc;
    }
  },

  setCitationBibliographyPath: (bibliographyPath) => {
    set((state) => ({
      citation: normalizeCitationSettings({
        ...state.citation,
        bibliographyPath,
      }),
    }));
    get().saveSettings();
  },

  setCitationCslStylePath: (cslStylePath) => {
    set((state) => ({
      citation: normalizeCitationSettings({
        ...state.citation,
        cslStylePath,
      }),
    }));
    get().saveSettings();
  },

  setCitationSettings: (citation) => {
    set({ citation: normalizeCitationSettings(citation) });
    get().saveSettings();
  },

  setShortcutStyle: (shortcutStyle) => {
    set({ shortcutStyle });
    get().saveSettings();
  },

  setAutoSaveEnabled: (autoSaveEnabled) => {
    set({ autoSaveEnabled });
    get().saveSettings();
  },

  setAutoSaveInterval: (autoSaveInterval) => {
    set({ autoSaveInterval });
    get().saveSettings();
  },

  setAutoSaveStrategy: (autoSaveStrategy) => {
    set({
      autoSaveStrategy,
      autoSaveInterval: autoSaveIntervalByStrategy[autoSaveStrategy],
    });
    get().saveSettings();
  },

  setShowLineNumbers: (showLineNumbers) => {
    set({ showLineNumbers });
    get().saveSettings();
  },

  setWordWrap: (wordWrap) => {
    set({ wordWrap });
    get().saveSettings();
  },

  addRecentFile: (path, name) => {
    set((state) => {
      const recentFiles = normalizeRecentFiles([
        { path, name, lastOpened: Date.now() },
        ...state.recentFiles,
      ], state.recentFilesLimit);
      try {
        localStorage.setItem(LEGACY_RECENT_FILES_KEY, JSON.stringify(recentFiles));
      } catch {
        // Settings persistence remains the primary source.
      }
      return { recentFiles };
    });
    get().saveSettings();
  },

  clearRecentFiles: () => {
    try {
      localStorage.removeItem(LEGACY_RECENT_FILES_KEY);
    } catch {
      // Ignore localStorage compatibility failures.
    }
    set({ recentFiles: [] });
    get().saveSettings();
  },

  setRecentFilesLimit: (recentFilesLimit) => {
    const limit = Math.min(20, Math.max(5, recentFilesLimit));
    set((state) => ({
      recentFilesLimit: limit,
      recentFiles: normalizeRecentFiles(state.recentFiles, limit),
    }));
    get().saveSettings();
  },

  recordExportHistory: (entry) => {
    if (!entry.documentPath.trim() || !entry.outputPath.trim()) return;
    set((state) => ({
      exportHistory: normalizeExportHistory([
        {
          ...entry,
          exportedAt: entry.exportedAt ?? Date.now(),
        },
        ...state.exportHistory.filter((item) => item.documentPath !== entry.documentPath),
      ]),
    }));
    get().saveSettings();
  },

  setRestoreLastSession: (restoreLastSession) => {
    set({ restoreLastSession });
    get().saveSettings();
  },

  setLastSession: (lastSession) => {
    set({ lastSession });
    get().saveSettings();
  },

  loadSettings: async () => {
    const applyLoadedSettings = async (settings: SettingsState) => {
      const themeRegistry = await initializeThemeRegistry();
      let contentTheme = settings.contentTheme;
      if (!isRegisteredContentTheme(contentTheme)) {
        contentTheme = DEFAULT_SETTINGS.contentTheme;
      }

      set((state) => ({
        ...settings,
        contentTheme,
        themeRegistry,
        themeRegistryVersion: state.themeRegistryVersion + 1,
      }));

      applyLocaleRuntime(settings.locale);
      applyAppearanceTheme(settings.theme);
      await applyContentTheme(contentTheme);
      void registerLoadedCustomFonts(settings.customFonts);

      // 监听系统主题变化
      if (settings.theme === 'auto') {
        const mediaQuery = typeof window.matchMedia === 'function'
          ? window.matchMedia('(prefers-color-scheme: dark)')
          : null;
        if (mediaQuery) {
          const handleChange = (e: MediaQueryListEvent) => {
            const newTheme = e.matches ? 'dark' : 'light';
            const classes = Array.from(document.body.classList).filter(c => c !== 'light' && c !== 'dark');
            document.body.className = [...classes, newTheme].join(' ');
          };
          mediaQuery.addEventListener('change', handleChange);
        }
      }
    };

    try {
      const raw = await readSettingsFile();
      if (!raw) throw new Error('settings file missing');
      const saved = JSON.parse(raw) as Partial<SettingsState> & { perfInstrumentation?: boolean };
      // 诊断开关，不进入 normalizeSettings，因此不会被 saveSettings 回写。
      initPerfInstrumentation(saved.perfInstrumentation);
      markPerf('settings_loaded');
      const settings = normalizeSettings(saved);
      if (!saved.recentFiles) {
        settings.recentFiles = migrateLegacyRecentFiles(settings.recentFilesLimit);
      }

      await applyLoadedSettings(settings);
      if (settings.contentTheme !== get().contentTheme) {
        await get().saveSettings();
      }
    } catch {
      try {
        const legacySaved = await loadLegacySettingsConfig();
        if (legacySaved) {
          const settings = normalizeSettings(legacySaved);
          settings.lastSession = null;
          if (!legacySaved.recentFiles) {
            settings.recentFiles = migrateLegacyRecentFiles(settings.recentFilesLimit);
          }
          await applyLoadedSettings(settings);
          await get().saveSettings();
          return;
        }
      } catch {
        // If legacy migration fails, continue with defaults.
      }

      applyLocaleRuntime(DEFAULT_SETTINGS.locale);
      applyAppearanceTheme(DEFAULT_SETTINGS.theme);
      const themeRegistry = await initializeThemeRegistry().catch(() => []);
      set((state) => ({
        themeRegistry,
        themeRegistryVersion: state.themeRegistryVersion + 1,
      }));
      await applyContentTheme(DEFAULT_SETTINGS.contentTheme);

      // 监听系统主题变化
      const mediaQuery = typeof window.matchMedia === 'function'
        ? window.matchMedia('(prefers-color-scheme: dark)')
        : null;
      if (mediaQuery) {
        const handleChange = (e: MediaQueryListEvent) => {
          const newTheme = e.matches ? 'dark' : 'light';
          const classes = Array.from(document.body.classList).filter(c => c !== 'light' && c !== 'dark');
          document.body.className = [...classes, newTheme].join(' ');
        };
        mediaQuery.addEventListener('change', handleChange);
      }
    }
  },

  saveSettings: async () => {
    try {
      const {
        settingsVersion,
        locale,
        theme,
        contentTheme,
        fontSize,
        editorFontFamily,
        editorLineHeight,
        previewFontFamily,
        previewFontSize,
        defaultViewMode,
        exportDefaults,
        shortcutStyle,
        autoSaveEnabled,
        autoSaveInterval,
        autoSaveStrategy,
        showLineNumbers,
        wordWrap,
        customFonts,
        editorFontSource,
        previewFontSource,
        recentFiles,
        recentFilesLimit,
        exportHistory,
        pandoc,
        citation,
        restoreLastSession,
        lastSession,
        windowState,
      } = get();
      const data = JSON.stringify(
        {
          settingsVersion,
          locale,
          theme,
          contentTheme,
          fontSize,
          editorFontFamily,
          editorLineHeight,
          previewFontFamily,
          previewFontSize,
          defaultViewMode,
          exportDefaults,
          shortcutStyle,
          autoSaveEnabled,
          autoSaveInterval,
          autoSaveStrategy,
          showLineNumbers,
          wordWrap,
          customFonts,
          editorFontSource,
          previewFontSource,
          recentFiles,
          recentFilesLimit,
          exportHistory,
          pandoc,
          citation,
          restoreLastSession,
          lastSession,
          windowState,
        },
        null,
        2,
      );
      await writeSettingsFile(data);
    } catch (err) {
      console.error('[Settings] Save failed:', err);
      showSettingsSaveFailed(err);
    }
  },
}));

export const __settingsStoreTesting = {
  getConfigPath,
  loadLegacySettingsConfig,
};
