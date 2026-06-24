import { syntaxTree } from '@codemirror/language';
import { Facet, RangeSetBuilder } from '@codemirror/state';
import { Decoration, DecorationSet, EditorView, ViewPlugin, type ViewUpdate } from '@codemirror/view';
import type { ContentTheme } from '../../settings/types';

export const contentThemeFacet = Facet.define<ContentTheme, ContentTheme>({
  combine: (values) => values[values.length - 1] ?? 'miaoyan',
});

const compatibilityDecos = {
  heading: Decoration.mark({ class: 'cm-md-heading' }),
  listMark: Decoration.mark({ class: 'cm-md-list-marker' }),
  quote: Decoration.mark({ class: 'cm-md-quote' }),
  codeInline: Decoration.mark({ class: 'cm-md-code-inline' }),
  fencedCode: Decoration.mark({ class: 'cm-md-fenced-code' }),
  strong: Decoration.mark({ class: 'cm-md-strong' }),
  emphasis: Decoration.mark({ class: 'cm-md-emphasis' }),
  strike: Decoration.mark({ class: 'cm-md-strike' }),
  linkSyntax: Decoration.mark({ class: 'cm-md-link-syntax' }),
  linkText: Decoration.mark({ class: 'cm-md-link-text' }),
  linkUrl: Decoration.mark({ class: 'cm-md-link-url' }),
  imageSyntax: Decoration.mark({ class: 'cm-md-image-syntax' }),
  imageUrl: Decoration.mark({ class: 'cm-md-image-url' }),
  imageMark: Decoration.mark({ class: 'cm-md-image-mark' }),
  mathToken: Decoration.mark({ class: 'cm-md-math-token' }),
};

type HighlightTokenRange = {
  from: number;
  to: number;
  className: string;
};

type MiaoyanCodeHighlightTarget = {
  code: string;
  offset: number;
  language?: string;
};

type MiaoyanInlineDecorationKind = 'linkSyntax' | 'linkText' | 'linkUrl' | 'imageSyntax' | 'imageUrl' | 'imageMark';

type MiaoyanInlineDecorationRange = {
  from: number;
  to: number;
  kind: MiaoyanInlineDecorationKind;
};

type AddDecoration = (from: number, to: number, decoration: Decoration) => void;

export const MIAOYAN_CODE_BLOCK_HIGHLIGHT_LIMIT = 3000;
const COMPATIBILITY_CODE_HIGHLIGHT_THEMES = new Set<ContentTheme>(['miaoyan', 'inkstone', 'slate', 'mono', 'nocturne']);
const PRISM_KNOWN_CODE_LANGUAGES = new Set([
  'bash',
  'c',
  'cpp',
  'csharp',
  'css',
  'diff',
  'dockerfile',
  'ini',
  'java',
  'javascript',
  'json',
  'markdown',
  'php',
  'python',
  'ruby',
  'rust',
  'shell',
  'sql',
  'swift',
  'typescript',
  'xml',
  'yaml',
  'sh',
  'zsh',
  'cc',
  'cxx',
  'c++',
  'hpp',
  'cs',
  'docker',
  'js',
  'jsx',
  'mjs',
  'cjs',
  'md',
  'mkd',
  'mdown',
  'php3',
  'php4',
  'php5',
  'py',
  'console',
  'shell-session',
  'ts',
  'tsx',
  'html',
  'xhtml',
  'svg',
  'yml',
]);
const codeHighlightDecorationCache = new Map<string, Decoration>();
const codeHighlightResultCache = new Map<string, HighlightTokenRange[]>();
type CodeHighlightModule = typeof import('../../markdown/codeHighlight');
let codeHighlightModule: CodeHighlightModule | null = null;
let codeHighlightLoadPromise: Promise<CodeHighlightModule> | null = null;

function ensureCodeHighlightModule(onLoaded?: () => void) {
  if (codeHighlightModule) return Promise.resolve(codeHighlightModule);
  codeHighlightLoadPromise ??= import('../../markdown/codeHighlight').then((module) => {
    codeHighlightModule = module;
    return module;
  });
  if (onLoaded) {
    void codeHighlightLoadPromise.then(onLoaded, () => undefined);
  }
  return codeHighlightLoadPromise;
}

export function loadMiaoyanCodeHighlighterForTesting() {
  return ensureCodeHighlightModule();
}

function getCodeHighlightDecoration(className: string) {
  const cached = codeHighlightDecorationCache.get(className);
  if (cached) return cached;
  const decoration = Decoration.mark({ class: `cm-code-token ${className}` });
  codeHighlightDecorationCache.set(className, decoration);
  return decoration;
}

