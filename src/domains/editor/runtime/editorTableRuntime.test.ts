import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { describe, expect, it } from 'vitest';
import {
  EDITOR_TABLE_COMMANDS,
  runMarkdownTableNavigation,
} from './editorTableRuntime';

function createView(doc: string, anchor: number) {
  const parent = document.createElement('div');
  document.body.appendChild(parent);
  const view = new EditorView({
    parent,
    state: EditorState.create({
      doc,
      selection: { anchor },
    }),
  });
  return {
    view,
    destroy: () => {
      view.destroy();
      parent.remove();
    },
  };
}

function splitCursor(source: string) {
  const position = source.indexOf('<cursor>');
  expect(position).toBeGreaterThanOrEqual(0);
  return {
    source: source.replace('<cursor>', ''),
    position,
  };
}

describe('editorTableRuntime', () => {
  it('keeps command ids mapped to markdown table commands', () => {
    expect(EDITOR_TABLE_COMMANDS.addTableColumn).toBe('addColumn');
    expect(EDITOR_TABLE_COMMANDS.insertTableRowBelow).toBe('insertRowBelow');
    expect(EDITOR_TABLE_COMMANDS.sortTableDesc).toBe('sortDesc');
  });

  it('applies table keyboard navigation edits to the editor view', () => {
    const { source, position } = splitCursor([
      '| A | B |',
      '| --- | --- |',
      '| 1<cursor> | 2 |',
    ].join('\n'));
    const { view, destroy } = createView(source, position);
    try {
      expect(runMarkdownTableNavigation(view, 'lineBreak')).toBe(true);
      expect(view.state.doc.toString()).toContain('| 1<br> | 2 |');
    } finally {
      destroy();
    }
  });

  it('ignores table navigation when the selection is not a cursor', () => {
    const { view, destroy } = createView('| A | B |\n| --- | --- |\n| 1 | 2 |', 0);
    try {
      view.dispatch({ selection: { anchor: 0, head: 3 } });
      expect(runMarkdownTableNavigation(view, 'nextCell')).toBe(false);
    } finally {
      destroy();
    }
  });
});
