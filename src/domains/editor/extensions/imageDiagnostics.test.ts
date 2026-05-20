import { describe, expect, it, vi } from 'vitest';
import { resolveMarkdownImagePath, scanMarkdownImageDiagnostics } from './imageDiagnostics';

describe('markdown image diagnostics', () => {
  it('resolves local image paths from the current document path', () => {
    expect(resolveMarkdownImagePath('assets/photo.png', '/repo/docs/page.md')).toBe('/repo/docs/assets/photo.png');
    expect(resolveMarkdownImagePath('C:\\tmp\\photo.png', '/repo/docs/page.md')).toBe('C:\\tmp\\photo.png');
    expect(resolveMarkdownImagePath('https://example.com/photo.png', '/repo/docs/page.md')).toBeNull();
  });

  it('reports missing, empty, unsupported, and unresolved image targets', async () => {
    const existsPath = vi.fn(async (path: string) => path.endsWith('ok.png'));
    const diagnostics = await scanMarkdownImageDiagnostics([
      '![missing](assets/missing.png)',
      '![]()',
      '![bad](javascript:alert(1))',
      '![remote](https://example.com/remote.png)',
      '![ok](assets/ok.png)',
    ].join('\n'), {
      documentPath: '/repo/docs/page.md',
      existsPath,
    });

    expect(diagnostics).toEqual([
      expect.objectContaining({
        kind: 'missing-file',
        line: 1,
        resolvedPath: '/repo/docs/assets/missing.png',
      }),
      expect.objectContaining({
        kind: 'empty-target',
        line: 2,
      }),
      expect.objectContaining({
        kind: 'unsupported-protocol',
        line: 3,
      }),
    ]);
    expect(existsPath).toHaveBeenCalledWith('/repo/docs/assets/missing.png');
    expect(existsPath).toHaveBeenCalledWith('/repo/docs/assets/ok.png');
  });

  it('blocks relative image paths when the document has not been saved', async () => {
    await expect(scanMarkdownImageDiagnostics('![draft](assets/draft.png)', {
      existsPath: vi.fn(),
    })).resolves.toEqual([
      expect.objectContaining({
        kind: 'unresolved-relative',
        target: 'assets/draft.png',
      }),
    ]);
  });
});
