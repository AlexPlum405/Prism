/**
 * 引用导出的两条路：有 Pandoc 时让它把 [@key] 渲染成真正的引文（含 CSL 样式），
 * 没 Pandoc 时保留占位符并把原因作为 warning 报给用户。
 *
 * 判据刻意严格：bib 与 csl 的扩展名都要对得上，否则 Pandoc 会静默产出
 * 一份看起来没问题的文档，而引文其实没解析。
 */
import { invokeNativeCommand } from '../../../platform/tauri/nativeCommands';
import { t } from '../../i18n/runtime';
import { findPandocCitations } from '../../editor/extensions/citations';
import type { ExportDocumentInput } from '../types';
import { getErrorMessage, reportWarning } from '../pipeline/exportPipelineContext';

export interface PandocCitationHtmlResult {
  html: string;
  warnings: string;
}
export type PandocCitationHtmlAttempt =
  | { attempted: false; html: null }
  | { attempted: true; html: string | null };

export type CitationPlaceholderContext = 'html' | 'builtIn';

function hasCitationExportConfig(input: ExportDocumentInput) {
  return Boolean(input.citation?.bibliographyPath || input.citation?.cslStylePath);
}

function hasSupportedCitationPathExtension(path: string, extensions: string[]) {
  const normalized = path.trim().toLowerCase();
  return normalized.length === 0 || extensions.some((extension) => normalized.endsWith(extension));
}

function hasPandocCitationHtmlSupport(input: ExportDocumentInput) {
  const bibliographyPath = input.citation?.bibliographyPath ?? '';
  const cslStylePath = input.citation?.cslStylePath ?? '';
  return Boolean(
    input.pandoc?.detected &&
    bibliographyPath &&
    hasSupportedCitationPathExtension(bibliographyPath, ['.bib', '.bibtex', '.json']) &&
    hasSupportedCitationPathExtension(cslStylePath, ['.csl']),
  );
}

function getCitationPlaceholderWarning(input: ExportDocumentInput, context: CitationPlaceholderContext) {
  const bibliographyPath = input.citation?.bibliographyPath?.trim() ?? '';
  const cslStylePath = input.citation?.cslStylePath?.trim() ?? '';
  const hasBibliography = bibliographyPath.length > 0;
  const hasCslStyle = cslStylePath.length > 0;
  const pandocError = input.pandoc?.lastError?.trim();

  if (!hasSupportedCitationPathExtension(bibliographyPath, ['.bib', '.bibtex', '.json'])) {
    return t('export.warning.citationInvalidBibliography');
  }
  if (!hasSupportedCitationPathExtension(cslStylePath, ['.csl'])) {
    return t('export.warning.citationInvalidCsl');
  }
  if (!hasBibliography && hasCslStyle) {
    return t('export.warning.citationMissingBibliography');
  }
  if (context === 'html' && hasBibliography && !input.pandoc?.detected) {
    return pandocError
      ? t('export.warning.citationPandocMissingWithError', { error: pandocError })
      : t('export.warning.citationPandocMissing');
  }
  return t('export.warning.citationBuiltIn');
}

export function reportCitationPlaceholderWarning(input: ExportDocumentInput, context: CitationPlaceholderContext = 'builtIn') {
  if (!hasCitationExportConfig(input)) return;
  if (findPandocCitations(input.content).length === 0) return;
  reportWarning(input, getCitationPlaceholderWarning(input, context));
}

export async function renderPandocCitationHtml(input: ExportDocumentInput): Promise<PandocCitationHtmlAttempt> {
  if (!hasPandocCitationHtmlSupport(input)) return { attempted: false, html: null };
  if (findPandocCitations(input.content).length === 0) return { attempted: false, html: null };

  try {
    const result = await invokeNativeCommand<PandocCitationHtmlResult>('render_citations_with_pandoc', {
      path: input.pandoc?.path || null,
      markdown: input.content,
      bibliographyPath: input.citation?.bibliographyPath ?? '',
      cslStylePath: input.citation?.cslStylePath || null,
    });
    const warnings = result.warnings.trim();
    if (warnings) reportWarning(input, warnings);
    return { attempted: true, html: result.html };
  } catch (error) {
    reportWarning(
      input,
      t('export.warning.citationPandocFailed', { message: getErrorMessage(error) }),
    );
    return { attempted: true, html: null };
  }
}
