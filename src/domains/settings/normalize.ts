import {
  DEFAULT_SETTINGS,
  type AutoSaveStrategy,
  type AppearanceMode,
  type CitationSettings,
  type CustomFont,
  type DocxFontPolicy,
  type DefaultViewMode,
  type ExportDefaultLocation,
  type ExportDefaultFormat,
  type ExportHistoryEntry,
  type ExportHistorySettings,
  type ExportTemplateId,
  type FontSource,
  type FontSourceKind,
  type LastSessionState,
  type PandocSettings,
  type PdfMargin,
  type PdfPaper,
  type RecentFileEntry,
  type SettingsState,
  type ShortcutStyle,
  isContentTheme,
} from './types';
import { normalizeLocalePreference } from '../i18n';

function isAppearanceMode(value: unknown): value is AppearanceMode {
  return value === 'light' || value === 'dark' || value === 'auto';
}

function isDefaultViewMode(value: unknown): value is DefaultViewMode {
  return value === 'edit' || value === 'split' || value === 'preview';
}

function isShortcutStyle(value: unknown): value is ShortcutStyle {
  return value === 'auto' || value === 'mac' || value === 'windows';
}

function isAutoSaveStrategy(value: unknown): value is AutoSaveStrategy {
  return value === 'instant' || value === 'balanced' || value === 'battery';
}

function isExportDefaultFormat(value: unknown): value is ExportDefaultFormat {
  return value === 'html' || value === 'pdf' || value === 'docx' || value === 'png';
}

function isPdfPaper(value: unknown): value is PdfPaper {
  return value === 'a4' || value === 'letter';
}

function isPdfMargin(value: unknown): value is PdfMargin {
  return value === 'compact' || value === 'standard' || value === 'wide';
}

function isExportTemplateId(value: unknown): value is ExportTemplateId {
  return value === 'theme' || value === 'business' || value === 'plain' || value === 'academic';
}

function isExportDefaultLocation(value: unknown): value is ExportDefaultLocation {
  return value === 'ask' || value === 'document' || value === 'downloads' || value === 'custom';
}

function isDocxFontPolicy(value: unknown): value is DocxFontPolicy {
  return value === 'theme' || value === 'preview' || value === 'custom';
}

function isFontSourceKind(value: unknown): value is FontSourceKind {
  return value === 'theme' || value === 'builtin' || value === 'system' || value === 'custom';
}

