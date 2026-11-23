/**
 * 单窗（所见即所得）渲染层。
 *
 * 与旧的「只藏标记」不同，这一层要真的换形：标题按级别放大、粗体变粗、斜体倾斜、
 * 行内代码带底色、引用带竖线、列表换成圆点、分隔线画成线、图片直接显示。
 * 语法标记（`#`、`**`、`` ` ``、`[]()`、`>`）只在**光标所在行**保留，
 * 其余行一律按成品渲染——这就是 Typora 的交互模型。
 *
 * 为什么不换 ProseMirror：Markdown 仍是唯一真源，撤销、搜索、诊断、导出必须走
 * 同一条链路。这里只加一层装饰（Decoration），文档模型一个字节都不动。
 */
import { syntaxTree } from '@codemirror/language';
import type { SyntaxNode } from '@lezer/common';
import type { EditorState, Extension } from '@codemirror/state';
import {
  Decoration,
  EditorView,
  ViewPlugin,
  WidgetType,
  type DecorationSet,
  type ViewUpdate,
} from '@codemirror/view';
import { readFile } from '../../../platform/tauri/fileSystem';
import { resolveMarkdownImagePath } from './imageDiagnostics';
import { TaskListCheckboxWidget, taskListCheckboxTheme } from './taskListCheckbox';

/** 需要隐藏或替换的行内区间。 */
export type WysiwygInlineKind = 'hidden' | 'image' | 'rule' | 'bullet' | 'checkbox';

export interface WysiwygInlineRange {
  from: number;
  to: number;
  kind: WysiwygInlineKind;
  /** 图片 widget 用 */
  src?: string;
  alt?: string;
  width?: string;
  /** 圆点 widget 用 */
  text?: string;
  /** 复选框 widget 用 */
  checked?: boolean;
}

export interface WysiwygLineRange {
  /** 行首偏移，用作 line decoration 的起点。 */
  from: number;
  className: string;
}

export interface WysiwygPlan {
  inline: WysiwygInlineRange[];
  lines: WysiwygLineRange[];
}

const BULLET_MARKERS = new Set(['-', '*', '+']);
/** 任务列表整行前缀：`- [x] ` / `1. [ ] `。捕获组 2 是方括号里的状态位。 */
const TASK_LINE_RE = /^(\s*(?:[-+*]|\d+[.)])\s+)\[([ xX])\](?=\s|$)/;
const HEADING_RE = /^(?:ATX|Setext)Heading([1-6])$/;
const IMAGE_RE = /^!\[([^\]]*)\]\(\s*([^)\s]+)(?:\s+"[^"]*")?\s*\)/;
const IMAGE_ATTR_RE = /^\s*\{([^{}\n]{1,80})\}/;

function lineNumbersInSelection(state: EditorState): Set<number> {
  const lines = new Set<number>();
  if (state.doc.length === 0) return lines;
  for (const range of state.selection.ranges) {
    const start = state.doc.lineAt(Math.min(range.from, state.doc.length)).number;
    const end = state.doc.lineAt(Math.min(range.to, state.doc.length)).number;
    for (let line = start; line <= end; line += 1) lines.add(line);
  }
  return lines;
}

function childNodes(node: SyntaxNode): Array<{ name: string; from: number; to: number }> {
  const children: Array<{ name: string; from: number; to: number }> = [];
  let child = node.firstChild;
  while (child) {
    children.push({ name: child.name, from: child.from, to: child.to });
    child = child.nextSibling;
  }
  return children;
}

function parseImageWidth(attributes: string | undefined): string | undefined {
  if (!attributes) return undefined;
  const width = /(?:^|\s)width\s*=\s*(\d+(?:\.\d+)?)(px|%)?/.exec(attributes);
  return width ? `${width[1]}${width[2] ?? 'px'}` : undefined;
}

/**
 * 纯函数：把语法树翻译成「哪些区间的标记要隐藏 / 换成什么」。
 * 不碰 DOM，便于单测。光标所在行整行保留源码。
 */
