import { describe, expect, it } from 'vitest';
import {
  getPresentationDeck,
  getPresentationSlides,
  hasPresentationSlides,
} from './presentation';

describe('presentation markdown splitting', () => {
  it('splits slides by standalone horizontal rule separators', () => {
    const slides = getPresentationSlides('# 开场\n\n---\n\n## 第二页');

    expect(slides).toHaveLength(2);
    expect(slides[0].markdown).toBe('# 开场');
    expect(slides[1].markdown).toBe('## 第二页');
    expect(hasPresentationSlides('# 开场\n\n---\n\n## 第二页')).toBe(true);
  });

  it('ignores YAML front matter before slide splitting', () => {
    const slides = getPresentationSlides('---\ntitle: Deck\n---\n\n# 第一页\n\n---\n\n# 第二页');

    expect(slides).toHaveLength(2);
    expect(slides[0].markdown).toBe('# 第一页');
    expect(slides[1].markdown).toBe('# 第二页');
  });

  it('removes leading Reveal config comments and extracts slide background attributes', () => {
    const deck = getPresentationDeck([
      '<!--',
      'transition: none',
      'controls: false',
      'progress: false',
      'slideNumber: c/t',
      'highlight.lineNumbers: true',
      '-->',
      '# 第一页',
      '',
      '---',
      '<!-- .slide: data-background="#F8CB9E" -->',
      '## 背景页',
      '',
      '---',
      '<!-- .slide: data-background-iframe="https://example.com/" -->',
    ].join('\n'));
    const { slides } = deck;

    expect(deck.config).toMatchObject({
      transition: 'none',
      controls: false,
      progress: false,
      slideNumber: 'c/t',
      'highlight.lineNumbers': true,
    });
    expect(slides).toHaveLength(3);
    expect(slides[0].markdown).toBe('# 第一页');
    expect(slides[1]).toMatchObject({
      background: '#F8CB9E',
      markdown: '## 背景页',
    });
    expect(slides[2]).toMatchObject({
      backgroundIframe: 'https://example.com/',
      markdown: '',
    });
  });

  it('converts Reveal element comments into fragment markup for presentation steps', () => {
    const [slide] = getPresentationSlides('- 第一步 <!-- .element: class="fragment" data-fragment-index="1" -->');

    expect(slide.markdown).toBe('- <span class="fragment" data-fragment-index="1">第一步</span>');
  });
});
