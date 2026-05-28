import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { EditorSelection } from '@codemirror/state';
import { createEditorRuntime } from '../runtime/createEditorRuntime';
import { useEditorTableModel } from './useEditorTableModel';

function createEditorView(doc: string) {
  const parent = document.createElement('div');
  const view = createEditorRuntime({
    doc,
    extensions: [],
    parent,
  });

  return { parent, view };
}

function splitCursor(doc: string) {
  const position = doc.indexOf('<cursor>');
  const source = doc.replace('<cursor>', '');
  return { position, source };
}

describe('useEditorTableModel', () => {
  it('runs table commands against the current editor view', () => {
    const { position, source } = splitCursor('| A | B<cursor> | C |\n| --- | --- | --- |\n| 1 | 2 | 3 |');
    const { view } = createEditorView(source);
    view.dispatch({ selection: EditorSelection.cursor(position) });
    const viewRef = { current: view };
    const editorRef = { current: null };

    const { result } = renderHook(() => useEditorTableModel({ editorRef, viewRef }));

    act(() => {
      expect(result.current.handleTableCommand('insertColumnRight')).toBe(true);
    });

    expect(view.state.doc.toString()).toContain('| A   | B   |     | C   |');
    view.destroy();
  });

  it('selects the current markdown table and hides the toolbar', () => {
    const { position, source } = splitCursor('before\n\n| A<cursor> | B |\n| --- | --- |\n| 1 | 2 |');
    const { view } = createEditorView(source);
    view.dispatch({ selection: EditorSelection.cursor(position) });
    const viewRef = { current: view };
    const editorRef = { current: null };

    const { result } = renderHook(() => useEditorTableModel({ editorRef, viewRef }));

    act(() => {
      expect(result.current.handleSelectTable()).toBe(true);
    });

    expect(view.state.selection.main.from).toBe('before\n\n'.length);
    expect(view.state.selection.main.to).toBe(view.state.doc.length);
    expect(result.current.tableToolbar.visible).toBe(false);
    view.destroy();
  });
});