export function collectWysiwygPlan(state: EditorState, activeLines: Set<number>): WysiwygPlan {
  const inline: WysiwygInlineRange[] = [];
  const lines: WysiwygLineRange[] = [];
  const pushLine = (lineNumber: number, className: string) => {
    if (lineNumber < 1 || lineNumber > state.doc.lines) return;
    const line = state.doc.line(lineNumber);
    if (lines.some((entry) => entry.from === line.from && entry.className === className)) return;
    lines.push({ from: line.from, className });
  };
  const lineOf = (pos: number) => state.doc.lineAt(Math.min(pos, state.doc.length)).number;
  const isActive = (pos: number) => activeLines.has(lineOf(pos));
  const pushInline = (range: WysiwygInlineRange) => {
    if (range.to > range.from) inline.push(range);
  };
  /**
   * 隐藏标记。行首标记（#、>）后面那个空格要一起吃掉，否则行首会多出半个空格位；
   * 行内标记（**、`、~~、[）不能吃——闭合标记后面紧跟的空格是正文的一部分。
   */
  const hideMark = (from: number, to: number, eatTrailingSpace = false) => {
    const next = state.doc.sliceString(to, to + 1);
    pushInline({
      from,
      to: eatTrailingSpace && next === ' ' ? to + 1 : to,
      kind: 'hidden',
    });
  };

  syntaxTree(state).iterate({
    enter: (node) => {
      const name = node.name;

      const headingMatch = HEADING_RE.exec(name);
      if (headingMatch) {
        const level = Number(headingMatch[1]);
        const firstLine = lineOf(node.from);
        const lastLine = lineOf(Math.max(node.from, node.to - 1));
        for (let line = firstLine; line <= lastLine; line += 1) {
          pushLine(line, `cm-wy-h${level}`);
        }
        if (name.startsWith('ATX') && !isActive(node.from)) {
          for (const child of childNodes(node.node)) {
            if (child.name === 'HeaderMark') hideMark(child.from, child.to, true);
          }
        }
        return undefined;
      }

      if (name === 'Blockquote') {
        const firstLine = lineOf(node.from);
        const lastLine = lineOf(Math.max(node.from, node.to - 1));
        for (let line = firstLine; line <= lastLine; line += 1) {
          pushLine(line, 'cm-wy-quote');
        }
        if (!isActive(node.from)) {
          for (const child of childNodes(node.node)) {
            if (child.name === 'QuoteMark') hideMark(child.from, child.to, true);
          }
        }
        return undefined;
      }

      if (name === 'ListMark') {
        if (isActive(node.from)) return false;
        const text = state.doc.sliceString(node.from, node.to);
        const line = state.doc.lineAt(node.from);
        const task = TASK_LINE_RE.exec(line.text);
        if (task) {
          // 任务列表：`- ` 收掉，方括号换成真复选框——和预览里的勾选项长得一样。
          const markerFrom = line.from + task[1].length;
          pushInline({ from: node.from, to: markerFrom, kind: 'hidden' });
          pushInline({
            from: markerFrom,
            to: markerFrom + 3,
            kind: 'checkbox',
            checked: task[2].toLowerCase() === 'x',
          });
          return false;
        }
        if (BULLET_MARKERS.has(text)) {
          // 无序列表：把 -/*/+ 换成真正的圆点，后面的空格保留。
          pushInline({ from: node.from, to: node.to, kind: 'bullet', text: '•' });
        } else {
          // 有序列表：编号本身就是内容，留着，只标一行用于数字对齐。
          pushLine(lineOf(node.from), 'cm-wy-ordered');
        }
        return false;
      }

      if (name === 'InlineCode') {
        if (!isActive(node.from)) {
          for (const child of childNodes(node.node)) {
            if (child.name === 'CodeMark') hideMark(child.from, child.to);
          }
        }
        return undefined;
      }

      if (name === 'StrongEmphasis' || name === 'Emphasis' || name === 'Strikethrough') {
        if (!isActive(node.from)) {
          for (const child of childNodes(node.node)) {
            if (/Mark$/.test(child.name)) hideMark(child.from, child.to);
          }
        }
        return undefined;
      }

      if (name === 'Link') {
        if (!isActive(node.from)) {
          const marks = childNodes(node.node).filter((child) => child.name === 'LinkMark');
          if (marks.length >= 2) {
            hideMark(marks[0].from, marks[0].to);
            pushInline({ from: marks[1].from, to: node.to, kind: 'hidden' });
          }
        }
        return undefined;
      }

      if (name === 'Image') {
        if (isActive(node.from)) return false;
        const raw = state.doc.sliceString(node.from, node.to);
        const match = IMAGE_RE.exec(raw);
        // `![图](a.png){width=320}` 的尺寸属性挂在图片节点后面，一起吃掉才不留尾巴。
        const lineEnd = state.doc.lineAt(node.to).to;
        const tail = state.doc.sliceString(node.to, lineEnd);
        const attributeMatch = IMAGE_ATTR_RE.exec(tail);
        pushInline({
          from: node.from,
          to: node.to + (attributeMatch ? attributeMatch[0].length : 0),
          kind: 'image',
          src: match?.[2] ?? '',
          alt: match?.[1] ?? '',
          width: parseImageWidth(attributeMatch?.[1]),
        });
        return false;
      }

      if (name === 'HorizontalRule') {
        if (isActive(node.from)) return false;
        pushInline({ from: node.from, to: node.to, kind: 'rule' });
        return false;
      }

      if (name === 'FencedCode' || name === 'CodeBlock') {
        const firstLine = lineOf(node.from);
        const lastLine = lineOf(Math.max(node.from, node.to - 1));
        const fenced = name === 'FencedCode' && lastLine > firstLine;
        const contentStart = fenced ? firstLine + 1 : firstLine;
        const contentEnd = fenced ? lastLine - 1 : lastLine;
        for (let line = firstLine; line <= lastLine; line += 1) {
          const className = [
            'cm-wy-code',
            line === contentStart ? 'cm-wy-code-start' : '',
            line === contentEnd ? 'cm-wy-code-end' : '',
          ].filter(Boolean).join(' ');
          pushLine(line, className);
        }
        if (fenced) {
          for (const fenceLine of [firstLine, lastLine]) {
            if (activeLines.has(fenceLine)) continue;
            const line = state.doc.line(fenceLine);
            pushLine(fenceLine, 'cm-wy-fence');
            pushInline({ from: line.from, to: line.to, kind: 'hidden' });
          }
        }
        return false;
      }

      return undefined;
    },
  });

  inline.sort((a, b) => a.from - b.from || b.to - a.to);
  return { inline, lines };
}

