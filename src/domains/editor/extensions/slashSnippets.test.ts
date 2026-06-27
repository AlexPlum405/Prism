import { describe, expect, it } from 'vitest';
import {
  formatSlashSnippetTimestamp,
  getSlashSnippetEdit,
} from './slashSnippets';

describe('slashSnippets', () => {
  it('formats /time snippets with minute precision', () => {
    expect(formatSlashSnippetTimestamp(new Date(2026, 5, 25, 9, 7))).toBe('2026-06-25 09:07');
  });

  it('expands supported MiaoYan-style slash commands before the cursor', () => {
    const doc = '计划： /table';
    const edit = getSlashSnippetEdit(doc, doc.length, new Date(2026, 5, 25, 9, 7));

    expect(edit).toMatchObject({
      from: '计划： '.length,
      to: doc.length,
    });
    expect(edit?.insert).toContain('| 项目 | 状态 | 备注 |');
  });

  it('selects useful placeholder text after inserting image snippets', () => {
    const doc = '/img';
    const edit = getSlashSnippetEdit(doc, doc.length);

    expect(edit?.insert).toBe('![图片描述](图片路径)');
    expect(edit?.selectionAnchor).toBe(2);
    expect(edit?.selectionHead).toBe(6);
  });

  it('ignores unsupported commands and ordinary path text', () => {
    expect(getSlashSnippetEdit('/unknown', '/unknown'.length)).toBeNull();
    expect(getSlashSnippetEdit('docs/path/to/file', 'docs/path/to/file'.length)).toBeNull();
  });
});
