import type { EditorView } from '@codemirror/view';

export interface SelectionFloatingToolbarState {
  visible: boolean;
  x: number;
  y: number;
}

export const HIDDEN_SELECTION_TOOLBAR: SelectionFloatingToolbarState = {
  visible: false,
  x: 0,
  y: 0,
};

interface SelectionFloatingToolbarOptions {
  gap?: number;
  padding?: number;
  toolbarHeight?: number;
  toolbarWidth?: number;
}

function clamp(value: number, min: number, max: number) {
  if (max < min) return min;
  return Math.min(Math.max(value, min), max);
}

export function getSelectionFloatingToolbarState(
  view: EditorView,
  host: HTMLElement | null,
  options: SelectionFloatingToolbarOptions = {},
): SelectionFloatingToolbarState {
  const selection = view.state.selection;
  if (selection.ranges.length !== 1 || selection.main.empty || !host) {
    return HIDDEN_SELECTION_TOOLBAR;
  }

  const anchorCoords = view.coordsAtPos(selection.main.from) ?? view.coordsAtPos(selection.main.head);
  if (!anchorCoords) return HIDDEN_SELECTION_TOOLBAR;

  const focusCoords = view.coordsAtPos(selection.main.to) ?? anchorCoords;
  const hostRect = host.getBoundingClientRect();
  const padding = options.padding ?? 8;
  const gap = options.gap ?? 8;
  const toolbarWidth = options.toolbarWidth ?? 288;
  const toolbarHeight = options.toolbarHeight ?? 36;
  const maxX = hostRect.width - toolbarWidth - padding;
  const x = clamp(
    anchorCoords.left - hostRect.left - toolbarWidth / 2,
    padding,
    maxX,
  );

  const aboveY = anchorCoords.top - hostRect.top - toolbarHeight - gap;
  const belowY = focusCoords.bottom - hostRect.top + gap;
  const maxY = hostRect.height - toolbarHeight - padding;
  const y = aboveY >= padding
    ? clamp(aboveY, padding, maxY)
    : clamp(belowY, padding, maxY);

  return {
    visible: true,
    x,
    y,
  };
}