function mimeTypeForPath(path: string) {
  const lower = path.toLowerCase();
  if (lower.endsWith('.svg')) return 'image/svg+xml';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.avif')) return 'image/avif';
  return 'application/octet-stream';
}

function isRemoteImage(src: string) {
  return /^https?:\/\//i.test(src) || src.startsWith('data:') || src.startsWith('blob:');
}

class WysiwygImageWidget extends WidgetType {
  private objectUrl: string | null = null;

  constructor(
    private readonly src: string,
    private readonly alt: string,
    private readonly width: string | undefined,
    private readonly documentPath: string | undefined,
  ) {
    super();
  }

  eq(other: WysiwygImageWidget) {
    return other.src === this.src
      && other.alt === this.alt
      && other.width === this.width
      && other.documentPath === this.documentPath;
  }

  toDOM(): HTMLElement {
    const wrapper = document.createElement('span');
    wrapper.className = 'cm-wy-image';
    wrapper.setAttribute('data-src', this.src);
    wrapper.dataset.state = 'loading';

    const image = document.createElement('img');
    image.alt = this.alt;
    image.draggable = false;
    if (this.width) image.style.width = this.width;
    wrapper.appendChild(image);

    if (this.alt) {
      const caption = document.createElement('span');
      caption.className = 'cm-wy-image-alt';
      caption.textContent = this.alt;
      wrapper.appendChild(caption);
    }

    void this.hydrate(image, wrapper);
    return wrapper;
  }

