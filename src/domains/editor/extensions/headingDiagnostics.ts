import { t } from '../../i18n';
import { getMarkdownHeadingSlug } from './linkDiagnostics';

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

  content.split('\n').forEach((lineText, lineIndex) => {
    const match = lineText.match(/^(#{1,6})\s+(.+)$/);
    if (!match) return;

    const slug = getMarkdownHeadingSlug(match[2]);
    if (!slug) return;

    const line = lineIndex + 1;
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
