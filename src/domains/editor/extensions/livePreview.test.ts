import { describe, expect, it } from 'vitest';
import { EditorState } from '@codemirror/state';
import { markdown } from '@codemirror/lang-markdown';
import { collectLivePreviewHiddenRanges } from './livePreview';

function stateFor(doc: string, cursorLine = 1) {
  const state = EditorState.create({ doc, extensions: [markdown()] });
  const lineNumber = Math.min(cursorLine, state.doc.lines);
  return {
    state,
    hiddenText: collectLivePreviewHiddenRanges(state, new Set([lineNumber]))
      .map((range) => doc.slice(range.from, range.to)),
  };
}

describe('collectLivePreviewHiddenRanges', () => {
  it('hides heading marks on inactive lines', () => {
    const { hiddenText } = stateFor('## 标题\n\n正文', 3);
    expect(hiddenText).toEqual(['##']);
  });

  it('keeps the current line readable so it can be edited', () => {
    const { hiddenText } = stateFor('## 标题', 1);
    expect(hiddenText).toEqual([]);
  });

  it('hides emphasis and inline code marks', () => {
    const { hiddenText } = stateFor('\n一段 **加粗** 和 *斜体* 以及 `代码`\n', 3);
    expect(hiddenText.sort()).toEqual(['*', '*', '**', '**', '`', '`'].sort());
  });

  it('hides quote marks but leaves list markers visible', () => {
    const { hiddenText } = stateFor('> 引用\n\n- 列表项', 3);
    expect(hiddenText).toEqual(['>']);
  });

  it('never hides fenced code fences', () => {
    const { hiddenText } = stateFor(['```ts', 'const a = 1;', '```'].join('\n'), 4);
    expect(hiddenText).toEqual([]);
  });

  it('skips every line that intersects the selection', () => {
    const state = EditorState.create({
      doc: ['## 第一节', '', '**加粗**'].join('\n'),
      selection: { anchor: 0, head: 0 },
      extensions: [markdown()],
    });
    const ranges = collectLivePreviewHiddenRanges(state, new Set([1]));

    expect(ranges).toHaveLength(2);
  });
});
