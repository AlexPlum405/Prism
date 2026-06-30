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

function getClipboardImageFile(event: ClipboardEvent): File | null {
  const itemFile = Array.from(event.clipboardData?.items ?? [])
    .find((item) => item.type.startsWith('image/'))
    ?.getAsFile();
  if (itemFile) return itemFile;

  return Array.from(event.clipboardData?.files ?? [])
    .find((file) => file.type.startsWith('image/')) ?? null;
}

function clipboardHasImagePayload(event: ClipboardEvent): boolean {
  const clipboard = event.clipboardData;
  return (
    Array.from(clipboard?.items ?? []).some((item) => item.type.startsWith('image/'))
    || Array.from(clipboard?.files ?? []).some((file) => file.type.startsWith('image/'))
  );
}

export async function handleEditorClipboardImagePaste(
  event: ClipboardEvent,
  view: EditorView,
  deps: EditorImageClipboardDeps,
) {
  const imageFile = getClipboardImageFile(event);
  if (!imageFile) {
    if (!clipboardHasImagePayload(event)) return false;
    event.preventDefault();
    event.stopPropagation();
    deps.notice(deps.messages.clipboardUnreadable);
    return true;
  }

  event.preventDefault();
  event.stopPropagation();

  const document = deps.getCurrentDocument();
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
