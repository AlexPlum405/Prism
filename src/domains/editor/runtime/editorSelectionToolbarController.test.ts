import { EditorSelection, EditorState, type SelectionRange } from '@codemirror/state';
import type { EditorView } from '@codemirror/view';
import { describe, expect, it, vi } from 'vitest';
import {
  HIDDEN_SELECTION_TOOLBAR,
  getSelectionFloatingToolbarState,
} from './editorSelectionToolbarController';

function makeHost(rect: Partial<DOMRect> = {}) {
  return {
    getBoundingClientRect: () => ({
      bottom: 600,
      height: 600,
      left: 20,
      right: 820,
      top: 40,
      width: 800,
      x: 20,
      y: 40,
      toJSON: () => undefined,
      ...rect,
    }),
  } as HTMLElement;
}

function makeView(
  selection: EditorSelection | SelectionRange,
  coords: DOMRect | null,
  options: { allowMultipleSelections?: boolean } = {},
) {
  const editorSelection = 'ranges' in selection
    ? selection
    : EditorSelection.create([selection]);

  return {
    state: EditorState.create({
      doc: 'Alpha beta gamma',
      selection: editorSelection,
      extensions: options.allowMultipleSelections
        ? [EditorState.allowMultipleSelections.of(true)]
        : [],
    }),
    coordsAtPos: vi.fn(() => coords),
  } as unknown as EditorView;
}

function rect(input: Partial<DOMRect>) {
  return {
    bottom: 120,
    height: 18,
    left: 320,
    right: 360,
    top: 102,
    width: 40,
    x: 320,
    y: 102,
    toJSON: () => undefined,
    ...input,
  } as DOMRect;
}

describe('editorSelectionToolbarController', () => {
  it('hides the toolbar for empty and multi-range selections', () => {
    expect(getSelectionFloatingToolbarState(
      makeView(EditorSelection.cursor(2), rect({})),
      makeHost(),
    )).toEqual(HIDDEN_SELECTION_TOOLBAR);

    expect(getSelectionFloatingToolbarState(
      makeView(EditorSelection.create([
        EditorSelection.range(0, 2),
        EditorSelection.range(4, 6),
      ]), rect({}), { allowMultipleSelections: true }),
      makeHost(),
    )).toEqual(HIDDEN_SELECTION_TOOLBAR);
  });

  it('positions the toolbar above a normal source selection', () => {
    expect(getSelectionFloatingToolbarState(
      makeView(EditorSelection.range(0, 5), rect({ left: 420, top: 140, bottom: 160 })),
      makeHost(),
      { toolbarWidth: 200, toolbarHeight: 32 },
    )).toEqual({
      visible: true,
      x: 300,
      y: 60,
    });
  });

  it('falls below the selection when there is not enough space above', () => {
    expect(getSelectionFloatingToolbarState(
      makeView(EditorSelection.range(0, 5), rect({ left: 120, top: 52, bottom: 70 })),
      makeHost(),
      { toolbarWidth: 200, toolbarHeight: 32 },
    )).toEqual({
      visible: true,
      x: 8,
      y: 38,
    });
  });
});
