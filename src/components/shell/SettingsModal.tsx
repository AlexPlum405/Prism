import { useEffect, useState, type CSSProperties } from 'react';
import { ask, message, open } from '@tauri-apps/plugin-dialog';
import { useSettingsStore } from '../../domains/settings/store';
import type {
  AutoSaveStrategy,
  ContentTheme,
  DefaultViewMode,
  DocxFontPolicy,
  ExportDefaultLocation,
  ExportTemplateId,
  FontSource,
  PdfMargin,
  PdfPaper,
  ShortcutStyle,
} from '../../domains/settings/types';
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
import { EXPORT_TEMPLATES } from '../../domains/export/templates';
import {
  EXPORT_QUALITY_PRESETS,
  getExportQualityPreset,
  normalizeExportQualityScale,
} from '../../domains/export/quality';

interface SettingsModalProps {
  visible: boolean;
  onClose: () => void;
}

const SETTINGS_SECTIONS = [
  { id: 'general', label: '通用', hint: '视图与快捷键' },
  { id: 'writing', label: '写作', hint: '编辑器与自动保存' },
  { id: 'appearance', label: '外观', hint: '主题与字体' },
  { id: 'export', label: '导出', hint: '格式与默认位置' },
  { id: 'citation', label: '引用', hint: 'Pandoc 与文献' },
  { id: 'files', label: '文件', hint: '恢复与最近文档' },
] as const;

type SettingsSectionId = typeof SETTINGS_SECTIONS[number]['id'];

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
  return source.kind === 'theme' ? '跟随主题' : resolvedFamily;
}

function getPandocHint(settings: ReturnType<typeof useSettingsStore.getState>['pandoc']) {
  if (settings.detected && settings.version) return `已检测 ${settings.version}`;
  if (settings.lastError) return settings.lastError;
  return '留空检测系统 pandoc，也可填写完整可执行文件路径';
}

function hasSupportedPathExtension(path: string, extensions: string[]) {
  const normalized = path.trim().toLowerCase();
  return normalized.length === 0 || extensions.some((extension) => normalized.endsWith(extension));
}

function getBibliographyHint(path: string) {
  if (!path.trim()) return 'BibTeX / CSL JSON 文件路径，用于 Pandoc 引用导出';
  if (!hasSupportedPathExtension(path, ['.bib', '.bibtex', '.json'])) {
    return '建议使用 .bib、.bibtex 或 .json 文件';
  }
  return '已配置，HTML 导出会在 Pandoc 可用时处理引用';
}

function getCslStyleHint(path: string) {
  if (!path.trim()) return '可填写 .csl 路径，留空时使用 Pandoc 默认样式';
  if (!hasSupportedPathExtension(path, ['.csl'])) {
    return 'CSL 样式通常是 .csl 文件';
  }
  return '已配置，引用导出会优先使用该样式';
}

function getCitationReadinessHint(input: {
  bibliographyPath: string;
  bibliographyPathIsSupported: boolean;
  cslStylePath: string;
  cslStylePathIsSupported: boolean;
  pandocDetected: boolean;
}) {
  const hasBibliography = input.bibliographyPath.trim().length > 0;
  const hasCslStyle = input.cslStylePath.trim().length > 0;

  if (!input.bibliographyPathIsSupported || !input.cslStylePathIsSupported) {
    return '引用路径后缀需要先修正；否则导出会回退到 citekey 占位。';
  }
  if (!hasBibliography && hasCslStyle) {
    return '已配置 CSL，但还需要参考文献文件才会启用引用导出。';
  }
  if (!hasBibliography) {
    return '未配置参考文献文件；Markdown 预览会保留 citekey 占位。';
  }
  if (!input.pandocDetected) {
    return '已配置参考文献；当前未检测到 Pandoc，导出会保留 citekey 占位并提示原因。';
  }
  return '引用导出已就绪；HTML 导出会优先尝试 Pandoc citeproc。';
}

