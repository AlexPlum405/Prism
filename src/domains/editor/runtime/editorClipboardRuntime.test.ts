import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { describe, expect, it, vi } from 'vitest';
import type { EditorImageClipboardDeps } from './editorClipboardRuntime';
import {
  handleEditorClipboardImagePaste,
  handleEditorImageDrop,
  insertTextAtSelection,
} from './editorClipboardRuntime';

function createView(doc = '') {
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

function createDeps(overrides: Partial<EditorImageClipboardDeps> = {}): EditorImageClipboardDeps {
  return {
    getCurrentDocument: () => ({ name: 'note.md', path: '/tmp/note.md' }),
    messages: {
      clipboardUnreadable: 'clipboard unreadable',
      saveBeforePaste: 'save before paste',
      nativePathUnavailable: 'native path unavailable',
      saveBeforeDrop: 'save before drop',
      pasteFailed: (message) => `paste failed: ${message}`,
      dropFailed: (message) => `drop failed: ${message}`,
    },
    notice: vi.fn(),
    formatError: (error) => error instanceof Error ? error.message : String(error),
    saveImage: vi.fn(async () => '![image](assets/image.png)'),
    ...overrides,
  };
}

function createClipboardEvent(file: File | null) {
  return {
    clipboardData: {
      items: [
        {
          type: 'image/png',
          getAsFile: () => file,
        },
      ],
    },
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
  } as unknown as ClipboardEvent;
}

function createDropEvent(files: File[], altKey = false) {
  return {
    dataTransfer: { files },
    altKey,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
  } as unknown as DragEvent;
}

describe('editorClipboardRuntime', () => {
  it('inserts text at the current selection', () => {
    const { view, destroy } = createView('hello');
    try {
      view.dispatch({ selection: { anchor: 5 } });
      insertTextAtSelection(view, ' world');
      expect(view.state.doc.toString()).toBe('hello world');
      expect(view.state.selection.main.from).toBe(11);
    } finally {
      destroy();
    }
  });

  it('saves clipboard image and inserts returned markdown', async () => {
    const { view, destroy } = createView('');
    const file = new File(['png'], 'image.png', { type: 'image/png' });
    const deps = createDeps();

    try {
      const handled = await handleEditorClipboardImagePaste(createClipboardEvent(file), view, deps);
      expect(handled).toBe(true);
      expect(deps.saveImage).toHaveBeenCalledWith({
        documentName: 'note.md',
        documentPath: '/tmp/note.md',
        file,
      });
      expect(view.state.doc.toString()).toBe('![image](assets/image.png)');
    } finally {
      destroy();
    }
  });

  it('notices when clipboard image needs a saved document', async () => {
    const { view, destroy } = createView('');
    const file = new File(['png'], 'image.png', { type: 'image/png' });
    const notice = vi.fn();
    const deps = createDeps({
      getCurrentDocument: () => ({ name: 'Untitled' }),
      notice,
    });

    try {
      const handled = await handleEditorClipboardImagePaste(createClipboardEvent(file), view, deps);
      expect(handled).toBe(true);
      expect(notice).toHaveBeenCalledWith('save before paste');
      expect(view.state.doc.toString()).toBe('');
    } finally {
      destroy();
    }
  });

  it('inserts native markdown links for alt image drop', async () => {
    const { view, destroy } = createView('');
    const file = new File(['png'], 'diagram.png', { type: 'image/png' }) as File & { path?: string };
    file.path = '/tmp/diagram.png';
    const deps = createDeps();

    try {
      const handled = await handleEditorImageDrop(createDropEvent([file], true), view, deps);
      expect(handled).toBe(true);
      expect(view.state.doc.toString()).toBe('![diagram.png](/tmp/diagram.png)');
    } finally {
      destroy();
    }
  });
});
