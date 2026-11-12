import { describe, expect, it } from 'vitest';
import { createHeadingSlugRegistry, getMarkdownHeadingSlug } from './headingSlug';

/**
 * 这些向量与 src-tauri/src/domain/workspace_index.rs 里的
 * heading_slugs_match_the_frontend_implementation 共用。
 * 任何一端改动都必须同步另一端，否则大纲跳转与深链会指向不存在的锚点。
 */
const SHARED_CASES: Array<[string, string]> = [
  ['Hello, World!', 'hello-world'],
  ['A/B 测试', 'ab-测试'],
  ['snake_case', 'snakecase'],
  ['Deep   Dive', 'deep-dive'],
  ['Intro - Scope', 'intro-scope'],
  ['中文标题 / API', '中文标题-api'],
  ['C++ 入门', 'c-入门'],
  ['  前导后置  ', '前导后置'],
];

describe('getMarkdownHeadingSlug', () => {
  it.each(SHARED_CASES)('slugifies %s as %s', (input, expected) => {
    expect(getMarkdownHeadingSlug(input)).toBe(expected);
  });

  it('drops inline markdown markers', () => {
    expect(getMarkdownHeadingSlug('**Bold** and `code`')).toBe('bold-and-code');
    expect(getMarkdownHeadingSlug('[Link](https://example.com)')).toBe('linkhttpsexamplecom');
  });

  it('returns an empty slug when nothing survives', () => {
    expect(getMarkdownHeadingSlug('!!!')).toBe('');
    expect(getMarkdownHeadingSlug('   ')).toBe('');
  });
});

describe('createHeadingSlugRegistry', () => {
  it('numbers duplicate headings the same way preview and export do', () => {
    const nextSlug = createHeadingSlugRegistry();
    expect([nextSlug('Notes'), nextSlug('Notes'), nextSlug('Notes')]).toEqual([
      'notes',
      'notes-2',
      'notes-3',
    ]);
  });

  it('keeps separate counters for distinct headings', () => {
    const nextSlug = createHeadingSlugRegistry();
    expect([nextSlug('Intro'), nextSlug('Notes'), nextSlug('Intro')]).toEqual([
      'intro',
      'notes',
      'intro-2',
    ]);
  });

  it('returns an empty string for headings that cannot be slugified', () => {
    const nextSlug = createHeadingSlugRegistry();
    expect(nextSlug('???')).toBe('');
  });
});
