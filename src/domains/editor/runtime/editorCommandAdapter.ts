import { redo, undo } from '@codemirror/commands';
import { foldable } from '@codemirror/language';
import type { EditorView } from '@codemirror/view';
import { markdownSelectionToRichClipboardInput, writeRichClipboard } from '../extensions/richCopy';

interface BasicEditorCommandDeps {
  handleTablePasteText: (view: EditorView, text: string) => boolean;
}

export function getCurrentHeadingFoldRange(view: EditorView) {
  let line = view.state.doc.lineAt(view.state.selection.main.head);

  while (line.number >= 1) {
    if (/^#{1,6}\s+\S/.test(line.text)) {
      return foldable(view.state, line.from, line.to);
    }
    if (line.number === 1) break;
    line = view.state.doc.line(line.number - 1);
  }

  return null;
}

export function runBasicEditorCommand(
  command: string,
  view: EditorView,
  deps: BasicEditorCommandDeps,
) {
  switch (command) {
    case 'undo':
      undo(view);
      return true;
    case 'redo':
      redo(view);
      return true;
    case 'cut':
      document.execCommand('cut');
      return true;
    case 'copy':
    case 'copyMd':
    case 'copyPlain': {
      const selection = view.state.selection.main;
      const text = view.state.doc.sliceString(selection.from, selection.to);
      if (text) void navigator.clipboard.writeText(text);
      return true;
    }
    case 'copyHtml': {
      const selection = view.state.selection.main;
      const text = view.state.doc.sliceString(selection.from, selection.to);
      if (text) {
        void markdownSelectionToRichClipboardInput(text).then(writeRichClipboard);
      }
      return true;
    }
    case 'selectAll':
      view.dispatch({ selection: { anchor: 0, head: view.state.doc.length } });
      return true;
    case 'paste':
    case 'pastePlain':
      void navigator.clipboard.readText().then((text) => {
        if (deps.handleTablePasteText(view, text)) return;
        view.dispatch({
          changes: { from: view.state.selection.main.from, to: view.state.selection.main.to, insert: text },
        });
      });
      return true;
    case 'clearFormat': {
      const selection = view.state.selection.main;
      const raw = view.state.doc.sliceString(selection.from, selection.to);
      const cleaned = raw.replace(/[*_~`<>[\]()#]/g, '');
      view.dispatch({ changes: { from: selection.from, to: selection.to, insert: cleaned } });
      return true;
    }
    case 'comment': {
      const selection = view.state.selection.main;
      const raw = view.state.doc.sliceString(selection.from, selection.to);
      view.dispatch({ changes: { from: selection.from, to: selection.to, insert: `<!-- ${raw} -->` } });
      return true;
    }
    default:
      return false;
  }
}
