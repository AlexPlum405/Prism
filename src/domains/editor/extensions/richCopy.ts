import { markdownToHtml } from '../../../lib/markdownToHtml';

interface RichClipboardInput {
  html: string;
  text: string;
}

type ClipboardWithRichWrite = Clipboard & {
  write?: (items: ClipboardItem[]) => Promise<void>;
};

function normalizeHtmlFragment(html: string) {
  return html.trim()
    ? html
    : '<p></p>';
}

export async function writeRichClipboard(input: RichClipboardInput) {
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

  await navigator.clipboard.writeText(input.html || input.text);
}

export function markdownSelectionToRichClipboardInput(markdown: string): RichClipboardInput {
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
