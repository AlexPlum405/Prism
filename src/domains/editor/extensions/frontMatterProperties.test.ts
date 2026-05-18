import { describe, expect, it } from 'vitest';
import {
  parseDocumentFrontMatter,
  updateDocumentFrontMatter,
} from './frontMatterProperties';

describe('frontMatterProperties', () => {
  it('parses editable document metadata while preserving unknown yaml data', () => {
    const parsed = parseDocumentFrontMatter(`---
title: 文章标题
tags: [Prism, Markdown]
description: 本地写作
author: Alex
date: 2026-05-18
status: draft
export:
  template: business
custom: keep
---
# Body`);

    expect(parsed.properties).toEqual({
      title: '文章标题',
      tags: 'Prism, Markdown',
      description: '本地写作',
      author: 'Alex',
      date: '2026-05-18',
      status: 'draft',
      exportRaw: 'template: business',
    });
    expect(parsed.data.custom).toBe('keep');
    expect(parsed.body).toBe('# Body');
  });

  it('updates front matter as the single source of truth', () => {
    const next = updateDocumentFrontMatter('# Body', {
      title: '文章标题',
      tags: 'Prism, Markdown',
      description: '本地写作',
      author: 'Alex',
      date: '2026-05-18',
      status: 'draft',
      exportRaw: 'template: business\ntoc: true',
    });

    expect(next).toContain('title: 文章标题');
    expect(next).toContain('tags:');
    expect(next).toContain('- Prism');
    expect(next).toContain('export:');
    expect(next).toContain('template: business');
    expect(next).toContain('# Body');
  });

  it('preserves unknown fields when editing known properties', () => {
    const next = updateDocumentFrontMatter(`---
custom: keep
title: Old
---
Body`, {
      title: 'New',
      tags: '',
      description: '',
      author: '',
      date: '',
      status: '',
      exportRaw: '',
    });

    expect(next).toContain('custom: keep');
    expect(next).toContain('title: New');
    expect(next).toContain('Body');
  });

  it('refuses to rewrite invalid yaml front matter', () => {
    expect(() => updateDocumentFrontMatter(`---
title: [broken
---
Body`, {
      title: 'New',
      tags: '',
      description: '',
      author: '',
      date: '',
      status: '',
      exportRaw: '',
    })).toThrow('不是有效 YAML');
  });
});
