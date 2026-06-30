import type { EditorView } from '@codemirror/view';
import {
  handleEditorClipboardImagePaste,
  handleEditorImageDrop,
  type EditorImageClipboardDeps,
} from './editorClipboardRuntime';

interface EditorClipboardControllerInput {
  handleTablePasteText: (view: EditorView, text: string) => boolean;
  imageDeps: EditorImageClipboardDeps;
}

export function hasClipboardImage(event: ClipboardEvent) {
  const clipboard = event.clipboardData;
  return (
    Array.from(clipboard?.items ?? []).some((item) => item.type.startsWith('image/'))
    || Array.from(clipboard?.files ?? []).some((file) => file.type.startsWith('image/'))
  );
}

export function hasDraggedImage(event: DragEvent) {
  return Array.from(event.dataTransfer?.items ?? []).some((item) => item.type.startsWith('image/'));
}

export function createEditorClipboardController({
  handleTablePasteText,
  imageDeps,
}: EditorClipboardControllerInput) {
  return {
    async handlePaste(event: ClipboardEvent, view: EditorView) {
      if (!hasClipboardImage(event)) {
        const text = event.clipboardData?.getData('text/plain') ?? '';
        if (text && handleTablePasteText(view, text)) {
          event.preventDefault();
          event.stopPropagation();
          return true;
        }
      }

      return handleEditorClipboardImagePaste(event, view, imageDeps);
    },

    handleDragOver(event: DragEvent) {
      if (!hasDraggedImage(event)) return false;
      event.preventDefault();
      return true;
    },

    handleDrop(event: DragEvent, view: EditorView) {
      return handleEditorImageDrop(event, view, imageDeps);
    },
  };
}
