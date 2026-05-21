import type { EditorView } from '@codemirror/view';
import {
  getMarkdownTableNavigationEdit,
  type MarkdownTableCommand,
  type MarkdownTableCommandEdit,
  type MarkdownTableNavigation,
} from '../extensions/tables';

export const EDITOR_TABLE_COMMANDS: Partial<Record<string, MarkdownTableCommand>> = {
  addTableColumn: 'addColumn',
  addTableRow: 'addRow',
  alignTableColumnCenter: 'alignCenter',
  alignTableColumnLeft: 'alignLeft',
  alignTableColumnRight: 'alignRight',
  deleteTableColumn: 'deleteColumn',
  deleteTableRow: 'deleteRow',
  formatTable: 'format',
  insertTableColumnLeft: 'insertColumnLeft',
  insertTableColumnRight: 'insertColumnRight',
  insertTableRowAbove: 'insertRowAbove',
  insertTableRowBelow: 'insertRowBelow',
  moveTableColumnLeft: 'moveColumnLeft',
  moveTableColumnRight: 'moveColumnRight',
  moveTableRowDown: 'moveRowDown',
  moveTableRowUp: 'moveRowUp',
  sortTableAsc: 'sortAsc',
  sortTableDesc: 'sortDesc',
};

export function applyMarkdownTableEdit(view: EditorView, result: MarkdownTableCommandEdit) {
  view.dispatch({
    changes: {
      from: result.from,
      to: result.to,
      insert: result.insert,
    },
    selection: { anchor: result.selectionFrom, head: result.selectionTo },
    scrollIntoView: true,
  });
  view.focus();
}

export function runMarkdownTableNavigation(view: EditorView, navigation: MarkdownTableNavigation) {
  const selection = view.state.selection.main;
  if (selection.from !== selection.to) return false;
  const result = getMarkdownTableNavigationEdit(
    view.state.doc.toString(),
    selection.head,
    navigation,
  );
  if (!result) return false;
  applyMarkdownTableEdit(view, result);
  return true;
}
