import { describe, expect, it } from 'vitest';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import { remarkImageSize } from './remarkImageSize';

function parse(markdown: string) {
  const processor = unified().use(remarkParse).use(remarkGfm).use(remarkImageSize);
  return processor.runSync(processor.parse(markdown)) as any;
}

function firstImage(tree: any) {
  const paragraph = tree.children.find((node: any) => node.type === 'paragraph');
  return paragraph.children.find((node: any) => node.type === 'image');
}

describe('remarkImageSize', () => {
  it('attaches style and structured size to the image node', () => {
    const tree = parse('![封面](assets/a.png){width=320}');
    const image = firstImage(tree);

    expect(image.data.hProperties.style).toBe('width: 320px; height: auto;');
    expect(image.data.prismImageSize).toEqual({ width: '320px' });
  });

  it('removes the attribute text from the paragraph', () => {
    const tree = parse('![封面](assets/a.png){width=40%}');
    const paragraph = tree.children[0];

    expect(paragraph.children).toHaveLength(1);
    expect(paragraph.children[0].type).toBe('image');
  });

  it('keeps the text after the attribute', () => {
    const tree = parse('![封面](assets/a.png){width=320} 图片说明');
    const paragraph = tree.children[0];

    expect(paragraph.children[1]).toMatchObject({ type: 'text', value: ' 图片说明' });
  });

  it('leaves plain images untouched', () => {
    const tree = parse('![封面](assets/a.png)');
    const image = firstImage(tree);

    expect(image.data?.hProperties?.style).toBeUndefined();
    expect(image.data?.prismImageSize).toBeUndefined();
  });

  it('ignores invalid attributes instead of dropping content', () => {
    const tree = parse('![封面](assets/a.png){width=abc}');
    const paragraph = tree.children[0];

    expect(paragraph.children).toHaveLength(2);
    expect(paragraph.children[1].value).toBe('{width=abc}');
  });
});
