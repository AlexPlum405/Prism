import { describe, expect, it } from 'vitest';
import { EditorState } from '@codemirror/state';
import { markdown } from '@codemirror/lang-markdown';
import { GFM } from '@lezer/markdown';
import { collectWysiwygPlan, parseWysiwygTable, tableEntryAnchor } from './wysiwygPreview';

function planFor(doc: string, cursorLine = 99) {
  const state = EditorState.create({ doc, extensions: [markdown({ extensions: [GFM] })] });
  const lineNumber = Math.min(cursorLine, state.doc.lines);
  const plan = collectWysiwygPlan(state, new Set([lineNumber]));
  return {
    state,
    doc,
    plan,
    hidden: plan.inline
      .filter((range) => range.kind === 'hidden')
      .map((range) => doc.slice(range.from, range.to)),
    lineClasses: plan.lines.map((line) => ({
      text: doc.slice(line.from, doc.indexOf('\n', line.from) === -1 ? doc.length : doc.indexOf('\n', line.from)),
      className: line.className,
    })),
    widgets: plan.inline.filter((range) => range.kind !== 'hidden'),
  };
}

describe('collectWysiwygPlan', () => {
  it('把标题标记连后面的空格一起隐藏，并标出行级标题类', () => {
    const { hidden, lineClasses } = planFor('## 标题\n\n正文', 3);
    expect(hidden).toEqual(['## ']);
    expect(lineClasses).toContainEqual({ text: '## 标题', className: 'cm-wy-h2' });
  });

  it('光标所在行保留源码', () => {
    const { hidden, lineClasses } = planFor('## 标题', 1);
    expect(hidden).toEqual([]);
    expect(lineClasses).toContainEqual({ text: '## 标题', className: 'cm-wy-h2' });
  });

  it('行内标记只隐藏标记本身，不吃掉后面的空格', () => {
    const { hidden } = planFor('\n一段 **粗** 和 *斜* 以及 ~~删~~ 和 `码`\n', 3);
    expect(hidden.sort()).toEqual(['*', '*', '**', '**', '`', '`', '~~', '~~'].sort());
  });

  it('链接只留文字，标记与 URL 全隐藏', () => {
    const { hidden, doc } = planFor('\n[链](https://a.b) 后文\n', 3);
    expect(hidden).toEqual(['[', '](https://a.b)']);
    expect(doc.includes('https://a.b')).toBe(true);
  });

  it('图片在非光标行换成包含 src 与 alt 的图片块', () => {
    const { widgets } = planFor('\n![示意图](assets/a.png)\n', 3);
    expect(widgets).toHaveLength(1);
    expect(widgets[0]).toMatchObject({
      kind: 'image',
      src: 'assets/a.png',
      alt: '示意图',
    });
  });

  it('图片尺寸属性会带进图片块', () => {
    const { widgets } = planFor('\n![图](a.png){width=320}\n', 3);
    expect(widgets[0]?.width).toBe('320px');
  });

  it('光标在图片行时保留源码，不换图片', () => {
    const { widgets } = planFor('![图](a.png)', 1);
    expect(widgets).toEqual([]);
  });

  it('分隔线换成一条真实横线', () => {
    const { widgets } = planFor('\n---\n', 3);
    expect(widgets[0]).toMatchObject({ kind: 'rule' });
  });

  it('无序列表换成圆点', () => {
    const plain = planFor('\n- 列表项\n', 3);
    expect(plain.widgets[0]).toMatchObject({ kind: 'bullet', text: '•' });
  });

  it('任务列表把 `- ` 收掉，方括号换成勾选状态正确的复选框', () => {
    const done = planFor('\n- [x] 已完成\n- [ ] 未完成\n', 4);
    expect(done.hidden).toEqual(['- ', '- ']);
    expect(done.widgets).toEqual([
      expect.objectContaining({ kind: 'checkbox', checked: true }),
      expect.objectContaining({ kind: 'checkbox', checked: false }),
    ]);
    expect(done.widgets.some((range) => range.kind === 'bullet')).toBe(false);
  });

  it('有序任务列表同样换成复选框，不叠编号对齐类', () => {
    const { hidden, widgets, lineClasses } = planFor('\n1. [ ] 第一步\n', 3);
    expect(hidden).toEqual(['1. ']);
    expect(widgets).toEqual([expect.objectContaining({ kind: 'checkbox', checked: false })]);
    expect(lineClasses.some((line) => line.className === 'cm-wy-ordered')).toBe(false);
  });

  it('代码围栏行收成细边并隐藏，内容行带代码块底色', () => {
    const { hidden, lineClasses } = planFor('```ts\nconst a = 1;\n```', 2);
    expect(hidden.sort()).toEqual(['```', '```ts'].sort());
    expect(lineClasses.map((line) => line.className).join('|')).toContain('cm-wy-code');
    expect(lineClasses.some((line) => line.className.includes('cm-wy-fence'))).toBe(true);
  });

  it('光标在围栏行时保留那一行围栏，方便改语言', () => {
    const { hidden } = planFor('```ts\nconst a = 1;\n```', 1);
    expect(hidden).toEqual(['```']);
  });

  it('引用的 > 隐藏，行上带引用类', () => {
    const { hidden, lineClasses } = planFor('> 引用正文\n\n正文', 3);
    expect(hidden).toEqual(['> ']);
    expect(lineClasses.some((line) => line.className === 'cm-wy-quote')).toBe(true);
  });

  const TABLE = [
    '| 章节 | 字数 | 状态 |',
    '| :--- | ---: | :---: |',
    '| 第一章 | 1200 | 完成 |',
    '| 第二章 | 900 | 草稿 |',
  ].join('\n');

  it('表格整块换成表头/对齐/数据行齐全的表格块', () => {
    const { widgets, hidden } = planFor(`\n${TABLE}\n`, 6);
    expect(hidden).toEqual([]);
    expect(widgets).toHaveLength(1);
    expect(widgets[0]).toMatchObject({
      kind: 'table',
      table: {
        align: ['left', 'right', 'center'],
        header: ['章节', '字数', '状态'],
        rows: [['第一章', '1200', '完成'], ['第二章', '900', '草稿']],
      },
    });
  });

  it('表格块覆盖整块源码，且不碰首尾之外的字符', () => {
    const { state, widgets } = planFor(`前言\n\n${TABLE}\n\n后记`, 9);
    const range = widgets[0];
    expect(range && state.doc.sliceString(range.from, range.to)).toBe(TABLE);
  });

  it('光标进表格就整块回源码，方便用管道符改单元格', () => {
    const { widgets } = planFor(`\n${TABLE}\n`, 3);
    expect(widgets.filter((range) => range.kind === 'table')).toEqual([]);
  });

  it('单元格里的 | 可以转义，列数不齐时补齐成矩形', () => {
    const table = parseWysiwygTable('| a | b |\n| --- | --- |\n| 1 \\| 2 |\n| 3 | 4 | 多余 |');
    expect(table?.header).toEqual(['a', 'b']);
    expect(table?.rows).toEqual([['1 | 2', ''], ['3', '4']]);
  });

  it('分隔行不是合法表格时不当表格处理', () => {
    expect(parseWysiwygTable('| a | b |\n| nope | --- |\n| 1 | 2 |')).toBeNull();
  });

  it('方向键走到表格边界时把光标送进表格，其余位置不接管', () => {
    const doc = `前言\n\n${TABLE}\n\n后记`;
    const make = (lineNumber: number) => {
      const base = EditorState.create({
        doc,
        selection: { anchor: doc.split('\n').slice(0, lineNumber - 1).join('\n').length + (lineNumber > 1 ? 1 : 0) },
        extensions: [markdown({ extensions: [GFM] })],
      });
      return base;
    };

    const tableStart = doc.indexOf('| 章节');
    const tableEnd = doc.indexOf('\n\n后记');

    // 表格上方按向下：落进第一行
    expect(tableEntryAnchor(make(2), 'down')).toBe(tableStart);
    // 表格下方按向上：落到最后一行的行尾
    expect(tableEntryAnchor(make(7), 'up')).toBe(tableEnd);
    // 离表格还远：不接管
    expect(tableEntryAnchor(make(1), 'down')).toBeNull();
    expect(tableEntryAnchor(make(2), 'up')).toBeNull();
  });
});
