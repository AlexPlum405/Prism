import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { describe, expect, it, vi } from 'vitest';
import {
  jumpToEditorLine,
  scrollEditorToLine,
  setEditorScrollRatio,
} from './editorScrollRuntime';
import { PREVIEW_SOURCE_FLASH_MS } from '../../../lib/feedbackTiming';

function createView(doc: string) {
  const parent = document.createElement('div');
  document.body.appendChild(parent);
  const view = new EditorView({
    parent,
    state: EditorState.create({ doc }),
  });
  return {
    view,
    destroy: () => {
      view.destroy();
      parent.remove();
    },
  };
}

describe('editorScrollRuntime', () => {
  it('jumps to a clamped line and schedules line flash cleanup', () => {
    const { view, destroy } = createView('one\ntwo\nthree');
    const scheduleClear = vi.fn((callback: () => void) => {
      callback();
      return 1 as unknown as ReturnType<typeof setTimeout>;
    });

    try {
      expect(jumpToEditorLine(view, 9, { scheduleClear })).toBe(true);
      expect(view.state.selection.main.from).toBe(8);
      expect(scheduleClear).toHaveBeenCalledWith(expect.any(Function), PREVIEW_SOURCE_FLASH_MS);
    } finally {
      destroy();
    }
  });

  it('sets scroll ratio on the editor scroller', () => {
    const { view, destroy } = createView('one\ntwo\nthree');
    try {
      Object.defineProperty(view.scrollDOM, 'scrollHeight', { value: 1000, configurable: true });
      Object.defineProperty(view.scrollDOM, 'clientHeight', { value: 200, configurable: true });
      expect(setEditorScrollRatio(view, 0.25)).toBe(true);
      expect(view.scrollDOM.scrollTop).toBe(200);
    } finally {
      destroy();
    }
  });

  it('scrolls to a clamped line without moving the selection', () => {
    const { view, destroy } = createView('one\ntwo\nthree');
    try {
      expect(scrollEditorToLine(view, 2)).toBe(true);
      expect(view.state.selection.main.from).toBe(0);
    } finally {
      destroy();
    }
  });
});
