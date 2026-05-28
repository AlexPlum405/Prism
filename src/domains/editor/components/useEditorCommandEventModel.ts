import { useCallback, useEffect, type RefObject } from 'react';
import type { EditorView } from '@codemirror/view';
import { isCommandId } from '../../commands';
import {
  isSourceBlockOperation,
  type SourceBlockOperation,
} from '../extensions/blockOperations';
import type { EditorFormat } from '../extensions/formatting';
import type {
  MarkdownTableCommand,
  MarkdownTableInsertOptions,
} from '../extensions/tables';
import {
  applyBlockFormatCommand,
  applyHeadingLevel,
} from '../runtime/editorBlockCommands';
import { runBasicEditorCommand } from '../runtime/editorCommandAdapter';
import { EDITOR_TABLE_COMMANDS } from '../runtime/editorTableRuntime';
import { emitAppEvent, onAppEvent } from '../../../platform/events/appEvents';

type EditorCommandDetail = ({ command?: string } & Record<string, unknown>) | null | undefined;
type EditorCommandRecord = Record<string, unknown>;

interface UseEditorCommandEventModelInput {
  viewRef: RefObject<EditorView | null>;
  handleFormat: (format: EditorFormat) => void;
  handleFoldCurrentHeading: () => boolean;
  handleSelectTable: () => boolean;
  handleSourceBlockOperation: (operation: SourceBlockOperation) => boolean;
  handleTableCommand: (command: MarkdownTableCommand, options?: MarkdownTableInsertOptions) => boolean;
  handleTableConvert: (target: 'html' | 'markdown') => boolean;
  handleTableCopy: (format: 'markdown' | 'html' | 'csv' | 'tsv') => Promise<boolean>;
  handleTablePasteText: (view: EditorView, text: string) => boolean;
  handleTemplateInsert: (templateId: unknown) => boolean;
  handleCustomEditorCommand?: (
    command: string,
    detail: EditorCommandRecord,
    view: EditorView,
  ) => boolean;
  setTableInsertVisible: (visible: boolean) => void;
}

function toCommandRecord(detail: EditorCommandDetail): EditorCommandRecord {
  return detail && typeof detail === 'object' ? detail : {};
}

export function useEditorCommandEventModel({
  viewRef,
  handleFormat,
  handleFoldCurrentHeading,
  handleSelectTable,
  handleSourceBlockOperation,
  handleTableCommand,
  handleTableConvert,
  handleTableCopy,
  handleTablePasteText,
  handleTemplateInsert,
  handleCustomEditorCommand,
  setTableInsertVisible,
}: UseEditorCommandEventModelInput) {
  const handleEditorContextMenuAction = useCallback(async (action: string) => {
    const view = viewRef.current;
    if (!view) return;

    if (isCommandId(action)) {
      emitAppEvent('command.run', { action });
    }

    view.focus();
  }, [viewRef]);

  useEffect(() => {
    const onFormat = (detail: { format?: string } | null | undefined) => {
      if (detail?.format) handleFormat(detail.format as EditorFormat);
    };
    const onHeading = (detail: { level?: string } | null | undefined) => {
      const view = viewRef.current;
      if (!view) return;
      const levelValue = typeof detail?.level === 'string' ? detail.level : '';
      applyHeadingLevel(view, levelValue);
    };
    const onBlock = (detail: { format?: string } | null | undefined) => {
      const view = viewRef.current;
      if (!view) return;
      const fmt = typeof detail?.format === 'string' ? detail.format : '';
      applyBlockFormatCommand(view, fmt, handleSourceBlockOperation);
    };

    const onEditorCommand = (detail: EditorCommandDetail) => {
      const view = viewRef.current;
      if (!view) return;
      const command = typeof detail?.command === 'string' ? detail.command : '';
      if (!command) return;

      if (isSourceBlockOperation(command)) {
        handleSourceBlockOperation(command);
        return;
      }

      const tableCommand = EDITOR_TABLE_COMMANDS[command];
      if (tableCommand) {
        handleTableCommand(tableCommand);
        return;
      }

      if (runBasicEditorCommand(command, view, { handleTablePasteText })) return;

      const commandDetail = toCommandRecord(detail);
      if (handleCustomEditorCommand?.(command, commandDetail, view)) return;

      switch (command) {
        case 'insertTable':
          if (commandDetail.options && typeof commandDetail.options === 'object') {
            handleTableCommand('insert', commandDetail.options as MarkdownTableInsertOptions);
          } else {
            setTableInsertVisible(true);
          }
          break;
        case 'selectTable':
          handleSelectTable();
          break;
        case 'copyTableMarkdown':
          void handleTableCopy('markdown');
          break;
        case 'copyTableHtml':
          void handleTableCopy('html');
          break;
        case 'copyTableCsv':
          void handleTableCopy('csv');
          break;
        case 'copyTableTsv':
          void handleTableCopy('tsv');
          break;
        case 'convertTableToHtml':
          handleTableConvert('html');
          break;
        case 'convertHtmlTableToMarkdown':
          handleTableConvert('markdown');
          break;
        case 'insertTemplate':
          handleTemplateInsert(commandDetail.templateId);
          break;
        case 'foldCurrentHeading':
          handleFoldCurrentHeading();
          break;
      }
    };

    const unsubscribeFormat = onAppEvent('editor.format', onFormat);
    const unsubscribeHeading = onAppEvent('editor.heading', onHeading);
    const unsubscribeBlock = onAppEvent('editor.blockFormat', onBlock);
    const unsubscribeEditorCommand = onAppEvent('editor.command', onEditorCommand);

    return () => {
      unsubscribeFormat();
      unsubscribeHeading();
      unsubscribeBlock();
      unsubscribeEditorCommand();
    };
  }, [
    handleCustomEditorCommand,
    handleFoldCurrentHeading,
    handleFormat,
    handleSelectTable,
    handleSourceBlockOperation,
    handleTableCommand,
    handleTableConvert,
    handleTableCopy,
    handleTablePasteText,
    handleTemplateInsert,
    setTableInsertVisible,
    viewRef,
  ]);

  return {
    handleEditorContextMenuAction,
  };
}
