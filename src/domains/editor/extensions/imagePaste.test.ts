import { beforeEach, describe, expect, it, vi } from 'vitest';

const fsMock = vi.hoisted(() => ({
  exists: vi.fn(),
  mkdir: vi.fn(),
  readFile: vi.fn(),
  writeFile: vi.fn(),
}));

vi.mock('@tauri-apps/plugin-fs', () => fsMock);

import {
  formatPastedImageTimestamp,
  getClipboardImageExtension,
  getMarkdownImageForPath,
  getPastedImageAssetTarget,
  isSupportedImageFile,
  isSupportedImagePath,
  saveClipboardImage,
  saveImageAssetFromPath,
  sanitizeAssetSegment,
} from './imagePaste';

describe('image paste assets', () => {
  beforeEach(() => {
    fsMock.exists.mockReset();
    fsMock.mkdir.mockReset();
    fsMock.readFile.mockReset();
    fsMock.writeFile.mockReset();
  });

  it('maps clipboard image mime types to stable file extensions', () => {
    expect(getClipboardImageExtension('image/png')).toBe('png');
    expect(getClipboardImageExtension('image/jpeg')).toBe('jpg');
    expect(getClipboardImageExtension('image/webp')).toBe('webp');
    expect(getClipboardImageExtension('', 'photo.jpeg')).toBe('jpg');
    expect(getClipboardImageExtension('application/octet-stream')).toBe('png');
  });

  it('recognizes draggable image files and normalizes native paths for markdown', () => {
    expect(isSupportedImageFile({ name: 'diagram.PNG', type: '' })).toBe(true);
    expect(isSupportedImageFile({ name: 'notes.md', type: 'text/markdown' })).toBe(false);
    expect(isSupportedImagePath('/tmp/diagram.webp')).toBe(true);
    expect(isSupportedImagePath('/tmp/notes.md')).toBe(false);
    expect(getMarkdownImageForPath('/tmp/My Image.png', 'My Image.png')).toBe('![My Image.png](/tmp/My Image.png)');
    expect(getMarkdownImageForPath('C:\\tmp\\image.png')).toBe('![](C:/tmp/image.png)');
  });

  it('sanitizes document names for asset folder names', () => {
    expect(sanitizeAssetSegment('My Product PRD.md')).toBe('My-Product-PRD');
    expect(sanitizeAssetSegment('中文 长文.md')).toBe('中文-长文');
  });

  it('builds deterministic asset paths next to the current markdown document', () => {
    const target = getPastedImageAssetTarget({
      documentName: 'Plan.md',
      documentPath: '/repo/docs/Plan.md',
      extension: 'png',
      now: new Date('2026-05-15T01:02:03'),
    });

    expect(formatPastedImageTimestamp(new Date('2026-05-15T01:02:03'))).toBe('20260515-010203');
    expect(target).toEqual({
      assetDir: '/repo/docs/assets/Plan',
      filename: 'image-20260515-010203.png',
      filePath: '/repo/docs/assets/Plan/image-20260515-010203.png',
      markdownPath: 'assets/Plan/image-20260515-010203.png',
    });
  });

  it('adds a numeric suffix for same-second collisions', () => {
    expect(getPastedImageAssetTarget({
      documentName: 'Plan.md',
      documentPath: '/repo/docs/Plan.md',
      extension: 'png',
      index: 2,
      now: new Date('2026-05-15T01:02:03'),
    }).filename).toBe('image-20260515-010203-3.png');
  });

  it('writes pasted clipboard images into the document asset folder', async () => {
    fsMock.exists.mockResolvedValue(false);
    const file = new File([new Uint8Array([1, 2, 3])], 'clip.png', { type: 'image/png' });

    const markdown = await saveClipboardImage({
      documentName: 'Plan.md',
      documentPath: '/repo/docs/Plan.md',
      file,
      now: new Date('2026-05-15T01:02:03'),
    });

    expect(fsMock.mkdir).toHaveBeenCalledWith('/repo/docs/assets/Plan', { recursive: true });
    expect(fsMock.writeFile).toHaveBeenCalledWith(
      '/repo/docs/assets/Plan/image-20260515-010203.png',
      new Uint8Array([1, 2, 3]),
    );
    expect(markdown).toBe('![image-20260515-010203.png](assets/Plan/image-20260515-010203.png)');
  });

  it('keeps pasted clipboard images unique when names collide in the same second', async () => {
    const occupiedPath = '/repo/docs/assets/Plan/image-20260515-010203.png';
    fsMock.exists.mockImplementation(async (path: string) => path === '/repo/docs/assets/Plan' || path === occupiedPath);
    const file = new File([new Uint8Array([4, 5, 6])], 'clip.png', { type: 'image/png' });

    const markdown = await saveClipboardImage({
      documentName: 'Plan.md',
      documentPath: '/repo/docs/Plan.md',
      file,
      now: new Date('2026-05-15T01:02:03'),
    });

    expect(fsMock.mkdir).not.toHaveBeenCalled();
    expect(fsMock.writeFile).toHaveBeenCalledWith(
      '/repo/docs/assets/Plan/image-20260515-010203-2.png',
      new Uint8Array([4, 5, 6]),
    );
    expect(markdown).toBe('![image-20260515-010203-2.png](assets/Plan/image-20260515-010203-2.png)');
  });

  it('copies a selected image file into the document asset folder', async () => {
    fsMock.exists.mockResolvedValue(false);
    fsMock.readFile.mockResolvedValue(new Uint8Array([7, 8, 9]));

    const markdown = await saveImageAssetFromPath({
      documentName: 'Plan.md',
      documentPath: '/repo/docs/Plan.md',
      sourcePath: '/Users/alex/Pictures/photo.jpeg',
      now: new Date('2026-05-15T01:02:03'),
    });

    expect(fsMock.readFile).toHaveBeenCalledWith('/Users/alex/Pictures/photo.jpeg');
    expect(fsMock.writeFile).toHaveBeenCalledWith(
      '/repo/docs/assets/Plan/image-20260515-010203.jpg',
      new Uint8Array([7, 8, 9]),
    );
    expect(markdown).toBe('![image-20260515-010203.jpg](assets/Plan/image-20260515-010203.jpg)');
  });
});
