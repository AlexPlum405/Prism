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
import { Prec, StateField, type EditorState, type Extension } from '@codemirror/state';
import {
  Decoration,
  EditorView,
  WidgetType,
  keymap,
  type DecorationSet,
} from '@codemirror/view';
import { readFile } from '../../../platform/tauri/fileSystem';
import { resolveMarkdownImagePath } from './imageDiagnostics';
import { TaskListCheckboxWidget, taskListCheckboxTheme } from './taskListCheckbox';

/** 表格单元格的对齐方式，`null` 表示 Markdown 没表态（浏览器默认左对齐）。 */
export type WysiwygTableAlign = 'left' | 'center' | 'right' | null;

export interface WysiwygTableData {
  align: WysiwygTableAlign[];
  header: string[];
  rows: string[][];
}

/** 需要隐藏或替换的行内区间。 */
export type WysiwygInlineKind = 'hidden' | 'image' | 'rule' | 'bullet' | 'checkbox' | 'table';

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
  /** 表格 widget 用 */
  table?: WysiwygTableData;
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

const TABLE_DELIMITER_CELL_RE = /^:?-+:?$/;

/**
 * 按 GFM 规则切一行表格：`|` 分隔，`\|` 是转义；首尾那根管子会切出两个空壳，要去掉。
 * 不处理单元格内的 `|`（Markdown 里本来就得写成 `\|`）。
 */
export function splitTableRow(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  const cells: string[] = [];
  let current = '';
  for (let index = 0; index < trimmed.length; index += 1) {
    const char = trimmed[index];
    if (char === '\\' && trimmed[index + 1] === '|') {
      current += '|';
      index += 1;
      continue;
    }
    if (char === '|') {
      cells.push(current.trim());
      current = '';
      continue;
    }
    current += char;
  }
  cells.push(current.trim());
  if (cells.length > 0 && cells[0] === '') cells.shift();
  if (cells.length > 0 && cells[cells.length - 1] === '') cells.pop();
  return cells;
}

/** 纯函数：把一段 GFM 表格源码解析成表头 / 对齐 / 数据行。 */
export function parseWysiwygTable(source: string): WysiwygTableData | null {
  const lines = source.split('\n').filter((line) => line.trim().length > 0);
  if (lines.length < 2) return null;
  const header = splitTableRow(lines[0]);
  const delimiter = splitTableRow(lines[1]);
  if (header.length === 0 || delimiter.length < header.length) return null;
  if (!delimiter.slice(0, header.length).every((cell) => TABLE_DELIMITER_CELL_RE.test(cell))) return null;

  const align = delimiter.slice(0, header.length).map((cell): WysiwygTableAlign => {
    const left = cell.startsWith(':');
    const right = cell.endsWith(':');
    if (left && right) return 'center';
    if (right) return 'right';
    if (left) return 'left';
    return null;
  });

  const rows = lines.slice(2).map((line) => {
    const cells = splitTableRow(line);
    // 列数不齐时补空、截断，渲染出来永远是规整的矩形。
    while (cells.length < header.length) cells.push('');
    return cells.slice(0, header.length);
  });

  return { align, header, rows };
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

      if (name === 'Table') {
        const firstLine = lineOf(node.from);
        const lastLine = lineOf(Math.max(node.from, node.to - 1));
        // 光标进表格就整块回源码——用管道符编辑单元格比在渲染结果上改更准。
        for (let line = firstLine; line <= lastLine; line += 1) {
          if (activeLines.has(line)) return false;
        }
        const table = parseWysiwygTable(state.doc.sliceString(node.from, node.to));
        if (!table) return false;
        pushInline({
          from: state.doc.line(firstLine).from,
          to: state.doc.line(lastLine).to,
          kind: 'table',
          table,
        });
        return false;
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

const CELL_INLINE_RE = /(\*\*[^*\n]+\*\*)|(\*[^*\n]+\*)|(`[^`\n]+`)|(~~[^~\n]+~~)|(\[[^\]\n]+\]\([^)\s]+\))/g;
const CELL_LINK_RE = /^\[([^\]\n]+)\]\(([^)\s]+)\)$/;

/** 单元格里的少量行内标记：粗/斜/删除线/行内代码/链接。样式与正文保持一致。 */
function appendInline(parent: HTMLElement, text: string) {
  let cursor = 0;
  for (const match of text.matchAll(CELL_INLINE_RE)) {
    const index = match.index ?? 0;
    if (index > cursor) parent.appendChild(document.createTextNode(text.slice(cursor, index)));
    const token = match[0];
    if (token.startsWith('**') || token.startsWith('__')) {
      const element = document.createElement('strong');
      element.textContent = token.slice(2, -2);
      parent.appendChild(element);
    } else if (token.startsWith('~~')) {
      const element = document.createElement('del');
      element.textContent = token.slice(2, -2);
      parent.appendChild(element);
    } else if (token.startsWith('`')) {
      const element = document.createElement('code');
      element.className = 'cm-wy-table-code';
      element.textContent = token.slice(1, -1);
      parent.appendChild(element);
    } else if (token.startsWith('[')) {
      const link = CELL_LINK_RE.exec(token);
      const element = document.createElement('span');
      element.className = 'cm-wy-table-link';
      element.textContent = link?.[1] ?? token;
      if (link) element.title = link[2];
      parent.appendChild(element);
    } else {
      const element = document.createElement('em');
      element.textContent = token.slice(1, -1);
      parent.appendChild(element);
    }
    cursor = index + token.length;
  }
  if (cursor < text.length) parent.appendChild(document.createTextNode(text.slice(cursor)));
}

