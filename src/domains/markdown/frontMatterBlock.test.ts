import { describe, expect, it } from 'vitest';
import {
  frontMatterObject,
  frontMatterScalar,
  splitFrontMatterBlock,
} from './frontMatterBlock';

describe('splitFrontMatterBlock', () => {
  it('splits the block from the body', () => {
    const block = splitFrontMatterBlock('---\ntitle: Note\n---\n# Body\n');
    expect(block.hasBlock).toBe(true);
    expect(block.raw).toBe('title: Note');
    expect(block.body).toBe('# Body\n');
  });

  it('accepts CRLF line endings', () => {
    const block = splitFrontMatterBlock('---\r\ntitle: Note\r\n---\r\nBody');
    expect(block.hasBlock).toBe(true);
    expect(block.raw).toBe('title: Note');
    expect(block.body).toBe('Body');
  });

  it('returns the content untouched when there is no block', () => {
    const block = splitFrontMatterBlock('# Just a doc\n');
    expect(block.hasBlock).toBe(false);
    expect(block.raw).toBe('');
    expect(block.body).toBe('# Just a doc\n');
  });

  it('ignores a delimiter that is not at the very start', () => {
    const block = splitFrontMatterBlock('intro\n---\ntitle: Note\n---\n');
    expect(block.hasBlock).toBe(false);
  });
});

describe('frontMatterScalar', () => {
  it('formats dates as yyyy-mm-dd', () => {
    expect(frontMatterScalar(new Date('2026-01-02T00:00:00Z'))).toBe('2026-01-02');
  });

  it('stringifies numbers and strings', () => {
    expect(frontMatterScalar(42)).toBe('42');
    expect(frontMatterScalar(' text ')).toBe(' text ');
  });

  it('returns an empty string for non-scalars', () => {
    expect(frontMatterScalar(undefined)).toBe('');
    expect(frontMatterScalar(null)).toBe('');
    expect(frontMatterScalar(['a'])).toBe('');
    expect(frontMatterScalar({ a: 1 })).toBe('');
  });

  it('does not emit an invalid date', () => {
    expect(frontMatterScalar(new Date('nope'))).toBe('');
  });
});

describe('frontMatterObject', () => {
  it('copies plain objects', () => {
    expect(frontMatterObject({ a: 1 })).toEqual({ a: 1 });
  });

  it('maps arrays and scalars to an empty object', () => {
    expect(frontMatterObject([1, 2])).toEqual({});
    expect(frontMatterObject('x')).toEqual({});
    expect(frontMatterObject(null)).toEqual({});
  });
});
