import { SearchQuery, findNext, findPrevious, replaceAll, replaceNext, selectMatches, setSearchQuery } from '@codemirror/search';
import type { EditorView } from '@codemirror/view';
import type { SearchAction, SearchParams } from '../components/SearchPanel';
import { ensureSearchHighlighterEnabled } from '../extensions/search';

function createEditorSearchQuery(params: SearchParams) {
  return new SearchQuery({
    search: params.query,
    caseSensitive: params.matchCase,
    regexp: params.regexp,
    wholeWord: params.wholeWord,
    replace: params.replaceWith,
  });
}

function setEditorSearchQuery(view: EditorView, params: SearchParams, resetSelection = false) {
  view.dispatch({
    ...(resetSelection ? { selection: { anchor: 0 } } : {}),
    effects: setSearchQuery.of(createEditorSearchQuery(params)),
  });
}

export function execEditorSearch(view: EditorView, action: SearchAction, params: SearchParams) {
  ensureSearchHighlighterEnabled(view);
  setEditorSearchQuery(view, params);

  switch (action) {
    case 'input':
      if (params.query) {
        view.dispatch({ selection: { anchor: 0 } });
        findNext(view);
      }
      break;
    case 'next':
      findNext(view);
      break;
    case 'prev':
      findPrevious(view);
      break;
    case 'all':
      selectMatches(view);
      break;
    case 'replace': {
      const beforeDoc = view.state.doc.toString();
      const handled = replaceNext(view);
      if (handled && params.query && view.state.doc.toString() !== beforeDoc) {
        findNext(view);
      }
      break;
    }
    case 'replaceAll':
      replaceAll(view);
      break;
  }
}

export function restoreEditorSearch(view: EditorView, params: SearchParams, currentMatch: number) {
  ensureSearchHighlighterEnabled(view);
  setEditorSearchQuery(view, params, true);

  if (!params.query || currentMatch <= 0) return;

  for (let index = 0; index < currentMatch; index += 1) {
    findNext(view);
  }
}