export function getMiaoyanCodeLanguage(code: string) {
  if (!code.startsWith('```')) return undefined;

  const firstLineEnd = code.search(/\r?\n/);
  if (firstLineEnd === -1) return undefined;

  const language = code
    .slice(3, firstLineEnd)
    .trim();

  if (!language || language === 'go' || !PRISM_KNOWN_CODE_LANGUAGES.has(language)) {
    return undefined;
  }

  return language;
}

function collectHighlightTokenRanges(html: string, originalLength: number) {
  const template = document.createElement('template');
  template.innerHTML = html;

  const ranges: HighlightTokenRange[] = [];
  let offset = 0;

  const walk = (node: Node, inheritedClasses: string[]) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent ?? '';
      const length = text.length;
      if (length > 0 && inheritedClasses.length > 0) {
        ranges.push({
          from: offset,
          to: offset + length,
          className: inheritedClasses.join(' '),
        });
      }
      offset += length;
      return;
    }

    if (!(node instanceof Element)) {
      node.childNodes.forEach((child) => walk(child, inheritedClasses));
      return;
    }

    const ownClasses = Array.from(node.classList).filter((className) => className.startsWith('hljs-'));
    const nextClasses = ownClasses.length > 0
      ? Array.from(new Set([...inheritedClasses, ...ownClasses]))
      : inheritedClasses;
    node.childNodes.forEach((child) => walk(child, nextClasses));
  };

  template.content.childNodes.forEach((child) => walk(child, []));
  return offset === originalLength ? ranges : [];
}

function findInlineDestinationBounds(markdown: string, closeBracket: number) {
  if (closeBracket < 0 || markdown[closeBracket + 1] !== '(') return null;
  const closeParen = markdown.lastIndexOf(')');
  if (closeParen <= closeBracket + 1) return null;

  return {
    openParen: closeBracket + 1,
    destinationStart: closeBracket + 2,
    destinationEnd: closeParen,
    closeParen,
  };
}

export function collectMiaoyanInlineMarkdownDecorationRanges(markdown: string) {
  const ranges: MiaoyanInlineDecorationRange[] = [];
  const isImage = markdown.startsWith('![');
  const isLink = !isImage && markdown.startsWith('[');
  if (!isImage && !isLink) return ranges;

  const openEnd = isImage ? 2 : 1;
  const closeBracket = markdown.indexOf(']', openEnd);
  if (closeBracket === -1) return ranges;

  const openingKind: MiaoyanInlineDecorationKind = isImage ? 'imageMark' : 'linkSyntax';
  const syntaxKind: MiaoyanInlineDecorationKind = isImage ? 'imageSyntax' : 'linkSyntax';
  ranges.push({ from: 0, to: openEnd, kind: openingKind });

  if (isLink && closeBracket > openEnd) {
    ranges.push({ from: openEnd, to: closeBracket, kind: 'linkText' });
  }

  ranges.push({ from: closeBracket, to: closeBracket + 1, kind: syntaxKind });

  const destination = findInlineDestinationBounds(markdown, closeBracket);
  if (destination) {
    ranges.push({ from: destination.openParen, to: destination.openParen + 1, kind: syntaxKind });
    if (destination.destinationEnd > destination.destinationStart) {
      ranges.push({
        from: destination.destinationStart,
        to: destination.destinationEnd,
        kind: isImage ? 'imageUrl' : 'linkUrl',
      });
    }
    ranges.push({ from: destination.closeParen, to: destination.closeParen + 1, kind: syntaxKind });
    return ranges;
  }

  if (markdown[closeBracket + 1] === '[') {
    const referenceEnd = markdown.indexOf(']', closeBracket + 2);
    if (referenceEnd > closeBracket + 1) {
      ranges.push({ from: closeBracket + 1, to: closeBracket + 2, kind: syntaxKind });
      ranges.push({
        from: closeBracket + 2,
        to: referenceEnd,
        kind: isImage ? 'imageUrl' : 'linkUrl',
      });
      ranges.push({ from: referenceEnd, to: referenceEnd + 1, kind: syntaxKind });
    }
  }

  return ranges;
}

function addMiaoyanInlineMarkdownDecorations(
  addDecoration: AddDecoration,
  view: EditorView,
  from: number,
  to: number,
) {
  const markdown = view.state.doc.sliceString(from, to);
  const ranges = collectMiaoyanInlineMarkdownDecorationRanges(markdown);
  for (const range of ranges) {
    if (range.from === range.to) continue;
    addDecoration(from + range.from, from + range.to, compatibilityDecos[range.kind]);
  }
}

const MIAOYAN_MATH_TOKEN_PATTERN = /\\[A-Za-z]+|(?<!\\)[_^]\{[^}\n]+\}|(?<!\\)[_^][A-Za-z0-9]+/g;
const MIAOYAN_INLINE_MATH_PATTERN = /(^|[^\\$])(\$\$?)([^$\n]+?)\2(?!\$)/g;

