import { useCallback, type RefObject } from 'react';
import { foldEffect } from '@codemirror/language';
import type { EditorView } from '@codemirror/view';
import {
  getSourceBlockOperationEdit,
  type SourceBlockOperation,
} from '../extensions/blockOperations';
import { getEditorFormatResult, type EditorFormat } from '../extensions/formatting';
import {
  getMarkdownTemplateInsertEdit,
  isMarkdownTemplateId,
} from '../extensions/templates';
import { getCurrentHeadingFoldRange } from '../runtime/editorCommandAdapter';

interface UseEditorActionModelInput {
  viewRef: RefObject<EditorView | null>;
}

export function useEditorActionModel({ viewRef }: UseEditorActionModelInput) {
  const handleFormat = useCallback(
    (format: EditorFormat) => {
      const view = viewRef.current;
      if (!view) return;

      const selection = view.state.selection.main;
      const result = getEditorFormatResult(
        view.state.doc.toString(),
        selection.from,
        selection.to,
        format,
      );

      view.dispatch({
        changes: {
          from: result.from,
          to: result.to,
          insert: result.insert,
        },
        selection: { anchor: result.selectionFrom, head: result.selectionTo },
      });

      view.focus();
    },
    [viewRef],
  );

  const handleTemplateInsert = useCallback((templateId: unknown) => {
    const view = viewRef.current;
    if (!view || !isMarkdownTemplateId(templateId)) return false;

    const selection = view.state.selection.main;
    const result = getMarkdownTemplateInsertEdit(
      view.state.doc.toString(),
      selection.from,
      selection.to,
      templateId,
    );

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
    return true;
  }, [viewRef]);

  const handleSourceBlockOperation = useCallback((operation: SourceBlockOperation) => {
    const view = viewRef.current;
    if (!view) return false;

    const selection = view.state.selection.main;
    const result = getSourceBlockOperationEdit(
      view.state.doc.toString(),
      selection.from,
      selection.to,
      operation,
    );
    if (!result) return false;

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
    return true;
  }, [viewRef]);

  const handleFoldCurrentHeading = useCallback(() => {
    const view = viewRef.current;
    if (!view) return false;

    const range = getCurrentHeadingFoldRange(view);
    if (!range) return false;

    view.dispatch({ effects: foldEffect.of(range), scrollIntoView: true });
    view.focus();
    return true;
  }, [viewRef]);

  return {
    handleFoldCurrentHeading,
    handleFormat,
    handleSourceBlockOperation,
    handleTemplateInsert,
  };
}
