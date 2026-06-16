import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkRehype from 'remark-rehype';
import rehypeRaw from 'rehype-raw';
import rehypeStringify from 'rehype-stringify';
import katex from 'katex';
import { visit } from 'unist-util-visit';
import { findPandocCitations } from '../domains/editor/extensions/citations';
import { applyCalloutMetadataToMdastBlockquote } from '../domains/editor/extensions/callouts';
import {
  highlightPrismCode,
  highlightPrismCodeAuto,
} from '../domains/markdown/codeHighlight';
import {
  parseDocumentFrontMatter,
  type DocumentFrontMatterProperties,
} from '../domains/editor/extensions/frontMatterProperties';
import { t } from '../domains/i18n/runtime';

function remarkMermaid() {
  return (tree: any) => {
    visit(tree, 'code', (node: any, index, parent) => {
      if (node.lang !== 'mermaid') return;
      if (index === undefined || !parent) return;

      const encoded = encodeURIComponent(node.value);
      const line = node.position?.start?.line;
      parent.children[index] = {
        type: 'mermaid',
        data: {
          hName: 'div',
          hProperties: {
            className: ['mermaid-placeholder'],
            dataMermaid: encoded,
            ...(Number.isFinite(line)
              ? {
                  'data-source-line': String(line),
                  'data-line': String(line),
                  dataLine: String(line),
                }
              : {}),
          },
        },
        children: [],
      };
    });
  };
}

function remarkCollectMathLines(mathLines: number[]) {
  return (tree: any) => {
    visit(tree, 'math', (node: any) => {
      const line = node.position?.start?.line;
      if (Number.isFinite(line)) mathLines.push(line);
    });
  };
}

function createKatexPlaceholderNode(value: string, displayMode: boolean, line?: number) {
  return {
    type: 'prismKatexPlaceholder',
    data: {
      hName: 'span',
      hProperties: {
        className: displayMode ? ['katex-display', 'katex-placeholder'] : ['katex-placeholder'],
        'data-katex': encodeURIComponent(value),
        'data-katex-display': displayMode ? 'true' : 'false',
        ...(displayMode && Number.isFinite(line)
          ? {
              'data-source-line': String(line),
              'data-line': String(line),
              dataLine: String(line),
            }
          : {}),
      },
    },
    children: [{ type: 'text', value }],
  };
}

function splitInlineKatexPlaceholderNodes(value: string) {
  const pattern = /(^|[^\\$])(\$\$?)([^$\n]+?)\2(?!\$)/g;
  const children: any[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(value)) !== null) {
    const prefix = match[1] ?? '';
    const delimiter = match[2] ?? '$';
    const math = match[3] ?? '';
    const mathStart = match.index + prefix.length;
    if (mathStart > lastIndex) {
      children.push({ type: 'text', value: value.slice(lastIndex, mathStart) });
    }
    children.push(createKatexPlaceholderNode(math, delimiter === '$$'));
    lastIndex = mathStart + delimiter.length + math.length + delimiter.length;
  }

  if (children.length === 0) return null;
  if (lastIndex < value.length) {
    children.push({ type: 'text', value: value.slice(lastIndex) });
  }
  return children;
}

function remarkKatexPlaceholders() {
  return (tree: any) => {
    visit(tree, 'paragraph', (node: any, index, parent: any) => {
      if (typeof index !== 'number' || !parent || !Array.isArray(node.children)) return;
      if (node.children.length !== 1 || node.children[0]?.type !== 'text') return;
      const value = String(node.children[0].value ?? '');
      const displayMatch = /^\$\$\s*\n?([\s\S]*?)\n?\s*\$\$$/.exec(value.trim());
      if (!displayMatch) return;
      const math = displayMatch[1] ?? '';
      const line = node.position?.start?.line;
      parent.children.splice(index, 1, createKatexPlaceholderNode(math, true, line));
      return ['skip', index] as any;
    });

    visit(tree, 'text', (node: any, index, parent: any) => {
      if (typeof index !== 'number' || !parent || !Array.isArray(parent.children)) return;
      if (parent.type === 'link' || parent.type === 'linkReference') return;
      const children = splitInlineKatexPlaceholderNodes(String(node.value ?? ''));
      if (!children) return;
      parent.children.splice(index, 1, ...children);
      return ['skip', index + children.length] as any;
    });
  };
}

function isUnsafePreviewUrl(value: unknown, allowedProtocols: Set<string>) {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (
    trimmed.startsWith('#')
    || trimmed.startsWith('//')
    || trimmed.startsWith('/')
    || trimmed.startsWith('./')
    || trimmed.startsWith('../')
    || trimmed.startsWith('?')
  ) {
    return false;
  }

  const protocolCandidate = trimmed.replace(/[\u0000-\u001F\u007F]+/g, '');
  const protocol = /^[a-zA-Z][a-zA-Z\d+.-]*:/.exec(protocolCandidate)?.[0].toLowerCase();
  return Boolean(protocol && !allowedProtocols.has(protocol));
}