class WysiwygTableWidget extends WidgetType {
  constructor(
    private readonly data: WysiwygTableData,
    private readonly from: number,
    private readonly source: string,
  ) {
    super();
  }

  eq(other: WysiwygTableWidget) {
    return other.source === this.source && other.from === this.from;
  }

  private cell(tag: 'th' | 'td', text: string, align: WysiwygTableAlign) {
    const element = document.createElement(tag);
    if (align) element.style.textAlign = align;
    appendInline(element, text);
    return element;
  }

  toDOM(view: EditorView): HTMLElement {
    const wrapper = document.createElement('div');
    wrapper.className = 'cm-wy-table';
    const table = document.createElement('table');

    const head = document.createElement('thead');
    const headRow = document.createElement('tr');
    this.data.header.forEach((text, index) => {
      headRow.appendChild(this.cell('th', text, this.data.align[index] ?? null));
    });
    head.appendChild(headRow);
    table.appendChild(head);

    if (this.data.rows.length > 0) {
      const body = document.createElement('tbody');
      for (const row of this.data.rows) {
        const rowElement = document.createElement('tr');
        row.forEach((text, index) => {
          rowElement.appendChild(this.cell('td', text, this.data.align[index] ?? null));
        });
        body.appendChild(rowElement);
      }
      table.appendChild(body);
    }

    wrapper.appendChild(table);
    // 点一下把光标放进表格，整块回源码——和 Typora 一样「点进去才编辑」。
    wrapper.addEventListener('mousedown', (event) => {
      event.preventDefault();
      view.dispatch({ selection: { anchor: this.from }, scrollIntoView: true });
      view.focus();
    });
    return wrapper;
  }
}

function buildDecorations(state: EditorState, documentPath: string | undefined): DecorationSet {
  const plan = collectWysiwygPlan(state, lineNumbersInSelection(state));
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
    if (range.kind === 'table' && range.table) {
      // 块级替换：区间从行首到行尾，widget 必须是块元素，否则 CodeMirror 会拒绝。
      decorations.push(
        Decoration.replace({
          widget: new WysiwygTableWidget(
            range.table,
            range.from,
            state.doc.sliceString(range.from, range.to),
          ),
          block: true,
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

interface TableBlock {
  from: number;
  to: number;
  firstLine: number;
  lastLine: number;
}

/** 找出当前「渲染成表格」的块（光标在表格里时它不算，因为那时表格是源码）。 */
function renderedTableBlocks(state: EditorState): TableBlock[] {
  const plan = collectWysiwygPlan(state, lineNumbersInSelection(state));
  const blocks: TableBlock[] = [];
  for (const range of plan.inline) {
    if (range.kind !== 'table') continue;
    blocks.push({
      from: range.from,
      to: range.to,
      firstLine: state.doc.lineAt(range.from).number,
      lastLine: state.doc.lineAt(range.to).number,
    });
  }
  return blocks;
}

/**
 * 纯函数：方向键走到表格边界时，光标应该落到哪里；不在边界就返回 null。
 *
 * 表格是块级替换，光标在它外面时方向键会整块跳过——键盘永远进不去。
 * 所以向上/向下各接管一次，把光标送进表格，表格随之回源码。
 */
export function tableEntryAnchor(
  state: EditorState,
  direction: 'up' | 'down',
): number | null {
  const selection = state.selection.main;
  if (!selection.empty) return null;
  const line = state.doc.lineAt(selection.head);
  // 廉价前置判断：相邻行不是管道行就不值得跑一遍语法树。
  const neighborNumber = direction === 'down' ? line.number + 1 : line.number - 1;
  if (neighborNumber < 1 || neighborNumber > state.doc.lines) return null;
  const neighbor = state.doc.line(neighborNumber);
  if (!neighbor.text.trimStart().startsWith('|')) return null;

  const block = renderedTableBlocks(state).find((entry) => (
    direction === 'down' ? entry.firstLine === neighborNumber : entry.lastLine === neighborNumber
  ));
  if (!block) return null;
  return direction === 'down' ? block.from : block.to;
}

function wysiwygTableKeymap(): Extension {
  const enterTable = (view: EditorView, direction: 'up' | 'down') => {
    const anchor = tableEntryAnchor(view.state, direction);
    if (anchor == null) return false;
    view.dispatch({ selection: { anchor }, scrollIntoView: true });
    return true;
  };

  return Prec.high(keymap.of([
    { key: 'ArrowDown', run: (view) => enterTable(view, 'down') },
    { key: 'ArrowUp', run: (view) => enterTable(view, 'up') },
  ]));
}

export interface WysiwygOptions {
  enabled: boolean;
  documentPath?: string;
}

export function getWysiwygExtension({ enabled, documentPath }: WysiwygOptions): Extension {
  if (!enabled) return [];

  /**
   * 必须是 StateField 而不是 ViewPlugin：表格是块级替换（`block: true`），
   * CodeMirror 只允许状态字段提供块级装饰，ViewPlugin 会直接抛
   * 「Block decorations may not be specified via plugins」。
   */
  const field = StateField.define<DecorationSet>({
    create: (state) => buildDecorations(state, documentPath),
    update: (decorations, transaction) => {
      if (transaction.docChanged || transaction.selection) {
        return buildDecorations(transaction.state, documentPath);
      }
      return decorations.map(transaction.changes);
    },
    provide: (value) => EditorView.decorations.from(value),
  });

  // 复选框的尺寸/光标样式复用源码模式那套 theme，只在单窗模式下生效。
  return [
    field,
    wysiwygTableKeymap(),
    taskListCheckboxTheme,
    EditorView.editorAttributes.of({ class: 'cm-wysiwyg' }),
  ];
}
