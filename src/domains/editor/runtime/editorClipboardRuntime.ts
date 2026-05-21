import type { EditorView } from '@codemirror/view';
import {
  getMarkdownImageForPath,
  getNativeImageFilePath,
  isSupportedImageFile,
  saveClipboardImage,
} from '../extensions/imagePaste';

export interface EditorClipboardDocument {
  name: string;
  path?: string | null;
}

export interface EditorImageClipboardMessages {
  clipboardUnreadable: string;
  saveBeforePaste: string;
  nativePathUnavailable: string;
  saveBeforeDrop: string;
  pasteFailed: (message: string) => string;
  dropFailed: (message: string) => string;
}

export interface EditorImageClipboardDeps {
  getCurrentDocument: () => EditorClipboardDocument | null | undefined;
  messages: EditorImageClipboardMessages;
  notice: (message: string) => void;
  formatError: (error: unknown) => string;
  saveImage?: typeof saveClipboardImage;
}

export function insertTextAtSelection(view: EditorView, text: string) {
  const selection = view.state.selection.main;
  view.dispatch({
    changes: { from: selection.from, to: selection.to, insert: text },
    selection: { anchor: selection.from + text.length },
    scrollIntoView: true,
  });
  view.focus();
}

export async function handleEditorClipboardImagePaste(
  event: ClipboardEvent,
  view: EditorView,
  deps: EditorImageClipboardDeps,
) {
  const imageItem = Array.from(event.clipboardData?.items ?? []).find((item) => item.type.startsWith('image/'));
  if (!imageItem) return false;

  event.preventDefault();
  event.stopPropagation();

  const imageFile = imageItem.getAsFile();
  const document = deps.getCurrentDocument();
  if (!imageFile) {
    deps.notice(deps.messages.clipboardUnreadable);
    return true;
  }
  if (!document?.path) {
    deps.notice(deps.messages.saveBeforePaste);
    return true;
  }

  try {
    const markdownImage = await (deps.saveImage ?? saveClipboardImage)({
      documentName: document.name,
      documentPath: document.path,
      file: imageFile,
    });
    insertTextAtSelection(view, markdownImage);
  } catch (error) {
    deps.notice(deps.messages.pasteFailed(deps.formatError(error)));
  }
  return true;
}

export async function handleEditorImageDrop(
  event: DragEvent,
  view: EditorView,
  deps: EditorImageClipboardDeps,
) {
  const imageFiles = Array.from(event.dataTransfer?.files ?? []).filter(isSupportedImageFile);
  if (imageFiles.length === 0) return false;

  event.preventDefault();
  event.stopPropagation();

  if (event.altKey) {
    const markdownLinks = imageFiles
      .map((file) => {
        const nativePath = getNativeImageFilePath(file);
        return nativePath ? getMarkdownImageForPath(nativePath, file.name) : null;
      })
      .filter((link): link is string => Boolean(link));

    if (markdownLinks.length === 0) {
      deps.notice(deps.messages.nativePathUnavailable);
      return true;
    }

    insertTextAtSelection(view, markdownLinks.join('\n'));
    return true;
  }

  const document = deps.getCurrentDocument();
  if (!document?.path) {
    deps.notice(deps.messages.saveBeforeDrop);
    return true;
  }

  try {
    const markdownImages: string[] = [];
    for (const file of imageFiles) {
      markdownImages.push(await (deps.saveImage ?? saveClipboardImage)({
        documentName: document.name,
        documentPath: document.path,
        file,
      }));
    }
    insertTextAtSelection(view, markdownImages.join('\n'));
  } catch (error) {
    deps.notice(deps.messages.dropFailed(deps.formatError(error)));
  }
  return true;
}
