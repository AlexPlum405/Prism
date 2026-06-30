import { describe, expect, it } from 'vitest';
import { parseExportFrontMatter } from './frontMatter';

describe('parseExportFrontMatter', () => {
  it('returns the original content when no front matter exists', () => {
    const content = '# Title\n\nBody';

    expect(parseExportFrontMatter(content)).toEqual({
      content,
      frontMatter: null,
    });
  });

  it('parses supported export fields and strips the yaml block', () => {
    const result = parseExportFrontMatter(`---
title: Export Title
author: Alex
date: 2026-05-15
template: business
paper: letter
margin: wide
toc: yes
---
# Body`);

    expect(result.content).toBe('# Body');
    expect(result.frontMatter).toEqual({
      title: 'Export Title',
      author: 'Alex',
      date: '2026-05-15',
      templateId: 'business',
      pdfPaper: 'letter',
      pdfMargin: 'wide',
      toc: true,
    });
  });

  it('accepts explicit Prism field aliases', () => {
    const result = parseExportFrontMatter(`---
templateId: academic
pdfPaper: a4
pdfMargin: compact
toc: "false"
---
Content`);

    expect(result.content).toBe('Content');
    expect(result.frontMatter).toEqual({
      templateId: 'academic',
      pdfPaper: 'a4',
      pdfMargin: 'compact',
      toc: false,
    });
  });

  it('parses nested export overrides used by Prism guide documents', () => {
    const result = parseExportFrontMatter(`---
title: Front Matter Export Override Title
author: Prism QA
date: 2026-06-30
export:
  template: theme
  toc: true
  paper: a4
  margin: narrow
---
# Body`);

    expect(result.content).toBe('# Body');
    expect(result.frontMatter).toEqual({
      title: 'Front Matter Export Override Title',
      author: 'Prism QA',
      date: '2026-06-30',
      templateId: 'theme',
      pdfPaper: 'a4',
      pdfMargin: 'compact',
      toc: true,
    });
  });

  it('strips valid front matter but ignores unsupported values', () => {
    const result = parseExportFrontMatter(`---
template: poster
paper: legal
margin: tiny
toc: maybe
unknown: value
---
Content`);

    expect(result.content).toBe('Content');
    expect(result.frontMatter).toBeNull();
  });

  it('keeps the original content when yaml parsing fails', () => {
    const content = `---
title: [broken
---
Content`;

    expect(parseExportFrontMatter(content)).toEqual({
      content,
      frontMatter: null,
    });
  });
});
