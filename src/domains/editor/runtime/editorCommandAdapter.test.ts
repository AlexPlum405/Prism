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
  it('writes Markdown source and rendered HTML to the system clipboard for copy', async () => {
    const write = vi.fn().mockResolvedValue(undefined);
    class TestClipboardItem {
      constructor(public readonly items: Record<string, Blob>) {}
    }
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { write },
    });
    Object.defineProperty(globalThis, 'ClipboardItem', {
      configurable: true,
      value: TestClipboardItem,
    });
    const view = createView('**hello** [Prism](https://example.com)');
    view.dispatch({ selection: EditorSelection.range(0, view.state.doc.length) });

    expect(runBasicEditorCommand('copy', view, { handleTablePasteText: vi.fn() })).toBe(true);
    await vi.waitFor(() => {
      expect(write).toHaveBeenCalledTimes(1);
    });
    const item = write.mock.calls[0]?.[0]?.[0] as unknown as TestClipboardItem;
    expect(await item.items['text/plain'].text()).toBe('**hello** [Prism](https://example.com)');
    const html = await item.items['text/html'].text();
    expect(html).toContain('<strong>hello</strong>');
    expect(html).toContain('href="https://example.com"');

    view.destroy();
  });

  it('keeps copyPlain and copyMd as plain Markdown text', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    const view = createView('**hello**');
    view.dispatch({ selection: EditorSelection.range(0, view.state.doc.length) });

    expect(runBasicEditorCommand('copyPlain', view, { handleTablePasteText: vi.fn() })).toBe(true);
    expect(runBasicEditorCommand('copyMd', view, { handleTablePasteText: vi.fn() })).toBe(true);
    await vi.waitFor(() => {
      expect(writeText).toHaveBeenCalledTimes(2);
    });
    expect(writeText).toHaveBeenNthCalledWith(1, '**hello**');
    expect(writeText).toHaveBeenNthCalledWith(2, '**hello**');

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

  it('pastes images before falling back to plain text for the paste command', async () => {
    const readText = vi.fn().mockResolvedValue('Prism');
    const handleImagePaste = vi.fn(async () => true);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { readText },
    });
    const view = createView('hello world');
    view.dispatch({ selection: EditorSelection.range(0, 5) });

    expect(runBasicEditorCommand('paste', view, {
      handleImagePaste,
      handleTablePasteText: vi.fn(() => false),
    })).toBe(true);
    await vi.waitFor(() => {
      expect(handleImagePaste).toHaveBeenCalledWith(view);
    });
    expect(readText).not.toHaveBeenCalled();
    expect(view.state.doc.toString()).toBe('hello world');

    view.destroy();
  });

  it('falls back to plain text when the paste command has no image payload', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { readText: vi.fn().mockResolvedValue('Prism') },
    });
    const view = createView('hello world');
    view.dispatch({ selection: EditorSelection.range(0, 5) });

    expect(runBasicEditorCommand('paste', view, {
      handleImagePaste: vi.fn(async () => false),
      handleTablePasteText: vi.fn(() => false),
    })).toBe(true);
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
