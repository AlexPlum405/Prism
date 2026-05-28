import { useCallback, useState, type RefObject } from 'react';
import type { EditorView } from '@codemirror/view';
import {
  applyMarkdownTableEdit,
} from '../runtime/editorTableRuntime';
import {
  getEditorTableToolbarState,
  type EditorTableToolbarState,
} from '../runtime/editorTableController';
import {
  getHtmlTableToMarkdownEdit,
  getMarkdownTableCommandEdit,
  getMarkdownTablePasteEdit,
  getMarkdownTableSelection,
  getMarkdownTableSerialization,
  getMarkdownTableToHtmlEdit,
  type MarkdownTableCommand,
  type MarkdownTableInsertOptions,
} from '../extensions/tables';
import { writeRichClipboard } from '../extensions/richCopy';

interface UseEditorTableModelInput {
  editorRef: RefObject<HTMLElement | null>;
  viewRef: RefObject<EditorView | null>;
}

export function useEditorTableModel({
  editorRef,
  viewRef,
}: UseEditorTableModelInput) {
  const [tableInsertVisible, setTableInsertVisible] = useState(false);
  const [tableToolbar, setTableToolbar] = useState<EditorTableToolbarState>({
    visible: false,
    x: 16,
    y: 16,
  });

  const updateTableToolbar = useCallback((view: EditorView) => {
    const nextToolbar = getEditorTableToolbarState(view, editorRef.current);
    if (!nextToolbar.visible) {
      setTableToolbar((current) => current.visible ? { ...current, visible: false } : current);
      return;
    }

    setTableToolbar(nextToolbar);
  }, [editorRef]);

  const handleTableCommand = useCallback((command: MarkdownTableCommand, options?: MarkdownTableInsertOptions) => {
    const view = viewRef.current;
    if (!view) return false;

    const selection = view.state.selection.main;
    const result = getMarkdownTableCommandEdit(
      view.state.doc.toString(),
      selection.from,
      selection.to,
      command,
      options,
    );
    if (!result) return false;

    applyMarkdownTableEdit(view, result);
    updateTableToolbar(view);
    return true;
  }, [updateTableToolbar, viewRef]);

  const handleTableInsert = useCallback((options: MarkdownTableInsertOptions) => {
    setTableInsertVisible(false);
    handleTableCommand('insert', options);
  }, [handleTableCommand]);

  const handleSelectTable = useCallback(() => {
    const view = viewRef.current;
    if (!view) return false;
    const selection = getMarkdownTableSelection(view.state.doc.toString(), view.state.selection.main.head);
    if (!selection) return false;
    view.dispatch({
      selection: { anchor: selection.from, head: selection.to },
      scrollIntoView: true,
    });
    view.focus();
    setTableToolbar((current) => ({ ...current, visible: false }));
    return true;
  }, [viewRef]);

  const handleTableCopy = useCallback(async (format: 'markdown' | 'html' | 'csv' | 'tsv') => {
    const view = viewRef.current;
    if (!view) return false;
    const serialization = getMarkdownTableSerialization(view.state.doc.toString(), view.state.selection.main.head);
    if (!serialization) return false;

    if (format === 'html') {
      await writeRichClipboard({
        html: serialization.html,
        text: serialization.markdown,
      });
      return true;
    }

    await navigator.clipboard.writeText(serialization[format]);
    return true;
  }, [viewRef]);

  const handleTableConvert = useCallback((target: 'html' | 'markdown') => {
    const view = viewRef.current;
    if (!view) return false;
    const cursor = view.state.selection.main.head;
    const result = target === 'html'
      ? getMarkdownTableToHtmlEdit(view.state.doc.toString(), cursor)
      : getHtmlTableToMarkdownEdit(view.state.doc.toString(), cursor);
    if (!result) return false;
    applyMarkdownTableEdit(view, result);
    updateTableToolbar(view);
    return true;
  }, [updateTableToolbar, viewRef]);

  const handleTablePasteText = useCallback((view: EditorView, text: string) => {
    const selection = view.state.selection.main;
    const result = getMarkdownTablePasteEdit(
      view.state.doc.toString(),
      selection.from,
      selection.to,
      text,
    );
    if (!result) return false;
    applyMarkdownTableEdit(view, result);
    updateTableToolbar(view);
    return true;
  }, [updateTableToolbar]);

  return {
    handleSelectTable,
    handleTableCommand,
    handleTableConvert,
    handleTableCopy,
    handleTableInsert,
    handleTablePasteText,
    setTableInsertVisible,
    tableInsertVisible,
    tableToolbar,
    updateTableToolbar,
  };
}
