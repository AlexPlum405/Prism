import { describe, expect, it, vi } from 'vitest';
import { EditorSelection } from '@codemirror/state';
import { createEditorRuntime } from './createEditorRuntime';
import { runBasicEditorCommand } from './editorCommandAdapter';

function createView(doc: string) {
  const parent = document.createElement('div');
  return createEditorRuntime({ doc, extensions: [], parent });
}

describe('editorCommandAdapter', () => {
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
