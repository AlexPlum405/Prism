import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  EXPORT_ATOMIC_BLOCK_CLASS,
  EXPORT_ATOMIC_GROUP_CLASS,
  EXPORT_ATOMIC_SPACER_CLASS,
  markExportAtomicBlocks,
  prepareExportAtomicPagination,
} from './pagination';

describe('export pagination', () => {
  const originalRequestAnimationFrame = globalThis.requestAnimationFrame;

  beforeEach(() => {
    globalThis.requestAnimationFrame = ((callback: FrameRequestCallback) => {
      window.setTimeout(() => callback(performance.now()), 0);
      return 1;
    }) as typeof requestAnimationFrame;
    document.body.replaceChildren();
  });

  afterEach(() => {
    if (originalRequestAnimationFrame) {
      globalThis.requestAnimationFrame = originalRequestAnimationFrame;
    } else {
      delete (globalThis as Partial<typeof globalThis>).requestAnimationFrame;
    }
    document.body.replaceChildren();
  });

  it('marks styled raw html visual blocks as atomic export blocks', () => {
    const root = document.createElement('div');
    root.className = 'prism-export-document';
    root.innerHTML = '<div style="border:1px solid #f59e0b;background:#fff7cc;padding:12px">警告</div>';

    markExportAtomicBlocks(root);

    const block = root.querySelector<HTMLElement>('div[style]');
    expect(block?.classList.contains(EXPORT_ATOMIC_BLOCK_CLASS)).toBe(true);
    expect(block?.dataset.prismExportAtomic).toBe('true');
  });

  it('inserts a spacer before atomic blocks that would cross a page boundary', async () => {
    const root = document.createElement('div');
    const block = document.createElement('div');
    block.className = EXPORT_ATOMIC_BLOCK_CLASS;
    root.appendChild(block);
    document.body.appendChild(root);

    root.getBoundingClientRect = vi.fn(() => ({
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 980,
      bottom: 300,
      width: 980,
      height: 300,
      toJSON: () => ({}),
    } as DOMRect));
    block.getBoundingClientRect = vi.fn(() => {
      const hasSpacer = Boolean(root.querySelector(`.${EXPORT_ATOMIC_SPACER_CLASS}`));
      const top = hasSpacer ? 100 : 80;
      return {
        x: 0,
        y: top,
        top,
        left: 0,
        right: 400,
        bottom: top + 40,
        width: 400,
        height: 40,
        toJSON: () => ({}),
      } as DOMRect;
    });

    await prepareExportAtomicPagination(root, 100);

    const spacer = root.querySelector<HTMLElement>(`.${EXPORT_ATOMIC_SPACER_CLASS}`);
    expect(spacer).toBeTruthy();
    expect(spacer?.style.height).toBe('20px');
    expect(spacer?.nextSibling).toBe(block);
  });

  it('keeps headings attached to following visual blocks during pagination', async () => {
    const root = document.createElement('div');
    const heading = document.createElement('h3');
    const block = document.createElement('div');
    heading.textContent = '4.3 嵌套 HTML';
    block.className = EXPORT_ATOMIC_BLOCK_CLASS;
    block.textContent = '警告';
    root.append(heading, block);
    document.body.appendChild(root);

    const getBoundingClientRectSpy = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockImplementation(function getBoundingClientRect(this: HTMLElement) {
        if (this === root) {
          return {
            x: 0,
            y: 0,
            top: 0,
            left: 0,
            right: 980,
            bottom: 300,
            width: 980,
            height: 300,
            toJSON: () => ({}),
          } as DOMRect;
        }
        if (this.classList.contains(EXPORT_ATOMIC_GROUP_CLASS)) {
          const hasSpacer = Boolean(root.querySelector(`.${EXPORT_ATOMIC_SPACER_CLASS}`));
          const top = hasSpacer ? 100 : 80;
          return {
            x: 0,
            y: top,
            top,
            left: 0,
            right: 400,
            bottom: top + 60,
            width: 400,
            height: 60,
            toJSON: () => ({}),
          } as DOMRect;
        }
        if (this === heading) {
          return {
            x: 0,
            y: 80,
            top: 80,
            left: 0,
            right: 400,
            bottom: 100,
            width: 400,
            height: 20,
            toJSON: () => ({}),
          } as DOMRect;
        }
        if (this === block) {
          return {
            x: 0,
            y: 100,
            top: 100,
            left: 0,
            right: 400,
            bottom: 140,
            width: 400,
            height: 40,
            toJSON: () => ({}),
          } as DOMRect;
        }
        return {
          x: 0,
          y: 0,
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: 0,
          height: 0,
          toJSON: () => ({}),
        } as DOMRect;
      });

    try {
      await prepareExportAtomicPagination(root, 100);

      const group = root.querySelector<HTMLElement>(`.${EXPORT_ATOMIC_GROUP_CLASS}`);
      const spacer = root.querySelector<HTMLElement>(`.${EXPORT_ATOMIC_SPACER_CLASS}`);
      expect(group).toBeTruthy();
      expect(group?.contains(heading)).toBe(true);
      expect(group?.contains(block)).toBe(true);
      expect(spacer).toBeTruthy();
      expect(spacer?.style.height).toBe('20px');
      expect(spacer?.nextSibling).toBe(group);
    } finally {
      getBoundingClientRectSpy.mockRestore();
    }
  });
});