function rehypePreviewUrlSafety() {
  const linkProtocols = new Set(['http:', 'https:', 'mailto:']);
  const mediaProtocols = new Set(['http:', 'https:']);
  const dangerousTags = new Set(['script', 'iframe', 'object', 'embed', 'base', 'meta', 'link', 'style']);

  return (tree: any) => {
    visit(tree, 'element', (node: any, index, parent) => {
      if (dangerousTags.has(node.tagName) && parent && typeof index === 'number') {
        parent.children.splice(index, 1);
        return ['skip', index] as any;
      }
      if (!node.properties) return;
      if (node.tagName === 'a' && isUnsafePreviewUrl(node.properties.href, linkProtocols)) {
        delete node.properties.href;
      }
      if ((node.tagName === 'img' || node.tagName === 'source') && isUnsafePreviewUrl(node.properties.src, mediaProtocols)) {
        delete node.properties.src;
      }
      const style = node.properties.style;
      if (typeof style === 'string' && /expression\s*\(|javascript:|url\s*\(\s*['"]?javascript:/i.test(style)) {
        delete node.properties.style;
      }
      Object.keys(node.properties).forEach((key) => {
        if (key.toLowerCase().startsWith('on')) {
          delete node.properties[key];
        }
      });
    });
  };
}

function getHastText(node: any): string {
  if (!node) return '';
  if (node.type === 'text') return typeof node.value === 'string' ? node.value : '';
  if (!Array.isArray(node.children)) return '';
  return node.children.map(getHastText).join('');
}

function getCodeLanguage(node: any) {
  const className = node.properties?.className;
  if (!Array.isArray(className)) return undefined;

  for (const value of className) {
    const name = String(value);
    if (name === 'no-highlight' || name === 'nohighlight') return false;
    if (name.startsWith('lang-')) return name.slice(5);
    if (name.startsWith('language-')) return name.slice(9);
  }

  return undefined;
}

function decodeHighlightHtmlText(value: string) {
  return value.replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (entity, body: string) => {
    const normalized = body.toLowerCase();
    if (normalized === 'amp') return '&';
    if (normalized === 'lt') return '<';
    if (normalized === 'gt') return '>';
    if (normalized === 'quot') return '"';
    if (normalized === 'apos') return "'";
    if (normalized.startsWith('#x')) {
      return String.fromCodePoint(Number.parseInt(normalized.slice(2), 16));
    }
    if (normalized.startsWith('#')) {
      return String.fromCodePoint(Number.parseInt(normalized.slice(1), 10));
    }
    return entity;
  });
}

function highlightHtmlToHastChildren(html: string) {
  const root: { children: any[] } = { children: [] };
  const stack: Array<{ children: any[] }> = [root];
  const spanPattern = /<\/span>|<span class="([^"]+)">/g;
  let lastIndex = 0;

  const appendText = (value: string) => {
    if (!value) return;
    stack[stack.length - 1].children.push({
      type: 'text',
      value: decodeHighlightHtmlText(value),
    });
  };

  for (const match of html.matchAll(spanPattern)) {
    appendText(html.slice(lastIndex, match.index));
    const token = match[0];
    if (token === '</span>') {
      if (stack.length > 1) {
        stack.pop();
      }
    } else {
      const node = {
        type: 'element',
        tagName: 'span',
        properties: {
          className: (match[1] ?? '').split(/\s+/).filter(Boolean),
        },
        children: [],
      };
      stack[stack.length - 1].children.push(node);
      stack.push(node);
    }
    lastIndex = match.index + token.length;
  }

  appendText(html.slice(lastIndex));
  return root.children;
}

function getElementClassNames(node: any): string[] {
  const className = node?.properties?.className;
  return Array.isArray(className) ? className.map(String) : [];
}

function nodeHasClass(node: any, className: string) {
  return getElementClassNames(node).includes(className);
}

function getMathRenderTarget(node: any) {
  if (node?.type !== 'element') return null;

  if (node.tagName === 'pre') {
    const code = Array.isArray(node.children)
      ? node.children.find((child: any) => child?.type === 'element' && child.tagName === 'code')
      : undefined;
    if (!code) return null;
    const isMathCode = nodeHasClass(code, 'language-math') || nodeHasClass(code, 'math-display');
    return isMathCode ? { scope: node, value: getHastText(code), displayMode: true } : null;
  }

  const isMath = nodeHasClass(node, 'language-math')
    || nodeHasClass(node, 'math-display')
    || nodeHasClass(node, 'math-inline');
  if (!isMath) return null;

  return {
    scope: node,
    value: getHastText(node),
    displayMode: nodeHasClass(node, 'math-display'),
  };
}

function withDisplayMathLineAttributes(html: string, line: number | undefined) {
  if (!Number.isFinite(line)) return html;
  const escapedLine = escapeGeneratedHtml(String(line));
  return html.replace(
    '<span class="katex-display"',
    `<span class="katex-display" data-source-line="${escapedLine}" data-line="${escapedLine}"`,
  );
}

