import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { EditorSelection } from '@codemirror/state';
import { createEditorRuntime } from '../runtime/createEditorRuntime';
import { useEditorActionModel } from './useEditorActionModel';

function createEditorView(doc: string) {
  const parent = document.createElement('div');
  const view = createEditorRuntime({
    doc,
    extensions: [],
    parent,
  });

  return view;
}

describe('useEditorActionModel', () => {
  it('applies inline formatting against the current editor selection', () => {
    const view = createEditorView('Prism');
    view.dispatch({ selection: EditorSelection.range(0, view.state.doc.length) });
    const viewRef = { current: view };

    const { result } = renderHook(() => useEditorActionModel({ viewRef }));

    act(() => {
      result.current.handleFormat('bold');
    });

    expect(view.state.doc.toString()).toBe('**Prism**');
    view.destroy();
  });

  it('inserts markdown templates through the source editor', () => {
    const view = createEditorView('Intro paragraph.');
    const viewRef = { current: view };

    const { result } = renderHook(() => useEditorActionModel({ viewRef }));

    act(() => {
      expect(result.current.handleTemplateInsert('prd')).toBe(true);
    });

    expect(view.state.doc.toString()).toContain('# PRD：未命名');
    expect(view.state.doc.toString()).toContain('Intro paragraph.');
    view.destroy();
  });

  it('runs source block operations without a WYSIWYG layer', () => {
    const view = createEditorView('Follow up');
    view.dispatch({ selection: EditorSelection.range(0, view.state.doc.length) });
    const viewRef = { current: view };

    const { result } = renderHook(() => useEditorActionModel({ viewRef }));

    act(() => {
      expect(result.current.handleSourceBlockOperation('selectionTaskList')).toBe(true);
    });

    expect(view.state.doc.toString()).toBe('- [ ] Follow up');
    view.destroy();
  });
});
