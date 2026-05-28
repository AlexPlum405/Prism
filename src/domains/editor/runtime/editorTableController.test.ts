import { describe, expect, it } from 'vitest';
import { EditorSelection } from '@codemirror/state';
import { createEditorRuntime } from './createEditorRuntime';
import {
  HIDDEN_TABLE_TOOLBAR_STATE,
  getEditorTableToolbarState,
} from './editorTableController';

describe('editorTableController', () => {
  it('shows fallback toolbar coordinates when the cursor is inside a markdown table', () => {
    const parent = document.createElement('div');
    const view = createEditorRuntime({
      doc: '| Name | Value |\n| --- | --- |\n| Prism | 1 |',
      extensions: [],
      parent,
    });

    view.dispatch({ selection: EditorSelection.cursor(3) });

    expect(getEditorTableToolbarState(view, null)).toEqual({
      visible: true,
      x: 16,
      y: 16,
    });

    view.destroy();
  });

  it('hides the toolbar outside tables and for ranged selections', () => {
    const parent = document.createElement('div');
    const view = createEditorRuntime({
      doc: 'plain text\n\n| A | B |\n| - | - |',
      extensions: [],
      parent,
    });

    view.dispatch({ selection: EditorSelection.cursor(2) });
    expect(getEditorTableToolbarState(view, null)).toEqual(HIDDEN_TABLE_TOOLBAR_STATE);

    view.dispatch({ selection: EditorSelection.range(14, 19) });
    expect(getEditorTableToolbarState(view, null)).toEqual(HIDDEN_TABLE_TOOLBAR_STATE);

    view.destroy();
  });
});
