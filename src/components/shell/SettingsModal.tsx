import { useEffect, useState, type CSSProperties } from 'react';
import { useSettingsStore } from '../../domains/settings/store';
import type {
  AutoSaveStrategy,
  ContentTheme,
  DefaultViewMode,
  DocxFontPolicy,
  ExportDefaultLocation,
  ExportTemplateId,
  FontSource,
  LocalePreference,
  PdfMargin,
  PdfPaper,
  ShortcutStyle,
} from '../../domains/settings/types';
import { LOCALE_PREFERENCES, t as translate, useI18n, type I18nKey } from '../../domains/i18n';
import {
  ThemeError,
  deleteInstalledUserTheme,
  getThemeErrorMessage,
  getThemeRegistrySnapshot,
  installThemeFromPath,
  openThemesDirectory,
} from '../../domains/themes';
import {
  BUILTIN_FONT_OPTIONS,
  SYSTEM_FONT_OPTIONS,
  deleteCustomFontFile,
  importCustomFont,
} from '../../domains/settings/fontService';
import {
  EXPORT_TEMPLATES,
  getExportTemplateDescription,
  getExportTemplateLabel,
} from '../../domains/export/templates';
import { normalizeExportQualityScale } from '../../domains/export/quality';
import type { ToastInput } from '../../lib/toast';
import { emitAppEvent } from '../../platform/events/appEvents';
import { openDialog } from '../../platform/tauri/dialogs';
import { useCitationSettingsModel } from './settings/useCitationSettingsModel';
import { useExportSettingsModel } from './settings/useExportSettingsModel';

interface SettingsModalProps {
  initialSection?: SettingsSectionId;
  visible: boolean;
  onClose: () => void;
}

const SETTINGS_SECTIONS = [
  { id: 'general', labelKey: 'settings.section.general', hintKey: 'settings.section.generalHint' },
  { id: 'writing', labelKey: 'settings.section.writing', hintKey: 'settings.section.writingHint' },
  { id: 'appearance', labelKey: 'settings.section.appearance', hintKey: 'settings.section.appearanceHint' },
  { id: 'export', labelKey: 'settings.section.export', hintKey: 'settings.section.exportHint' },
  { id: 'citation', labelKey: 'settings.section.citation', hintKey: 'settings.section.citationHint' },
  { id: 'files', labelKey: 'settings.section.files', hintKey: 'settings.section.filesHint' },
] as const;

type SettingsSectionId = typeof SETTINGS_SECTIONS[number]['id'];
type ThemeImportSource = 'folder' | 'archive';
type ThemePromptState =
  | {
    kind: 'import-source';
    resolve: (value: ThemeImportSource | null) => void;
  }
  | {
    kind: 'replace';
    themeId: string;
    resolve: (value: boolean) => void;
  }
  | {
    kind: 'delete';
    label: string;
    resolve: (value: boolean) => void;
  };

const localeLabelKeys: Record<LocalePreference, I18nKey> = {
  auto: 'locale.auto',
  'zh-CN': 'locale.zh-CN',
  'en-US': 'locale.en-US',
  'ja-JP': 'locale.ja-JP',
};

function encodeFontSource(source: FontSource) {
  return `${source.kind}:${source.value}`;
}

function decodeFontSource(value: string): FontSource {
  const [kind, ...rest] = value.split(':');
  const sourceValue = rest.join(':');
  if (kind === 'theme' || kind === 'builtin' || kind === 'system' || kind === 'custom') {
    return { kind, value: sourceValue };
  }
  return { kind: 'theme', value: '' };
}

function getFontSourceHint(source: FontSource, resolvedFamily: string) {
  return source.kind === 'theme' ? translate('settings.followTheme') : resolvedFamily;
}

function getPandocHint(settings: ReturnType<typeof useSettingsStore.getState>['pandoc']) {
  if (settings.detected && settings.version) return translate('settings.pandoc.detected', { version: settings.version });
  if (settings.lastError) return settings.lastError;
  return translate('settings.pandoc.hint');
}

function showSettingsToast(input: ToastInput) {
  emitAppEvent('toast.show', input);
}

