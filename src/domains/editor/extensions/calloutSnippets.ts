import type { CalloutKind } from './callouts';
import type { SourceBlockOperation } from './blockOperations';

export const EDITOR_CALLOUT_KINDS = ['note', 'warning', 'tip', 'important'] as const satisfies readonly CalloutKind[];

const CALLOUT_MARKER_BY_KIND: Record<CalloutKind, string> = {
  note: 'NOTE',
  warning: 'WARNING',
  tip: 'TIP',
  important: 'IMPORTANT',
};

const CALLOUT_PLACEHOLDER_BY_KIND: Record<CalloutKind, string> = {
  note: '内容',
  warning: '需要注意的内容',
  tip: '建议或技巧',
  important: '重要内容',
};

const SELECTION_CALLOUT_OPERATION_BY_KIND: Record<CalloutKind, SourceBlockOperation> = {
  note: 'selectionCalloutNote',
  warning: 'selectionCalloutWarning',
  tip: 'selectionCalloutTip',
  important: 'selectionCalloutImportant',
};

export function isEditorCalloutKind(value: unknown): value is CalloutKind {
  return typeof value === 'string' && EDITOR_CALLOUT_KINDS.includes(value as CalloutKind);
}

export function getCalloutSnippet(kind: CalloutKind) {
  const marker = CALLOUT_MARKER_BY_KIND[kind];
  const placeholder = CALLOUT_PLACEHOLDER_BY_KIND[kind];
  const insert = `> [!${marker}]\n> ${placeholder}\n`;
  const selectionStart = insert.indexOf(placeholder);

  return {
    insert,
    selectionEnd: selectionStart + placeholder.length,
    selectionStart,
  };
}

export function getSelectionCalloutOperation(kind: CalloutKind): SourceBlockOperation {
  return SELECTION_CALLOUT_OPERATION_BY_KIND[kind];
}
