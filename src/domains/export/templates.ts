import type {
  CustomFont,
  DocxFontPolicy,
  ExportTemplateId,
  PdfMargin,
  SettingsState,
} from '../settings/types';
import { getDocxThemeByContentTheme } from './exportSettings';
import { parseExportFrontMatter } from './frontMatter';
import type { ExportDocumentInput } from './types';
import { resolveAppLocale, t } from '../i18n/runtime';
import type { I18nKey } from '../i18n/resources';

export interface ExportTemplate {
  id: ExportTemplateId;
  label: string;
  description: string;
  labelKey: I18nKey;
  descriptionKey: I18nKey;
  pdfMargin: PdfMargin;
  docxFontPolicy: DocxFontPolicy;
  codeStyle: 'theme' | 'boxed' | 'plain';
  tableStyle: 'theme' | 'grid' | 'minimal';
}

export const EXPORT_TEMPLATES: Record<ExportTemplateId, ExportTemplate> = {
  theme: {
    id: 'theme',
    labelKey: 'export.template.theme.label',
    descriptionKey: 'export.template.theme.description',
    label: 'Follow Theme',
    description: 'Keep the current writing theme as closely as possible.',
    pdfMargin: 'standard',
    docxFontPolicy: 'theme',
    codeStyle: 'theme',
    tableStyle: 'theme',
  },
  business: {
    id: 'business',
    labelKey: 'export.template.business.label',
    descriptionKey: 'export.template.business.description',
    label: 'Business Document',
    description: 'Wider margins and clear table borders for formal delivery.',
    pdfMargin: 'wide',
    docxFontPolicy: 'preview',
    codeStyle: 'boxed',
    tableStyle: 'grid',
  },
  plain: {
    id: 'plain',
    labelKey: 'export.template.plain.label',
    descriptionKey: 'export.template.plain.description',
    label: 'Clean Compatible',
    description: 'Reduce decoration and backgrounds for sharing or platform paste.',
    pdfMargin: 'standard',
    docxFontPolicy: 'theme',
    codeStyle: 'plain',
    tableStyle: 'minimal',
  },
  academic: {
    id: 'academic',
    labelKey: 'export.template.academic.label',
    descriptionKey: 'export.template.academic.description',
    label: 'Long Paper',
    description: 'More stable heading hierarchy, citations, and footnotes for long-form writing.',
    pdfMargin: 'compact',
    docxFontPolicy: 'preview',
    codeStyle: 'boxed',
    tableStyle: 'grid',
  },
};

export function getExportTemplateLabel(template: ExportTemplate) {
  return t(template.labelKey);
}

export function getExportTemplateDescription(template: ExportTemplate) {
  return t(template.descriptionKey);
}

export interface ResolvedExportOptions extends ExportDocumentInput {
  templateId: ExportTemplateId;
  codeStyle: ExportTemplate['codeStyle'];
  tableStyle: ExportTemplate['tableStyle'];
}

function resolveDocxFont(settings: SettingsState, policy: DocxFontPolicy = settings.exportDefaults.docxFontPolicy) {
  const themeFont = getDocxThemeByContentTheme(settings.contentTheme).font;
  let customFont: CustomFont | undefined;

  if (policy === 'preview') {
    if (settings.previewFontSource.kind === 'custom') {
      customFont = settings.customFonts.find((font) => font.id === settings.previewFontSource.value);
    }

    return {
      family: customFont?.family ?? (settings.previewFontFamily === 'inherit' ? themeFont : settings.previewFontFamily),
      customFont,
    };
  }

  if (policy === 'custom') {
    customFont = settings.customFonts.find((font) => font.id === settings.exportDefaults.docxCustomFontId);
    return {
      family: customFont?.family ?? themeFont,
      customFont,
    };
  }

  return { family: themeFont, customFont: undefined };
}

export function resolveExportOptions(input: {
  content: string;
  filename: string;
  documentPath?: string;
  settings: SettingsState;
  onProgress?: (message: string) => void;
  onWarning?: (message: string) => void;
}): ResolvedExportOptions {
  const parsed = input.settings.exportDefaults.frontMatterOverrides
    ? parseExportFrontMatter(input.content)
    : { content: input.content, frontMatter: null };
  const frontMatter = parsed.frontMatter;
  const templateId = frontMatter?.templateId ?? input.settings.exportDefaults.templateId;
  const template = EXPORT_TEMPLATES[templateId] ?? EXPORT_TEMPLATES.theme;
  const useFrontMatterTemplateDefaults = Boolean(frontMatter?.templateId);
  const docxFontPolicy = useFrontMatterTemplateDefaults
    ? template.docxFontPolicy
    : input.settings.exportDefaults.docxFontPolicy || template.docxFontPolicy;
  const docxFont = resolveDocxFont(input.settings, docxFontPolicy);

  return {
    content: parsed.content,
    filename: input.filename,
    documentPath: input.documentPath,
    title: frontMatter?.title,
    author: frontMatter?.author,
    date: frontMatter?.date,
    contentTheme: input.settings.contentTheme,
    htmlIncludeTheme: input.settings.exportDefaults.htmlIncludeTheme,
    pngScale: input.settings.exportDefaults.pngScale,
    pdfPaper: frontMatter?.pdfPaper ?? input.settings.exportDefaults.pdfPaper,
    pdfMargin: frontMatter?.pdfMargin ?? (
      useFrontMatterTemplateDefaults
        ? template.pdfMargin
        : input.settings.exportDefaults.pdfMargin || template.pdfMargin
    ),
    pdfPageNumbers: input.settings.exportDefaults.pdfPageNumbers,
    pageHeaderFooter: input.settings.exportDefaults.pageHeaderFooter,
    pageHeaderText: input.settings.exportDefaults.pageHeaderText,
    pageFooterText: input.settings.exportDefaults.pageFooterText,
    toc: frontMatter?.toc ?? input.settings.exportDefaults.toc,
    frontMatter,
    templateId: template.id,
    codeStyle: template.codeStyle,
    tableStyle: template.tableStyle,
    localePreference: input.settings.locale,
    locale: resolveAppLocale(input.settings.locale),
    citation: input.settings.citation,
    pandoc: input.settings.pandoc,
    docxFontFamily: docxFont.family,
    docxFontFile: docxFont.customFont
      ? {
          filename: docxFont.customFont.filename,
          path: docxFont.customFont.path,
          format: docxFont.customFont.format,
        }
      : undefined,
    docxFontPolicy,
    onProgress: input.onProgress,
    onWarning: input.onWarning,
  };
}
