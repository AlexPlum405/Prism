import { foldable } from '@codemirror/language';
import type { EditorView } from '@codemirror/view';

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