export function SettingsModal({ initialSection = 'general', visible, onClose }: SettingsModalProps) {
  const { t } = useI18n();
  const settings = useSettingsStore();
  const [activeSection, setActiveSection] = useState<SettingsSectionId>('general');
  const [pandocChecking, setPandocChecking] = useState(false);
  const [themeBusy, setThemeBusy] = useState(false);
  const [themePrompt, setThemePrompt] = useState<ThemePromptState | null>(null);

  useEffect(() => {
    if (visible) setActiveSection(initialSection);
  }, [initialSection, visible]);

  useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (themePrompt) {
          if (themePrompt.kind === 'import-source') themePrompt.resolve(null);
          else themePrompt.resolve(false);
          setThemePrompt(null);
          return;
        }
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [visible, onClose, themePrompt]);

  const toggleClass = (on: boolean) => `toggle ${on ? 'on' : ''}`;
  const selectStyle: CSSProperties = {
    padding: '6px 10px',
    background: 'var(--c-canvas)',
    border: '1px solid var(--c-fog)',
    borderRadius: 'var(--r-link)',
    fontFamily: 'inherit',
    fontSize: 13,
    color: 'var(--c-void)',
    cursor: 'pointer',
    maxWidth: 220,
  };
  const buttonStyle: CSSProperties = {
    padding: '6px 12px',
    background: 'var(--c-canvas)',
    border: '1px solid var(--c-fog)',
    borderRadius: 'var(--r-link)',
    fontFamily: 'inherit',
    fontSize: 13,
    color: 'var(--c-void)',
    cursor: 'pointer',
  };
  const inputStyle: CSSProperties = {
    ...selectStyle,
    cursor: 'text',
    width: 220,
  };
  const citationPathInputStyle: CSSProperties = {
    ...inputStyle,
    width: 260,
    maxWidth: 320,
  };
  const citationSettingsModel = useCitationSettingsModel({
    bibliographyPath: settings.citation.bibliographyPath,
    cslStylePath: settings.citation.cslStylePath,
    pandocDetected: settings.pandoc.detected,
  });
  const exportSettingsModel = useExportSettingsModel(settings.exportDefaults);

  if (!visible) return null;

  const importFont = async () => {
    const result = await importCustomFont();
    if (result) settings.addCustomFont(result.font);
  };

  const requestThemeImportSource = () => new Promise<ThemeImportSource | null>((resolve) => {
    setThemePrompt({ kind: 'import-source', resolve });
  });

  const requestReplaceTheme = (themeId: string) => new Promise<boolean>((resolve) => {
    setThemePrompt({ kind: 'replace', themeId, resolve });
  });

  const requestDeleteTheme = (label: string) => new Promise<boolean>((resolve) => {
    setThemePrompt({ kind: 'delete', label, resolve });
  });

  const resolveThemePrompt = (value: ThemeImportSource | boolean | null) => {
    const prompt = themePrompt;
    if (!prompt) return;
    setThemePrompt(null);
    if (prompt.kind === 'import-source') {
      prompt.resolve(value === 'folder' || value === 'archive' ? value : null);
      return;
    }
    prompt.resolve(value === true);
  };

  const chooseThemePath = async () => {
    const source = await requestThemeImportSource();
    if (!source) return null;
    const selected = await openDialog({
      multiple: false,
      directory: source === 'folder',
      recursive: false,
      filters: source === 'folder'
        ? undefined
        : [{ name: 'Prism Themes', extensions: ['zip', 'prism-theme'] }],
    });
    return selected && !Array.isArray(selected) ? selected : null;
  };

  const importTheme = async (applyAfterImport: boolean) => {
    if (themeBusy) return;
    const selected = await chooseThemePath();
    if (!selected) return;

    setThemeBusy(true);
    try {
      let result;
      try {
        result = await installThemeFromPath(selected);
      } catch (error) {
        if (error instanceof ThemeError && error.code === 'theme_exists' && error.themeId) {
          const shouldReplace = await requestReplaceTheme(error.themeId);
          if (!shouldReplace) return;
          result = await installThemeFromPath(selected, { replace: true });
        } else {
          throw error;
        }
      }

      await settings.reloadThemeRegistry();
      if (applyAfterImport) {
        await settings.setContentTheme(result.id);
      }
      showSettingsToast({
        tone: 'success',
        title: applyAfterImport
          ? t('settings.importTheme.applied', { name: result.name })
          : t('settings.importTheme.imported', { name: result.name }),
        message: applyAfterImport ? t('settings.importTheme.appliedHint') : t('settings.importTheme.importedHint'),
      });
    } catch (error) {
      showSettingsToast({
        tone: 'error',
        title: t('settings.importTheme.title'),
        message: t('settings.importTheme.failed', { message: getThemeErrorMessage(error) }),
      });
    } finally {
      setThemeBusy(false);
    }
  };

  const reloadThemes = async () => {
    if (themeBusy) return;
    setThemeBusy(true);
    try {
      await settings.reloadThemeRegistry();
      await settings.setContentTheme(settings.contentTheme);
      showSettingsToast({
        tone: 'success',
        title: t('settings.theme.title'),
        message: t('settings.themeReloaded'),
      });
    } catch (error) {
      showSettingsToast({
        tone: 'error',
        title: t('settings.theme.title'),
        message: t('settings.themeReloadFailed', { message: getThemeErrorMessage(error) }),
      });
    } finally {
      setThemeBusy(false);
    }
  };

  const deleteCurrentTheme = async () => {
    if (themeBusy) return;
    const current = getThemeRegistrySnapshot().find((theme) => theme.id === settings.contentTheme)
      ?? settings.themeRegistry.find((theme) => theme.id === settings.contentTheme);
    if (!current || current.source !== 'user') return;
    const confirmed = await requestDeleteTheme(current.label);
    if (!confirmed) return;

    setThemeBusy(true);
    try {
      await settings.setContentTheme('miaoyan');
      await deleteInstalledUserTheme(current.id);
      await settings.reloadThemeRegistry();
      showSettingsToast({
        tone: 'success',
        title: t('settings.theme.title'),
        message: t('settings.themeDeleted'),
      });
    } catch (error) {
      showSettingsToast({
        tone: 'error',
        title: t('settings.theme.title'),
        message: t('settings.themeDeleteFailed', { message: getThemeErrorMessage(error) }),
      });
    } finally {
      setThemeBusy(false);
    }
  };

  const chooseCustomExportDirectory = async () => {
    const selected = await openDialog({
      directory: true,
      multiple: false,
      recursive: false,
      defaultPath: settings.exportDefaults.customDirectory || undefined,
    });
    if (!selected || Array.isArray(selected)) return;
    settings.setExportCustomDirectory(selected);
    settings.setExportDefaultLocation('custom');
  };

  const removeFont = async (fontId: string) => {
    const font = settings.customFonts.find((item) => item.id === fontId);
    if (font) await deleteCustomFontFile(font);
    settings.removeCustomFont(fontId);
  };

  const detectPandoc = async () => {
    setPandocChecking(true);
    try {
      await settings.detectPandoc();
    } finally {
      setPandocChecking(false);
    }
  };

  const fontOptions = (
    <>
      <option value="theme:">{t('settings.followTheme')}</option>
      {BUILTIN_FONT_OPTIONS.map((font) => (
        <option key={font.id} value={`builtin:${font.family}`}>{font.label}</option>
      ))}
      {SYSTEM_FONT_OPTIONS.map((font) => (
        <option key={font.id} value={`system:${font.family}`}>{font.labelKey ? t(font.labelKey) : font.label}</option>
      ))}
      {settings.customFonts.map((font) => (
        <option key={font.id} value={`custom:${font.id}`}>{font.displayName}</option>
      ))}
    </>
  );
  const themeRegistry = settings.themeRegistry.length > 0
    ? settings.themeRegistry
    : getThemeRegistrySnapshot();
  const availableThemes = themeRegistry.filter((theme) => theme.source !== 'invalid');
  const invalidThemes = themeRegistry.filter((theme) => theme.source === 'invalid');
  const currentTheme = themeRegistry.find((theme) => theme.id === settings.contentTheme);
  const confirmationPrompt = themePrompt?.kind === 'replace'
    ? {
        title: t('settings.replaceTheme.title'),
        message: t('settings.replaceTheme.message', { themeId: themePrompt.themeId }),
        detail: t('settings.replaceTheme.detail'),
        confirmLabel: t('settings.replaceTheme.confirm'),
        danger: false,
      }
    : themePrompt?.kind === 'delete'
      ? {
          title: t('settings.deleteTheme.title'),
          message: t('settings.deleteTheme.message', { label: themePrompt.label }),
          detail: t('settings.deleteTheme.detail'),
          confirmLabel: t('settings.deleteTheme.confirm'),
          danger: true,
        }
      : null;

  return (
    <>
      <div className="modal-overlay" onClick={onClose} />
      <div className="modal settings-modal" role="dialog" aria-label={t('settings.title')}>
        <div className="modal-header">
          <div className="modal-title">{t('settings.title')}</div>
          <button className="modal-close" onClick={onClose} aria-label={t('common.close')}>×</button>
        </div>
        <div className="modal-body settings-modal-body">
          <nav className="settings-nav" aria-label={t('settings.navLabel')}>
            {SETTINGS_SECTIONS.map((section) => (
              <button
                key={section.id}
                type="button"
                className={`settings-nav-item ${activeSection === section.id ? 'is-active' : ''}`}
                aria-current={activeSection === section.id ? 'page' : undefined}
                onClick={() => setActiveSection(section.id)}
              >
                <span>{t(section.labelKey)}</span>
                <small>{t(section.hintKey)}</small>
              </button>
            ))}
          </nav>
          <div className="settings-content">
          {activeSection === 'general' && (
          <div className="settings-group">
            <h4>{t('settings.section.general')}</h4>
            <div className="settings-row">
              <div>
                <div className="row-label">{t('settings.language.label')}</div>
                <div className="row-hint">{t('settings.language.hint')}</div>
              </div>
              <select
                value={settings.locale}
                onChange={(e) => settings.setLocale(e.target.value as LocalePreference)}
                style={selectStyle}
              >
                {LOCALE_PREFERENCES.map((locale) => (
                  <option key={locale} value={locale}>{t(localeLabelKeys[locale])}</option>
                ))}
              </select>
            </div>
            <div className="settings-row">
              <div>
                <div className="row-label">{t('settings.defaultView.label')}</div>
                <div className="row-hint">{t('settings.defaultView.hint')}</div>
              </div>
              <select
                value={settings.defaultViewMode}
                onChange={(e) => settings.setDefaultViewMode(e.target.value as DefaultViewMode)}
                style={selectStyle}
              >
                <option value="edit">{t('settings.view.edit')}</option>
                <option value="split">{t('settings.view.split')}</option>
                <option value="preview">{t('settings.view.preview')}</option>
              </select>
            </div>
            <div className="settings-row">
              <div>
                <div className="row-label">{t('settings.shortcutStyle.label')}</div>
                <div className="row-hint">{t('settings.shortcutStyle.hint')}</div>
              </div>
              <select
                value={settings.shortcutStyle}
                onChange={(e) => settings.setShortcutStyle(e.target.value as ShortcutStyle)}
                style={selectStyle}
              >
                <option value="auto">{t('settings.shortcutStyle.auto')}</option>
                <option value="mac">macOS</option>
                <option value="windows">Windows</option>
              </select>
            </div>
          </div>
          )}

          {activeSection === 'writing' && (
          <div className="settings-group">
            <h4>{t('settings.section.writing')}</h4>
            <div className="settings-row">
              <div>
                <div className="row-label">{t('settings.lineNumbers.label')}</div>
                <div className="row-hint">{t('settings.lineNumbers.hint')}</div>
              </div>
              <div
                className={toggleClass(settings.showLineNumbers)}
                onClick={() => settings.setShowLineNumbers(!settings.showLineNumbers)}
                role="switch"
                aria-checked={settings.showLineNumbers}
              />
            </div>
            <div className="settings-row">
              <div>
                <div className="row-label">{t('settings.autoSave.label')}</div>
                <div className="row-hint">{t('settings.autoSave.hint')}</div>
              </div>
              <div
                className={toggleClass(settings.autoSaveEnabled)}
                onClick={() => settings.setAutoSaveEnabled(!settings.autoSaveEnabled)}
                role="switch"
                aria-checked={settings.autoSaveEnabled}
              />
            </div>
            <div className="settings-row">
              <div>
                <div className="row-label">{t('settings.autoSaveStrategy.label')}</div>
                <div className="row-hint">
                  {t('settings.seconds', { seconds: (settings.autoSaveInterval / 1000).toFixed(1) })}
                </div>
              </div>
              <select
                value={settings.autoSaveStrategy}
                onChange={(e) => settings.setAutoSaveStrategy(e.target.value as AutoSaveStrategy)}
                style={selectStyle}
              >
                <option value="instant">{t('settings.autoSaveStrategy.instant')}</option>
                <option value="balanced">{t('settings.autoSaveStrategy.balanced')}</option>
                <option value="battery">{t('settings.autoSaveStrategy.battery')}</option>
              </select>
            </div>
            <div className="settings-row">
              <div>
                <div className="row-label">{t('settings.editorFont.label')}</div>
                <div className="row-hint">{getFontSourceHint(settings.editorFontSource, settings.editorFontFamily)}</div>
              </div>
              <select
                value={encodeFontSource(settings.editorFontSource)}
                onChange={(e) => settings.setEditorFontSource(decodeFontSource(e.target.value))}
                style={selectStyle}
              >
                {fontOptions}
              </select>
            </div>
            <div className="settings-row">
              <div>
                <div className="row-label">{t('settings.editorSize.label')}</div>
                <div className="row-hint">{settings.fontSize}px</div>
              </div>
              <input
                type="range"
                min={12}
                max={22}
                step={1}
                value={settings.fontSize}
                onChange={(e) => settings.setFontSize(Number(e.target.value))}
                style={{ width: 160 }}
              />
            </div>
            <div className="settings-row">
              <div>
                <div className="row-label">{t('settings.editorLineHeight.label')}</div>
                <div className="row-hint">{settings.editorLineHeight.toFixed(2)}</div>
              </div>
              <input
                type="range"
                min={1.3}
                max={2.2}
                step={0.05}
                value={settings.editorLineHeight}
                onChange={(e) => settings.setEditorLineHeight(Number(e.target.value))}
                style={{ width: 160 }}
              />
            </div>
          </div>
          )}

          {activeSection === 'appearance' && (
          <div className="settings-group">
            <h4>{t('settings.section.appearance')}</h4>
            <div className="settings-row">
              <div>
                <div className="row-label">{t('settings.contentTheme.label')}</div>
                <div className="row-hint">{t('settings.contentTheme.hint')}</div>
              </div>
              <select
                value={settings.contentTheme}
                onChange={(e) => { void settings.setContentTheme(e.target.value as ContentTheme); }}
                style={selectStyle}
              >
                {availableThemes.map((theme) => (
                  <option key={theme.id} value={theme.id}>
                    {theme.source === 'user' ? `${theme.label} · ${t('menu.userThemeSuffix')}` : theme.label}
                  </option>
                ))}
                {invalidThemes.length > 0 && (
                  <optgroup label={t('menu.invalidThemes')}>
                    {invalidThemes.map((theme) => (
                      <option key={theme.id} value={theme.id} disabled>
                        {theme.label} · {theme.error}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            </div>
            <div className="settings-row settings-row--theme-management">
              <div>
                <div className="row-label">{t('settings.themeManagement.label')}</div>
                <div className="row-hint">
                  {currentTheme?.source === 'user'
                    ? t('settings.themeManagement.userHint', {
                        version: currentTheme.version || t('settings.themeManagement.localTheme'),
                        directory: currentTheme.directory || '',
                      })
                    : t('settings.themeManagement.hint')}
                </div>
              </div>
              <div className="theme-management-actions" aria-label={t('settings.themeManagement.label')}>
                <button
                  type="button"
                  className="settings-action-button settings-action-button--primary"
                  onClick={() => void importTheme(true)}
                  disabled={themeBusy}
                >
                  {t('settings.importAndApplyTheme')}
                </button>
                <button
                  type="button"
                  className="settings-action-button"
                  onClick={() => void importTheme(false)}
                  disabled={themeBusy}
                >
                  {t('settings.importTheme')}
                </button>
                <button
                  type="button"
                  className="settings-action-button settings-action-button--quiet"
                  onClick={() => void openThemesDirectory()}
                >
                  {t('settings.openThemesDirectory')}
                </button>
                <button
                  type="button"
                  className="settings-action-button settings-action-button--quiet"
                  onClick={() => void reloadThemes()}
                  disabled={themeBusy}
                >
                  {t('settings.reloadUserThemes')}
                </button>
                {currentTheme?.source === 'user' && (
                  <button
                    type="button"
                    className="settings-action-button settings-action-button--danger"
                    onClick={() => void deleteCurrentTheme()}
                    disabled={themeBusy}
                  >
                    {t('settings.deleteCurrentUserTheme')}
                  </button>
                )}
              </div>
            </div>
            <div className="settings-row">
              <div>
                <div className="row-label">{t('settings.previewFont.label')}</div>
                <div className="row-hint">{getFontSourceHint(settings.previewFontSource, settings.previewFontFamily)}</div>
              </div>
              <select
                value={encodeFontSource(settings.previewFontSource)}
                onChange={(e) => settings.setPreviewFontSource(decodeFontSource(e.target.value))}
                style={selectStyle}
              >
                {fontOptions}
              </select>
            </div>
            <div className="settings-row">
              <div>
                <div className="row-label">{t('settings.previewSize.label')}</div>
                <div className="row-hint">{settings.previewFontSize}px</div>
              </div>
              <input
                type="range"
                min={13}
                max={24}
                step={1}
                value={settings.previewFontSize}
                onChange={(e) => settings.setPreviewFontSize(Number(e.target.value))}
                style={{ width: 160 }}
              />
            </div>
            <div className="settings-row">
              <div>
                <div className="row-label">{t('settings.importFont.label')}</div>
                <div className="row-hint">{t('settings.importFont.hint')}</div>
              </div>
              <button type="button" style={buttonStyle} onClick={importFont}>{t('settings.importFont.button')}</button>
            </div>
            {settings.customFonts.map((font) => (
              <div className="settings-row" key={font.id}>
                <div>
                  <div className="row-label">{font.displayName}</div>
                  <div className="row-hint">{font.filename}</div>
                </div>
                <button type="button" style={buttonStyle} onClick={() => removeFont(font.id)}>{t('settings.removeFont')}</button>
              </div>
            ))}
          </div>
          )}

          {activeSection === 'export' && (
          <div className="settings-group">
            <h4>{t('settings.section.export')}</h4>
            <div className="settings-row">
              <div>
                <div className="row-label">{t('settings.exportTemplate.label')}</div>
                <div className="row-hint">{getExportTemplateDescription(EXPORT_TEMPLATES[settings.exportDefaults.templateId])}</div>
              </div>
              <select
                value={settings.exportDefaults.templateId}
                onChange={(e) => {
                  const templateId = e.target.value as ExportTemplateId;
                  const template = EXPORT_TEMPLATES[templateId];
                  settings.setExportTemplateId(templateId);
                  settings.setExportPdfMargin(template.pdfMargin);
                  settings.setExportDocxFontPolicy(template.docxFontPolicy);
                }}
                style={selectStyle}
              >
                {Object.values(EXPORT_TEMPLATES).map((template) => (
                  <option key={template.id} value={template.id}>{getExportTemplateLabel(template)}</option>
                ))}
              </select>
            </div>
            <div className="settings-row">
              <div>
                <div className="row-label">{t('settings.pdfPaper.label')}</div>
                <div className="row-hint">{t('settings.pdfPaper.hint')}</div>
              </div>
              <select
                value={settings.exportDefaults.pdfPaper}
                onChange={(e) => settings.setExportPdfPaper(e.target.value as PdfPaper)}
                style={selectStyle}
              >
                <option value="a4">A4</option>
                <option value="letter">Letter</option>
              </select>
            </div>
            <div className="settings-row">
              <div>
                <div className="row-label">{t('settings.frontMatterOverrides.label')}</div>
                <div className="row-hint">{t('settings.frontMatterOverrides.hint')}</div>
              </div>
              <div
                className={toggleClass(settings.exportDefaults.frontMatterOverrides)}
                onClick={() => settings.setExportFrontMatterOverrides(!settings.exportDefaults.frontMatterOverrides)}
                role="switch"
                aria-checked={settings.exportDefaults.frontMatterOverrides}
              />
            </div>
            <div className="settings-row">
              <div>
                <div className="row-label">{t('settings.toc.label')}</div>
                <div className="row-hint">{t('settings.toc.hint')}</div>
              </div>
              <div
                className={toggleClass(settings.exportDefaults.toc)}
                onClick={() => settings.setExportToc(!settings.exportDefaults.toc)}
                role="switch"
                aria-checked={settings.exportDefaults.toc}
              />
            </div>
            <div className="settings-row">
              <div>
                <div className="row-label">{t('settings.pdfMargin.label')}</div>
                <div className="row-hint">{t('settings.pdfMargin.hint')}</div>
              </div>
              <select
                value={settings.exportDefaults.pdfMargin}
                onChange={(e) => settings.setExportPdfMargin(e.target.value as PdfMargin)}
                style={selectStyle}
              >
                <option value="compact">{t('settings.pdfMargin.compact')}</option>
                <option value="standard">{t('settings.pdfMargin.standard')}</option>
                <option value="wide">{t('settings.pdfMargin.wide')}</option>
              </select>
            </div>
            <div className="settings-row">
              <div>
                <div className="row-label">{t('settings.pageNumbers.label')}</div>
                <div className="row-hint">{t('settings.pageNumbers.hint')}</div>
              </div>
              <div
                className={toggleClass(settings.exportDefaults.pdfPageNumbers)}
                onClick={() => settings.setExportPdfPageNumbers(!settings.exportDefaults.pdfPageNumbers)}
                role="switch"
                aria-checked={settings.exportDefaults.pdfPageNumbers}
              />
            </div>
            <div className="settings-row">
              <div>
                <div className="row-label">{t('settings.headerFooter.label')}</div>
                <div className="row-hint">{t('settings.headerFooter.hint')}</div>
              </div>
              <div
                className={toggleClass(settings.exportDefaults.pageHeaderFooter)}
                onClick={() => settings.setExportPageHeaderFooter(!settings.exportDefaults.pageHeaderFooter)}
                role="switch"
                aria-checked={settings.exportDefaults.pageHeaderFooter}
              />
            </div>
            {exportSettingsModel.showHeaderFooterFields && (
              <>
                <div className="settings-row">
                  <div>
                    <div className="row-label">{t('settings.headerText.label')}</div>
                    <div className="row-hint">{t('settings.headerText.hint')}</div>
                  </div>
                  <input
                    value={settings.exportDefaults.pageHeaderText}
                    onChange={(e) => settings.setExportPageHeaderText(e.target.value)}
                    maxLength={160}
                    style={inputStyle}
                  />
                </div>
                <div className="settings-row">
                  <div>
                    <div className="row-label">{t('settings.footerText.label')}</div>
                    <div className="row-hint">{t('settings.footerText.hint')}</div>
                  </div>
                  <input
                    value={settings.exportDefaults.pageFooterText}
                    onChange={(e) => settings.setExportPageFooterText(e.target.value)}
                    maxLength={160}
                    style={inputStyle}
                  />
                </div>
              </>
            )}
            <div className="settings-row">
              <div>
                <div className="row-label">{t('settings.defaultExportLocation.label')}</div>
                <div className="row-hint">{exportSettingsModel.defaultLocationHint}</div>
              </div>
              <select
                value={settings.exportDefaults.defaultLocation}
                onChange={(e) => settings.setExportDefaultLocation(e.target.value as ExportDefaultLocation)}
                style={selectStyle}
              >
                <option value="ask">{t('settings.defaultExportLocation.ask')}</option>
                <option value="document">{t('settings.defaultExportLocation.document')}</option>
                <option value="downloads">{t('settings.defaultExportLocation.downloads')}</option>
                <option value="custom">{t('settings.defaultExportLocation.custom')}</option>
              </select>
            </div>
            <div className="settings-row">
              <div>
                <div className="row-label">{t('settings.customExportDirectory.label')}</div>
                <div className="row-hint">{exportSettingsModel.customDirectoryHint}</div>
              </div>
              <button type="button" style={buttonStyle} onClick={chooseCustomExportDirectory}>{t('settings.chooseDirectory')}</button>
            </div>
            <div className="settings-row">
              <div>
                <div className="row-label">{t('settings.docxFont.label')}</div>
                <div className="row-hint">{t('settings.docxFont.hint')}</div>
              </div>
              <select
                value={settings.exportDefaults.docxFontPolicy}
                onChange={(e) => settings.setExportDocxFontPolicy(e.target.value as DocxFontPolicy)}
                style={selectStyle}
              >
                <option value="theme">{t('settings.docxFont.theme')}</option>
                <option value="preview">{t('settings.docxFont.preview')}</option>
                <option value="custom">{t('settings.docxFont.custom')}</option>
              </select>
            </div>
            {exportSettingsModel.showCustomDocxFont && (
              <div className="settings-row">
                <div>
                  <div className="row-label">{t('settings.docxCustomFont.label')}</div>
                  <div className="row-hint">{t('settings.docxCustomFont.hint')}</div>
                </div>
                <select
                  value={settings.exportDefaults.docxCustomFontId}
                  onChange={(e) => settings.setExportDocxCustomFontId(e.target.value)}
                  style={selectStyle}
                >
                  <option value="">{t('settings.followTheme')}</option>
                  {settings.customFonts.map((font) => (
                    <option key={font.id} value={font.id}>{font.displayName}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="settings-row">
              <div>
                <div className="row-label">{t('settings.htmlIncludeTheme.label')}</div>
                <div className="row-hint">{t('settings.htmlIncludeTheme.hint')}</div>
              </div>
              <div
                className={toggleClass(settings.exportDefaults.htmlIncludeTheme)}
                onClick={() => settings.setExportHtmlIncludeTheme(!settings.exportDefaults.htmlIncludeTheme)}
                role="switch"
                aria-checked={settings.exportDefaults.htmlIncludeTheme}
              />
            </div>
            <div className="settings-row">
              <div>
                <div className="row-label">{t('settings.exportQuality.label')}</div>
                <div className="row-hint">
                  {exportSettingsModel.qualityDescription}
                </div>
              </div>
              <select
                value={exportSettingsModel.qualityScale}
                onChange={(e) => settings.setExportPngScale(normalizeExportQualityScale(Number(e.target.value)))}
                style={selectStyle}
              >
                {exportSettingsModel.qualityPresets.map((preset) => (
                  <option key={preset.scale} value={preset.scale}>
                    {preset.shortLabel}
                  </option>
                ))}
              </select>
            </div>
          </div>
          )}

          {activeSection === 'citation' && (
          <div className="settings-group">
            <h4>{t('settings.section.citation')}</h4>
            <div className="settings-row">
              <div>
                <div className="row-label">{t('settings.pandocPath.label')}</div>
                <div className="row-hint">{getPandocHint(settings.pandoc)}</div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  aria-label={t('settings.pandocPath.label')}
                  value={settings.pandoc.path}
                  onChange={(e) => settings.setPandocPath(e.target.value)}
                  placeholder={t('settings.pandocPath.placeholder')}
                  style={inputStyle}
                />
                <button
                  type="button"
                  style={pandocChecking ? { ...buttonStyle, opacity: 0.55, cursor: 'default' } : buttonStyle}
                  onClick={detectPandoc}
                  disabled={pandocChecking}
                >
                  {pandocChecking ? t('common.detecting') : t('common.detect')}
                </button>
              </div>
            </div>
            <div className="settings-row">
              <div>
                <div className="row-label">{t('settings.bibliography.label')}</div>
                <div className="row-hint">{citationSettingsModel.bibliographyHint}</div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  aria-label={t('settings.bibliography.aria')}
                  aria-invalid={!citationSettingsModel.bibliographyPathIsSupported}
                  value={settings.citation.bibliographyPath}
                  onChange={(e) => settings.setCitationBibliographyPath(e.target.value)}
                  placeholder={t('settings.bibliography.placeholder')}
                  style={citationPathInputStyle}
                />
                {settings.citation.bibliographyPath && (
                  <button
                    type="button"
                    style={buttonStyle}
                    onClick={() => settings.setCitationBibliographyPath('')}
                    aria-label={t('settings.clearBibliography')}
                  >
                    {t('common.clear')}
                  </button>
                )}
              </div>
            </div>
            <div className="settings-row">
              <div>
                <div className="row-label">{t('settings.csl.label')}</div>
                <div className="row-hint">{citationSettingsModel.cslStyleHint}</div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  aria-label={t('settings.csl.aria')}
                  aria-invalid={!citationSettingsModel.cslStylePathIsSupported}
                  value={settings.citation.cslStylePath}
                  onChange={(e) => settings.setCitationCslStylePath(e.target.value)}
                  placeholder={t('settings.csl.placeholder')}
                  style={citationPathInputStyle}
                />
                {settings.citation.cslStylePath && (
                  <button
                    type="button"
                    style={buttonStyle}
                    onClick={() => settings.setCitationCslStylePath('')}
                    aria-label={t('settings.clearCsl')}
                  >
                    {t('common.clear')}
                  </button>
                )}
              </div>
            </div>
            <div className="settings-row">
              <div>
                <div className="row-label">{t('settings.citationStatus.label')}</div>
                <div className="row-hint" aria-live="polite">{citationSettingsModel.citationReadinessHint}</div>
              </div>
            </div>
          </div>
          )}

          {activeSection === 'files' && (
          <div className="settings-group">
            <h4>{t('settings.section.files')}</h4>
            <div className="settings-row">
              <div>
                <div className="row-label">{t('settings.restoreLastSession.label')}</div>
                <div className="row-hint">{t('settings.restoreLastSession.hint')}</div>
              </div>
              <div
                className={toggleClass(settings.restoreLastSession)}
                onClick={() => settings.setRestoreLastSession(!settings.restoreLastSession)}
                role="switch"
                aria-checked={settings.restoreLastSession}
              />
            </div>
            <div className="settings-row">
              <div>
                <div className="row-label">{t('settings.recentFilesLimit.label')}</div>
                <div className="row-hint">{t('settings.recentFilesLimit.hint', { count: settings.recentFiles.length })}</div>
              </div>
              <select
                value={settings.recentFilesLimit}
                onChange={(e) => settings.setRecentFilesLimit(Number(e.target.value))}
                style={selectStyle}
              >
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={20}>20</option>
              </select>
            </div>
            <div className="settings-row">
              <div>
                <div className="row-label">{t('settings.clearRecentFiles.label')}</div>
                <div className="row-hint">{t('settings.clearRecentFiles.hint')}</div>
              </div>
              <button type="button" style={buttonStyle} onClick={() => settings.clearRecentFiles()}>
                {t('settings.clearRecentFiles.button')}
              </button>
            </div>
          </div>
          )}
          </div>
        </div>
      </div>
      {themePrompt && (
        <>
          <div
            className="modal-overlay settings-prompt-overlay"
            onClick={() => resolveThemePrompt(null)}
          />
          <div
            className={`modal settings-prompt-modal ${confirmationPrompt?.danger ? 'settings-prompt-modal--danger' : ''}`}
            role="dialog"
            aria-modal="true"
            aria-label={themePrompt.kind === 'import-source' ? t('settings.importTheme.sourceTitle') : confirmationPrompt?.title}
          >
            <div className="settings-prompt-header">
              <div>
                <div className="settings-prompt-title">
                  {themePrompt.kind === 'import-source' ? t('settings.importTheme.sourceTitle') : confirmationPrompt?.title}
                </div>
                <div className="settings-prompt-subtitle">
                  {themePrompt.kind === 'import-source' ? t('settings.importTheme.sourceSubtitle') : confirmationPrompt?.message}
                </div>
              </div>
              <button
                type="button"
                className="modal-close"
                onClick={() => resolveThemePrompt(null)}
                aria-label={t('common.close')}
              >
                ×
              </button>
            </div>
            <div className="settings-prompt-body">
              {themePrompt.kind === 'import-source' ? (
                <div className="settings-theme-source-grid">
                  <button
                    type="button"
                    className="settings-theme-source-card"
                    onClick={() => resolveThemePrompt('folder')}
                  >
                    <span className="settings-theme-source-title">{t('settings.importTheme.folderOption')}</span>
                    <span className="settings-theme-source-hint">{t('settings.importTheme.folderHint')}</span>
                  </button>
                  <button
                    type="button"
                    className="settings-theme-source-card"
                    onClick={() => resolveThemePrompt('archive')}
                  >
                    <span className="settings-theme-source-title">{t('settings.importTheme.archiveOption')}</span>
                    <span className="settings-theme-source-hint">{t('settings.importTheme.archiveHint')}</span>
                  </button>
                </div>
              ) : (
                <p className="settings-prompt-detail">{confirmationPrompt?.detail}</p>
              )}
            </div>
            {themePrompt.kind === 'import-source' && (
              <div className="settings-prompt-footer">
                <button
                  type="button"
                  className="settings-action-button settings-action-button--quiet"
                  onClick={() => resolveThemePrompt(null)}
                >
                  {t('common.cancel')}
                </button>
              </div>
            )}
            {themePrompt.kind !== 'import-source' && confirmationPrompt && (
              <div className="settings-prompt-footer">
                <button
                  type="button"
                  className="settings-action-button settings-action-button--quiet"
                  onClick={() => resolveThemePrompt(false)}
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="button"
                  className={`settings-action-button ${confirmationPrompt.danger ? 'settings-action-button--danger-filled' : 'settings-action-button--primary'}`}
                  onClick={() => resolveThemePrompt(true)}
                >
                  {confirmationPrompt.confirmLabel}
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
}
