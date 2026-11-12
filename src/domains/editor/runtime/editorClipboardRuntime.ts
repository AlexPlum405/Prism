import type { EditorView } from '@codemirror/view';
import {
  getMarkdownImageForPath,
  getNativeImageFilePath,
  isSupportedImageFile,
  saveClipboardImage,
} from '../extensions/imagePaste';
import { convertHtmlToMarkdown, getClipboardHtml, getClipboardText } from '../extensions/htmlToMarkdown';

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
  readClipboardImage?: typeof readSystemClipboardImageFile;
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

type ClipboardWithRead = Clipboard & {
  read?: () => Promise<Array<{
    types: readonly string[];
    getType: (type: string) => Promise<Blob>;
  }>>;
};

export async function readSystemClipboardImageFile(): Promise<File | null> {
  const clipboard = navigator.clipboard as ClipboardWithRead | undefined;
  if (!clipboard?.read) return null;

  const items = await clipboard.read();
  for (const item of items) {
    const type = item.types.find((candidate) => candidate.startsWith('image/'));
    if (!type) continue;

    const blob = await item.getType(type);
    const extension = type.split('/')[1] || 'png';
    return new File([blob], `clipboard-image.${extension}`, {
      type: blob.type || type,
    });
  }

  return null;
}

async function saveImageIntoDocument(
  imageFile: File,
  view: EditorView,
  deps: EditorImageClipboardDeps,
) {
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

/**
 * 把剪贴板里的 text/html 转成 Markdown，失败或结果为空时返回 null。
 * 调用方据此决定是否接管此次粘贴，未接管则交回浏览器原生粘贴。
 */
export function convertClipboardHtmlToMarkdown(html: string): string | null {
  const trimmed = html.trim();
  if (!trimmed) return null;

  try {
    const markdown = convertHtmlToMarkdown(trimmed);
    return markdown ? markdown : null;
  } catch (error) {
    console.warn('HTML to Markdown conversion failed:', error);
    return null;
  }
}

export async function handleEditorClipboardImagePaste(
  event: ClipboardEvent,
  view: EditorView,
  deps: EditorImageClipboardDeps,
) {
  // 已被其他处理器接管的粘贴不再重复插入。
  if (event.defaultPrevented) return false;
  // 捕获阶段先于 CodeMirror 执行，只读限制需要自己守。
  if (view.state.readOnly) return false;

  const markdown = convertClipboardHtmlToMarkdown(getClipboardHtml(event) ?? '');
  if (markdown) {
    event.preventDefault();
    event.stopPropagation();
    insertTextAtSelection(view, markdown);
    return true;
  }

  // 剪贴板里有文本时一律交回原生粘贴：既保住 text/plain 的原始换行，
  // 也避免为了探测图片去调 navigator.clipboard.read 触发系统授权弹窗。
  if (getClipboardText(event).trim()) return false;

  let imageFile = getClipboardImageFile(event);
  if (!imageFile) {
    if (!clipboardHasImagePayload(event)) {
      imageFile = await (deps.readClipboardImage ?? readSystemClipboardImageFile)().catch(() => null);
      if (!imageFile) return false;
    } else {
      event.preventDefault();
      event.stopPropagation();
      deps.notice(deps.messages.clipboardUnreadable);
      return true;
    }
  }

  event.preventDefault();
  event.stopPropagation();
  return saveImageIntoDocument(imageFile, view, deps);
}

export async function handleEditorSystemImagePaste(
  view: EditorView,
  deps: EditorImageClipboardDeps,
) {
  const imageFile = await (deps.readClipboardImage ?? readSystemClipboardImageFile)().catch(() => null);
  if (!imageFile) return false;

  return saveImageIntoDocument(imageFile, view, deps);
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
