import { describe, expect, it } from 'vitest';
import {
  MARKDOWN_TEMPLATES,
  getMarkdownTemplateInsertEdit,
  isMarkdownTemplateId,
  resolveMarkdownTemplateContent,
} from './templates';

describe('markdown templates', () => {
  it('defines the built-in writing templates from the product plan', () => {
    expect(Object.keys(MARKDOWN_TEMPLATES)).toEqual([
      'readme',
      'prd',
      'meeting',
      'weekly',
      'technicalPlan',
      'article',
      'paperDraft',
      'readingNote',
      'researchSummary',
      'whitePaper',
    ]);
  });

  it('defines academic templates as Markdown-only document skeletons', () => {
    expect(MARKDOWN_TEMPLATES.paperDraft.content).toContain('## 参考文献');
    expect(MARKDOWN_TEMPLATES.readingNote.content).toContain('## 关键摘录');
    expect(MARKDOWN_TEMPLATES.researchSummary.content).toContain('## 证据链');
    expect(MARKDOWN_TEMPLATES.whitePaper.content).toContain('## 执行摘要');
  });

  it('inserts a template at the cursor with blank-line boundaries', () => {
    const doc = 'Intro textOutro text';
    const edit = getMarkdownTemplateInsertEdit(
      doc,
      'Intro text'.length,
      'Intro text'.length,
      'weekly',
      { date: '2026-05-19' },
    );
    const nextDoc = `${doc.slice(0, edit.from)}${edit.insert}${doc.slice(edit.to)}`;

    expect(nextDoc).toContain('Intro text\n\n# 周报：2026-05-19');
    expect(nextDoc).toContain('需要协助');
    expect(nextDoc).toContain('\n\nOutro text');
    expect(edit.selectionFrom).toBe(edit.selectionTo);
  });

  it('resolves only supported template placeholders', () => {
    expect(resolveMarkdownTemplateContent(
      '# {{title}}\n{{date}}\n{{author}}\n{{unknown}}',
      { title: '标题', date: '2026-05-19', author: 'Alex' },
    )).toBe('# 标题\n2026-05-19\nAlex\n{{unknown}}');
  });

  it('replaces the current selection with the chosen template', () => {
    const doc = 'Replace me';
    const edit = getMarkdownTemplateInsertEdit(doc, 0, doc.length, 'readme');

    expect(`${doc.slice(0, edit.from)}${edit.insert}${doc.slice(edit.to)}`.startsWith('# 项目名称')).toBe(true);
  });

  it('guards template ids coming from editor events', () => {
    expect(isMarkdownTemplateId('prd')).toBe(true);
    expect(isMarkdownTemplateId('paperDraft')).toBe(true);
    expect(isMarkdownTemplateId('unknown')).toBe(false);
  });
});