export function collectMiaoyanMathDecorationRanges(markdown: string) {
  const ranges: Array<{ from: number; to: number }> = [];

  for (const mathMatch of markdown.matchAll(MIAOYAN_INLINE_MATH_PATTERN)) {
    const prefix = mathMatch[1] ?? '';
    const delimiter = mathMatch[2] ?? '$';
    const content = mathMatch[3] ?? '';
    const contentStart = (mathMatch.index ?? 0) + prefix.length + delimiter.length;

    for (const tokenMatch of content.matchAll(MIAOYAN_MATH_TOKEN_PATTERN)) {
      const tokenStart = tokenMatch.index ?? 0;
      const token = tokenMatch[0] ?? '';
      ranges.push({
        from: contentStart + tokenStart,
        to: contentStart + tokenStart + token.length,
      });
    }
  }

  return ranges;
}

function addMiaoyanMathDecorations(
  addDecoration: AddDecoration,
  view: EditorView,
  from: number,
  to: number,
) {
  const markdown = view.state.doc.sliceString(from, to);
  const ranges = collectMiaoyanMathDecorationRanges(markdown);
  for (const range of ranges) {
    addDecoration(from + range.from, from + range.to, compatibilityDecos.mathToken);
  }
}

function getMiaoyanCodeHighlightTarget(code: string): MiaoyanCodeHighlightTarget {
  const language = getMiaoyanCodeLanguage(code);
  if (!code.startsWith('```')) {
    return { code, offset: 0, language };
  }

  const firstLineEnd = code.search(/\r?\n/);
  if (firstLineEnd === -1) {
    return { code, offset: 0, language };
  }

  const firstLineBreak = code.match(/^.*?(\r?\n)/)?.[1] ?? '\n';
  const bodyStart = firstLineEnd + firstLineBreak.length;
  const closingFenceStart = code.lastIndexOf('\n```');
  const bodyEnd = closingFenceStart > bodyStart ? closingFenceStart : code.length;

  return {
    code: code.slice(bodyStart, bodyEnd),
    offset: bodyStart,
    language,
  };
}

export function getMiaoyanCodeHighlightRanges(code: string, onHighlighterLoaded?: () => void) {
  if (code.length === 0 || code.length > MIAOYAN_CODE_BLOCK_HIGHLIGHT_LIMIT) {
    return [];
  }

  const target = getMiaoyanCodeHighlightTarget(code);
  if (target.code.length === 0) {
    return [];
  }

  const cacheKey = `${target.language ?? 'auto'}:${target.offset}\n${code}`;
  const cached = codeHighlightResultCache.get(cacheKey);
  if (cached) return cached;
  if (!codeHighlightModule) {
    void ensureCodeHighlightModule(onHighlighterLoaded);
    return [];
  }

  try {
    const highlighted = target.language
      ? codeHighlightModule.highlightPrismCode(target.code, target.language)
      : codeHighlightModule.highlightPrismCodeAuto(target.code);
    const ranges = collectHighlightTokenRanges(highlighted.value, target.code.length)
      .map((range) => ({
        ...range,
        from: range.from + target.offset,
        to: range.to + target.offset,
      }));

    codeHighlightResultCache.set(cacheKey, ranges);
    if (codeHighlightResultCache.size > 80) {
      const firstKey = codeHighlightResultCache.keys().next().value;
      if (firstKey !== undefined) {
        codeHighlightResultCache.delete(firstKey);
      }
    }

    return ranges;
  } catch {
    return [];
  }
}

function addMiaoyanCodeHighlightDecorations(
  addDecoration: AddDecoration,
  view: EditorView,
  from: number,
  to: number,
  onHighlighterLoaded?: () => void,
) {
  const code = view.state.doc.sliceString(from, to);
  const tokenRanges = getMiaoyanCodeHighlightRanges(code, onHighlighterLoaded);
  for (const tokenRange of tokenRanges) {
    if (tokenRange.from === tokenRange.to) continue;
    addDecoration(
      from + tokenRange.from,
      from + tokenRange.to,
      getCodeHighlightDecoration(tokenRange.className),
    );
  }
}

function shouldHighlightCompatibilityCode(view: EditorView) {
  return COMPATIBILITY_CODE_HIGHLIGHT_THEMES.has(view.state.facet(contentThemeFacet));
}

export function shouldHighlightCompatibilityCodeTheme(theme: ContentTheme) {
  return COMPATIBILITY_CODE_HIGHLIGHT_THEMES.has(theme);
}