function renderKatexHtml(value: string, displayMode: boolean, line: number | undefined) {
  let html: string;

  try {
    html = katex.renderToString(value, {
      displayMode,
      throwOnError: true,
    });
  } catch (error) {
    try {
      html = katex.renderToString(value, {
        displayMode,
        strict: 'ignore',
        throwOnError: false,
      });
    } catch {
      html = `<span class="katex-error" style="color:#cc0000" title="${escapeGeneratedHtml(String(error))}">${escapeGeneratedHtml(value)}</span>`;
    }
  }

  return displayMode ? withDisplayMathLineAttributes(html, line) : html;
}

function renderKatexPlaceholderHtml(value: string, displayMode: boolean, line: number | undefined) {
  const encoded = encodeURIComponent(value);
  const text = escapeGeneratedHtml(value);
  if (!displayMode) {
    return `<span class="katex-placeholder" data-katex="${encoded}" data-katex-display="false">${text}</span>`;
  }

  const escapedLine = Number.isFinite(line) ? escapeGeneratedHtml(String(line)) : '';
  const sourceAttributes = escapedLine
    ? ` data-source-line="${escapedLine}" data-line="${escapedLine}"`
    : '';
  return `<span class="katex-display katex-placeholder" data-katex="${encoded}" data-katex-display="true"${sourceAttributes}>${text}</span>`;
}

function rehypeKatexRaw(mathLines: number[], options: { renderMath: boolean }) {
  return (tree: any) => {
    visit(tree, 'element', (node: any, index, parent: any) => {
      if (!parent || typeof index !== 'number') return;
      const target = getMathRenderTarget(node);
      if (!target || target.scope !== node) return;
      const line = target.displayMode ? mathLines.shift() : undefined;
      parent.children.splice(index, 1, {
        type: 'raw',
        value: options.renderMath
          ? renderKatexHtml(target.value, target.displayMode, line)
          : renderKatexPlaceholderHtml(target.value, target.displayMode, line),
      });
      return ['skip', index] as any;
    });
  };
}

function rehypePrismCodeHighlight(options: { autoDetectUnlabeledCode: boolean; highlightCode: boolean }) {
  return (tree: any) => {
    visit(tree, 'element', (node: any, _index, parent: any) => {
      if (
        node.tagName !== 'code'
        || !parent
        || parent.type !== 'element'
        || parent.tagName !== 'pre'
      ) {
        return;
      }

      const language = getCodeLanguage(node);
      if (language === false) return;

      node.properties = node.properties || {};
      const className = Array.isArray(node.properties.className) ? node.properties.className : [];
      if (!className.includes('hljs')) {
        className.unshift('hljs');
      }
      node.properties.className = className;

      if (!options.highlightCode) return;
      if (!language && !options.autoDetectUnlabeledCode) return;

      const code = getHastText(node);

      try {
        const result = language
          ? highlightPrismCode(code, language)
          : highlightPrismCodeAuto(code);

        if (!language && result.language) {
          const detectedLanguageClass = `language-${result.language}`;
          if (!className.includes(detectedLanguageClass)) {
            className.push(detectedLanguageClass);
          }
        }

        const children = highlightHtmlToHastChildren(result.value);
        if (children.length > 0) {
          node.children = children;
        }
      } catch (error) {
        if (language && error instanceof Error && /Unknown language/.test(error.message)) {
          return;
        }
        throw error;
      }
    });
  };
}

function remarkBlockLines() {
  const BLOCK_TYPES = new Set([
    'heading',
    'paragraph',
    'blockquote',
    'list',
    'listItem',
    'math',
    'code',
    'table',
    'thematicBreak',
  ]);
  return (tree: any) => {
    visit(tree, (node: any) => {
      if (!BLOCK_TYPES.has(node.type)) return;
      if (!node.position) return;
      node.data = node.data || {};
      node.data.hProperties = node.data.hProperties || {};
      const line = node.position.start.line;
      if (node.data.hProperties['data-source-line'] === undefined) {
        node.data.hProperties['data-source-line'] = String(line);
      }
      if (node.data.hProperties['data-line'] === undefined) {
        node.data.hProperties['data-line'] = String(line);
      }
      if (node.data.hProperties.dataLine === undefined) {
        node.data.hProperties.dataLine = String(line);
      }
    });
  };
}

function remarkCallouts() {
  return (tree: any) => {
    visit(tree, 'blockquote', (node: any) => {
      applyCalloutMetadataToMdastBlockquote(node);
    });
  };
}

// ==xxx== → <mark>xxx</mark>（对原型 highlight 语法的支持）
function remarkMark() {
  return (tree: any) => {
    visit(tree, 'text', (node: any, index, parent) => {
      if (index === undefined || !parent) return;
      const value: string = node.value;
      if (!value.includes('==')) return;

      const pattern = /==([^=\n]+)==/g;
      const children: any[] = [];
      let lastIndex = 0;
      let match;
      while ((match = pattern.exec(value)) !== null) {
        if (match.index > lastIndex) {
          children.push({ type: 'text', value: value.slice(lastIndex, match.index) });
        }
        children.push({
          type: 'mark',
          data: {
            hName: 'mark',
            hChildren: [{ type: 'text', value: match[1] }],
          },
          children: [{ type: 'text', value: match[1] }],
        });
        lastIndex = match.index + match[0].length;
      }
      if (lastIndex < value.length) {
        children.push({ type: 'text', value: value.slice(lastIndex) });
      }
      if (children.length > 0) {
        parent.children.splice(index, 1, ...children);
      }
    });
  };
}

