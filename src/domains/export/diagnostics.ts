import type { SettingsState } from '../settings/types';
import { getThemeEntry } from '../themes';
import { t } from '../i18n/runtime';
import { getExportFormatLabel, type ExportFormat } from './types';

function formatExportDiagnosticError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error instanceof Event) return error.type || t('common.unknownEventError');
  return String(error);
}

function hasSupportedCitationPathExtension(path: string, extensions: string[]) {
  const normalized = path.trim().toLowerCase();
  return normalized.length === 0 || extensions.some((extension) => normalized.endsWith(extension));
}

export function getExportCitationPathValidation(citation: SettingsState['citation']) {
  const issues: string[] = [];
  if (!hasSupportedCitationPathExtension(citation.bibliographyPath, ['.bib', '.bibtex', '.json'])) {
    issues.push(t('export.diagnostic.citationBibliographyExtension'));
  }
  if (!hasSupportedCitationPathExtension(citation.cslStylePath, ['.csl'])) {
    issues.push(t('export.diagnostic.citationCslExtension'));
  }
  if (!citation.bibliographyPath.trim() && citation.cslStylePath.trim()) {
    issues.push(t('export.diagnostic.citationMissingBibliography'));
  }
  return issues.length > 0 ? issues.join('；') : t('export.diagnostic.pass');
}

export function buildExportFailureDiagnostic(input: {
  format: ExportFormat;
  documentName: string;
  documentPath: string;
  outputPath?: string | null;
  stage: string;
  settings: SettingsState;
  warnings?: string[];
  error: unknown;
}) {
  const errorMessage = formatExportDiagnosticError(input.error);
  const stack = input.error instanceof Error && input.error.stack
    ? input.error.stack
    : '';
  const pandoc = input.settings.pandoc;
  const themeEntry = getThemeEntry(input.settings.contentTheme);
  const themeSource = themeEntry?.source ?? 'fallback';
  const pandocStatus = pandoc.lastCheckedAt === null
    ? t('export.diagnostic.notChecked')
    : pandoc.detected
      ? t('export.diagnostic.available')
      : t('export.diagnostic.unavailable');
  const citation = input.settings.citation;
  const citationPathValidation = getExportCitationPathValidation(citation);
  const citationPandocReady =
    pandoc.detected
    && Boolean(citation.bibliographyPath)
    && citationPathValidation === t('export.diagnostic.pass');
  const empty = t('export.diagnostic.empty');
  const line = (label: string, value: string) => `${label}: ${value}`;
  return [
    t('export.diagnostic.title'),
    line(t('export.diagnostic.time'), new Date().toISOString()),
    line(t('export.diagnostic.format'), `${getExportFormatLabel(input.format)} (${input.format})`),
    line(t('export.diagnostic.stage'), input.stage),
    line(t('export.diagnostic.document'), input.documentName),
    line(t('export.diagnostic.documentPath'), input.documentPath || `(${t('export.diagnostic.unsaved')})`),
    line(t('export.diagnostic.outputPath'), input.outputPath || `(${t('export.diagnostic.notSelected')})`),
    line(t('export.diagnostic.contentTheme'), input.settings.contentTheme),
    line(t('export.diagnostic.themeName'), themeEntry?.label ?? 'Miaoyan fallback'),
    line(t('export.diagnostic.themeSource'), themeSource),
    line(t('export.diagnostic.userThemeCss'), themeEntry?.source === 'user' ? t('common.enabled') : t('common.disabled')),
    themeEntry?.error ? line(t('export.diagnostic.themeError'), themeEntry.error) : '',
    line(t('export.diagnostic.exportTemplate'), input.settings.exportDefaults.templateId),
    line(t('export.diagnostic.frontMatterOverrides'), input.settings.exportDefaults.frontMatterOverrides ? t('common.enabled') : t('common.disabled')),
    line(t('export.diagnostic.toc'), input.settings.exportDefaults.toc ? t('common.enabled') : t('common.disabled')),
    line(t('export.diagnostic.defaultExportLocation'), input.settings.exportDefaults.defaultLocation),
    line(t('export.diagnostic.pdfPaper'), input.settings.exportDefaults.pdfPaper),
    line(t('export.diagnostic.pdfMargin'), input.settings.exportDefaults.pdfMargin),
    line(t('export.diagnostic.pageNumbers'), input.settings.exportDefaults.pdfPageNumbers ? t('common.enabled') : t('common.disabled')),
    line(t('export.diagnostic.headerFooter'), input.settings.exportDefaults.pageHeaderFooter ? t('common.enabled') : t('common.disabled')),
    line(t('export.diagnostic.headerText'), input.settings.exportDefaults.pageHeaderText || `(${empty})`),
    line(t('export.diagnostic.footerText'), input.settings.exportDefaults.pageFooterText || `(${empty})`),
    line(t('export.diagnostic.exportQuality'), `${input.settings.exportDefaults.pngScale}x`),
    line(t('export.diagnostic.htmlInlineTheme'), input.settings.exportDefaults.htmlIncludeTheme ? t('common.yes') : t('common.no')),
    line(t('export.diagnostic.docxFontPolicy'), input.settings.exportDefaults.docxFontPolicy),
    line(t('export.diagnostic.docxCustomFont'), input.settings.exportDefaults.docxCustomFontId || `(${t('common.unspecified')})`),
    line(t('export.diagnostic.bibliographyFile'), citation.bibliographyPath || `(${t('common.unspecified')})`),
    line(t('export.diagnostic.cslStyleFile'), citation.cslStylePath || `(${t('common.unspecified')})`),
    line(t('export.diagnostic.citationPathValidation'), citationPathValidation),
    line(t('export.diagnostic.pandocCitationCondition'), citationPandocReady ? t('export.diagnostic.satisfied') : t('export.diagnostic.notSatisfied')),
    line(t('export.diagnostic.pandocStatus'), pandocStatus),
    line(t('export.diagnostic.pandocPath'), pandoc.path || `(${t('export.diagnostic.systemPandoc')})`),
    pandoc.version ? line(t('export.diagnostic.pandocVersion'), pandoc.version) : '',
    pandoc.lastError ? line(t('export.diagnostic.pandocError'), pandoc.lastError) : '',
    input.warnings?.length
      ? `${t('export.diagnostic.exportWarnings')}:\n${input.warnings.map((message) => `- ${message}`).join('\n')}`
      : '',
    line(t('export.diagnostic.possibleCause'), t('export.diagnostic.possibleCauseText')),
    line(t('export.diagnostic.nextSteps'), t('export.diagnostic.nextStepsText')),
    line(t('export.diagnostic.error'), errorMessage),
    stack ? `${t('export.diagnostic.stack')}:\n${stack}` : '',
  ].filter(Boolean).join('\n');
}
