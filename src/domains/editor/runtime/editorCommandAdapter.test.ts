import { beforeAll, describe, expect, it, vi } from 'vitest';
import { EditorSelection } from '@codemirror/state';
import { createEditorRuntime } from './createEditorRuntime';
import { runBasicEditorCommand } from './editorCommandAdapter';

function createView(doc: string) {
  const parent = document.createElement('div');
  return createEditorRuntime({ doc, extensions: [], parent });
}

beforeAll(() => {
  if (!Range.prototype.getClientRects) {
    Object.defineProperty(Range.prototype, 'getClientRects', {
      value: () => [],
    });
  }

  if (!Range.prototype.getBoundingClientRect) {
    Object.defineProperty(Range.prototype, 'getBoundingClientRect', {
      value: () => ({
        bottom: 0,
        height: 0,
        left: 0,
        right: 0,
        top: 0,
        width: 0,
        x: 0,
        y: 0,
        toJSON: () => undefined,
      }),
    });
  }
});

describe('editorCommandAdapter', () => {
  it('writes the CodeMirror selection to the system clipboard for copy', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    const view = createView('hello world');
    view.dispatch({ selection: EditorSelection.range(0, 5) });

    expect(runBasicEditorCommand('copy', view, { handleTablePasteText: vi.fn() })).toBe(true);
    await vi.waitFor(() => {
      expect(writeText).toHaveBeenCalledWith('hello');
    });

    view.destroy();
  });

  it('cuts the CodeMirror selection only after writing it to the clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    const view = createView('hello world');
    view.dispatch({ selection: EditorSelection.range(0, 5) });

    expect(runBasicEditorCommand('cut', view, { handleTablePasteText: vi.fn() })).toBe(true);
    await vi.waitFor(() => {
      expect(writeText).toHaveBeenCalledWith('hello');
      expect(view.state.doc.toString()).toBe(' world');
    });

    view.destroy();
  });

  it('pastes plain text from the system clipboard at the active selection', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { readText: vi.fn().mockResolvedValue('Prism') },
    });
    const view = createView('hello world');
    view.dispatch({ selection: EditorSelection.range(0, 5) });

    expect(runBasicEditorCommand('paste', view, { handleTablePasteText: vi.fn(() => false) })).toBe(true);
    await vi.waitFor(() => {
      expect(view.state.doc.toString()).toBe('Prism world');
    });

    view.destroy();
  });

  it('selects all text for selectAll command', () => {
    const view = createView('hello');

    expect(runBasicEditorCommand('selectAll', view, { handleTablePasteText: vi.fn() })).toBe(true);
    expect(view.state.selection.main.from).toBe(0);
    expect(view.state.selection.main.to).toBe(5);

    view.destroy();
  });

  it('clears markdown markers from the current selection', () => {
    const view = createView('**hello**');
    view.dispatch({ selection: EditorSelection.range(0, 9) });

    expect(runBasicEditorCommand('clearFormat', view, { handleTablePasteText: vi.fn() })).toBe(true);
    expect(view.state.doc.toString()).toBe('hello');

    view.destroy();
  });

  it('auto-formats markdown spacing without rewriting fenced code content', () => {
    const view = createView([
      '#   Title',
      '',
      '',
      '-    item',
      '```js',
      'const answer = 42;   ',
      '```',
      '##   Next',
    ].join('\n'));

    expect(runBasicEditorCommand('autoFormat', view, { handleTablePasteText: vi.fn() })).toBe(true);
    expect(view.state.doc.toString()).toBe([
      '# Title',
      '',
      '- item',
      '',
      '```js',
      'const answer = 42;   ',
      '```',
      '',
      '## Next',
    ].join('\n'));

    view.destroy();
  });

  it('returns false for commands outside the basic adapter', () => {
    const view = createView('hello');

    expect(runBasicEditorCommand('insertTable', view, { handleTablePasteText: vi.fn() })).toBe(false);

    view.destroy();
  });
});