function remarkWikiLinks() {
  return (tree: any) => {
    visit(tree, 'text', (node: any, index, parent) => {
      if (index === undefined || !parent) return;
      const value: string = node.value;
      if (!value.includes('[[')) return;

      const pattern = /\[\[([^\]\n|]+)(?:\|([^\]\n]+))?\]\]/g;
      const children: any[] = [];
      let lastIndex = 0;
      let match;
      while ((match = pattern.exec(value)) !== null) {
        const target = match[1].trim();
        if (!target) continue;
        const label = (match[2] ?? target).trim() || target;
        if (match.index > lastIndex) {
          children.push({ type: 'text', value: value.slice(lastIndex, match.index) });
        }
        children.push({
          type: 'wikiLink',
          data: {
            hName: 'a',
            hProperties: {
              href: '#',
              className: ['prism-wiki-link'],
              dataPrismWikiTarget: target,
            },
            hChildren: [{ type: 'text', value: label }],
          },
          children: [{ type: 'text', value: label }],
        });
        lastIndex = match.index + match[0].length;
      }
      if (children.length === 0) return;
      if (lastIndex < value.length) {
        children.push({ type: 'text', value: value.slice(lastIndex) });
      }
      parent.children.splice(index, 1, ...children);
    });
  };
}

function remarkCitations() {
  return (tree: any) => {
    visit(tree, 'text', (node: any, index, parent) => {
      if (index === undefined || !parent) return;
      if (parent.type === 'link' || parent.type === 'linkReference') return;

      const value: string = node.value;
      const citations = findPandocCitations(value);
      if (citations.length === 0) return;

      const children: any[] = [];
      let lastIndex = 0;
      citations.forEach((citation) => {
        if (citation.index > lastIndex) {
          children.push({ type: 'text', value: value.slice(lastIndex, citation.index) });
        }
        children.push({
          type: 'citation',
          data: {
            hName: 'span',
            hProperties: {
              className: ['prism-citation'],
              dataCitekeys: citation.keys.join(' '),
              title: t('frontMatter.citationPlaceholder', { keys: citation.keys.map((key) => `@${key}`).join(', ') }),
            },
            hChildren: [{ type: 'text', value: citation.raw }],
          },
          children: [{ type: 'text', value: citation.raw }],
        });
        lastIndex = citation.index + citation.raw.length;
      });

      if (lastIndex < value.length) {
        children.push({ type: 'text', value: value.slice(lastIndex) });
      }
      parent.children.splice(index, 1, ...children);
    });
  };
}

export interface MarkdownToHtmlOptions {
  compatibilityMode?: 'miaoyan' | 'inkstone' | 'slate' | 'mono' | 'nocturne';
  /** 大文档预览中可抽取纯文本简单表格，绕开全量 GFM 表格解析。复杂表格仍走 GFM。 */
  lightweightTables?: boolean;
  /** 是否同步生成 KaTeX HTML。大文档预览可关闭，交给 PreviewPane 异步补齐。 */
  renderMath?: boolean;
  /** 是否执行 token 级代码高亮。大文档预览可关闭以保留完整代码内容但减少渲染成本。 */
  highlightCode?: boolean;
  /** 对无语言代码块是否自动猜语言。大文档预览可关闭以避免 highlightAuto 放大耗时。 */
  autoDetectUnlabeledCode?: boolean;
  frontMatterMode?: 'plain' | 'hide' | 'metadata';
  stripFrontMatter?: boolean;
}

interface MarkdownPreviewFeatureHints {
  callouts: boolean;
  citations: boolean;
  code: boolean;
  gfm: boolean;
  mark: boolean;
  math: boolean;
  mermaid: boolean;
  rawHtml: boolean;
  wikiLinks: boolean;
}

