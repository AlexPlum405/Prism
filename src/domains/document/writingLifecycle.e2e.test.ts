import { describe, expect, it, beforeEach } from 'vitest';
import { useDocumentStore } from './store';
import { markdownToHtml } from '../../lib/markdownToHtml';

// 核心写作链路端到端：打开 → 编辑（标记脏）→ 保存中 → 已保存 → 再编辑 → 导出渲染。
// 串联 document store 状态机与导出渲染，确保「导出的内容始终跟随最新编辑」且状态一致。
beforeEach(() => {
  useDocumentStore.setState({ currentDocument: null });
});

describe('核心写作链路 (编辑→保存→导出)', () => {
  it('从打开到保存的状态机按预期流转', () => {
    const store = useDocumentStore.getState();
    store.openDocument('/tmp/note.md', 'note.md', '# 初稿', { size: 6, mtimeMs: 1000 });
    expect(useDocumentStore.getState().currentDocument).toMatchObject({
      saveStatus: 'saved',
      isDirty: false,
    });

    // 编辑 → 脏
    useDocumentStore.getState().updateContent('# 初稿\n\n正文一段。');
    expect(useDocumentStore.getState().currentDocument).toMatchObject({
      saveStatus: 'dirty',
      isDirty: true,
    });

    // 保存中 → 已保存
    useDocumentStore.getState().markSaving('/tmp/note.md');
    expect(useDocumentStore.getState().currentDocument?.saveStatus).toBe('saving');
    useDocumentStore.getState().markSaved('/tmp/note.md', { size: 20, mtimeMs: 2000 });
    expect(useDocumentStore.getState().currentDocument).toMatchObject({
      saveStatus: 'saved',
      isDirty: false,
      lastKnownMtime: 2000,
    });
  });

  it('导出渲染始终反映 store 中的最新编辑内容', () => {
    useDocumentStore.getState().openDocument('/tmp/note.md', 'note.md', '# 旧标题');
    useDocumentStore.getState().updateContent([
      '# 新标题',
      '',
      '> [!NOTE]',
      '> 提示内容',
      '',
      '| 列 | 值 |',
      '| --- | --- |',
      '| A | 1 |',
    ].join('\n'));

    const latest = useDocumentStore.getState().currentDocument?.content ?? '';
    const html = markdownToHtml(latest);

    // 导出内容跟随最新编辑
    expect(html).toContain('新标题');
    expect(html).not.toContain('旧标题');
    // 富内容正确渲染
    expect(html).toContain('prism-callout--note');
    expect(html).toMatch(/<table[ >]/);
    // 未保存的脏状态不阻断导出渲染
    expect(useDocumentStore.getState().currentDocument?.isDirty).toBe(true);
  });

  it('保存失败后再次编辑可恢复为可保存的脏状态，且导出仍可用', () => {
    useDocumentStore.getState().openDocument('/tmp/note.md', 'note.md', '# A');
    useDocumentStore.getState().updateContent('# A 修改');
    useDocumentStore.getState().markSaveFailed(new Error('disk full'), '/tmp/note.md');
    expect(useDocumentStore.getState().currentDocument?.saveStatus).toBe('failed');

    // 再次编辑应清除错误、回到 dirty
    useDocumentStore.getState().updateContent('# A 再修改');
    expect(useDocumentStore.getState().currentDocument).toMatchObject({
      saveStatus: 'dirty',
      saveError: null,
    });

    // 导出渲染不受先前保存失败影响
    const html = markdownToHtml(useDocumentStore.getState().currentDocument?.content ?? '');
    expect(html).toContain('A 再修改');
  });

  it('新建模板文档为脏草稿，导出可立即渲染模板内容', () => {
    useDocumentStore.getState().createNewDocument('# 模板\n\n- 待办', 'draft.md');
    expect(useDocumentStore.getState().currentDocument).toMatchObject({
      path: '',
      saveStatus: 'dirty',
      isDirty: true,
    });

    const html = markdownToHtml(useDocumentStore.getState().currentDocument?.content ?? '');
    expect(html).toContain('模板');
    expect(html).toContain('<li');
  });
});
