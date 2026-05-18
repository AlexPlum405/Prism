import { describe, expect, it } from 'vitest';
import {
  applyCalloutMetadataToMdastBlockquote,
  parseMarkdownCalloutMarker,
} from './callouts';

describe('callouts', () => {
  it('parses supported Markdown callout markers', () => {
    expect(parseMarkdownCalloutMarker('[!NOTE]')).toEqual({
      kind: 'note',
      label: 'Note',
      title: 'Note',
    });
    expect(parseMarkdownCalloutMarker('[!WARNING] 发布前确认')).toEqual({
      kind: 'warning',
      label: 'Warning',
      title: '发布前确认',
    });
    expect(parseMarkdownCalloutMarker('[!TIP]')).toMatchObject({ kind: 'tip' });
    expect(parseMarkdownCalloutMarker('[!INFO]')).toBeNull();
  });

  it('turns blockquote marker paragraphs into callout metadata without changing body content', () => {
    const node = {
      type: 'blockquote',
      children: [
        { type: 'paragraph', children: [{ type: 'text', value: '[!NOTE]' }] },
        { type: 'paragraph', children: [{ type: 'text', value: '正文内容' }] },
      ],
      data: {
        hProperties: {
          'data-source-line': '3',
        },
      },
    };

    const metadata = applyCalloutMetadataToMdastBlockquote(node);
    const hProperties = node.data.hProperties as Record<string, unknown>;

    expect(metadata).toMatchObject({ kind: 'note', title: 'Note' });
    expect(node.children).toHaveLength(1);
    expect(node.children[0].children[0].value).toBe('正文内容');
    expect(hProperties).toMatchObject({
      'data-source-line': '3',
      'data-callout-kind': 'note',
      'data-callout-title': 'Note',
    });
    expect(hProperties.className).toEqual(['prism-callout', 'prism-callout--note']);
  });
});