const FRONT_MATTER_PATTERN = /^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/;
const HTML_CANDIDATE_PATTERN = /<\/?[A-Za-z][A-Za-z0-9:-]*(?:\s|>|\/>)/;
const CODE_CANDIDATE_PATTERN = /(^|\n)(```|~~~)|<pre(?:\s|>)|<code(?:\s|>)/i;
const MERMAID_FENCE_PATTERN = /(^|\n)(```|~~~)\s*mermaid(?:\s|\n|$)/i;
const MATH_FENCE_PATTERN = /(^|\n)(```|~~~)\s*math(?:\s|\n|$)/i;
const CALLOUT_PATTERN = /(^|\n)\s*>\s*\[![A-Za-z]+\]/;
const GFM_TABLE_SEPARATOR_PATTERN = /(^|\n)\s{0,3}\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?\s*(?:\n|$)/;
const GFM_TASK_LIST_PATTERN = /(^|\n)\s{0,3}(?:[-+*]|\d+[.)])\s+\[[ xX]\]\s/;
const GFM_FOOTNOTE_PATTERN = /(^|\n)\s{0,3}\[\^[^\]\n]+]:|\[\^[^\]\n]+\]/;
const GFM_AUTOLINK_LITERAL_PATTERN = /(^|[\s(])(?:https?:\/\/|www\.)[^\s<]+|[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/;
const LARGE_PRE_TABLE_ROW_THRESHOLD = 24;
const LARGE_PRE_TABLE_PLACEHOLDER_BASE = 'PrismLargePreTablePlaceholder';
const HTML_ESCAPE_CANDIDATE_PATTERN = /[&<>"']/;
const HTML_ESCAPE_PATTERN = /[&<>"']/g;
const HTML_ESCAPE_REPLACEMENTS: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};
const FRONT_MATTER_FIELDS: Array<{
  className: string;
  key: keyof DocumentFrontMatterProperties;
  labelKey: 'frontMatter.title' | 'frontMatter.tags' | 'frontMatter.description' | 'frontMatter.author' | 'frontMatter.date' | 'frontMatter.status' | 'frontMatter.export';
  renderAs?: 'tags' | 'code';
}> = [
  { key: 'title', labelKey: 'frontMatter.title', className: 'title' },
  { key: 'tags', labelKey: 'frontMatter.tags', className: 'tags', renderAs: 'tags' },
  { key: 'description', labelKey: 'frontMatter.description', className: 'description' },
  { key: 'author', labelKey: 'frontMatter.author', className: 'author' },
  { key: 'date', labelKey: 'frontMatter.date', className: 'date' },
  { key: 'status', labelKey: 'frontMatter.status', className: 'status' },
  { key: 'exportRaw', labelKey: 'frontMatter.export', className: 'export', renderAs: 'code' },
];

function escapeGeneratedHtml(value: string) {
  if (!HTML_ESCAPE_CANDIDATE_PATTERN.test(value)) return value;
  return value.replace(HTML_ESCAPE_PATTERN, (char) => HTML_ESCAPE_REPLACEMENTS[char] ?? char);
}

function splitMarkdownTableRow(line: string) {
  const trimmed = line.trim();
  if (!trimmed.startsWith('|') || !trimmed.endsWith('|')) return null;
  return trimmed
    .slice(1, -1)
    .split('|')
    .map((cell) => cell.trim());
}

function isMarkdownTableSeparator(line: string) {
  const cells = splitMarkdownTableRow(line);
  return Boolean(cells && cells.length >= 2 && cells.every((cell) => /^:?-{3,}:?$/.test(cell)));
}

function getMarkdownTableAlignments(separatorCells: string[]) {
  return separatorCells.map((cell) => {
    const left = cell.startsWith(':');
    const right = cell.endsWith(':');
    if (left && right) return 'center';
    if (right) return 'right';
    if (left) return 'left';
    return null;
  });
}

function stripInlineCodeFence(value: string) {
  const trimmed = value.trim();
  const match = /^`([^`]*)`$/.exec(trimmed);
  return match ? match[1] : trimmed;
}

function renderLargePreTableCell(value: string) {
  return `<code>${escapeGeneratedHtml(stripInlineCodeFence(value))}</code>`;
}

interface LargePreTableRow {
  firstCell: string;
  preContent: string;
  sourceLine: number;
  trailingCell: string;
}

interface LightweightMarkdownTableRow {
  cells: string[];
  sourceLine: number;
}

interface LargePreTablePlaceholder {
  replacementHtml: string;
  token: string;
}

interface SourceLineOffset {
  afterLine: number;
  delta: number;
}

function parseLargePreTableRows(lines: string[], startIndex: number) {
  const rows: LargePreTableRow[] = [];
  let index = startIndex;

  while (index < lines.length) {
    const startLine = lines[index];
    const startMatch = /^\|\s*([^|]+?)\s*\|\s*<pre>(.*)$/.exec(startLine);
    if (!startMatch) break;

    const sourceLine = index + 1;
    const preLines: string[] = [];
    let trailingCell = '';
    let rowClosed = false;
    const firstPreLine = startMatch[2] ?? '';
    const firstLineClose = /^(.*?)<\/pre>\s*\|\s*(.*?)\s*\|\s*$/.exec(firstPreLine);
    if (firstLineClose) {
      preLines.push(firstLineClose[1]);
      trailingCell = firstLineClose[2];
      rowClosed = true;
    } else {
      preLines.push(firstPreLine);
      index += 1;
      while (index < lines.length) {
        const line = lines[index];
        const closeMatch = /^(.*?)<\/pre>\s*\|\s*(.*?)\s*\|\s*$/.exec(line);
        if (closeMatch) {
          preLines.push(closeMatch[1]);
          trailingCell = closeMatch[2];
          rowClosed = true;
          break;
        }
        preLines.push(line);
        index += 1;
      }
    }

    if (!rowClosed) break;

    rows.push({
      firstCell: startMatch[1],
      preContent: preLines.join('\n'),
      sourceLine,
      trailingCell,
    });
    index += 1;
  }

  return { nextIndex: index, rows };
}

function renderLargePreTable(headers: string[], rows: LargePreTableRow[], sourceLine: number) {
  const normalizedHeaders = headers.map((header) => stripInlineCodeFence(header));
  const headerHtml = normalizedHeaders
    .map((header) => `<span>${escapeGeneratedHtml(header)}</span>`)
    .join('');
  const rowsHtml = rows
    .map((row) => [
      `<div data-source-line="${row.sourceLine}">`,
      renderLargePreTableCell(row.firstCell),
      `<pre>${escapeGeneratedHtml(row.preContent)}</pre>`,
      renderLargePreTableCell(row.trailingCell),
      '</div>',
    ].join(''))
    .join('\n');

  return [
    `<section class="prism-large-pre-table" data-source-line="${sourceLine}" data-row-count="${rows.length}">`,
    `<div class="prism-large-pre-table__header">${headerHtml}</div>`,
    rowsHtml,
    '</section>',
  ].join('\n');
}

function isPlainMarkdownTableCell(value: string) {
  return !/[\\`*_#[\]<>~]|!\(|!\[|\]\(|https?:\/\/|www\.|@/.test(value);
}

function canRenderLightweightMarkdownTable(headers: string[], rows: LightweightMarkdownTableRow[]) {
  return [...headers, ...rows.flatMap((row) => row.cells)].every(isPlainMarkdownTableCell);
}

function normalizeMarkdownTableCells(cells: string[], columnCount: number) {
  return Array.from({ length: columnCount }, (_, index) => cells[index] ?? '');
}

function renderTableCellAttributes(align: string | null | undefined) {
  return align ? ` style="text-align:${align}"` : '';
}

function renderLightweightMarkdownTable(
  headers: string[],
  separatorCells: string[],
  rows: LightweightMarkdownTableRow[],
  sourceLine: number,
) {
  const columnCount = headers.length;
  const alignments = getMarkdownTableAlignments(normalizeMarkdownTableCells(separatorCells, columnCount));
  const headerHtml = normalizeMarkdownTableCells(headers, columnCount)
    .map((header, index) => (
      `<th${renderTableCellAttributes(alignments[index])}>${escapeGeneratedHtml(header)}</th>`
    ))
    .join('');
  const rowsHtml = rows
    .map((row) => {
      const cells = normalizeMarkdownTableCells(row.cells, columnCount)
        .map((cell, index) => (
          `<td${renderTableCellAttributes(alignments[index])}>${escapeGeneratedHtml(cell)}</td>`
        ))
        .join('');
      return `<tr>${cells}</tr>`;
    })
    .join('\n');

  return [
    `<table data-source-line="${sourceLine}">`,
    `<thead><tr>${headerHtml}</tr></thead>`,
    rowsHtml ? `<tbody>${rowsHtml}</tbody>` : '<tbody></tbody>',
    '</table>',
  ].join('\n');
}

function parseLightweightMarkdownTableRows(lines: string[], startIndex: number) {
  const rows: LightweightMarkdownTableRow[] = [];
  let index = startIndex;

  while (index < lines.length) {
    const line = lines[index];
    if (line.includes('<pre') || line.includes('</pre>')) break;
    const cells = splitMarkdownTableRow(line);
    if (!cells || isMarkdownTableSeparator(line)) break;
    rows.push({
      cells,
      sourceLine: index + 1,
    });
    index += 1;
  }

  return { nextIndex: index, rows };
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function createLargePreTablePlaceholderPrefix(content: string) {
  let prefix = LARGE_PRE_TABLE_PLACEHOLDER_BASE;
  while (content.includes(prefix)) {
    prefix += 'X';
  }
  return prefix;
}

function injectLargePreTablePlaceholders(html: string, placeholders: LargePreTablePlaceholder[]) {
  if (placeholders.length === 0) return html;
  const replacementByToken = new Map(
    placeholders.map((placeholder) => [placeholder.token, placeholder.replacementHtml]),
  );
  const tokenPattern = placeholders
    .map((placeholder) => escapeRegExp(placeholder.token))
    .join('|');

  return html.replace(new RegExp(`<p(?:\\s+[^>]*)?>(${tokenPattern})</p>`, 'g'), (_, token: string) => {
    return replacementByToken.get(token) ?? token;
  });
}

function mapCompactedSourceLine(line: number, offsets: SourceLineOffset[]) {
  let mappedLine = line;
  for (const offset of offsets) {
    if (line <= offset.afterLine) break;
    mappedLine += offset.delta;
  }
  return mappedLine;
}

function remarkApplySourceLineOffsets(offsets: SourceLineOffset[]) {
  return (tree: any) => {
    if (offsets.length === 0) return;

    visit(tree, (node: any) => {
      const position = node.position;
      if (!position) return;
      if (Number.isFinite(position.start?.line)) {
        position.start.line = mapCompactedSourceLine(position.start.line, offsets);
      }
      if (Number.isFinite(position.end?.line)) {
        position.end.line = mapCompactedSourceLine(position.end.line, offsets);
      }
    });
  };
}

function extractLargePreTablesForPreview(
  content: string,
  options: { lightweightTables?: boolean } = {},
) {
  if (!content.includes('|')) return { content, placeholders: [], sourceLineOffsets: [] };

  const lines = content.split(/\r?\n/);
  const output: string[] = [];
  const placeholders: LargePreTablePlaceholder[] = [];
  const sourceLineOffsets: SourceLineOffset[] = [];
  const placeholderPrefix = createLargePreTablePlaceholderPrefix(content);
  let index = 0;

  while (index < lines.length) {
    const headers = splitMarkdownTableRow(lines[index]);
    const nextLine = lines[index + 1];
    if (headers && headers.length >= 2 && nextLine && isMarkdownTableSeparator(nextLine)) {
      const parsed = parseLargePreTableRows(lines, index + 2);
      if (headers.length >= 3 && parsed.rows.length >= LARGE_PRE_TABLE_ROW_THRESHOLD) {
        const outputLine = output.length + 1;
        const consumedLineCount = parsed.nextIndex - index;
        const token = `${placeholderPrefix}${placeholders.length}`;
        placeholders.push({
          replacementHtml: renderLargePreTable(headers, parsed.rows, index + 1),
          token,
        });
        output.push(token);
        sourceLineOffsets.push({
          afterLine: outputLine,
          delta: consumedLineCount - 1,
        });
        index = parsed.nextIndex;
        continue;
      }

      if (options.lightweightTables && !lines[index].includes('<pre') && !nextLine.includes('<pre')) {
        const separatorCells = splitMarkdownTableRow(nextLine) ?? [];
        const lightweightTable = parseLightweightMarkdownTableRows(lines, index + 2);
        if (canRenderLightweightMarkdownTable(headers, lightweightTable.rows)) {
          const outputLine = output.length + 1;
          const consumedLineCount = lightweightTable.nextIndex - index;
          const token = `${placeholderPrefix}${placeholders.length}`;
          placeholders.push({
            replacementHtml: renderLightweightMarkdownTable(headers, separatorCells, lightweightTable.rows, index + 1),
            token,
          });
          output.push(token);
          sourceLineOffsets.push({
            afterLine: outputLine,
            delta: consumedLineCount - 1,
          });
          index = lightweightTable.nextIndex;
          continue;
        }
      }
    }

    output.push(lines[index]);
    index += 1;
  }

  return {
    content: output.join('\n'),
    placeholders,
    sourceLineOffsets,
  };
}

function compactMetadataValue(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function renderFrontMatterTags(value: string) {
  const tags = value
    .split(',')
    .map((tag) => compactMetadataValue(tag))
    .filter(Boolean);

  if (tags.length === 0) return '';

  return `<div class="prism-frontmatter-preview__tags">${tags
    .map((tag) => `<span class="prism-frontmatter-preview__tag">${escapeGeneratedHtml(tag)}</span>`)
    .join('')}</div>`;
}

function renderFrontMatterField(
  field: (typeof FRONT_MATTER_FIELDS)[number],
  properties: DocumentFrontMatterProperties,
) {
  const value = compactMetadataValue(properties[field.key]);
  if (!value) return '';

  const content = field.renderAs === 'tags'
    ? renderFrontMatterTags(value)
    : field.renderAs === 'code'
      ? `<code>${escapeGeneratedHtml(value)}</code>`
      : escapeGeneratedHtml(value);
  if (!content) return '';

  return [
    `<div class="prism-frontmatter-preview__row prism-frontmatter-preview__row--${field.className}">`,
    `<dt>${escapeGeneratedHtml(t(field.labelKey))}</dt>`,
    `<dd>${content}</dd>`,
    '</div>',
  ].join('');
}

function renderFrontMatterMetadataHtml(content: string) {
  const parsed = parseDocumentFrontMatter(content);

  if (parsed.error) {
    return [
      '<section class="prism-frontmatter-preview prism-frontmatter-preview--invalid" data-source-line="1" data-line="1" data-frontmatter-state="invalid">',
      '<div class="prism-frontmatter-preview__header">',
      `<span class="prism-frontmatter-preview__title">${escapeGeneratedHtml(t('frontMatter.documentProperties'))}</span>`,
      `<span class="prism-frontmatter-preview__meta">${escapeGeneratedHtml(t('frontMatter.yamlError'))}</span>`,
      '</div>',
      `<p class="prism-frontmatter-preview__empty">${escapeGeneratedHtml(t('frontMatter.parseFailed', { message: parsed.error }))}</p>`,
      '</section>',
    ].join('');
  }

  const fields = FRONT_MATTER_FIELDS
    .map((field) => renderFrontMatterField(field, parsed.properties))
    .filter(Boolean);
  const body = fields.length > 0
    ? `<dl class="prism-frontmatter-preview__list">${fields.join('')}</dl>`
    : `<p class="prism-frontmatter-preview__empty">${escapeGeneratedHtml(t('frontMatter.empty'))}</p>`;
  const count = fields.length > 0
    ? t('frontMatter.count', { count: fields.length })
    : t('frontMatter.emptyCount');

  return [
    '<section class="prism-frontmatter-preview" data-source-line="1" data-line="1" data-frontmatter-state="valid">',
    '<div class="prism-frontmatter-preview__header">',
    `<span class="prism-frontmatter-preview__title">${escapeGeneratedHtml(t('frontMatter.documentProperties'))}</span>`,
    `<span class="prism-frontmatter-preview__meta">${escapeGeneratedHtml(count)}</span>`,
    '</div>',
    body,
    '</section>',
  ].join('');
}

function frontMatterModeForOptions(options: MarkdownToHtmlOptions) {
  if (options.frontMatterMode) return options.frontMatterMode;
  return options.stripFrontMatter ? 'hide' : 'plain';
}

function detectMarkdownPreviewFeatures(content: string): MarkdownPreviewFeatureHints {
  const hasAutolinkLiteralCandidate = content.includes('://') || content.includes('www.') || content.includes('@');
  return {
    callouts: content.includes('[!') && CALLOUT_PATTERN.test(content),
    citations: content.includes('@') && content.includes('['),
    code: CODE_CANDIDATE_PATTERN.test(content),
    gfm: (content.includes('|') && GFM_TABLE_SEPARATOR_PATTERN.test(content))
      || (content.includes('[') && (GFM_TASK_LIST_PATTERN.test(content) || GFM_FOOTNOTE_PATTERN.test(content)))
      || content.includes('~')
      || (hasAutolinkLiteralCandidate && GFM_AUTOLINK_LITERAL_PATTERN.test(content)),
    mark: content.includes('=='),
    math: content.includes('$') || content.includes('\\(') || content.includes('\\[') || MATH_FENCE_PATTERN.test(content),
    mermaid: MERMAID_FENCE_PATTERN.test(content),
    rawHtml: HTML_CANDIDATE_PATTERN.test(content),
    wikiLinks: content.includes('[['),
  };
}

function stripFrontMatterForPreview(content: string) {
  const match = FRONT_MATTER_PATTERN.exec(content);
  if (!match) return content;

  const preservedLineOffset = match[0].match(/\n/g)?.length ?? 0;
  return `${'\n'.repeat(preservedLineOffset)}${content.slice(match[0].length)}`;
}

function renderFrontMatterForPreview(content: string, mode: 'plain' | 'hide' | 'metadata') {
  if (mode === 'plain') return content;

  const match = FRONT_MATTER_PATTERN.exec(content);
  if (!match) return content;
  if (mode === 'hide') return stripFrontMatterForPreview(content);

  const preservedLineOffset = match[0].match(/\n/g)?.length ?? 0;
  return `${renderFrontMatterMetadataHtml(content)}${'\n'.repeat(preservedLineOffset)}${content.slice(match[0].length)}`;
}

export function markdownToHtml(content: string, options: MarkdownToHtmlOptions = {}): string {
  const displayMathLines: number[] = [];
  const largePreTablePreview = extractLargePreTablesForPreview(
    renderFrontMatterForPreview(content, frontMatterModeForOptions(options)),
    { lightweightTables: options.lightweightTables === true },
  );
  const featureHints = detectMarkdownPreviewFeatures(largePreTablePreview.content);
  let processor: any = unified()
    .use(remarkParse);

  if (featureHints.gfm) processor = processor.use(remarkGfm);

  if (featureHints.math && options.renderMath === false) {
    processor = processor.use(remarkKatexPlaceholders);
  } else if (featureHints.math) {
    processor = processor
      .use(remarkMath);
  }
  if (largePreTablePreview.sourceLineOffsets.length > 0) {
    processor = processor.use(() => remarkApplySourceLineOffsets(largePreTablePreview.sourceLineOffsets));
  }
  if (featureHints.math && options.renderMath !== false) {
    processor = processor.use(() => remarkCollectMathLines(displayMathLines));
  }
  if (featureHints.mark) processor = processor.use(remarkMark);
  if (featureHints.wikiLinks) processor = processor.use(remarkWikiLinks);
  if (featureHints.citations) processor = processor.use(remarkCitations);
  processor = processor.use(remarkBlockLines);
  if (featureHints.callouts) processor = processor.use(remarkCallouts);
  if (featureHints.mermaid) processor = processor.use(remarkMermaid);

  processor = processor.use(remarkRehype, { allowDangerousHtml: featureHints.rawHtml });
  if (featureHints.rawHtml) processor = processor.use(rehypeRaw);
  if (featureHints.math && options.renderMath !== false) {
    processor = processor.use(() => rehypeKatexRaw(displayMathLines, {
      renderMath: true,
    }));
  }
  if (featureHints.code) {
    // MiaoYan hands unlabeled fenced blocks to Highlightr for auto detection.
    processor = processor.use(rehypePrismCodeHighlight, {
      autoDetectUnlabeledCode: options.autoDetectUnlabeledCode !== false,
      highlightCode: options.highlightCode !== false,
    });
  }

  const result = processor
    .use(rehypePreviewUrlSafety)
    .use(rehypeStringify, { allowDangerousHtml: true })
    .processSync(largePreTablePreview.content);

  return injectLargePreTablePlaceholders(String(result), largePreTablePreview.placeholders);
}
