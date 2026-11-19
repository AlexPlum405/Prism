/**
 * 单窗预览（live）：在不离开编辑器的情况下，把 Markdown 标记藏起来，
 * 正文看起来接近成品；光标所在行始终显示源码，方便就地修改。
 *
 * 只隐藏「语法标记」本身（#、**、` 等），不替换内容、不引入第二套文档模型，
 * 因此撤销、搜索、诊断、导出仍然走同一条链路。
 */
import { ensureSyntaxTree, syntaxTree } from '@codemirror/language';
import type { EditorState, Extension } from '@codemirror/state';
import { RangeSetBuilder } from '@codemirror/state';
import { Decoration, EditorView, ViewPlugin, type DecorationSet } from '@codemirror/view';

const HIDDEN_MARK_NODES = new Set([
  'HeaderMark',
  'EmphasisMark',
  'CodeMark',
  'QuoteMark',
]);

const FENCE_LINE = /^\s*(?:```|~~~)/;

export interface HiddenRange {
  from: number;
  to: number;
}

export function collectLivePreviewHiddenRanges(
  state: EditorState,
  activeLineNumbers: Set<number>,
): HiddenRange[] {
  const ranges: HiddenRange[] = [];
  const tree = ensureSyntaxTree(state, Math.min(state.doc.length, 200_000), 60) ?? syntaxTree(state);
  tree.iterate({
    enter(node) {
      if (!HIDDEN_MARK_NODES.has(node.name)) return;
      if (node.to <= node.from) return;
      if (node.to > state.doc.length) return;

      const line = state.doc.lineAt(node.from);
      if (activeLineNumbers.has(line.number)) return;
      // 代码围栏的 ``` 也是 CodeMark，藏掉会让整段代码失去边界。
      if (node.name === 'CodeMark' && FENCE_LINE.test(line.text)) return;

      ranges.push({ from: node.from, to: node.to });
    },
  });
  return ranges;
}

function activeLineNumbers(state: EditorState) {
  const lines = new Set<number>();
  for (const range of state.selection.ranges) {
    const start = state.doc.lineAt(range.from).number;
    const end = state.doc.lineAt(range.to).number;
    for (let line = start; line <= end; line += 1) lines.add(line);
  }
  return lines;
}

function buildLivePreviewDecorations(state: EditorState): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  for (const range of collectLivePreviewHiddenRanges(state, activeLineNumbers(state))) {
    builder.add(range.from, range.to, Decoration.replace({}));
  }
  return builder.finish();
}

class LivePreviewState {
  decorations: DecorationSet;

  constructor(view: EditorView) {
    this.decorations = buildLivePreviewDecorations(view.state);
  }

  update(update: { state: EditorState; docChanged: boolean; selectionSet: boolean; viewportChanged: boolean }) {
    if (update.docChanged || update.selectionSet || update.viewportChanged) {
      this.decorations = buildLivePreviewDecorations(update.state);
    }
  }
}

export function getLivePreviewExtension(enabled: boolean): Extension {
  if (!enabled) return [];
  return ViewPlugin.fromClass(LivePreviewState, {
    decorations: (value) => value.decorations,
  });
}