  private async hydrate(image: HTMLImageElement, wrapper: HTMLElement) {
    if (!this.src) {
      wrapper.dataset.state = 'error';
      return;
    }
    if (isRemoteImage(this.src)) {
      image.src = this.src;
      wrapper.dataset.state = 'ready';
      return;
    }
    const filePath = resolveMarkdownImagePath(this.src, this.documentPath);
    if (!filePath) {
      wrapper.dataset.state = 'error';
      return;
    }
    try {
      const bytes = await readFile(filePath);
      this.objectUrl = URL.createObjectURL(new Blob([bytes], { type: mimeTypeForPath(filePath) }));
      image.src = this.objectUrl;
      wrapper.dataset.state = 'ready';
    } catch {
      wrapper.dataset.state = 'error';
    }
  }

  destroy() {
    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl);
      this.objectUrl = null;
    }
  }
}

class WysiwygBulletWidget extends WidgetType {
  constructor(private readonly text: string) {
    super();
  }

  eq(other: WysiwygBulletWidget) {
    return other.text === this.text;
  }

  toDOM(): HTMLElement {
    const bullet = document.createElement('span');
    bullet.className = 'cm-wy-bullet';
    bullet.textContent = this.text;
    return bullet;
  }
}

class WysiwygRuleWidget extends WidgetType {
  toDOM(): HTMLElement {
    const rule = document.createElement('span');
    rule.className = 'cm-wy-rule';
    return rule;
  }
}

function buildDecorations(view: EditorView, documentPath: string | undefined): DecorationSet {
  const plan = collectWysiwygPlan(view.state, lineNumbersInSelection(view.state));
  const decorations = [];

  for (const line of plan.lines) {
    decorations.push(Decoration.line({ class: line.className }).range(line.from));
  }

  for (const range of plan.inline) {
    if (range.kind === 'hidden') {
      decorations.push(Decoration.replace({}).range(range.from, range.to));
      continue;
    }
    if (range.kind === 'bullet') {
      decorations.push(
        Decoration.replace({ widget: new WysiwygBulletWidget(range.text ?? '•') })
          .range(range.from, range.to),
      );
      continue;
    }
    if (range.kind === 'checkbox') {
      decorations.push(
        Decoration.replace({
          widget: new TaskListCheckboxWidget(range.checked ?? false, range.from),
        }).range(range.from, range.to),
      );
      continue;
    }
    if (range.kind === 'rule') {
      decorations.push(
        Decoration.replace({ widget: new WysiwygRuleWidget() }).range(range.from, range.to),
      );
      continue;
    }
    decorations.push(
      Decoration.replace({
        widget: new WysiwygImageWidget(range.src ?? '', range.alt ?? '', range.width, documentPath),
      }).range(range.from, range.to),
    );
  }

  return Decoration.set(decorations, true);
}

export interface WysiwygOptions {
  enabled: boolean;
  documentPath?: string;
}

export function getWysiwygExtension({ enabled, documentPath }: WysiwygOptions): Extension {
  if (!enabled) return [];

  const plugin = ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;

      constructor(view: EditorView) {
        this.decorations = buildDecorations(view, documentPath);
      }

      update(update: ViewUpdate) {
        if (update.docChanged || update.selectionSet || update.viewportChanged) {
          this.decorations = buildDecorations(update.view, documentPath);
        }
      }
    },
    { decorations: (value) => value.decorations },
  );

  // 复选框的尺寸/光标样式复用源码模式那套 theme，只在单窗模式下生效。
  return [plugin, taskListCheckboxTheme, EditorView.editorAttributes.of({ class: 'cm-wysiwyg' })];
}