function buildCompatibilityDecorations(view: EditorView, onHighlighterLoaded?: () => void): DecorationSet {
  const decorations: Array<{ from: number; to: number; decoration: Decoration }> = [];
  const addDecoration: AddDecoration = (from, to, decoration) => {
    if (from >= to) return;
    decorations.push({ from, to, decoration });
  };
  const builder = new RangeSetBuilder<Decoration>();
  const contentTheme = view.state.facet(contentThemeFacet);
  const useMiaoyanInlineMarkdown = contentTheme === 'miaoyan';
  const useMiaoyanMath = contentTheme === 'miaoyan';
  const enableCodeHighlight = shouldHighlightCompatibilityCode(view);
  for (const { from, to } of view.visibleRanges) {
    syntaxTree(view.state).iterate({
      from,
      to,
      enter: (node) => {
        const name = node.name;
        if (useMiaoyanMath && name === 'Paragraph') {
          addMiaoyanMathDecorations(addDecoration, view, node.from, node.to);
          return;
        }
        if (/^ATXHeading[1-6]$/.test(name) || name === 'SetextHeading1' || name === 'SetextHeading2') {
          addDecoration(node.from, node.to, compatibilityDecos.heading);
          return false;
        }
        if (name === 'ListMark') {
          addDecoration(node.from, node.to, compatibilityDecos.listMark);
          return;
        }
        if (name === 'Blockquote') {
          addDecoration(node.from, node.to, compatibilityDecos.quote);
          return;
        }
        if (name === 'InlineCode') {
          addDecoration(node.from, node.to, compatibilityDecos.codeInline);
          return false;
        }
        if (name === 'FencedCode' || name === 'CodeBlock') {
          if (enableCodeHighlight) {
            addDecoration(node.from, node.to, compatibilityDecos.fencedCode);
            addMiaoyanCodeHighlightDecorations(addDecoration, view, node.from, node.to, onHighlighterLoaded);
          } else {
            addDecoration(node.from, node.to, compatibilityDecos.fencedCode);
          }
          return false;
        }
        if (name === 'StrongEmphasis') {
          addDecoration(node.from, node.to, compatibilityDecos.strong);
          return false;
        }
        if (name === 'Emphasis') {
          addDecoration(node.from, node.to, compatibilityDecos.emphasis);
          return false;
        }
        if (name === 'Strikethrough') {
          addDecoration(node.from, node.to, compatibilityDecos.strike);
          return false;
        }
        if (name === 'Link') {
          if (useMiaoyanInlineMarkdown) {
            addMiaoyanInlineMarkdownDecorations(addDecoration, view, node.from, node.to);
            return false;
          }
          const cursor = node.node.cursor();
          let firstMarkEnd = -1;
          let secondMarkStart = -1;
          if (cursor.firstChild()) {
            do {
              if (cursor.name === 'LinkMark') {
                if (firstMarkEnd === -1) firstMarkEnd = cursor.to;
                else if (secondMarkStart === -1) {
                  secondMarkStart = cursor.from;
                  break;
                }
              }
            } while (cursor.nextSibling());
          }
          if (firstMarkEnd !== -1 && secondMarkStart !== -1 && firstMarkEnd < secondMarkStart) {
            addDecoration(firstMarkEnd, secondMarkStart, compatibilityDecos.linkText);
          }
          return false;
        }
        if (name === 'Image') {
          if (useMiaoyanInlineMarkdown) {
            addMiaoyanInlineMarkdownDecorations(addDecoration, view, node.from, node.to);
            return false;
          }
          addDecoration(node.from, node.to, compatibilityDecos.imageMark);
          return false;
        }
      },
    });
  }
  decorations
    .sort((first, second) => first.from - second.from || first.to - second.to)
    .forEach((range) => builder.add(range.from, range.to, range.decoration));
  return builder.finish();
}

export const compatibilityMarkdownPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    private destroyed = false;
    private refreshQueued = false;
    private view: EditorView;
    constructor(view: EditorView) {
      this.view = view;
      this.decorations = buildCompatibilityDecorations(view, this.scheduleHighlightRefresh);
    }
    update(update: ViewUpdate) {
      const contentThemeChanged =
        update.startState.facet(contentThemeFacet) !== update.state.facet(contentThemeFacet);
      if (update.docChanged || update.viewportChanged || update.selectionSet || contentThemeChanged) {
        this.decorations = buildCompatibilityDecorations(update.view, this.scheduleHighlightRefresh);
      }
    }
    destroy() {
      this.destroyed = true;
    }
    private scheduleHighlightRefresh = () => {
      if (this.destroyed || this.refreshQueued) return;
      this.refreshQueued = true;
      const win = this.view.dom.ownerDocument.defaultView ?? window;
      win.requestAnimationFrame(() => {
        this.refreshQueued = false;
        if (this.destroyed) return;
        this.decorations = buildCompatibilityDecorations(this.view, this.scheduleHighlightRefresh);
        this.view.dispatch({});
      });
    };
  },
  { decorations: (v) => v.decorations },
);
