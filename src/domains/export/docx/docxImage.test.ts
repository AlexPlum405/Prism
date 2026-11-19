import { describe, expect, it } from 'vitest';
import { getDocxImageMaxWidth } from './docxImage';
import { DOCX_IMAGE_MAX_WIDTH } from '../exportConstants';

describe('getDocxImageMaxWidth', () => {
  it('uses the pixel width written in markdown', () => {
    expect(getDocxImageMaxWidth({ width: '320px' })).toBe(320);
  });

  it('converts percentage widths against the text column', () => {
    expect(getDocxImageMaxWidth({ width: '40%' })).toBe(Math.round(DOCX_IMAGE_MAX_WIDTH * 0.4));
  });

  it('never exceeds the docx text column', () => {
    expect(getDocxImageMaxWidth({ width: '4096px' })).toBe(DOCX_IMAGE_MAX_WIDTH);
    expect(getDocxImageMaxWidth({ width: '100%' })).toBe(DOCX_IMAGE_MAX_WIDTH);
  });

  it('returns undefined when no size is set', () => {
    expect(getDocxImageMaxWidth(undefined)).toBeUndefined();
    expect(getDocxImageMaxWidth({})).toBeUndefined();
    expect(getDocxImageMaxWidth({ width: 'abc' })).toBeUndefined();
  });
});
