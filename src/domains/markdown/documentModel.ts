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

export interface MarkdownDocumentImageReference {
  alt: string;
  column: number;
  line: number;
  target: string;
}

export type MarkdownDocumentBlockKind = 'callout' | 'details' | 'mermaid' | 'katex';

export interface MarkdownDocumentBlockReference {
  column: number;
  info?: string;
  kind: MarkdownDocumentBlockKind;
  line: number;
  title?: string;
}

export interface MarkdownDocumentModel {
  body: string;
  blocks: MarkdownDocumentBlockReference[];
  content: string;
  frontMatter: MarkdownDocumentFrontMatter;
  frontMatterLineOffset: number;
  headings: MarkdownDocumentHeading[];
  images: MarkdownDocumentImageReference[];
  links: MarkdownDocumentLinkReference[];
}

const MARKDOWN_LINK_RE = /!?\[([^\]\n]*)\]\(([^)\n]*)\)/g;
const WIKI_LINK_RE = /\[\[([^\]\n|#]+)(?:#[^\]\n|]*)?(?:\|([^\]\n]*))?\]\]/g;
const CALLOUT_RE = /^>\s*\[!(NOTE|TIP|WARNING|IMPORTANT)\](?:\s+(.+?))?\s*$/i;
const DETAILS_RE = /^\s*<details\b/i;
const FENCE_RE = /^```+\s*([^\s`]*)/;

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

function createLineColumnReader(content: string) {
  const lineStarts = [0];
  for (let index = 0; index < content.length; index += 1) {
    if (content.charCodeAt(index) === 10) {
      lineStarts.push(index + 1);
    }
  }

  return (index: number) => {
    let low = 0;
    let high = lineStarts.length - 1;
    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      if (lineStarts[mid] <= index) {
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    const lineIndex = Math.max(0, high);
    return {
      line: lineIndex + 1,
      column: index - lineStarts[lineIndex] + 1,
    };
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
  const lineColumnFromIndex = createLineColumnReader(content);

  for (const match of content.matchAll(MARKDOWN_LINK_RE)) {
    if (content[match.index ?? 0] === '!') continue;
    const target = match[2]?.trim() ?? '';
    if (!target) continue;
    const { line, column } = lineColumnFromIndex(match.index ?? 0);
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
    const { line, column } = lineColumnFromIndex(match.index ?? 0);
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

export function extractMarkdownDocumentImages(content: string): MarkdownDocumentImageReference[] {
  const images: MarkdownDocumentImageReference[] = [];
  const lineColumnFromIndex = createLineColumnReader(content);

  for (const match of content.matchAll(MARKDOWN_LINK_RE)) {
    if (content[match.index ?? 0] !== '!') continue;
    const target = match[2]?.trim() ?? '';
    const { line, column } = lineColumnFromIndex(match.index ?? 0);
    images.push({
      alt: match[1]?.trim() ?? '',
      column,
      line,
      target,
    });
  }

  return images.sort((a, b) => a.line - b.line || a.column - b.column);
}

export function extractMarkdownDocumentBlocks(
  content: string,
  lineOffset = 0,
): MarkdownDocumentBlockReference[] {
  const blocks: MarkdownDocumentBlockReference[] = [];
  let inMermaidFence = false;
  let inKatexBlock = false;

  content.split(/\r?\n/).forEach((lineText, index) => {
    const line = lineOffset + index + 1;
    const callout = lineText.match(CALLOUT_RE);
    if (callout) {
      blocks.push({
        column: 1,
        info: callout[1].toLowerCase(),
        kind: 'callout',
        line,
        title: callout[2]?.trim() || callout[1].toUpperCase(),
      });
      return;
    }

    const details = lineText.match(DETAILS_RE);
    if (details) {
      blocks.push({
        column: (details.index ?? 0) + 1,
        kind: 'details',
        line,
      });
      return;
    }

    const fence = lineText.match(FENCE_RE);
    if (fence) {
      const info = fence[1]?.trim().toLowerCase() ?? '';
      if (!inMermaidFence && info === 'mermaid') {
        blocks.push({
          column: 1,
          info,
          kind: 'mermaid',
          line,
        });
      }
      inMermaidFence = !inMermaidFence && info === 'mermaid'
        ? true
        : inMermaidFence && !info
          ? false
          : inMermaidFence;
      return;
    }

    const trimmed = lineText.trim();
    if (trimmed.startsWith('$$')) {
      if (!inKatexBlock) {
        blocks.push({
          column: lineText.indexOf('$$') + 1,
          info: 'math',
          kind: 'katex',
          line,
        });
      }
      if (trimmed === '$$' || !trimmed.endsWith('$$') || trimmed.length === 2) {
        inKatexBlock = !inKatexBlock;
      }
    }
  });

  return blocks.sort((a, b) => a.line - b.line || a.column - b.column);
}

export function parseMarkdownDocumentModel(content: string): MarkdownDocumentModel {
  const parsed = parseDocumentFrontMatter(content);
  const frontMatterLineOffset = getFrontMatterLineOffset(content, parsed.body);

  return {
    body: parsed.body,
    blocks: extractMarkdownDocumentBlocks(parsed.body, frontMatterLineOffset),
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
    images: extractMarkdownDocumentImages(content),
    links: extractMarkdownDocumentLinks(content),
  };
}
