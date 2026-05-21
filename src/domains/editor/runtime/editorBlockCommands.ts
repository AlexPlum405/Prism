import type { EditorView } from '@codemirror/view';
import type { SourceBlockOperation } from '../extensions/blockOperations';

export function applyHeadingLevel(view: EditorView, levelValue: string) {
  if (!/^h[1-6]$/.test(levelValue)) return false;
  const level = Number(levelValue.slice(1));
  const prefix = '#'.repeat(level) + ' ';
  const cursor = view.state.selection.main.head;
  const line = view.state.doc.lineAt(cursor);
  const lineText = view.state.doc.sliceString(line.from, line.to);
  const stripped = lineText.replace(/^#{1,6}\s*/, '');
  view.dispatch({
    changes: { from: line.from, to: line.to, insert: prefix + stripped },
  });
  view.focus();
  return true;
}

export function applyBlockFormatCommand(
  view: EditorView,
  format: string,
  handleSourceBlockOperation: (operation: SourceBlockOperation) => boolean,
) {
  if (!format) return false;
  const cursor = view.state.selection.main.head;
  const line = view.state.doc.lineAt(cursor);
  const lineText = view.state.doc.sliceString(line.from, line.to);

  if (format === 'paragraph') {
    const stripped = lineText.replace(/^#{1,6}\s*/, '');
    view.dispatch({ changes: { from: line.from, to: line.to, insert: stripped } });
    view.focus();
    return true;
  }

  if (format === 'increaseHeading') {
    const match = lineText.match(/^(#{1,6})\s/);
    if (match && match[1].length < 6) {
      view.dispatch({ changes: { from: line.from, to: line.to, insert: '#' + lineText } });
    } else if (!match) {
      view.dispatch({ changes: { from: line.from, insert: '# ' } });
    }
    view.focus();
    return true;
  }

  if (format === 'decreaseHeading') {
    const match = lineText.match(/^(#{1,6})\s/);
    if (match && match[1].length > 1) {
      view.dispatch({ changes: { from: line.from, to: line.to, insert: lineText.slice(1) } });
    } else if (match && match[1].length === 1) {
      view.dispatch({ changes: { from: line.from, to: line.to, insert: lineText.replace(/^#\s*/, '') } });
    }
    view.focus();
    return true;
  }

  const selectionBlockOperationMap: Partial<Record<string, SourceBlockOperation>> = {
    quote: 'selectionQuote',
    orderedList: 'selectionOrderedList',
    unorderedList: 'selectionUnorderedList',
    taskList: 'selectionTaskList',
  };
  const selectionOperation = selectionBlockOperationMap[format];
  if (selectionOperation) {
    return handleSourceBlockOperation(selectionOperation);
  }

  if (format === 'insertAbove') {
    view.dispatch({ changes: { from: line.from, insert: '\n' } });
    view.dispatch({ selection: { anchor: line.from } });
    view.focus();
    return true;
  }
  if (format === 'insertBelow') {
    view.dispatch({ changes: { from: line.to, insert: '\n' } });
    view.dispatch({ selection: { anchor: line.to + 1 } });
    view.focus();
    return true;
  }

  const prefixMap: Record<string, string> = {
    quote: '> ',
    codeBlock: '```\n',
    orderedList: '1. ',
    unorderedList: '- ',
    taskList: '- [ ] ',
    hr: '\n---\n',
    mathBlock: '$$\n',
    toc: '[TOC]\n',
    yaml: '---\n',
    linkReference: '[text][ref]\n\n[ref]: url',
    footnote: '[^1]\n\n[^1]: ',
    comment: '<!-- ',
  };

  const suffixMap: Record<string, string> = {
    codeBlock: '\n```',
    mathBlock: '\n$$',
    yaml: '\n---',
    comment: ' -->',
  };

  const prefix = prefixMap[format] || '';
  const suffix = suffixMap[format] || '';
  if (!prefix && !suffix) return false;

  view.dispatch({
    changes: { from: line.from, insert: prefix },
  });
  if (suffix) {
    const newLine = view.state.doc.lineAt(cursor + prefix.length);
    view.dispatch({
      changes: { from: newLine.to, insert: suffix },
    });
  }
  view.focus();
  return true;
}
