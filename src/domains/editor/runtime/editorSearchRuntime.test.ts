import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { search } from '@codemirror/search';
import { describe, expect, it } from 'vitest';
import type { SearchParams } from '../components/SearchPanel';
import { createHiddenSearchPanel } from '../extensions/search';
import {
  execEditorSearch,
  restoreEditorSearch,
} from './editorSearchRuntime';

function createSearchParams(overrides: Partial<SearchParams> = {}): SearchParams {
  return {
    query: 'alpha',
    replaceWith: 'beta',
    matchCase: false,
    regexp: false,
    wholeWord: false,
    ...overrides,
  };
}

function createView(doc: string) {
  const parent = document.createElement('div');
  document.body.appendChild(parent);
  const view = new EditorView({
    parent,
    state: EditorState.create({
      doc,
      extensions: [
        search({
          createPanel: createHiddenSearchPanel,
        }),
        EditorState.allowMultipleSelections.of(true),
      ],
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

function selectedText(view: EditorView) {
  const selection = view.state.selection.main;
  return view.state.doc.sliceString(selection.from, selection.to);
}

describe('editorSearchRuntime', () => {
  it('executes input and next search actions through CodeMirror search', () => {
    const { view, destroy } = createView('alpha beta alpha');
    try {
      execEditorSearch(view, 'input', createSearchParams());
      expect(selectedText(view)).toBe('alpha');
      expect(view.state.selection.main.from).toBe(0);

      execEditorSearch(view, 'next', createSearchParams());
      expect(selectedText(view)).toBe('alpha');
      expect(view.state.selection.main.from).toBe(11);
    } finally {
      destroy();
    }
  });

  it('replaces one match and keeps the next match selected', () => {
    const { view, destroy } = createView('alpha alpha');
    try {
      execEditorSearch(view, 'input', createSearchParams());
      execEditorSearch(view, 'replace', createSearchParams());

      expect(view.state.doc.toString()).toBe('beta alpha');
      expect(selectedText(view)).toBe('alpha');
      expect(view.state.selection.main.from).toBe(5);
    } finally {
      destroy();
    }
  });

  it('replaces all matches with the active query', () => {
    const { view, destroy } = createView('alpha gamma alpha');
    try {
      execEditorSearch(view, 'replaceAll', createSearchParams());
      expect(view.state.doc.toString()).toBe('beta gamma beta');
    } finally {
      destroy();
    }
  });

  it('restores the previous search match position', () => {
    const { view, destroy } = createView('alpha beta alpha gamma alpha');
    try {
      restoreEditorSearch(view, createSearchParams(), 2);
      expect(selectedText(view)).toBe('alpha');
      expect(view.state.selection.main.from).toBe(11);
    } finally {
      destroy();
    }
  });
});
