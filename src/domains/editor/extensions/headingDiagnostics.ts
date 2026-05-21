import { t } from '../../i18n';
import { extractMarkdownDocumentHeadings } from '../../markdown/documentModel';

export type HeadingDiagnosticKind = 'duplicate-anchor';

export interface HeadingDiagnostic {
  column: number;
  firstLine: number;
  kind: HeadingDiagnosticKind;
  line: number;
  message: string;
  slug: string;
}

export function scanHeadingAnchorDiagnostics(content: string): HeadingDiagnostic[] {
  const seen = new Map<string, number>();
  const diagnostics: HeadingDiagnostic[] = [];

  extractMarkdownDocumentHeadings(content).forEach((heading) => {
    const { line, slug } = heading;
    const firstLine = seen.get(slug);
    if (firstLine) {
      diagnostics.push({
        column: 1,
        firstLine,
        kind: 'duplicate-anchor',
        line,
        message: t('diagnostics.heading.duplicateAnchor.message', { slug, line: firstLine }),
        slug,
      });
      return;
    }

    seen.set(slug, line);
  });

  return diagnostics;
}
