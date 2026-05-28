import type { EditorView } from '@codemirror/view';
import { findMarkdownTableBlock } from '../extensions/tables';

export interface EditorTableToolbarState {
  visible: boolean;
  x: number;
  y: number;
}

export const HIDDEN_TABLE_TOOLBAR_STATE: EditorTableToolbarState = {
  visible: false,
  x: 16,
  y: 16,
};

export function getEditorTableToolbarState(
  view: EditorView,
  host: HTMLElement | null,
): EditorTableToolbarState {
  const selection = view.state.selection.main;
  if (selection.from !== selection.to) return HIDDEN_TABLE_TOOLBAR_STATE;

  const block = findMarkdownTableBlock(view.state.doc.toString(), selection.head);
  if (!block) return HIDDEN_TABLE_TOOLBAR_STATE;

  if (!host) {
    return { visible: true, x: 16, y: 16 };
  }

  const hostRect = host.getBoundingClientRect();
  const coords = view.coordsAtPos(selection.head) ?? view.coordsAtPos(block.from);
  if (!hostRect || !coords) {
    return { visible: true, x: 16, y: 16 };
  }

  const toolbarWidth = 560;
  const x = Math.max(12, Math.min(coords.left - hostRect.left - 12, hostRect.width - toolbarWidth - 12));
  const y = Math.max(12, coords.top - hostRect.top - 44);

  return { visible: true, x, y };
}
