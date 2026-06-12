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
import { t } from '../domains/i18n';

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

function rehypeKatexRaw(mathLines: number[]) {
  return (tree: any) => {
    visit(tree, 'element', (node: any, index, parent: any) => {
      if (!parent || typeof index !== 'number') return;
      const target = getMathRenderTarget(node);
      if (!target || target.scope !== node) return;
      const line = target.displayMode ? mathLines.shift() : undefined;
      parent.children.splice(index, 1, {
        type: 'raw',
        value: renderKatexHtml(target.value, target.displayMode, line),
      });
      return ['skip', index] as any;
    });
  };
}

function rehypePrismCodeHighlight() {
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

interface MarkdownToHtmlOptions {
  compatibilityMode?: 'miaoyan' | 'inkstone' | 'slate' | 'mono' | 'nocturne';
  frontMatterMode?: 'plain' | 'hide' | 'metadata';
  stripFrontMatter?: boolean;
}

interface MarkdownPreviewFeatureHints {
  callouts: boolean;
  citations: boolean;
  code: boolean;
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
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
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
  return {
    callouts: content.includes('[!') && CALLOUT_PATTERN.test(content),
    citations: content.includes('@') && content.includes('['),
    code: CODE_CANDIDATE_PATTERN.test(content),
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
  const renderContent = renderFrontMatterForPreview(content, frontMatterModeForOptions(options));
  const featureHints = detectMarkdownPreviewFeatures(renderContent);
  let processor: any = unified()
    .use(remarkParse)
    .use(remarkGfm);

  if (featureHints.math) {
    processor = processor
      .use(remarkMath)
      .use(() => remarkCollectMathLines(displayMathLines));
  }
  if (featureHints.mark) processor = processor.use(remarkMark);
  if (featureHints.wikiLinks) processor = processor.use(remarkWikiLinks);
  if (featureHints.citations) processor = processor.use(remarkCitations);
  processor = processor.use(remarkBlockLines);
  if (featureHints.callouts) processor = processor.use(remarkCallouts);
  if (featureHints.mermaid) processor = processor.use(remarkMermaid);

  processor = processor.use(remarkRehype, { allowDangerousHtml: featureHints.rawHtml });
  if (featureHints.rawHtml) processor = processor.use(rehypeRaw);
  if (featureHints.math) {
    processor = processor.use(() => rehypeKatexRaw(displayMathLines));
  }
  if (featureHints.code) {
    // MiaoYan hands unlabeled fenced blocks to Highlightr for auto detection.
    processor = processor.use(rehypePrismCodeHighlight);
  }

  const result = processor
    .use(rehypePreviewUrlSafety)
    .use(rehypeStringify, { allowDangerousHtml: true })
    .processSync(renderContent);

  return String(result);
}
