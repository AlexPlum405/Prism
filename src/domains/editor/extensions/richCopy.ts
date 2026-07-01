export interface RichClipboardInput {
  html: string;
  text: string;
}

interface RichClipboardOptions {
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

export async function writeRichClipboard(input: RichClipboardInput, options: RichClipboardOptions = {}) {
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

  const fallbackText = options.fallback === 'html'
    ? input.html || input.text
    : input.text || input.html;
  await navigator.clipboard.writeText(fallbackText);
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
