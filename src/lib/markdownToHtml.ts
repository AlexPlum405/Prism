import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkRehype from 'remark-rehype';
import rehypeRaw from 'rehype-raw';
import rehypeKatex from 'rehype-katex';
import rehypeStringify from 'rehype-stringify';
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

function rehypeDisplayMathLines(mathLines: number[]) {
  return (tree: any) => {
    visit(tree, 'element', (node: any) => {
      const className = node.properties?.className;
      if (!Array.isArray(className) || !className.includes('katex-display')) return;
      const line = mathLines.shift();
      if (!Number.isFinite(line)) return;
      node.properties = node.properties || {};
      node.properties['data-source-line'] = String(line);
      node.properties['data-line'] = String(line);
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
              title: `引用占位：${citation.keys.map((key) => `@${key}`).join(', ')}`,
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

const FRONT_MATTER_PATTERN = /^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/;
const FRONT_MATTER_FIELDS: Array<{
  className: string;
  key: keyof DocumentFrontMatterProperties;
  label: string;
  renderAs?: 'tags' | 'code';
}> = [
  { key: 'title', label: '标题', className: 'title' },
  { key: 'tags', label: '标签', className: 'tags', renderAs: 'tags' },
  { key: 'description', label: '描述', className: 'description' },
  { key: 'author', label: '作者', className: 'author' },
  { key: 'date', label: '日期', className: 'date' },
  { key: 'status', label: '状态', className: 'status' },
  { key: 'exportRaw', label: '导出', className: 'export', renderAs: 'code' },
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
    `<dt>${field.label}</dt>`,
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
      '<span class="prism-frontmatter-preview__title">文档属性</span>',
      '<span class="prism-frontmatter-preview__meta">YAML 错误</span>',
      '</div>',
      `<p class="prism-frontmatter-preview__empty">Front Matter 解析失败：${escapeGeneratedHtml(parsed.error)}</p>`,
      '</section>',
    ].join('');
  }

  const fields = FRONT_MATTER_FIELDS
    .map((field) => renderFrontMatterField(field, parsed.properties))
    .filter(Boolean);
  const body = fields.length > 0
    ? `<dl class="prism-frontmatter-preview__list">${fields.join('')}</dl>`
    : '<p class="prism-frontmatter-preview__empty">未设置文档属性</p>';
  const count = fields.length > 0 ? `${fields.length} 项` : '空';

  return [
    '<section class="prism-frontmatter-preview" data-source-line="1" data-line="1" data-frontmatter-state="valid">',
    '<div class="prism-frontmatter-preview__header">',
    '<span class="prism-frontmatter-preview__title">文档属性</span>',
    `<span class="prism-frontmatter-preview__meta">${count}</span>`,
    '</div>',
    body,
    '</section>',
  ].join('');
}

function frontMatterModeForOptions(options: MarkdownToHtmlOptions) {
  if (options.frontMatterMode) return options.frontMatterMode;
  return options.stripFrontMatter ? 'hide' : 'plain';
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
  const processor = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkMath)
    .use(() => remarkCollectMathLines(displayMathLines))
    .use(remarkMark)
    .use(remarkWikiLinks)
    .use(remarkCitations)
    .use(remarkBlockLines)
    .use(remarkCallouts)
    .use(remarkMermaid)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeRaw)
    // MiaoYan hands unlabeled fenced blocks to Highlightr for auto detection.
    .use(rehypePrismCodeHighlight);

  const result = processor
    .use(rehypeKatex)
    .use(() => rehypeDisplayMathLines(displayMathLines))
    .use(rehypePreviewUrlSafety)
    .use(rehypeStringify)
    .processSync(renderContent);

  return String(result);
}
