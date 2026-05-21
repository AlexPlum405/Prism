import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { describe, expect, it, vi } from 'vitest';
import {
  applyBlockFormatCommand,
  applyHeadingLevel,
} from './editorBlockCommands';

function createView(doc: string, anchor = 0) {
  const parent = document.createElement('div');
  document.body.appendChild(parent);
  const view = new EditorView({
    parent,
    state: EditorState.create({
      doc,
      selection: { anchor },
    }),
  });
  return {
    view,
    destroy: () => {
      view.destroy();
      parent.remove();
    },
  };
}

describe('editorBlockCommands', () => {
  it('applies explicit heading levels to the current line', () => {
    const { view, destroy } = createView('Title');
    try {
      expect(applyHeadingLevel(view, 'h2')).toBe(true);
      expect(view.state.doc.toString()).toBe('## Title');
      expect(applyHeadingLevel(view, 'bad')).toBe(false);
    } finally {
      destroy();
    }
  });

  it('converts headings back to paragraphs and adjusts heading depth', () => {
    const { view, destroy } = createView('# Title');
    try {
      expect(applyBlockFormatCommand(view, 'increaseHeading', vi.fn())).toBe(true);
      expect(view.state.doc.toString()).toBe('## Title');
      expect(applyBlockFormatCommand(view, 'decreaseHeading', vi.fn())).toBe(true);
      expect(view.state.doc.toString()).toBe('# Title');
      expect(applyBlockFormatCommand(view, 'paragraph', vi.fn())).toBe(true);
      expect(view.state.doc.toString()).toBe('Title');
    } finally {
      destroy();
    }
  });

  it('delegates selection block operations to the source block handler', () => {
    const { view, destroy } = createView('quote me');
    const handleSourceBlockOperation = vi.fn(() => true);
    try {
      expect(applyBlockFormatCommand(view, 'quote', handleSourceBlockOperation)).toBe(true);
      expect(handleSourceBlockOperation).toHaveBeenCalledWith('selectionQuote');
    } finally {
      destroy();
    }
  });

  it('inserts paired block wrappers around the current line', () => {
    const { view, destroy } = createView('code');
    try {
      expect(applyBlockFormatCommand(view, 'codeBlock', vi.fn())).toBe(true);
      expect(view.state.doc.toString()).toBe('```\ncode\n```');
    } finally {
      destroy();
    }
  });
});
