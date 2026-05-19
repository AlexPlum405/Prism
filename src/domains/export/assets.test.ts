import { describe, expect, it, vi } from 'vitest';

const fsMock = vi.hoisted(() => ({
  readFile: vi.fn(async (_path: string) => new Uint8Array([1, 2, 3])),
}));

vi.mock('@tauri-apps/plugin-fs', () => fsMock);

import {
  bytesToDataUrl,
  dataUrlToBytes,
  getDocxRasterType,
  getExportMediaMimeType,
  getSvgSize,
  prepareSvgForDocx,
  readLocalExportMedia,
  resolveExportMediaPath,
} from './assets';

describe('export assets', () => {
  it('converts bytes and data URLs without losing binary content', () => {
    const bytes = new Uint8Array([0, 1, 2, 255]);
    const dataUrl = bytesToDataUrl(bytes, 'image/png');

    expect(dataUrl).toBe('data:image/png;base64,AAEC/w==');
    expect(Array.from(dataUrlToBytes(dataUrl))).toEqual([0, 1, 2, 255]);
  });

  it('resolves local export media paths relative to the document path', () => {
    expect(resolveExportMediaPath('assets/figure.png?cache=1#frag', '/Users/Alex/docs/demo.md'))
      .toBe('/Users/Alex/docs/assets/figure.png');
    expect(resolveExportMediaPath('/Users/Alex/docs/figure.png')).toBe('/Users/Alex/docs/figure.png');
    expect(resolveExportMediaPath('https://example.com/figure.png', '/Users/Alex/docs/demo.md')).toBeNull();
    expect(resolveExportMediaPath('#heading', '/Users/Alex/docs/demo.md')).toBeNull();
  });

  it('reads local media with MIME metadata for export embedding', async () => {
    fsMock.readFile.mockResolvedValueOnce(new Uint8Array([10, 20]));

    const media = await readLocalExportMedia('diagram.svg', '/Users/Alex/docs/demo.md');

    expect(fsMock.readFile).toHaveBeenCalledWith('/Users/Alex/docs/diagram.svg');
    expect(media).toEqual({
      filePath: '/Users/Alex/docs/diagram.svg',
      bytes: new Uint8Array([10, 20]),
      mimeType: 'image/svg+xml',
    });
  });

  it('derives media MIME and DOCX raster type from file names', () => {
    expect(getExportMediaMimeType('/tmp/a.svg')).toBe('image/svg+xml');
    expect(getExportMediaMimeType('/tmp/a.jpeg')).toBe('image/jpeg');
    expect(getDocxRasterType('image/png', '/tmp/a.bin')).toBe('png');
    expect(getDocxRasterType('application/octet-stream', '/tmp/a.gif')).toBe('gif');
    expect(getDocxRasterType('image/webp', '/tmp/a.webp')).toBeNull();
  });

  it('normalizes SVG size for DOCX fallbacks', () => {
    expect(getSvgSize('<svg viewBox="0 0 120 40"></svg>')).toEqual({ width: 120, height: 40 });

    const prepared = prepareSvgForDocx(`
      <svg viewBox="0 0 120 40" width="100%" height="100%">
        <foreignObject x="0" y="0" width="120" height="40"><div>节点</div></foreignObject>
      </svg>
    `);

    expect(prepared).toContain('width="120"');
    expect(prepared).toContain('height="40"');
    expect(prepared).toContain('<text');
    expect(prepared).toContain('节点');
    expect(prepared).not.toContain('foreignObject');
  });
});
