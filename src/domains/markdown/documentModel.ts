import { parseDocumentFrontMatter } from './frontMatter';
import {
  extractMarkdownDocumentHeadings,
  type MarkdownDocumentHeading,
} from './headings';
import {
  extractMarkdownDocumentImages,
  extractMarkdownDocumentLinks,
  type MarkdownDocumentImageReference,
  type MarkdownDocumentLinkReference,
} from './links';

export {
  extractMarkdownDocumentHeadings,
  type MarkdownDocumentHeading,
} from './headings';
export {
  extractMarkdownDocumentImages,
  extractMarkdownDocumentLinks,
  type MarkdownDocumentImageReference,
  type MarkdownDocumentLinkKind,
  type MarkdownDocumentLinkReference,
} from './links';

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