export function SettingsModal({ visible, onClose }: SettingsModalProps) {
  const settings = useSettingsStore();
  const [activeSection, setActiveSection] = useState<SettingsSectionId>('general');
  const [pandocChecking, setPandocChecking] = useState(false);
  const [themeBusy, setThemeBusy] = useState(false);

  useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [visible, onClose]);

  if (!visible) return null;

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
  const bibliographyPathIsSupported = hasSupportedPathExtension(
    settings.citation.bibliographyPath,
    ['.bib', '.bibtex', '.json'],
  );
  const cslStylePathIsSupported = hasSupportedPathExtension(settings.citation.cslStylePath, ['.csl']);
  const citationReadinessHint = getCitationReadinessHint({
    bibliographyPath: settings.citation.bibliographyPath,
    bibliographyPathIsSupported,
    cslStylePath: settings.citation.cslStylePath,
    cslStylePathIsSupported,
    pandocDetected: settings.pandoc.detected,
  });

  const importFont = async () => {
    const result = await importCustomFont();
    if (result) settings.addCustomFont(result.font);
  };

  const chooseThemePath = async () => {
    const chooseFolder = await ask('要导入主题文件夹吗？选择“否”可导入 .zip / .prism-theme 文件。', {
      title: '导入主题',
      kind: 'info',
    });
    const selected = await open({
      multiple: false,
      directory: chooseFolder,
      recursive: false,
      filters: chooseFolder
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
          const shouldReplace = await ask(`已存在同 id 用户主题 ${error.themeId}，是否替换？`, {
            title: '替换主题',
            kind: 'warning',
          });
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
      await message(
        applyAfterImport ? `已导入并应用主题：${result.name}` : `已导入主题：${result.name}`,
        { title: '主题导入', kind: 'info' },
      );
    } catch (error) {
      await message(`主题导入失败：${getThemeErrorMessage(error)}`, {
        title: '主题导入',
        kind: 'error',
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
      await message('用户主题已重新加载', { title: '主题', kind: 'info' });
    } catch (error) {
      await message(`重新加载主题失败：${getThemeErrorMessage(error)}`, {
        title: '主题',
        kind: 'error',
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
    const confirmed = await ask(`确定删除用户主题“${current.label}”吗？Prism 会先切回 Miaoyan。`, {
      title: '删除主题',
      kind: 'warning',
    });
    if (!confirmed) return;

    setThemeBusy(true);
    try {
      await settings.setContentTheme('miaoyan');
      await deleteInstalledUserTheme(current.id);
      await settings.reloadThemeRegistry();
      await message('主题已删除，并已切回 Miaoyan', { title: '主题', kind: 'info' });
    } catch (error) {
      await message(`删除主题失败：${getThemeErrorMessage(error)}`, {
        title: '主题',
        kind: 'error',
      });
    } finally {
      setThemeBusy(false);
    }
  };

  const chooseCustomExportDirectory = async () => {
    const selected = await open({
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
      <option value="theme:">跟随主题</option>
      {BUILTIN_FONT_OPTIONS.map((font) => (
        <option key={font.id} value={`builtin:${font.family}`}>{font.label}</option>
      ))}
      {SYSTEM_FONT_OPTIONS.map((font) => (
        <option key={font.id} value={`system:${font.family}`}>{font.label}</option>
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

  return (
    <>
      <div className="modal-overlay" onClick={onClose} />
      <div className="modal settings-modal" role="dialog" aria-label="设置中心">
        <div className="modal-header">
          <div className="modal-title">设置中心</div>
          <button className="modal-close" onClick={onClose} aria-label="关闭">×</button>
        </div>
        <div className="modal-body settings-modal-body">
          <nav className="settings-nav" aria-label="设置分类">
            {SETTINGS_SECTIONS.map((section) => (
              <button
                key={section.id}
                type="button"
                className={`settings-nav-item ${activeSection === section.id ? 'is-active' : ''}`}
                aria-current={activeSection === section.id ? 'page' : undefined}
                onClick={() => setActiveSection(section.id)}
              >
                <span>{section.label}</span>
                <small>{section.hint}</small>
              </button>
            ))}
          </nav>
          <div className="settings-content">
          {activeSection === 'general' && (
          <div className="settings-group">
            <h4>通用</h4>
            <div className="settings-row">
              <div>
                <div className="row-label">默认视图</div>
                <div className="row-hint">新建和打开文档时使用</div>
              </div>
              <select
                value={settings.defaultViewMode}
                onChange={(e) => settings.setDefaultViewMode(e.target.value as DefaultViewMode)}
                style={selectStyle}
              >
                <option value="edit">编辑</option>
                <option value="split">分栏</option>
                <option value="preview">预览</option>
              </select>
            </div>
            <div className="settings-row">
              <div>
                <div className="row-label">快捷键显示</div>
                <div className="row-hint">菜单和快捷键面板中的快捷键文案</div>
              </div>
              <select
                value={settings.shortcutStyle}
                onChange={(e) => settings.setShortcutStyle(e.target.value as ShortcutStyle)}
                style={selectStyle}
              >
                <option value="auto">跟随系统</option>
                <option value="mac">macOS</option>
                <option value="windows">Windows</option>
              </select>
            </div>
          </div>
          )}

          {activeSection === 'writing' && (
          <div className="settings-group">
            <h4>写作</h4>
            <div className="settings-row">
              <div>
                <div className="row-label">显示行号</div>
                <div className="row-hint">编辑器左侧行号栏</div>
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
                <div className="row-label">自动保存</div>
                <div className="row-hint">只对已保存过路径的文档生效</div>
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
                <div className="row-label">自动保存策略</div>
                <div className="row-hint">{(settings.autoSaveInterval / 1000).toFixed(1)} 秒</div>
              </div>
              <select
                value={settings.autoSaveStrategy}
                onChange={(e) => settings.setAutoSaveStrategy(e.target.value as AutoSaveStrategy)}
                style={selectStyle}
              >
                <option value="instant">即时</option>
                <option value="balanced">均衡</option>
                <option value="battery">省电</option>
              </select>
            </div>
            <div className="settings-row">
              <div>
                <div className="row-label">编辑器字体</div>
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
                <div className="row-label">编辑器字号</div>
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
                <div className="row-label">编辑器行高</div>
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
            <h4>外观</h4>
            <div className="settings-row">
              <div>
                <div className="row-label">内容主题</div>
                <div className="row-hint">编辑、预览、搜索和导出共享主题 token</div>
              </div>
              <select
                value={settings.contentTheme}
                onChange={(e) => { void settings.setContentTheme(e.target.value as ContentTheme); }}
                style={selectStyle}
              >
                {availableThemes.map((theme) => (
                  <option key={theme.id} value={theme.id}>
                    {theme.source === 'user' ? `${theme.label} · 用户主题` : theme.label}
                  </option>
                ))}
                {invalidThemes.length > 0 && (
                  <optgroup label="异常主题">
                    {invalidThemes.map((theme) => (
                      <option key={theme.id} value={theme.id} disabled>
                        {theme.label} · {theme.error}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            </div>
            <div className="settings-row">
              <div>
                <div className="row-label">主题管理</div>
                <div className="row-hint">
                  {currentTheme?.source === 'user'
                    ? `${currentTheme.version || '本地主题'} · ${currentTheme.directory || ''}`
                    : '导入本地主题包，不会自动覆盖内置主题'}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  style={themeBusy ? { ...buttonStyle, opacity: 0.55, cursor: 'default' } : buttonStyle}
                  onClick={() => void importTheme(false)}
                  disabled={themeBusy}
                >
                  导入主题
                </button>
                <button
                  type="button"
                  style={themeBusy ? { ...buttonStyle, opacity: 0.55, cursor: 'default' } : buttonStyle}
                  onClick={() => void importTheme(true)}
                  disabled={themeBusy}
                >
                  导入并应用主题
                </button>
                <button
                  type="button"
                  style={buttonStyle}
                  onClick={() => void openThemesDirectory()}
                >
                  打开主题目录
                </button>
                <button
                  type="button"
                  style={themeBusy ? { ...buttonStyle, opacity: 0.55, cursor: 'default' } : buttonStyle}
                  onClick={() => void reloadThemes()}
                  disabled={themeBusy}
                >
                  重新加载用户主题
                </button>
                <button
                  type="button"
                  style={
                    currentTheme?.source === 'user' && !themeBusy
                      ? buttonStyle
                      : { ...buttonStyle, opacity: 0.5, cursor: 'default' }
                  }
                  onClick={() => void deleteCurrentTheme()}
                  disabled={currentTheme?.source !== 'user' || themeBusy}
                >
                  删除当前用户主题
                </button>
              </div>
            </div>
            <div className="settings-row">
              <div>
                <div className="row-label">预览字体</div>
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
                <div className="row-label">预览字号</div>
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
                <div className="row-label">导入字体</div>
                <div className="row-hint">支持 ttf / otf / woff / woff2，可用于编辑、预览和 DOCX</div>
              </div>
              <button type="button" style={buttonStyle} onClick={importFont}>导入字体</button>
            </div>
            {settings.customFonts.map((font) => (
              <div className="settings-row" key={font.id}>
                <div>
                  <div className="row-label">{font.displayName}</div>
                  <div className="row-hint">{font.filename}</div>
                </div>
                <button type="button" style={buttonStyle} onClick={() => removeFont(font.id)}>移除</button>
              </div>
            ))}
          </div>
          )}

          {activeSection === 'export' && (
          <div className="settings-group">
            <h4>导出</h4>
            <div className="settings-row">
              <div>
                <div className="row-label">导出模板</div>
                <div className="row-hint">{EXPORT_TEMPLATES[settings.exportDefaults.templateId].description}</div>
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
                  <option key={template.id} value={template.id}>{template.label}</option>
                ))}
              </select>
            </div>
            <div className="settings-row">
              <div>
                <div className="row-label">PDF 纸张</div>
                <div className="row-hint">影响 PDF 分页尺寸</div>
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
                <div className="row-label">允许 Front matter 覆盖导出</div>
                <div className="row-hint">开启后当前文件可覆盖 title / template / paper / margin / toc</div>
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
                <div className="row-label">目录</div>
                <div className="row-hint">导出 HTML / PDF / PNG / DOCX 时插入静态目录</div>
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
                <div className="row-label">PDF 边距</div>
                <div className="row-hint">紧凑适合长文，宽松适合正式文档</div>
              </div>
              <select
                value={settings.exportDefaults.pdfMargin}
                onChange={(e) => settings.setExportPdfMargin(e.target.value as PdfMargin)}
                style={selectStyle}
              >
                <option value="compact">紧凑</option>
                <option value="standard">标准</option>
                <option value="wide">宽松</option>
              </select>
            </div>
            <div className="settings-row">
              <div>
                <div className="row-label">页码</div>
                <div className="row-hint">导出 PDF / DOCX 时在页脚居中显示页码</div>
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
                <div className="row-label">页眉页脚</div>
                <div className="row-hint">导出 PDF / DOCX 时使用相同模板变量</div>
              </div>
              <div
                className={toggleClass(settings.exportDefaults.pageHeaderFooter)}
                onClick={() => settings.setExportPageHeaderFooter(!settings.exportDefaults.pageHeaderFooter)}
                role="switch"
                aria-checked={settings.exportDefaults.pageHeaderFooter}
              />
            </div>
            {settings.exportDefaults.pageHeaderFooter && (
              <>
                <div className="settings-row">
                  <div>
                    <div className="row-label">页眉文本</div>
                    <div className="row-hint">默认使用导出标题</div>
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
                    <div className="row-label">页脚文本</div>
                    <div className="row-hint">默认使用文件名，可与页码并存</div>
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
                <div className="row-label">默认导出位置</div>
                <div className="row-hint">{settings.exportDefaults.customDirectory || '未指定自定义目录'}</div>
              </div>
              <select
                value={settings.exportDefaults.defaultLocation}
                onChange={(e) => settings.setExportDefaultLocation(e.target.value as ExportDefaultLocation)}
                style={selectStyle}
              >
                <option value="ask">每次询问</option>
                <option value="document">文档所在文件夹</option>
                <option value="downloads">下载文件夹</option>
                <option value="custom">自定义目录</option>
              </select>
            </div>
            <div className="settings-row">
              <div>
                <div className="row-label">自定义导出目录</div>
                <div className="row-hint">{settings.exportDefaults.customDirectory || '选择一个固定目录'}</div>
              </div>
              <button type="button" style={buttonStyle} onClick={chooseCustomExportDirectory}>选择目录</button>
            </div>
            <div className="settings-row">
              <div>
                <div className="row-label">DOCX 字体</div>
                <div className="row-hint">导入字体会尝试嵌入到 Word 文件</div>
              </div>
              <select
                value={settings.exportDefaults.docxFontPolicy}
                onChange={(e) => settings.setExportDocxFontPolicy(e.target.value as DocxFontPolicy)}
                style={selectStyle}
              >
                <option value="theme">跟随主题</option>
                <option value="preview">使用预览字体</option>
                <option value="custom">指定导入字体</option>
              </select>
            </div>
            {settings.exportDefaults.docxFontPolicy === 'custom' && (
              <div className="settings-row">
                <div>
                  <div className="row-label">指定 DOCX 字体</div>
                  <div className="row-hint">仅显示已导入字体</div>
                </div>
                <select
                  value={settings.exportDefaults.docxCustomFontId}
                  onChange={(e) => settings.setExportDocxCustomFontId(e.target.value)}
                  style={selectStyle}
                >
                  <option value="">跟随主题</option>
                  {settings.customFonts.map((font) => (
                    <option key={font.id} value={font.id}>{font.displayName}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="settings-row">
              <div>
                <div className="row-label">HTML 包含主题</div>
                <div className="row-hint">导出时内联当前主题样式</div>
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
                <div className="row-label">导出清晰度</div>
                <div className="row-hint">
                  {getExportQualityPreset(normalizeExportQualityScale(settings.exportDefaults.pngScale)).description}
                </div>
              </div>
              <select
                value={normalizeExportQualityScale(settings.exportDefaults.pngScale)}
                onChange={(e) => settings.setExportPngScale(normalizeExportQualityScale(Number(e.target.value)))}
                style={selectStyle}
              >
                {EXPORT_QUALITY_PRESETS.map((preset) => (
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
            <h4>引用</h4>
            <div className="settings-row">
              <div>
                <div className="row-label">Pandoc 路径</div>
                <div className="row-hint">{getPandocHint(settings.pandoc)}</div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  aria-label="Pandoc 路径"
                  value={settings.pandoc.path}
                  onChange={(e) => settings.setPandocPath(e.target.value)}
                  placeholder="pandoc 或 /opt/homebrew/bin/pandoc"
                  style={inputStyle}
                />
                <button
                  type="button"
                  style={pandocChecking ? { ...buttonStyle, opacity: 0.55, cursor: 'default' } : buttonStyle}
                  onClick={detectPandoc}
                  disabled={pandocChecking}
                >
                  {pandocChecking ? '检测中' : '检测'}
                </button>
              </div>
            </div>
            <div className="settings-row">
              <div>
                <div className="row-label">参考文献文件</div>
                <div className="row-hint">{getBibliographyHint(settings.citation.bibliographyPath)}</div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  aria-label="参考文献文件路径"
                  aria-invalid={!bibliographyPathIsSupported}
                  value={settings.citation.bibliographyPath}
                  onChange={(e) => settings.setCitationBibliographyPath(e.target.value)}
                  placeholder="/Users/Alex/library.bib"
                  style={citationPathInputStyle}
                />
                {settings.citation.bibliographyPath && (
                  <button
                    type="button"
                    style={buttonStyle}
                    onClick={() => settings.setCitationBibliographyPath('')}
                    aria-label="清除参考文献文件"
                  >
                    清除
                  </button>
                )}
              </div>
            </div>
            <div className="settings-row">
              <div>
                <div className="row-label">CSL 样式文件</div>
                <div className="row-hint">{getCslStyleHint(settings.citation.cslStylePath)}</div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  aria-label="CSL 样式文件路径"
                  aria-invalid={!cslStylePathIsSupported}
                  value={settings.citation.cslStylePath}
                  onChange={(e) => settings.setCitationCslStylePath(e.target.value)}
                  placeholder="/Users/Alex/styles/chinese-gb7714.csl"
                  style={citationPathInputStyle}
                />
                {settings.citation.cslStylePath && (
                  <button
                    type="button"
                    style={buttonStyle}
                    onClick={() => settings.setCitationCslStylePath('')}
                    aria-label="清除 CSL 样式"
                  >
                    清除
                  </button>
                )}
              </div>
            </div>
            <div className="settings-row">
              <div>
                <div className="row-label">引用导出状态</div>
                <div className="row-hint" aria-live="polite">{citationReadinessHint}</div>
              </div>
            </div>
          </div>
          )}

          {activeSection === 'files' && (
          <div className="settings-group">
            <h4>文件</h4>
            <div className="settings-row">
              <div>
                <div className="row-label">启动时恢复上次窗口</div>
                <div className="row-hint">没有显式打开文件时恢复上次文档和工作区</div>
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
                <div className="row-label">最近文档数量</div>
                <div className="row-hint">当前 {settings.recentFiles.length} 个</div>
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
                <div className="row-label">清空最近文档</div>
                <div className="row-hint">只清除记录，不删除文件</div>
              </div>
              <button type="button" style={buttonStyle} onClick={() => settings.clearRecentFiles()}>清空</button>
            </div>
          </div>
          )}
          </div>
        </div>
      </div>
    </>
  );
}
