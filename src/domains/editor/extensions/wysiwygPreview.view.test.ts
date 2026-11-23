import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { markdown } from '@codemirror/lang-markdown';
import { GFM } from '@lezer/markdown';
import { afterEach, describe, expect, it } from 'vitest';
import { getWysiwygExtension } from './wysiwygPreview';

const TABLE = [
  '| 章节 | 字数 |',
  '| --- | --- |',
  '| 第一章 | 1200 |',
].join('\n');

const mounted: Array<() => void> = [];

function mount(doc: string, anchor: number) {
  const parent = document.createElement('div');
  document.body.appendChild(parent);
  const view = new EditorView({
    parent,
    state: EditorState.create({
      doc,
      selection: { anchor },
      extensions: [
        markdown({ extensions: [GFM] }),
        getWysiwygExtension({ enabled: true }),
      ],
    }),
  });
  mounted.push(() => {
    view.destroy();
    parent.remove();
  });
  return view;
}

function pressArrow(view: EditorView, key: 'ArrowDown' | 'ArrowUp') {
  view.contentDOM.dispatchEvent(
    new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }),
  );
}

afterEach(() => {
  while (mounted.length > 0) mounted.pop()?.();
});

describe('单窗表格的方向键进入', () => {
  it('紧邻表格上方的空行按向下：光标落进表格第一行，表格随之回源码', () => {
    const doc = `前言\n\n${TABLE}\n\n后记`;
    // 表格上一行是空行——这是最常见的落点，也正是方向键会「跳过表格」的地方。
    const view = mount(doc, doc.indexOf('\n\n|') + 1);
    // 表格此刻是渲染块，方向键原本会整块跳过它。
    expect(view.dom.querySelector('.cm-wy-table')).not.toBeNull();

    pressArrow(view, 'ArrowDown');

    expect(view.state.selection.main.head).toBe(doc.indexOf('| 章节'));
    // 光标进了表格，整块回源码，渲染块消失。
    expect(view.dom.querySelector('.cm-wy-table')).toBeNull();
  });

  it('紧邻表格下方的空行按向上：光标落进表格最后一行末尾', () => {
    const doc = `前言\n\n${TABLE}\n\n后记`;
    const view = mount(doc, doc.indexOf('\n\n后记') + 1);
    expect(view.dom.querySelector('.cm-wy-table')).not.toBeNull();

    pressArrow(view, 'ArrowUp');

    expect(view.state.selection.main.head).toBe(doc.indexOf('\n\n后记'));
    expect(view.dom.querySelector('.cm-wy-table')).toBeNull();
  });

  it('点渲染出来的表格：光标进表格，整块回源码', () => {
    const doc = `前言\n\n${TABLE}\n\n后记`;
    const view = mount(doc, 0);
    const table = view.dom.querySelector('.cm-wy-table');
    expect(table).not.toBeNull();

    table?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));

    expect(view.state.selection.main.head).toBe(doc.indexOf('| 章节'));
    expect(view.dom.querySelector('.cm-wy-table')).toBeNull();
  });

  it('远离表格时方向键仍是普通移动', () => {
    const doc = `第一行\n第二行\n第三行`;
    const view = mount(doc, 0);

    pressArrow(view, 'ArrowDown');

    // 普通移动：只要没有跳到别处，光标仍在第一/第二行内。
    expect(view.state.selection.main.head).toBeLessThan(doc.indexOf('第三行'));
  });
});
