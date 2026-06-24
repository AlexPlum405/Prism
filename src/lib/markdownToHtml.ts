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

const MERMAID_ALIAS_DIRECTIVES: Record<string, string> = {
  architecture: 'architecture-beta',
  block: 'block-beta',
  blockdiagram: 'block-beta',
  c4: 'C4Context',
  class: 'classDiagram',
  classdiagram: 'classDiagram',
  er: 'erDiagram',
  erdiagram: 'erDiagram',
  flowchart: 'flowchart',
  gantt: 'gantt',
  gitgraph: 'gitGraph',
  graph: 'graph',
  journey: 'journey',
  kanban: 'kanban',
  mindmap: 'mindmap',
  packet: 'packet-beta',
  pie: 'pie',
  quadrant: 'quadrantChart',
  quadrantchart: 'quadrantChart',
  requirement: 'requirementDiagram',
  requirementdiagram: 'requirementDiagram',
  sequence: 'sequenceDiagram',
  sequencediagram: 'sequenceDiagram',
  state: 'stateDiagram-v2',
  statediagram: 'stateDiagram-v2',
  timeline: 'timeline',
  xy: 'xychart-beta',
  xychart: 'xychart-beta',
};

const MERMAID_DIRECTIVE_PATTERN = /^(?:architecture-beta|block-beta|C4(?:Context|Container|Component|Dynamic|Deployment)?|classDiagram|erDiagram|flowchart|gantt|gitGraph|graph|journey|kanban|mindmap|packet-beta|pie|quadrantChart|requirementDiagram|sequenceDiagram|stateDiagram(?:-v2)?|timeline|xychart-beta)\b/i;
const MARKMAP_MARKDOWN_PATTERN = /^\s{0,3}(?:#{1,6}\s+\S|[-+*]\s+\S|\d+[.)]\s+\S)/m;

function normalizeDiagramLanguage(language: unknown) {
  return String(language ?? '').trim().toLowerCase().replace(/[\s_-]+/g, '');
}

function looksLikeMarkmapMarkdown(source: string) {
  return MARKMAP_MARKDOWN_PATTERN.test(source);
}

function isMarkmapLanguage(language: unknown, source = '') {
  const normalized = normalizeDiagramLanguage(language);
  if (normalized === 'markmap') return true;
  return normalized === 'mindmap' && looksLikeMarkmapMarkdown(source);
}

function normalizeMermaidAliasSource(directive: string, source: string) {
  const trimmed = source.trimStart();
  if (MERMAID_DIRECTIVE_PATTERN.test(trimmed)) return source;

  if (directive === 'flowchart' || directive === 'graph') {
    const lines = source.split('\n');
    const firstLine = lines[0] ?? '';
    const directionMatch = /^(\s*)(TB|BT|RL|LR|TD)\b(.*)$/i.exec(firstLine);
    if (directionMatch) {
      const [, indent = '', direction = '', rest = ''] = directionMatch;
      return [
        `${indent}${directive} ${direction}${rest}`,
        ...lines.slice(1),
      ].join('\n');
    }
  }

  return `${directive}\n${source}`;
}

function getMermaidSourceForLanguage(language: unknown, source: string) {
  const normalized = normalizeDiagramLanguage(language);
  if (normalized === 'mermaid') return source;
  if (isMarkmapLanguage(language, source)) return null;
  const directive = MERMAID_ALIAS_DIRECTIVES[normalized];
  return directive ? normalizeMermaidAliasSource(directive, source) : null;
}

function remarkMermaid() {
  return (tree: any) => {
    visit(tree, 'code', (node: any, index, parent) => {
      const source = getMermaidSourceForLanguage(node.lang, node.value);
      if (source === null) return;
      if (index === undefined || !parent) return;

      const encoded = encodeURIComponent(source);
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

function isPlantUmlLanguage(language: unknown) {
  const normalized = normalizeDiagramLanguage(language);
  return normalized === 'plantuml' || normalized === 'puml';
}

function remarkPlantUml() {
  return (tree: any) => {
    visit(tree, 'code', (node: any, index, parent) => {
      if (!isPlantUmlLanguage(node.lang)) return;
      if (index === undefined || !parent) return;

      const encoded = encodeURIComponent(node.value);
      const line = node.position?.start?.line;
      parent.children[index] = {
        type: 'plantUml',
        data: {
          hName: 'div',
          hProperties: {
            className: ['plantuml-placeholder'],
            dataPlantuml: encoded,
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

function remarkMarkmap() {
  return (tree: any) => {
    visit(tree, 'code', (node: any, index, parent) => {
      if (!isMarkmapLanguage(node.lang, node.value)) return;
      if (index === undefined || !parent) return;

      const encoded = encodeURIComponent(node.value);
      const line = node.position?.start?.line;
      parent.children[index] = {
        type: 'markmap',
        data: {
          hName: 'div',
          hProperties: {
            className: ['markmap-placeholder'],
            dataMarkmap: encoded,
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

function remarkPromoteSingleLineDisplayMath(source: string) {
  function isNodeAloneOnSourceLine(startOffset: number, endOffset: number) {
    const lineStart = source.lastIndexOf('\n', startOffset - 1) + 1;
    const nextLineBreak = source.indexOf('\n', endOffset);
    const lineEnd = nextLineBreak === -1 ? source.length : nextLineBreak;
    const line = source.slice(lineStart, lineEnd);
    const raw = source.slice(startOffset, endOffset);
    return line.trim() === raw.trim();
  }

  function getDisplayMathSource(node: any, allowStandaloneInlineMath: boolean) {
    const startOffset = node.position?.start?.offset;
    const endOffset = node.position?.end?.offset;
    if (!Number.isFinite(startOffset) || !Number.isFinite(endOffset)) return null;

    const raw = source.slice(startOffset, endOffset).trim();
    const displayMatch = /^\$\$([\s\S]+)\$\$$/.exec(raw);
    if (displayMatch) return (displayMatch[1] ?? node.value ?? '').trim();

    const canPromoteInlineMath = allowStandaloneInlineMath || isNodeAloneOnSourceLine(startOffset, endOffset);
    const standaloneInlineMathMatch = canPromoteInlineMath ? /^\$([^$\n]+)\$$/.exec(raw) : null;
    return standaloneInlineMathMatch ? (standaloneInlineMathMatch[1] ?? node.value ?? '').trim() : null;
  }

  function createDisplayMathNode(node: any, value: string) {
    return {
      ...node,
      type: 'math',
      value,
      data: {
        hName: 'code',
        hProperties: { className: ['language-math', 'math-display'] },
        hChildren: [{ type: 'text', value }],
      },
      position: node.position,
    };
  }

  function createParagraphNode(sourceNode: any, children: any[]) {
    return {
      ...sourceNode,
      children,
      position: {
        start: children[0]?.position?.start ?? sourceNode.position?.start,
        end: children[children.length - 1]?.position?.end ?? sourceNode.position?.end,
      },
    };
  }

  return (tree: any) => {
    visit(tree, 'paragraph', (node: any, index, parent: any) => {
      if (typeof index !== 'number' || !parent || !Array.isArray(node.children)) return;
      if (!Array.isArray(node.children)) return;

      const replacement: any[] = [];
      let paragraphChildren: any[] = [];
      let promoted = false;
      const allowStandaloneInlineMath = node.children.length === 1 && node.children[0]?.type === 'inlineMath';

      node.children.forEach((child: any) => {
        const displayMathSource = child?.type === 'inlineMath'
          ? getDisplayMathSource(child, allowStandaloneInlineMath)
          : null;
        if (displayMathSource === null) {
          paragraphChildren.push(child);
          return;
        }

        if (paragraphChildren.length > 0) {
          replacement.push(createParagraphNode(node, paragraphChildren));
          paragraphChildren = [];
        }
        replacement.push(createDisplayMathNode(child, displayMathSource));
        promoted = true;
      });

      if (!promoted) return;
      if (paragraphChildren.length > 0) {
        replacement.push(createParagraphNode(node, paragraphChildren));
      }

      parent.children.splice(index, 1, ...replacement);
      return ['skip', index] as any;
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

function ensureClassName(properties: Record<string, unknown>, className: string) {
  const current = properties.className;
  const classNames = Array.isArray(current)
    ? current.map(String)
    : typeof current === 'string'
      ? current.split(/\s+/).filter(Boolean)
      : [];
  if (!classNames.includes(className)) classNames.push(className);
  properties.className = classNames;
}

function hasClassName(properties: Record<string, unknown> | undefined, className: string) {
  const current = properties?.className;
  const classNames = Array.isArray(current)
    ? current.map(String)
    : typeof current === 'string'
      ? current.split(/\s+/).filter(Boolean)
      : [];
  return classNames.includes(className);
}

function isCheckboxInput(node: any) {
  if (node?.type !== 'element' || node.tagName !== 'input') return false;
  const type = node.properties?.type;
  return typeof type === 'string' && type.toLowerCase() === 'checkbox';
}

function findClosestElementAncestor(ancestors: any[], tagName: string) {
  for (let index = ancestors.length - 1; index >= 0; index -= 1) {
    const ancestor = ancestors[index];
    if (ancestor?.type === 'element' && ancestor.tagName === tagName) return ancestor;
  }
  return null;
}

function rehypeInteractiveTaskListItems() {
  return (tree: any) => {
    let checkboxIndex = 0;

    function visitNode(node: any, ancestors: any[]) {
      if (isCheckboxInput(node)) {
        const li = findClosestElementAncestor(ancestors, 'li');
        if (!li || !hasClassName(li.properties, 'task-list-item')) {
          return;
        }

        node.properties = node.properties || {};
        delete node.properties.disabled;
        node.properties['data-task-checkbox-index'] = String(checkboxIndex);

        const ul = findClosestElementAncestor(ancestors, 'ul');

        li.properties = li.properties || {};
        const sourceLine = li.properties['data-source-line'] ?? li.properties.dataLine ?? li.properties['data-line'];
        if (sourceLine !== undefined) {
          node.properties['data-source-line'] = String(sourceLine);
          node.properties['data-line'] = String(sourceLine);
          node.properties.dataLine = String(sourceLine);
        }
        if (node.properties.checked === true || node.properties.checked === '') {
          ensureClassName(li.properties, 'strike');
        }

        if (ul) {
          ul.properties = ul.properties || {};
          ensureClassName(ul.properties, 'cb');
        }

        checkboxIndex += 1;
      }

      if (!Array.isArray(node?.children)) return;
      node.children.forEach((child: any) => visitNode(child, [...ancestors, node]));
    }

    visitNode(tree, []);
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
    return `<span class="katex-placeholder" data-katex="${encoded}">${text}</span>`;
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
  compatibilityMode?: 'miaoyan' | 'inkstone' | 'slate' | 'mono' | 'nocturne' | 'carbon';
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
  markmap: boolean;
  plantUml: boolean;
  rawHtml: boolean;
  wikiLinks: boolean;
}

const FRONT_MATTER_PATTERN = /^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/;
const HTML_CANDIDATE_PATTERN = /<\/?[A-Za-z][A-Za-z0-9:-]*(?:\s|>|\/>)/;
const CODE_CANDIDATE_PATTERN = /(^|\n)(```|~~~)|<pre(?:\s|>)|<code(?:\s|>)/i;
const MERMAID_FENCE_PATTERN = /(^|\n)(```|~~~)\s*(?:mermaid|architecture[-_\s]?beta|architecture|block[-_\s]?beta|block(?:diagram)?|c4|class(?:diagram)?|er(?:diagram)?|flowchart|gantt|gitgraph|graph|journey|kanban|mind[-_\s]?map|packet[-_\s]?beta|packet|pie|quadrant(?:chart)?|requirement(?:diagram)?|sequence(?:diagram)?|state(?:diagram)?|timeline|xy(?:chart)?)(?:\s|\n|$)/i;
const MARKMAP_FENCE_PATTERN = /(^|\n)(```|~~~)\s*(?:mark[-_\s]?map|mind[-_\s]?map)(?:\s|\n|$)/i;
const PLANTUML_FENCE_PATTERN = /(^|\n)(```|~~~)\s*(?:plantuml|puml)(?:\s|\n|$)/i;
const MATH_FENCE_PATTERN = /(^|\n)(```|~~~)\s*math(?:\s|\n|$)/i;
const CALLOUT_PATTERN = /(^|\n)\s*>\s*\[![A-Za-z]+\]/;
const GFM_TABLE_SEPARATOR_PATTERN = /(^|\n)\s{0,3}\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?\s*(?:\n|$)/;
const GFM_TASK_LIST_PATTERN = /(^|\n)\s{0,3}(?:[-+*]|\d+[.)])\s+\[[ xX]\]\s/;
const GFM_FOOTNOTE_PATTERN = /(^|\n)\s{0,3}\[\^[^\]\n]+]:|\[\^[^\]\n]+\]/;
const GFM_AUTOLINK_LITERAL_PATTERN = /(^|[\s(])(?:https?:\/\/|www\.)[^\s<]+|[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/;
const LARGE_PRE_TABLE_ROW_THRESHOLD = 24;
const LARGE_PRE_TABLE_PLACEHOLDER_BASE = 'PrismLargePreTablePlaceholder';
const COMMON_MARKDOWN_PREVIEW_FAST_PATH_MIN_LENGTH = 300 * 1024;
const COMMON_MARKDOWN_PREVIEW_SOURCE_MAP_MARKER = 'prism-preview-source-map:flat';
const HTML_ESCAPE_CANDIDATE_PATTERN = /[&<>"']/;
const HTML_ESCAPE_PATTERN = /[&<>"']/g;
const HTML_TEXT_ESCAPE_CANDIDATE_PATTERN = /[&<>]/;
const HTML_TEXT_ESCAPE_PATTERN = /[&<>]/g;
const HTML_ESCAPE_REPLACEMENTS: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};
const COMMON_MARKDOWN_PREVIEW_SIDECAR_LINE_PATTERN = /(<(?:h[1-6]|p|pre|blockquote|li|hr)\b[^>]*?|<div class="prism-simple-table[^"]*"[^>]*?)\sdata-line="(\d+)"/g;
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

function escapeGeneratedHtmlText(value: string) {
  if (!HTML_TEXT_ESCAPE_CANDIDATE_PATTERN.test(value)) return value;
  return value.replace(HTML_TEXT_ESCAPE_PATTERN, (char) => HTML_ESCAPE_REPLACEMENTS[char] ?? char);
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

interface CommonMarkdownFastPathFrontMatter {
  endLineIndex: number;
  html: string;
}

function findFrontMatterForCommonFastPath(content: string): CommonMarkdownFastPathFrontMatter | null {
  const match = FRONT_MATTER_PATTERN.exec(content);
  if (!match) return null;
  return {
    endLineIndex: match[0].match(/\n/g)?.length ?? 0,
    html: renderFrontMatterMetadataHtml(content),
  };
}

function collectCommonFastPathBodyLinesOutsideFences(content: string) {
  const lines = content.split(/\r?\n/);
  const output: string[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    const fence = isFenceLine(line);
    if (!fence) {
      output.push(line);
      index += 1;
      continue;
    }

    const fenceText = fence[1];
    const fenceChar = fenceText[0];
    const closePattern = new RegExp(`^\\s{0,3}${escapeRegExp(fenceChar.repeat(fenceText.length))}${fenceChar}*\\s*$`);
    index += 1;
    while (index < lines.length && !closePattern.test(lines[index])) {
      index += 1;
    }
    if (index >= lines.length) {
      output.push(line);
      break;
    }
    index += 1;
  }

  return output;
}

function hasIndentedCodeOutsideFences(content: string) {
  return collectCommonFastPathBodyLinesOutsideFences(content)
    .some((line) => /^(?: {4}|\t)\S/.test(line));
}

function canUseCommonMarkdownPreviewFastPath(content: string, options: MarkdownToHtmlOptions) {
  if (content.length < COMMON_MARKDOWN_PREVIEW_FAST_PATH_MIN_LENGTH) return false;
  if (options.lightweightTables !== true) return false;
  if (options.renderMath !== false) return false;
  if (options.highlightCode !== false) return false;
  if (options.autoDetectUnlabeledCode !== false) return false;
  if (frontMatterModeForOptions(options) !== 'metadata') return false;

  const frontMatter = FRONT_MATTER_PATTERN.exec(content);
  const body = frontMatter ? content.slice(frontMatter[0].length) : content;
  const bodyOutsideFences = collectCommonFastPathBodyLinesOutsideFences(body).join('\n');
  if (HTML_CANDIDATE_PATTERN.test(bodyOutsideFences)) return false;
  if (GFM_TASK_LIST_PATTERN.test(bodyOutsideFences) || GFM_FOOTNOTE_PATTERN.test(bodyOutsideFences)) return false;
  if (/(^|\n)\s{0,3}\[[^\]\n]+]:/.test(bodyOutsideFences)) return false;
  if (hasIndentedCodeOutsideFences(body)) return false;
  return true;
}

function findClosingDelimiter(value: string, delimiter: string, startIndex: number) {
  let index = startIndex;
  while (index < value.length) {
    const foundIndex = value.indexOf(delimiter, index);
    if (foundIndex === -1) return -1;
    if (foundIndex === 0 || value[foundIndex - 1] !== '\\') return foundIndex;
    index = foundIndex + delimiter.length;
  }
  return -1;
}

function appendEscapedInlineChunk(output: string[], value: string, startIndex: number, endIndex: number) {
  if (endIndex <= startIndex) return;
  output.push(escapeGeneratedHtmlText(value.slice(startIndex, endIndex)));
}

function renderCommonPreviewHrefAttribute(value: string, kind: 'link' | 'media') {
  const protocols = kind === 'link'
    ? new Set(['http:', 'https:', 'mailto:'])
    : new Set(['http:', 'https:']);
  return isUnsafePreviewUrl(value, protocols) ? '' : escapeGeneratedHtml(value);
}

function renderCommonPreviewKatexPlaceholder(value: string, displayMode: boolean, line?: number) {
  const encoded = encodeURIComponent(value);
  const text = escapeGeneratedHtml(value);
  if (!displayMode) {
    return `<span class="katex-placeholder" data-katex="${encoded}">${text}</span>`;
  }

  const sourceAttribute = Number.isFinite(line) ? ` data-line="${escapeGeneratedHtml(String(line))}"` : '';
  return `<span class="katex-display katex-placeholder" data-katex="${encoded}" data-katex-display="true"${sourceAttribute}>${text}</span>`;
}

function renderCommonMarkdownInline(value: string, options: { allowImages?: boolean } = {}): string {
  const output: string[] = [];
  let index = 0;

  while (index < value.length) {
    if (value.startsWith('[[', index)) {
      const endIndex = value.indexOf(']]', index + 2);
      if (endIndex !== -1) {
        const rawTarget = value.slice(index + 2, endIndex);
        const [targetValue, labelValue] = rawTarget.split('|');
        const target = targetValue?.trim() ?? '';
        const label = (labelValue ?? target).trim() || target;
        if (target) {
          output.push(
            `<a href="#" class="prism-wiki-link" data-prism-wiki-target="${escapeGeneratedHtml(target)}">${escapeGeneratedHtmlText(label)}</a>`,
          );
          index = endIndex + 2;
          continue;
        }
      }
    }

    if (options.allowImages !== false && value.startsWith('![', index)) {
      const labelEndIndex = value.indexOf(']', index + 2);
      if (labelEndIndex !== -1 && value[labelEndIndex + 1] === '(') {
        const hrefEndIndex = value.indexOf(')', labelEndIndex + 2);
        if (hrefEndIndex !== -1) {
          const alt = value.slice(index + 2, labelEndIndex);
          const src = value.slice(labelEndIndex + 2, hrefEndIndex).trim();
          const safeSrc = renderCommonPreviewHrefAttribute(src, 'media');
          output.push(safeSrc
            ? `<img src="${safeSrc}" alt="${escapeGeneratedHtml(alt)}">`
            : `<img alt="${escapeGeneratedHtml(alt)}">`);
          index = hrefEndIndex + 1;
          continue;
        }
      }
    }

    if (value[index] === '[') {
      const labelEndIndex = value.indexOf(']', index + 1);
      if (labelEndIndex !== -1 && value[labelEndIndex + 1] === '(') {
        const hrefEndIndex = value.indexOf(')', labelEndIndex + 2);
        if (hrefEndIndex !== -1) {
          const label = value.slice(index + 1, labelEndIndex);
          const href = value.slice(labelEndIndex + 2, hrefEndIndex).trim();
          const safeHref = renderCommonPreviewHrefAttribute(href, 'link');
          const labelHtml = renderCommonMarkdownInline(label, { allowImages: false });
          output.push(safeHref
            ? `<a href="${safeHref}">${labelHtml}</a>`
            : `<a>${labelHtml}</a>`);
          index = hrefEndIndex + 1;
          continue;
        }
      }
    }

    if (value.startsWith('`', index)) {
      const endIndex = findClosingDelimiter(value, '`', index + 1);
      if (endIndex !== -1) {
        output.push(`<code>${escapeGeneratedHtmlText(value.slice(index + 1, endIndex))}</code>`);
        index = endIndex + 1;
        continue;
      }
    }

    if (value.startsWith('**', index)) {
      const endIndex = findClosingDelimiter(value, '**', index + 2);
      if (endIndex !== -1) {
        output.push(`<strong>${renderCommonMarkdownInline(value.slice(index + 2, endIndex), options)}</strong>`);
        index = endIndex + 2;
        continue;
      }
    }

    if (value.startsWith('==', index)) {
      const endIndex = findClosingDelimiter(value, '==', index + 2);
      if (endIndex !== -1) {
        output.push(`<mark>${renderCommonMarkdownInline(value.slice(index + 2, endIndex), options)}</mark>`);
        index = endIndex + 2;
        continue;
      }
    }

    if (value.startsWith('$$', index)) {
      const endIndex = findClosingDelimiter(value, '$$', index + 2);
      if (endIndex !== -1) {
        output.push(renderCommonPreviewKatexPlaceholder(value.slice(index + 2, endIndex), true));
        index = endIndex + 2;
        continue;
      }
    }

    if (value[index] === '$') {
      const endIndex = findClosingDelimiter(value, '$', index + 1);
      if (endIndex !== -1) {
        output.push(renderCommonPreviewKatexPlaceholder(value.slice(index + 1, endIndex), false));
        index = endIndex + 1;
        continue;
      }
    }

    const urlMatch = /^(https?:\/\/[^\s<]+|www\.[^\s<]+)/.exec(value.slice(index));
    if (urlMatch) {
      const rawHref = urlMatch[1];
      const href = rawHref.startsWith('www.') ? `http://${rawHref}` : rawHref;
      output.push(`<a href="${escapeGeneratedHtml(href)}">${escapeGeneratedHtmlText(rawHref)}</a>`);
      index += rawHref.length;
      continue;
    }

    const emailMatch = /^[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/.exec(value.slice(index));
    if (emailMatch) {
      const email = emailMatch[0];
      output.push(`<a href="mailto:${escapeGeneratedHtml(email)}">${escapeGeneratedHtmlText(email)}</a>`);
      index += email.length;
      continue;
    }

    const nextSpecialIndex = [
      value.indexOf('[[', index + 1),
      value.indexOf('![', index + 1),
      value.indexOf('[', index + 1),
      value.indexOf('`', index + 1),
      value.indexOf('**', index + 1),
      value.indexOf('==', index + 1),
      value.indexOf('$', index + 1),
      value.indexOf('http://', index + 1),
      value.indexOf('https://', index + 1),
      value.indexOf('www.', index + 1),
    ].filter((nextIndex) => nextIndex !== -1).sort((a, b) => a - b)[0] ?? value.length;
    appendEscapedInlineChunk(output, value, index, nextSpecialIndex);
    index = nextSpecialIndex;
  }

  return output.join('');
}

function isFenceLine(line: string) {
  return /^\s{0,3}(```+|~~~+)\s*([^\s`]*)?.*$/.exec(line);
}

function isThematicBreakLine(line: string) {
  return /^\s{0,3}(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line);
}

function isSimpleListLine(line: string) {
  return /^\s{0,3}(?:[-+*]|\d+[.)])\s+\S/.test(line);
}

function isBlockquoteLine(line: string) {
  return /^\s{0,3}>\s?/.test(line);
}

function isAtxHeadingLine(line: string) {
  return /^\s{0,3}#{1,6}(?:\s|$)/.test(line);
}

function isDisplayMathFenceLine(line: string) {
  return /^\s{0,3}\$\$\s*$/.test(line);
}

function isCommonMarkdownBlockStart(lines: string[], index: number) {
  const line = lines[index] ?? '';
  if (!line.trim()) return true;
  if (isAtxHeadingLine(line)) return true;
  if (isFenceLine(line)) return true;
  if (isDisplayMathFenceLine(line)) return true;
  if (isBlockquoteLine(line)) return true;
  if (isSimpleListLine(line)) return true;
  if (isThematicBreakLine(line)) return true;
  return Boolean(splitMarkdownTableRow(line) && isMarkdownTableSeparator(lines[index + 1] ?? ''));
}

function renderCommonPreviewCodeBlock(
  lines: string[],
  startIndex: number,
): { html: string; nextIndex: number } | null {
  const startLine = lines[startIndex] ?? '';
  const match = isFenceLine(startLine);
  if (!match) return null;

  const fence = match[1];
  const fenceChar = fence[0];
  const closePattern = new RegExp(`^\\s{0,3}${escapeRegExp(fenceChar.repeat(fence.length))}${fenceChar}*\\s*$`);
  const language = (match[2] ?? '').trim();
  const normalizedLanguage = language.toLowerCase();
  const codeLines: string[] = [];
  let index = startIndex + 1;
  while (index < lines.length && !closePattern.test(lines[index])) {
    codeLines.push(lines[index]);
    index += 1;
  }
  if (index >= lines.length) return null;

  const sourceLine = startIndex + 1;
  const code = codeLines.join('\n');
  const mermaidSource = getMermaidSourceForLanguage(normalizedLanguage, code);
  if (mermaidSource !== null) {
    const escapedLine = escapeGeneratedHtml(String(sourceLine));
    return {
      html: `<div class="mermaid-placeholder" data-mermaid="${encodeURIComponent(mermaidSource)}" data-line="${escapedLine}"></div>`,
      nextIndex: index + 1,
    };
  }
  if (isMarkmapLanguage(normalizedLanguage, code)) {
    const escapedLine = escapeGeneratedHtml(String(sourceLine));
    return {
      html: `<div class="markmap-placeholder" data-markmap="${encodeURIComponent(code)}" data-line="${escapedLine}"></div>`,
      nextIndex: index + 1,
    };
  }
  if (isPlantUmlLanguage(normalizedLanguage)) {
    const escapedLine = escapeGeneratedHtml(String(sourceLine));
    return {
      html: `<div class="plantuml-placeholder" data-plantuml="${encodeURIComponent(code)}" data-line="${escapedLine}"></div>`,
      nextIndex: index + 1,
    };
  }

  const className = language ? `hljs language-${escapeGeneratedHtml(language)}` : 'hljs';
  return {
    html: `<pre data-line="${sourceLine}" class="${className}">${escapeGeneratedHtmlText(code)}</pre>`,
    nextIndex: index + 1,
  };
}

function renderCommonPreviewDisplayMath(
  lines: string[],
  startIndex: number,
): { html: string; nextIndex: number } | null {
  if (!isDisplayMathFenceLine(lines[startIndex] ?? '')) return null;
  const mathLines: string[] = [];
  let index = startIndex + 1;
  while (index < lines.length && !isDisplayMathFenceLine(lines[index])) {
    mathLines.push(lines[index]);
    index += 1;
  }
  if (index >= lines.length) return null;

  return {
    html: renderCommonPreviewKatexPlaceholder(mathLines.join('\n'), true, startIndex + 1),
    nextIndex: index + 1,
  };
}

function renderCommonPreviewTable(
  lines: string[],
  startIndex: number,
): { html: string; nextIndex: number } | null {
  const headers = splitMarkdownTableRow(lines[startIndex] ?? '');
  const separator = splitMarkdownTableRow(lines[startIndex + 1] ?? '');
  if (!headers || !separator || !isMarkdownTableSeparator(lines[startIndex + 1] ?? '')) return null;

  const parsed = parseLightweightMarkdownTableRows(lines, startIndex + 2);
  if (!canRenderLightweightMarkdownTable(headers, parsed.rows)) return null;
  return {
    html: canRenderCommonPreviewSimpleTable(headers)
      ? renderCommonPreviewSimpleTable(headers, separator, parsed.rows, startIndex + 1)
      : renderLightweightMarkdownTable(headers, separator, parsed.rows, startIndex + 1),
    nextIndex: parsed.nextIndex,
  };
}

function renderCommonPreviewBlockquote(
  lines: string[],
  startIndex: number,
): { html: string; nextIndex: number } | null {
  const quoteLines: string[] = [];
  let index = startIndex;
  while (index < lines.length && isBlockquoteLine(lines[index])) {
    quoteLines.push(lines[index].replace(/^\s{0,3}>\s?/, ''));
    index += 1;
  }

  const sourceLine = startIndex + 1;
  const firstLine = quoteLines[0] ?? '';
  const calloutMatch = /^\[!([A-Za-z]+)](?:\s+(.*))?$/.exec(firstLine.trim());
  if (calloutMatch) {
    const kind = calloutMatch[1].toLowerCase();
    const title = calloutMatch[2]?.trim() || kind[0].toUpperCase() + kind.slice(1);
    const bodyLines = quoteLines.slice(1);
    const body = bodyLines.join('\n').trim();
    const bodyHtml = body ? `<p>${renderCommonMarkdownInline(body)}</p>` : '';
    return {
      html: [
        `<blockquote class="prism-callout prism-callout--${escapeGeneratedHtml(kind)}" data-callout-kind="${escapeGeneratedHtml(kind)}" data-callout-title="${escapeGeneratedHtml(title)}" data-line="${sourceLine}">`,
        bodyHtml,
        '</blockquote>',
      ].join(''),
      nextIndex: index,
    };
  }

  return {
    html: `<blockquote data-line="${sourceLine}"><p>${renderCommonMarkdownInline(quoteLines.join('\n'))}</p></blockquote>`,
    nextIndex: index,
  };
}

function renderCommonPreviewList(
  lines: string[],
  startIndex: number,
): { html: string; nextIndex: number } | null {
  const firstMatch = /^(\s{0,3})([-+*]|\d+[.)])\s+(.+)$/.exec(lines[startIndex] ?? '');
  if (!firstMatch) return null;

  const ordered = /\d/.test(firstMatch[2]);
  const tagName = ordered ? 'ol' : 'ul';
  const items: string[] = [];
  let index = startIndex;
  while (index < lines.length) {
    const match = /^(\s{0,3})([-+*]|\d+[.)])\s+(.+)$/.exec(lines[index] ?? '');
    if (!match) break;
    const nextOrdered = /\d/.test(match[2]);
    if (nextOrdered !== ordered) break;
    const sourceLine = index + 1;
    items.push(`<li data-line="${sourceLine}">${renderCommonMarkdownInline(match[3])}</li>`);
    index += 1;
  }

  return {
    html: `<${tagName}>${items.join('')}</${tagName}>`,
    nextIndex: index,
  };
}

function renderCommonPreviewParagraph(
  lines: string[],
  startIndex: number,
): { html: string; nextIndex: number } {
  const paragraphLines: string[] = [];
  let index = startIndex;
  while (index < lines.length && !isCommonMarkdownBlockStart(lines, index)) {
    paragraphLines.push(lines[index]);
    index += 1;
  }

  return {
    html: `<p data-line="${startIndex + 1}">${renderCommonMarkdownInline(paragraphLines.join('\n'))}</p>`,
    nextIndex: index,
  };
}

function encodeCommonPreviewSourceMapLines(lines: string[]) {
  let previousLine = 0;
  return lines
    .map((rawLine) => {
      const line = Number(rawLine);
      const delta = line - previousLine;
      previousLine = line;
      return delta.toString(36);
    })
    .join(',');
}

function renderCommonMarkdownPreviewFastPath(content: string, options: MarkdownToHtmlOptions): string | null {
  if (!canUseCommonMarkdownPreviewFastPath(content, options)) return null;

  const lines = content.split(/\r?\n/);
  const html: string[] = [];
  const frontMatter = findFrontMatterForCommonFastPath(content);
  let index = 0;

  if (frontMatter) {
    html.push(frontMatter.html);
    index = frontMatter.endLineIndex;
  }

  while (index < lines.length) {
    const line = lines[index] ?? '';
    if (!line.trim()) {
      index += 1;
      continue;
    }

    const headingMatch = /^\s{0,3}(#{1,6})(?:\s+(.+?)\s*#*\s*)?$/.exec(line);
    if (headingMatch) {
      const level = headingMatch[1].length;
      html.push(`<h${level} data-line="${index + 1}">${renderCommonMarkdownInline(headingMatch[2] ?? '')}</h${level}>`);
      index += 1;
      continue;
    }

    if (isFenceLine(line)) {
      const code = renderCommonPreviewCodeBlock(lines, index);
      if (!code) return null;
      html.push(code.html);
      index = code.nextIndex;
      continue;
    }

    if (isDisplayMathFenceLine(line)) {
      const math = renderCommonPreviewDisplayMath(lines, index);
      if (!math) return null;
      html.push(math.html);
      index = math.nextIndex;
      continue;
    }

    if (isBlockquoteLine(line)) {
      const blockquote = renderCommonPreviewBlockquote(lines, index);
      if (!blockquote) return null;
      html.push(blockquote.html);
      index = blockquote.nextIndex;
      continue;
    }

    if (splitMarkdownTableRow(line) && isMarkdownTableSeparator(lines[index + 1] ?? '')) {
      const table = renderCommonPreviewTable(lines, index);
      if (!table) return null;
      html.push(table.html);
      index = table.nextIndex;
      continue;
    }

    if (isSimpleListLine(line)) {
      const list = renderCommonPreviewList(lines, index);
      if (!list) return null;
      html.push(list.html);
      index = list.nextIndex;
      continue;
    }

    if (isThematicBreakLine(line)) {
      html.push(`<hr data-line="${index + 1}">`);
      index += 1;
      continue;
    }

    const paragraph = renderCommonPreviewParagraph(lines, index);
    html.push(paragraph.html);
    index = paragraph.nextIndex;
  }

  const sourceLines: string[] = [];
  const body = html.join('\n').replace(
    COMMON_MARKDOWN_PREVIEW_SIDECAR_LINE_PATTERN,
    (_match, prefix: string, line: string) => {
      sourceLines.push(line);
      return prefix;
    },
  );
  return [
    `<!--${COMMON_MARKDOWN_PREVIEW_SOURCE_MAP_MARKER}:${encodeCommonPreviewSourceMapLines(sourceLines)}-->`,
    body,
  ].join('\n');
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

function canRenderCommonPreviewSimpleTable(headers: string[]) {
  return headers.length >= 1 && headers.length <= 8;
}

function renderCommonPreviewSimpleTableCell(value: string, align: string | null | undefined) {
  const alignClass = align ? ` class="prism-simple-table__cell--${align}"` : '';
  return `<span${alignClass}>${escapeGeneratedHtml(value)}</span>`;
}

function renderCommonPreviewSimpleTable(
  headers: string[],
  separatorCells: string[],
  rows: LightweightMarkdownTableRow[],
  sourceLine: number,
) {
  const columnCount = headers.length;
  const alignments = getMarkdownTableAlignments(normalizeMarkdownTableCells(separatorCells, columnCount));
  const headerHtml = normalizeMarkdownTableCells(headers, columnCount)
    .map((header, index) => renderCommonPreviewSimpleTableCell(header, alignments[index]))
    .join('');
  const rowsHtml = rows
    .map((row) => normalizeMarkdownTableCells(row.cells, columnCount)
      .map((cell, index) => renderCommonPreviewSimpleTableCell(cell, alignments[index]))
      .join(''))
    .join('\n');

  return [
    `<div class="prism-simple-table prism-simple-table--cols-${columnCount}" data-line="${sourceLine}">`,
    headerHtml,
    rowsHtml,
    '</div>',
  ].join('\n');
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
    markmap: MARKMAP_FENCE_PATTERN.test(content),
    plantUml: PLANTUML_FENCE_PATTERN.test(content),
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
  const fastPathHtml = renderCommonMarkdownPreviewFastPath(content, options);
  if (fastPathHtml !== null) return fastPathHtml;

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
      .use(remarkMath)
      .use(() => remarkPromoteSingleLineDisplayMath(largePreTablePreview.content));
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
  if (featureHints.markmap) processor = processor.use(remarkMarkmap);
  if (featureHints.plantUml) processor = processor.use(remarkPlantUml);

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
    .use(rehypeInteractiveTaskListItems)
    .use(rehypePreviewUrlSafety)
    .use(rehypeStringify, { allowDangerousHtml: true })
    .processSync(largePreTablePreview.content);

  return injectLargePreTablePlaceholders(String(result), largePreTablePreview.placeholders);
}
