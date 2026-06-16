export type MarkdownDocumentLinkKind = 'markdown' | 'wiki';

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

const MARKDOWN_LINK_RE = /!?\[([^\]\n]*)\]\(([^)\n]*)\)/g;
const WIKI_LINK_RE = /\[\[([^\]\n|#]+)(?:#[^\]\n|]*)?(?:\|([^\]\n]*))?\]\]/g;

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
