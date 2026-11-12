import { isTauriClipboardRuntime, writeClipboardRichNative } from '../../../platform/tauri/clipboardRich';

export interface RichClipboardInput {
  html: string;
  text: string;
}

interface RichClipboardOptions {
  /** 已废弃：回退时始终写可读文本，保留参数是为了兼容既有调用。 */
  fallback?: 'text' | 'html';
}

type ClipboardWithRichWrite = Clipboard & {
  write?: (items: ClipboardItem[]) => Promise<void>;
};

function normalizeHtmlFragment(html: string) {
  return html.trim()
    ? html
    : '<p></p>';
}

export async function writeRichClipboard(input: RichClipboardInput, _options: RichClipboardOptions = {}) {
  if (isTauriClipboardRuntime()) {
    try {
      await writeClipboardRichNative({
        html: normalizeHtmlFragment(input.html),
        text: input.text,
      });
      return;
    } catch {
      // 原生剪贴板写入失败时退回 Web API 路径。
    }
  }

  const clipboard = navigator.clipboard as ClipboardWithRichWrite | undefined;
  const clipboardItemCtor = globalThis.ClipboardItem;

  if (clipboard?.write && clipboardItemCtor) {
    await clipboard.write([
      new clipboardItemCtor({
        'text/html': new Blob([normalizeHtmlFragment(input.html)], { type: 'text/html' }),
        'text/plain': new Blob([input.text], { type: 'text/plain' }),
      }),
    ]);
    return;
  }

  // 回退时永远写可读文本：把原始 HTML 字符串写进剪贴板，粘贴出来就是满屏标签。
  await navigator.clipboard.writeText(input.text || input.html);
}

export async function markdownSelectionToRichClipboardInput(markdown: string): Promise<RichClipboardInput> {
  const { markdownToHtml } = await import('../../../lib/markdownToHtml');
  return {
    html: markdownToHtml(markdown, { frontMatterMode: 'hide' }),
    text: markdown,
  };
}

export function previewHtmlToRichClipboardInput(html: string, text: string): RichClipboardInput {
  return {
    html,
    text,
  };
}