function numberInRange(value: unknown, fallback: number, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

function booleanOrDefault(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function stringOrDefault(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function exportTextOrDefault(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback;
  return value.replace(/\s+/g, ' ').trim().slice(0, 160);
}

function optionalText(value: unknown, maxLength: number): string {
  if (typeof value !== 'string') return '';
  return value.replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function optionalPath(value: unknown, maxLength = 1000): string {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLength);
}

function inferAutoSaveStrategy(interval: number): AutoSaveStrategy {
  if (interval <= 1000) return 'instant';
  if (interval <= 4000) return 'balanced';
  return 'battery';
}

function normalizeFontSource(value: unknown, fallback: FontSource): FontSource {
  if (!value || typeof value !== 'object') return fallback;
  const source = value as Partial<FontSource>;
  return {
    kind: isFontSourceKind(source.kind) ? source.kind : fallback.kind,
    value: typeof source.value === 'string' ? source.value : fallback.value,
  };
}

function normalizeCustomFonts(value: unknown): CustomFont[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((font): CustomFont | null => {
      if (!font || typeof font !== 'object') return null;
      const candidate = font as Partial<CustomFont>;
      if (
        typeof candidate.id !== 'string' ||
        typeof candidate.family !== 'string' ||
        typeof candidate.displayName !== 'string' ||
        typeof candidate.filename !== 'string' ||
        typeof candidate.path !== 'string' ||
        !(candidate.format === 'ttf' || candidate.format === 'otf' || candidate.format === 'woff' || candidate.format === 'woff2')
      ) {
        return null;
      }
      return {
        id: candidate.id,
        family: candidate.family,
        displayName: candidate.displayName,
        filename: candidate.filename,
        path: candidate.path,
        format: candidate.format,
        importedAt: typeof candidate.importedAt === 'number' ? candidate.importedAt : Date.now(),
      };
    })
    .filter((font): font is CustomFont => Boolean(font));
}

export function normalizeRecentFiles(value: unknown, limit = DEFAULT_SETTINGS.recentFilesLimit): RecentFileEntry[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const normalized: RecentFileEntry[] = [];

  for (const file of value) {
    if (!file || typeof file !== 'object') continue;
    const candidate = file as Partial<RecentFileEntry>;
    if (typeof candidate.path !== 'string' || !candidate.path.trim()) continue;
    const key = candidate.path.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    normalized.push({
      path: candidate.path,
      name: stringOrDefault(candidate.name, candidate.path.split(/[\\/]/).pop() || candidate.path),
      lastOpened: typeof candidate.lastOpened === 'number' ? candidate.lastOpened : Date.now(),
    });
  }

  return normalized
    .sort((a, b) => b.lastOpened - a.lastOpened)
    .slice(0, limit);
}

function normalizeExportHistorySettings(value: unknown): ExportHistorySettings {
  const settings = value && typeof value === 'object'
    ? value as Partial<ExportHistorySettings>
    : {};
  const legacySettings = settings as Partial<ExportHistorySettings> & {
    pdfHeaderFooter?: unknown;
    pdfHeaderText?: unknown;
    pdfFooterText?: unknown;
  };
  const defaults = DEFAULT_SETTINGS.exportDefaults;

  return {
    contentTheme: isContentTheme(settings.contentTheme)
      ? settings.contentTheme
      : DEFAULT_SETTINGS.contentTheme,
    htmlIncludeTheme: booleanOrDefault(settings.htmlIncludeTheme, defaults.htmlIncludeTheme),
    pngScale: numberInRange(settings.pngScale, defaults.pngScale, 1, 4),
    pdfPaper: isPdfPaper(settings.pdfPaper) ? settings.pdfPaper : defaults.pdfPaper,
    pdfMargin: isPdfMargin(settings.pdfMargin) ? settings.pdfMargin : defaults.pdfMargin,
    pdfPageNumbers: booleanOrDefault(settings.pdfPageNumbers, defaults.pdfPageNumbers),
    pageHeaderFooter: booleanOrDefault(
      settings.pageHeaderFooter ?? legacySettings.pdfHeaderFooter,
      defaults.pageHeaderFooter,
    ),
    pageHeaderText: exportTextOrDefault(
      settings.pageHeaderText ?? legacySettings.pdfHeaderText,
      defaults.pageHeaderText,
    ),
    pageFooterText: exportTextOrDefault(
      settings.pageFooterText ?? legacySettings.pdfFooterText,
      defaults.pageFooterText,
    ),
    templateId: isExportTemplateId(settings.templateId) ? settings.templateId : defaults.templateId,
    frontMatterOverrides: booleanOrDefault(settings.frontMatterOverrides, defaults.frontMatterOverrides),
    toc: booleanOrDefault(settings.toc, defaults.toc),
    defaultLocation: isExportDefaultLocation(settings.defaultLocation)
      ? settings.defaultLocation
      : defaults.defaultLocation,
    docxFontPolicy: isDocxFontPolicy(settings.docxFontPolicy)
      ? settings.docxFontPolicy
      : defaults.docxFontPolicy,
    docxCustomFontId: typeof settings.docxCustomFontId === 'string'
      ? settings.docxCustomFontId
      : defaults.docxCustomFontId,
  };
}

export function normalizeExportHistory(value: unknown, limit = 50): ExportHistoryEntry[] {
  if (!Array.isArray(value)) return [];
  const candidates: ExportHistoryEntry[] = [];

  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const candidate = item as Partial<ExportHistoryEntry>;
    if (typeof candidate.documentPath !== 'string' || !candidate.documentPath.trim()) continue;
    if (typeof candidate.outputPath !== 'string' || !candidate.outputPath.trim()) continue;
    if (!isExportDefaultFormat(candidate.format)) continue;

    candidates.push({
      documentPath: candidate.documentPath,
      documentName: stringOrDefault(candidate.documentName, candidate.documentPath.split(/[\\/]/).pop() || 'Untitled.md'),
      format: candidate.format,
      outputPath: candidate.outputPath,
      settings: normalizeExportHistorySettings(candidate.settings),
      exportedAt: typeof candidate.exportedAt === 'number' && Number.isFinite(candidate.exportedAt)
        ? candidate.exportedAt
        : Date.now(),
    });
  }

  const seen = new Set<string>();
  return candidates
    .sort((a, b) => b.exportedAt - a.exportedAt)
    .filter((entry) => {
      const key = entry.documentPath.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, limit);
}

export function normalizePandocSettings(value: unknown): PandocSettings {
  if (!value || typeof value !== 'object') return DEFAULT_SETTINGS.pandoc;
  const candidate = value as Partial<PandocSettings>;
  const lastCheckedAt = typeof candidate.lastCheckedAt === 'number' && Number.isFinite(candidate.lastCheckedAt)
    ? Math.max(0, candidate.lastCheckedAt)
    : null;
  const detected = booleanOrDefault(candidate.detected, DEFAULT_SETTINGS.pandoc.detected);
  const version = optionalText(candidate.version, 160);
  const lastError = optionalText(candidate.lastError, 500);

  return {
    path: typeof candidate.path === 'string'
      ? candidate.path.trim()
      : DEFAULT_SETTINGS.pandoc.path,
    detected,
    version: detected ? version : '',
    lastCheckedAt,
    lastError: detected ? '' : lastError,
  };
}

export function normalizeCitationSettings(value: unknown): CitationSettings {
  if (!value || typeof value !== 'object') return DEFAULT_SETTINGS.citation;
  const candidate = value as Partial<CitationSettings>;
  return {
    bibliographyPath: optionalPath(candidate.bibliographyPath),
    cslStylePath: optionalPath(candidate.cslStylePath),
  };
}

function normalizeLastSession(value: unknown): LastSessionState | null {
  if (!value || typeof value !== 'object') return null;
  const session = value as Partial<LastSessionState>;
  const filePath = typeof session.filePath === 'string' ? session.filePath : undefined;
  const folderPath = typeof session.folderPath === 'string' ? session.folderPath : undefined;
  if (!filePath && !folderPath) return null;
  const rawScrollState = session.scrollState;
  const scrollState = rawScrollState && typeof rawScrollState === 'object'
    ? {
        editorRatio: clampRatio((rawScrollState as { editorRatio?: unknown }).editorRatio),
        previewRatio: clampRatio((rawScrollState as { previewRatio?: unknown }).previewRatio),
      }
    : undefined;

  return {
    filePath,
    folderPath,
    viewMode: isDefaultViewMode(session.viewMode) ? session.viewMode : undefined,
    scrollState,
    sidebarVisible: typeof session.sidebarVisible === 'boolean' ? session.sidebarVisible : undefined,
    sidebarTab: session.sidebarTab === 'files' || session.sidebarTab === 'outline' || session.sidebarTab === 'search'
      ? session.sidebarTab
      : undefined,
    updatedAt: typeof session.updatedAt === 'number' ? session.updatedAt : Date.now(),
  };
}

function clampRatio(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.min(1, value))
    : 0;
}

function migrateEditorFontSource(saved: Partial<SettingsState>): FontSource {
  if (saved.editorFontSource) {
    return normalizeFontSource(saved.editorFontSource, DEFAULT_SETTINGS.editorFontSource);
  }
  if (
    typeof saved.editorFontFamily === 'string' &&
    saved.editorFontFamily.trim() &&
    saved.editorFontFamily !== DEFAULT_SETTINGS.editorFontFamily
  ) {
    return { kind: 'builtin', value: saved.editorFontFamily };
  }
  return DEFAULT_SETTINGS.editorFontSource;
}

function migratePreviewFontSource(saved: Partial<SettingsState>): FontSource {
  if (saved.previewFontSource) {
    return normalizeFontSource(saved.previewFontSource, DEFAULT_SETTINGS.previewFontSource);
  }
  if (
    typeof saved.previewFontFamily === 'string' &&
    saved.previewFontFamily.trim() &&
    saved.previewFontFamily !== 'inherit'
  ) {
    return { kind: 'builtin', value: saved.previewFontFamily };
  }
  return DEFAULT_SETTINGS.previewFontSource;
}

export function normalizeSettings(saved: Partial<SettingsState>): SettingsState {
  const exportDefaults =
    saved.exportDefaults && typeof saved.exportDefaults === 'object'
      ? saved.exportDefaults
      : {} as Partial<SettingsState['exportDefaults']>;
  const legacyExportDefaults = exportDefaults as Partial<SettingsState['exportDefaults']> & {
    pdfHeaderFooter?: unknown;
    pdfHeaderText?: unknown;
    pdfFooterText?: unknown;
  };
  const autoSaveInterval = numberInRange(
    saved.autoSaveInterval,
    DEFAULT_SETTINGS.autoSaveInterval,
    500,
    60000,
  );
  const recentFilesLimit = numberInRange(
    saved.recentFilesLimit,
    DEFAULT_SETTINGS.recentFilesLimit,
    5,
    20,
  );

  return {
    ...DEFAULT_SETTINGS,
    ...saved,
    settingsVersion: DEFAULT_SETTINGS.settingsVersion,
    locale: normalizeLocalePreference(saved.locale),
    theme: isAppearanceMode(saved.theme) ? saved.theme : DEFAULT_SETTINGS.theme,
    contentTheme: isContentTheme(saved.contentTheme)
      ? saved.contentTheme
      : DEFAULT_SETTINGS.contentTheme,
    fontSize: numberInRange(saved.fontSize, DEFAULT_SETTINGS.fontSize, 10, 32),
    editorFontFamily: stringOrDefault(saved.editorFontFamily, DEFAULT_SETTINGS.editorFontFamily),
    editorLineHeight: numberInRange(
      saved.editorLineHeight,
      DEFAULT_SETTINGS.editorLineHeight,
      1.1,
      3,
    ),
    previewFontFamily: stringOrDefault(saved.previewFontFamily, DEFAULT_SETTINGS.previewFontFamily),
    previewFontSize: numberInRange(saved.previewFontSize, DEFAULT_SETTINGS.previewFontSize, 10, 36),
    defaultViewMode: isDefaultViewMode(saved.defaultViewMode)
      ? saved.defaultViewMode
      : DEFAULT_SETTINGS.defaultViewMode,
    exportDefaults: {
      ...DEFAULT_SETTINGS.exportDefaults,
      format: isExportDefaultFormat(exportDefaults.format)
        ? exportDefaults.format
        : DEFAULT_SETTINGS.exportDefaults.format,
      pngScale: numberInRange(
        exportDefaults.pngScale,
        DEFAULT_SETTINGS.exportDefaults.pngScale,
        1,
        4,
      ),
      htmlIncludeTheme: booleanOrDefault(
        exportDefaults.htmlIncludeTheme,
        DEFAULT_SETTINGS.exportDefaults.htmlIncludeTheme,
      ),
      pdfPaper: isPdfPaper(exportDefaults.pdfPaper)
        ? exportDefaults.pdfPaper
        : DEFAULT_SETTINGS.exportDefaults.pdfPaper,
      pdfMargin: isPdfMargin(exportDefaults.pdfMargin)
        ? exportDefaults.pdfMargin
        : DEFAULT_SETTINGS.exportDefaults.pdfMargin,
      pdfPageNumbers: booleanOrDefault(
        exportDefaults.pdfPageNumbers,
        DEFAULT_SETTINGS.exportDefaults.pdfPageNumbers,
      ),
      pageHeaderFooter: booleanOrDefault(
        exportDefaults.pageHeaderFooter ?? legacyExportDefaults.pdfHeaderFooter,
        DEFAULT_SETTINGS.exportDefaults.pageHeaderFooter,
      ),
      pageHeaderText: exportTextOrDefault(
        exportDefaults.pageHeaderText ?? legacyExportDefaults.pdfHeaderText,
        DEFAULT_SETTINGS.exportDefaults.pageHeaderText,
      ),
      pageFooterText: exportTextOrDefault(
        exportDefaults.pageFooterText ?? legacyExportDefaults.pdfFooterText,
        DEFAULT_SETTINGS.exportDefaults.pageFooterText,
      ),
      templateId: isExportTemplateId(exportDefaults.templateId)
        ? exportDefaults.templateId
        : DEFAULT_SETTINGS.exportDefaults.templateId,
      frontMatterOverrides: booleanOrDefault(
        exportDefaults.frontMatterOverrides,
        DEFAULT_SETTINGS.exportDefaults.frontMatterOverrides,
      ),
      toc: booleanOrDefault(
        exportDefaults.toc,
        DEFAULT_SETTINGS.exportDefaults.toc,
      ),
      defaultLocation: isExportDefaultLocation(exportDefaults.defaultLocation)
        ? exportDefaults.defaultLocation
        : DEFAULT_SETTINGS.exportDefaults.defaultLocation,
      customDirectory: typeof exportDefaults.customDirectory === 'string'
        ? exportDefaults.customDirectory
        : DEFAULT_SETTINGS.exportDefaults.customDirectory,
      docxFontPolicy: isDocxFontPolicy(exportDefaults.docxFontPolicy)
        ? exportDefaults.docxFontPolicy
        : DEFAULT_SETTINGS.exportDefaults.docxFontPolicy,
      docxCustomFontId: typeof exportDefaults.docxCustomFontId === 'string'
        ? exportDefaults.docxCustomFontId
        : DEFAULT_SETTINGS.exportDefaults.docxCustomFontId,
    },
    shortcutStyle: isShortcutStyle(saved.shortcutStyle)
      ? saved.shortcutStyle
      : DEFAULT_SETTINGS.shortcutStyle,
    autoSaveEnabled: booleanOrDefault(saved.autoSaveEnabled, DEFAULT_SETTINGS.autoSaveEnabled),
    autoSaveInterval,
    autoSaveStrategy: isAutoSaveStrategy(saved.autoSaveStrategy)
      ? saved.autoSaveStrategy
      : inferAutoSaveStrategy(autoSaveInterval),
    showLineNumbers: booleanOrDefault(saved.showLineNumbers, DEFAULT_SETTINGS.showLineNumbers),
    wordWrap: booleanOrDefault(saved.wordWrap, DEFAULT_SETTINGS.wordWrap),
    customFonts: normalizeCustomFonts(saved.customFonts),
    editorFontSource: migrateEditorFontSource(saved),
    previewFontSource: migratePreviewFontSource(saved),
    recentFilesLimit,
    recentFiles: normalizeRecentFiles(saved.recentFiles, recentFilesLimit),
    exportHistory: normalizeExportHistory(saved.exportHistory),
    pandoc: normalizePandocSettings(saved.pandoc),
    citation: normalizeCitationSettings(saved.citation),
    restoreLastSession: booleanOrDefault(saved.restoreLastSession, DEFAULT_SETTINGS.restoreLastSession),
    lastSession: normalizeLastSession(saved.lastSession),
    windowState: {
      ...DEFAULT_SETTINGS.windowState,
      ...saved.windowState,
    },
  };
}
