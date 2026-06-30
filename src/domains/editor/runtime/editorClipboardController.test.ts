import { describe, expect, it, vi } from 'vitest';
import type { EditorView } from '@codemirror/view';
import {
  createEditorClipboardController,
  hasClipboardImage,
  hasDraggedImage,
} from './editorClipboardController';

function createClipboardEvent(input: {
  files?: Array<{ type: string }>;
  items?: Array<{ type: string }>;
  text?: string;
}) {
  return {
    clipboardData: {
      files: input.files ?? [],
      items: input.items ?? [],
      getData: vi.fn(() => input.text ?? ''),
    },
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
  } as unknown as ClipboardEvent;
}

function createDragEvent(items: Array<{ type: string }>) {
  return {
    dataTransfer: { items },
    preventDefault: vi.fn(),
  } as unknown as DragEvent;
}

function createController(handleTablePasteText = vi.fn(() => false)) {
  return createEditorClipboardController({
    handleTablePasteText,
    imageDeps: {
      getCurrentDocument: () => ({ name: 'doc.md', path: '/repo/doc.md' }),
      messages: {
        clipboardUnreadable: 'clipboard unreadable',
        saveBeforePaste: 'save before paste',
        nativePathUnavailable: 'native path unavailable',
        saveBeforeDrop: 'save before drop',
        pasteFailed: (message) => `paste failed: ${message}`,
        dropFailed: (message) => `drop failed: ${message}`,
      },
      notice: vi.fn(),
      formatError: (error) => String(error),
    },
  });
}

describe('editorClipboardController', () => {
  it('detects clipboard and dragged images', () => {
    expect(hasClipboardImage(createClipboardEvent({ items: [{ type: 'image/png' }] }))).toBe(true);
    expect(hasClipboardImage(createClipboardEvent({ files: [{ type: 'image/png' }] }))).toBe(true);
    expect(hasClipboardImage(createClipboardEvent({ items: [{ type: 'text/plain' }] }))).toBe(false);
    expect(hasDraggedImage(createDragEvent([{ type: 'image/jpeg' }]))).toBe(true);
    expect(hasDraggedImage(createDragEvent([{ type: 'text/uri-list' }]))).toBe(false);
  });

  it('lets table paste consume plain text before image paste handling', async () => {
    const handleTablePasteText = vi.fn(() => true);
    const controller = createController(handleTablePasteText);
    const event = createClipboardEvent({ text: '| A | B |' });
    const view = {} as EditorView;

    await controller.handlePaste(event, view);

    expect(handleTablePasteText).toHaveBeenCalledWith(view, '| A | B |');
    expect(event.preventDefault).toHaveBeenCalledTimes(1);
    expect(event.stopPropagation).toHaveBeenCalledTimes(1);
  });

  it('prevents dragover only for image drags', () => {
    const controller = createController();
    const imageEvent = createDragEvent([{ type: 'image/webp' }]);
    const textEvent = createDragEvent([{ type: 'text/plain' }]);

    expect(controller.handleDragOver(imageEvent)).toBe(true);
    expect(controller.handleDragOver(textEvent)).toBe(false);
    expect(imageEvent.preventDefault).toHaveBeenCalledTimes(1);
    expect(textEvent.preventDefault).not.toHaveBeenCalled();
  });
});
