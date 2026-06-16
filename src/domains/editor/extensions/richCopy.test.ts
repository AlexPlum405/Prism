import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  markdownSelectionToRichClipboardInput,
  previewHtmlToRichClipboardInput,
  writeRichClipboard,
} from './richCopy';

describe('rich clipboard copy', () => {
  const originalClipboard = navigator.clipboard;
  const originalClipboardItem = globalThis.ClipboardItem;

  afterEach(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: originalClipboard,
    });
    Object.defineProperty(globalThis, 'ClipboardItem', {
      configurable: true,
      value: originalClipboardItem,
    });
  });

  it('writes text/html and text/plain when rich clipboard APIs are available', async () => {
    const write = vi.fn(async (_items: ClipboardItem[]) => undefined);
    class TestClipboardItem {
      constructor(public readonly items: Record<string, Blob>) {}
    }
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { write },
    });
    Object.defineProperty(globalThis, 'ClipboardItem', {
      configurable: true,
      value: TestClipboardItem,
    });

    await writeRichClipboard(previewHtmlToRichClipboardInput('<h1>标题</h1>', '标题'));

    expect(write).toHaveBeenCalledTimes(1);
    const item = write.mock.calls[0]?.[0]?.[0] as unknown as TestClipboardItem;
    expect(await item.items['text/html'].text()).toBe('<h1>标题</h1>');
    expect(await item.items['text/plain'].text()).toBe('标题');
  });

  it('falls back to writing html text when rich clipboard APIs are unavailable', async () => {
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    Object.defineProperty(globalThis, 'ClipboardItem', {
      configurable: true,
      value: undefined,
    });

    await writeRichClipboard(previewHtmlToRichClipboardInput('<p>Body</p>', 'Body'));

    expect(writeText).toHaveBeenCalledWith('<p>Body</p>');
  });

  it('converts markdown selections to rendered html and plain text', async () => {
    const input = await markdownSelectionToRichClipboardInput('# 标题');

    expect(input.html).toContain('<h1');
    expect(input.html).toContain('标题');
    expect(input.text).toBe('# 标题');
  });
});
