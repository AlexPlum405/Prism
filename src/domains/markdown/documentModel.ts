import { parseDocumentFrontMatter } from './frontMatter';
import { getMarkdownHeadingSlug } from './headingSlug';

export type MarkdownDocumentLinkKind = 'markdown' | 'wiki';

export interface MarkdownDocumentFrontMatter {
  author: string;
  date: string;
  description: string;
  error: string | null;
  exportRaw: string;
  hasFrontMatter: boolean;
  status: string;
  tags: string[];
  title: string;
}

export interface MarkdownDocumentHeading {
  level: number;
  line: number;
  slug: string;
  title: string;
}

export interface MarkdownDocumentLinkReference {
  column: number;
  kind: MarkdownDocumentLinkKind;
  label: string;
  line: number;
  target: string;
}

export interface MarkdownDocumentModel {
  body: string;
  content: string;
  frontMatter: MarkdownDocumentFrontMatter;
  frontMatterLineOffset: number;
  headings: MarkdownDocumentHeading[];
  links: MarkdownDocumentLinkReference[];
}

const MARKDOWN_LINK_RE = /!?\[([^\]\n]*)\]\(([^)\n]*)\)/g;
const WIKI_LINK_RE = /\[\[([^\]\n|#]+)(?:#[^\]\n|]*)?(?:\|([^\]\n]*))?\]\]/g;

function splitTags(value: string) {
  return value
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function getFrontMatterLineOffset(content: string, body: string) {
  if (body === content) return 0;
  return content.slice(0, content.length - body.length).split(/\r?\n/).length - 1;
}

function lineColumnFromIndex(content: string, index: number) {
  const prefix = content.slice(0, index);
  const lines = prefix.split('\n');
  return {
    line: lines.length,
    column: lines[lines.length - 1].length + 1,
  };
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

export function extractMarkdownDocumentLinks(content: string): MarkdownDocumentLinkReference[] {
  const links: MarkdownDocumentLinkReference[] = [];

  for (const match of content.matchAll(MARKDOWN_LINK_RE)) {
    if (content[match.index ?? 0] === '!') continue;
    const target = match[2]?.trim() ?? '';
    if (!target) continue;
    const { line, column } = lineColumnFromIndex(content, match.index ?? 0);
    links.push({
      kind: 'markdown',
      target,
      label: match[1]?.trim() || target,
      line,
      column,
    });
  }

  for (const match of content.matchAll(WIKI_LINK_RE)) {
    const target = match[1]?.trim() ?? '';
    if (!target) continue;
    const { line, column } = lineColumnFromIndex(content, match.index ?? 0);
    links.push({
      kind: 'wiki',
      target,
      label: match[2]?.trim() || target,
      line,
      column,
    });
  }

  return links.sort((a, b) => a.line - b.line || a.column - b.column);
}

export function parseMarkdownDocumentModel(content: string): MarkdownDocumentModel {
  const parsed = parseDocumentFrontMatter(content);
  const frontMatterLineOffset = getFrontMatterLineOffset(content, parsed.body);

  return {
    body: parsed.body,
    content,
    frontMatter: {
      author: parsed.properties.author,
      date: parsed.properties.date,
      description: parsed.properties.description,
      error: parsed.error,
      exportRaw: parsed.properties.exportRaw,
      hasFrontMatter: parsed.hasFrontMatter,
      status: parsed.properties.status,
      tags: splitTags(parsed.properties.tags),
      title: parsed.properties.title,
    },
    frontMatterLineOffset,
    headings: extractMarkdownDocumentHeadings(parsed.body, frontMatterLineOffset),
    links: extractMarkdownDocumentLinks(content),
  };
}
