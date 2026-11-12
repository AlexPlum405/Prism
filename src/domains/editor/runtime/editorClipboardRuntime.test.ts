import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { describe, expect, it, vi } from 'vitest';
import type { EditorImageClipboardDeps } from './editorClipboardRuntime';
import {
  handleEditorClipboardImagePaste,
  handleEditorImageDrop,
  handleEditorSystemImagePaste,
  insertTextAtSelection,
  readSystemClipboardImageFile,
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
      files: [],
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

function createClipboardFilesEvent(file: File) {
  return {
    clipboardData: {
      files: [file],
      items: [],
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

function createRichClipboardEvent(
  payload: { html?: string; text?: string },
  options: { defaultPrevented?: boolean } = {},
) {
  const html = payload.html ?? '';
  const text = payload.text ?? '';

  return {
    clipboardData: {
      files: [],
      items: [],
      getData: (type: string) => {
        if (type === 'text/html') return html;
        if (type === 'text/plain') return text;
        return '';
      },
    },
    defaultPrevented: options.defaultPrevented ?? false,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
  } as unknown as ClipboardEvent;
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

  it('converts clipboard html into markdown and takes over the paste', async () => {
    const { view, destroy } = createView('');
    const event = createRichClipboardEvent({
      html: '<h1>标题</h1><p>正文<strong>加粗</strong>与<em>斜体</em></p>',
      text: '标题\n正文加粗与斜体',
    });

    try {
      const handled = await handleEditorClipboardImagePaste(event, view, createDeps());

      expect(handled).toBe(true);
      expect(event.preventDefault).toHaveBeenCalledTimes(1);
      expect(event.stopPropagation).toHaveBeenCalledTimes(1);
      const doc = view.state.doc.toString();
      expect(doc).toContain('# 标题');
      expect(doc).toContain('**加粗**');
      expect(doc).toContain('*斜体*');
    } finally {
      destroy();
    }
  });

  it('defers to native paste when the clipboard only carries text', async () => {
    const { view, destroy } = createView('');
    const event = createRichClipboardEvent({ text: '纯文本内容' });

    try {
      const handled = await handleEditorClipboardImagePaste(event, view, createDeps());

      expect(handled).toBe(false);
      expect(event.preventDefault).not.toHaveBeenCalled();
      expect(view.state.doc.toString()).toBe('');
    } finally {
      destroy();
    }
  });

  it('skips handling when an earlier handler already prevented the paste', async () => {
    const { view, destroy } = createView('');
    const event = createRichClipboardEvent(
      { html: '<h1>标题</h1>', text: '标题' },
      { defaultPrevented: true },
    );

    try {
      const handled = await handleEditorClipboardImagePaste(event, view, createDeps());

      expect(handled).toBe(false);
      expect(view.state.doc.toString()).toBe('');
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

  it('accepts image files exposed through clipboardData.files', async () => {
    const { view, destroy } = createView('');
    const file = new File(['png'], 'image-from-files.png', { type: 'image/png' });
    const deps = createDeps();

    try {
      const handled = await handleEditorClipboardImagePaste(createClipboardFilesEvent(file), view, deps);
      expect(handled).toBe(true);
      expect(deps.saveImage).toHaveBeenCalledWith(expect.objectContaining({ file }));
      expect(view.state.doc.toString()).toBe('![image](assets/image.png)');
    } finally {
      destroy();
    }
  });

  it('reads image files from the async system clipboard fallback', async () => {
    const blob = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' });
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        read: vi.fn(async () => [{
          types: ['text/plain', 'image/png'],
          getType: vi.fn(async (type: string) => {
            expect(type).toBe('image/png');
            return blob;
          }),
        }]),
      },
    });

    const file = await readSystemClipboardImageFile();

    expect(file).toBeInstanceOf(File);
    expect(file?.name).toBe('clipboard-image.png');
    expect(file?.type).toBe('image/png');
  });

  it('uses the async system clipboard fallback when paste events omit image files', async () => {
    const { view, destroy } = createView('');
    const file = new File(['png'], 'system.png', { type: 'image/png' });
    const deps = createDeps({
      readClipboardImage: vi.fn(async () => file),
    });
    const event = {
      clipboardData: {
        files: [],
        items: [],
      },
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    } as unknown as ClipboardEvent;

    try {
      const handled = await handleEditorClipboardImagePaste(event, view, deps);
      expect(handled).toBe(true);
      expect(deps.saveImage).toHaveBeenCalledWith(expect.objectContaining({ file }));
      expect(event.preventDefault).toHaveBeenCalledTimes(1);
      expect(view.state.doc.toString()).toBe('![image](assets/image.png)');
    } finally {
      destroy();
    }
  });

  it('pastes a system clipboard image through the document asset pipeline', async () => {
    const { view, destroy } = createView('');
    const file = new File(['png'], 'system.png', { type: 'image/png' });
    const deps = createDeps({
      readClipboardImage: vi.fn(async () => file),
    });

    try {
      const handled = await handleEditorSystemImagePaste(view, deps);
      expect(handled).toBe(true);
      expect(deps.saveImage).toHaveBeenCalledWith(expect.objectContaining({ file }));
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
