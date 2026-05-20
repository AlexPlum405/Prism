import { describe, expect, it } from 'vitest';
import {
  getSlashMenuCompletionOptions,
  getSlashMenuItems,
  getSlashMenuTrigger,
} from './slashMenu';

describe('slashMenu', () => {
  it('detects slash triggers at the start of a line or after whitespace', () => {
    expect(getSlashMenuTrigger('/')).toEqual({ fromOffset: 0, query: '' });
    expect(getSlashMenuTrigger('/mermaid')).toEqual({ fromOffset: 0, query: 'mermaid' });
    expect(getSlashMenuTrigger('  /table')).toEqual({ fromOffset: 2, query: 'table' });
    expect(getSlashMenuTrigger('text/inline')).toBeNull();
  });

  it('keeps Notion-inspired insertions as plain Markdown or safe HTML snippets', () => {
    const items = getSlashMenuItems();
    const labels = items.map((item) => item.label);

    expect(labels).toEqual(expect.arrayContaining([
      '标题',
      '表格',
      'Mermaid 图表',
      'KaTeX 公式',
      'Callout: Note',
      'Callout: Warning',
      'Callout: Tip',
      'Callout: Important',
      'Toggle 折叠块',
      '代码块',
      '分割线',
      '图片',
      '链接',
      '导出设置块',
      '模板：会议纪要',
      '模板：PRD',
      '模板：技术方案',
      '模板：周报',
      '模板：公众号长文',
      '模板：论文草稿',
    ]));

    expect(items.find((item) => item.id === 'heading')?.insert).toContain('## 标题');
    expect(items.find((item) => item.id === 'mermaid')?.insert).toContain('```mermaid');
    expect(items.find((item) => item.id === 'katex')?.insert).toContain('$$');
    expect(items.find((item) => item.id === 'callout-note')?.insert).toContain('> [!NOTE]');
    expect(items.find((item) => item.id === 'callout-important')?.insert).toContain('> [!IMPORTANT]');
    expect(items.find((item) => item.id === 'toggle')?.insert).toContain('<details>');
    expect(items.find((item) => item.id === 'divider')?.insert).toBe('---\n');
    expect(items.find((item) => item.id === 'image')?.insert).toContain('![描述]');
    expect(items.find((item) => item.id === 'link')?.insert).toContain('[链接文本]');
    expect(items.find((item) => item.id === 'export-settings')?.insert).toContain('export:');
  });

  it('maps slash items to CodeMirror completion options', () => {
    const options = getSlashMenuCompletionOptions();
    const table = options.find((option) => option.label === '表格');
    const template = options.find((option) => option.label === '模板：会议纪要');

    expect(table?.apply).not.toContain('| Column 1 | Column 2 | Column 3 |');
    expect(table?.type).toBe('keyword');
    expect(template?.apply).toContain('# 会议纪要');
    expect(template?.type).toBe('text');
  });
});
