/**
 * @vitest-environment jsdom
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DocumentPropertiesPanel } from './DocumentPropertiesPanel';

describe('DocumentPropertiesPanel', () => {
  it('edits front matter fields without hiding the markdown source of truth', () => {
    const onApply = vi.fn();
    render(
      <DocumentPropertiesPanel
        visible={true}
        content="# Body"
        onApply={onApply}
        onClose={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText('标题'), { target: { value: '文章标题' } });
    fireEvent.change(screen.getByLabelText('标签'), { target: { value: 'Prism, Markdown' } });
    fireEvent.click(screen.getByRole('button', { name: '应用' }));

    expect(onApply).toHaveBeenCalledWith(expect.stringContaining('title: 文章标题'));
    expect(onApply).toHaveBeenCalledWith(expect.stringContaining('- Prism'));
    expect(onApply).toHaveBeenCalledWith(expect.stringContaining('# Body'));
  });

  it('writes all supported metadata fields back to yaml front matter', () => {
    const onApply = vi.fn();
    const onNotice = vi.fn();
    const onClose = vi.fn();

    render(
      <DocumentPropertiesPanel
        visible={true}
        content={'---\ncustom: keep\n---\n# Body'}
        onApply={onApply}
        onClose={onClose}
        onNotice={onNotice}
      />,
    );

    fireEvent.change(screen.getByLabelText('描述'), { target: { value: '用于导出和搜索' } });
    fireEvent.change(screen.getByLabelText('作者'), { target: { value: 'Alex' } });
    fireEvent.change(screen.getByLabelText('日期'), { target: { value: '2026-05-19' } });
    fireEvent.change(screen.getByLabelText('状态'), { target: { value: 'draft' } });
    fireEvent.change(screen.getByLabelText('导出'), { target: { value: 'template: theme\ntoc: true' } });
    fireEvent.click(screen.getByRole('button', { name: '应用' }));

    expect(onApply).toHaveBeenCalledWith(expect.stringContaining('custom: keep'));
    expect(onApply).toHaveBeenCalledWith(expect.stringContaining('description: 用于导出和搜索'));
    expect(onApply).toHaveBeenCalledWith(expect.stringContaining('author: Alex'));
    expect(onApply).toHaveBeenCalledWith(expect.stringContaining("date: '2026-05-19'"));
    expect(onApply).toHaveBeenCalledWith(expect.stringContaining('status: draft'));
    expect(onApply).toHaveBeenCalledWith(expect.stringContaining('export:'));
    expect(onApply).toHaveBeenCalledWith(expect.stringContaining('toc: true'));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onNotice).toHaveBeenCalledWith('文档属性已更新');
  });

  it('disables applying when existing front matter is invalid yaml', () => {
    render(
      <DocumentPropertiesPanel
        visible={true}
        content={'---\ntitle: [broken\n---\nBody'}
        onApply={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText('当前 Front Matter 不是有效 YAML，请先回到源码修正后再编辑属性。')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '应用' })).toBeDisabled();
  });
});
