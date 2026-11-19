import { describe, expect, it } from 'vitest';
import {
  applyImageWidthToMarkdown,
  formatImageSizeAttribute,
  imageSizeStyle,
  parseImageSizeAttribute,
  parseImageSizeFromText,
} from './imageSize';

describe('parseImageSizeAttribute', () => {
  it('reads pixel and percentage widths', () => {
    expect(parseImageSizeAttribute('{width=320}')).toEqual({ width: '320px' });
    expect(parseImageSizeAttribute('{width=320px}')).toEqual({ width: '320px' });
    expect(parseImageSizeAttribute('{width = 40%}')).toEqual({ width: '40%' });
  });

  it('reads height and combined attributes in any order', () => {
    expect(parseImageSizeAttribute('{height=180}')).toEqual({ height: '180px' });
    expect(parseImageSizeAttribute('{width=320 height=180}')).toEqual({ width: '320px', height: '180px' });
    expect(parseImageSizeAttribute('{height=180 width=40%}')).toEqual({ width: '40%', height: '180px' });
  });

  it('rejects unusable values instead of writing broken css', () => {
    expect(parseImageSizeAttribute('{width=}')).toBeNull();
    expect(parseImageSizeAttribute('{width=0}')).toBeNull();
    expect(parseImageSizeAttribute('{width=-20}')).toBeNull();
    expect(parseImageSizeAttribute('{width=40%}extra')).toBeNull();
    expect(parseImageSizeAttribute('{foo=1}')).toBeNull();
    expect(parseImageSizeAttribute('')).toBeNull();
  });

  it('clamps out-of-range values into the supported window', () => {
    expect(parseImageSizeAttribute('{width=99999}')).toEqual({ width: '4096px' });
    expect(parseImageSizeAttribute('{width=140%}')).toEqual({ width: '100%' });
    expect(parseImageSizeAttribute('{width=2}')).toEqual({ width: '8px' });
  });
});

describe('formatImageSizeAttribute', () => {
  it('round-trips through the attribute syntax', () => {
    expect(formatImageSizeAttribute({ width: '320px' })).toBe('{width=320}');
    expect(formatImageSizeAttribute({ width: '40%' })).toBe('{width=40%}');
    expect(formatImageSizeAttribute({ width: '320px', height: '180px' })).toBe('{width=320 height=180}');
    expect(formatImageSizeAttribute({})).toBe('');
  });
});

describe('imageSizeStyle', () => {
  it('keeps aspect ratio when only width is set', () => {
    expect(imageSizeStyle({ width: '320px' })).toBe('width: 320px; height: auto;');
    expect(imageSizeStyle({ width: '40%' })).toBe('width: 40%; height: auto;');
  });

  it('honours explicit height', () => {
    expect(imageSizeStyle({ width: '320px', height: '180px' })).toBe('width: 320px; height: 180px;');
  });

  it('returns null when nothing is set', () => {
    expect(imageSizeStyle({})).toBeNull();
  });
});

describe('parseImageSizeFromText', () => {
  it('only accepts an attribute immediately after the image', () => {
    const text = '{width=320} 后文';
    expect(parseImageSizeFromText(text, 0)).toEqual({
      size: { width: '320px' },
      endIndex: '{width=320}'.length,
    });
    expect(parseImageSizeFromText('普通文字', 0)).toBeNull();
  });

  it('does not swallow following prose', () => {
    expect(parseImageSizeFromText('{width=320}文字', 0)).toEqual({
      size: { width: '320px' },
      endIndex: 11,
    });
  });
});

describe('applyImageWidthToMarkdown', () => {
  const markdown = [
    '# 标题',
    '',
    '![图一](assets/a.png)',
    '',
    '中间文字',
    '',
    '![图二](assets/b.png){width=200}',
  ].join('\n');

  it('appends an attribute to the selected image only', () => {
    const next = applyImageWidthToMarkdown(markdown, 0, '320px');
    expect(next).toContain('![图一](assets/a.png){width=320}');
    expect(next).toContain('![图二](assets/b.png){width=200}');
  });

  it('replaces an existing attribute in place', () => {
    const next = applyImageWidthToMarkdown(markdown, 1, '80%');
    expect(next).toContain('![图二](assets/b.png){width=80%}');
    expect(next.match(/\{width=/g)).toHaveLength(1);
  });

  it('keeps the document untouched for an out-of-range index', () => {
    expect(applyImageWidthToMarkdown(markdown, 9, '320px')).toBe(markdown);
  });

  it('ignores inline code and fenced code that look like images', () => {
    const source = ['```', '![代码里的图](x.png)', '```', '![真图](y.png)'].join('\n');
    const next = applyImageWidthToMarkdown(source, 0, '200px');
    expect(next).toContain('![代码里的图](x.png)');
    expect(next).toContain('![真图](y.png){width=200}');
  });
});
