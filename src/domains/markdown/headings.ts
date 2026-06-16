import { getMarkdownHeadingSlug } from './headingSlug';

export interface MarkdownDocumentHeading {
  level: number;
  line: number;
  slug: string;
  title: string;
}

export function extractMarkdownDocumentHeadings(
  content: string,
  lineOffset = 0,
): MarkdownDocumentHeading[] {
  return content.split(/\r?\n/).flatMap((line, index) => {
    const match = line.match(/^(#{1,6})[ \t]+(.+?)[ \t#]*$/);
    if (!match) return [];
    const title = match[2].replace(/`([^`]+)`/g, '$1').trim();
    const slug = getMarkdownHeadingSlug(title);
    if (!title || !slug) return [];
    return [{
      level: match[1].length,
      line: lineOffset + index + 1,
      slug,
      title,
    }];
  });
}
