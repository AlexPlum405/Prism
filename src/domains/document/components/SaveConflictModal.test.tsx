import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SaveConflictModal } from './SaveConflictModal';

describe('SaveConflictModal', () => {
  it('does not render when hidden', () => {
    render(
      <SaveConflictModal
        visible={false}
        documentName="a.md"
        error={null}
        busyAction={null}
        onReload={vi.fn()}
        onSaveAs={vi.fn()}
        onOverwrite={vi.fn()}
      />,
    );

    expect(screen.queryByRole('dialog', { name: '文件冲突' })).not.toBeInTheDocument();
  });

  it('exposes the three explicit conflict actions', () => {
    const onReload = vi.fn();
    const onSaveAs = vi.fn();
    const onOverwrite = vi.fn();

    render(
      <SaveConflictModal
        visible
        documentName="a.md"
        error="文件已在磁盘上被外部修改，请先重新加载或另存为。"
        busyAction={null}
        onReload={onReload}
        onSaveAs={onSaveAs}
        onOverwrite={onOverwrite}
      />,
    );

    expect(screen.getByRole('dialog', { name: '文件冲突' })).toBeInTheDocument();
    expect(screen.getByText('a.md')).toBeInTheDocument();
    expect(screen.getByText('文件已在磁盘上被外部修改，请先重新加载或另存为。')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '重新加载磁盘版本' }));
    fireEvent.click(screen.getByRole('button', { name: '保留我的版本并另存为' }));
    fireEvent.click(screen.getByRole('button', { name: '覆盖磁盘版本' }));

    expect(onReload).toHaveBeenCalledTimes(1);
    expect(onSaveAs).toHaveBeenCalledTimes(1);
    expect(onOverwrite).toHaveBeenCalledTimes(1);
  });

  it('shows missing-file actions without offering reload', () => {
    const onReload = vi.fn();
    const onSaveAs = vi.fn();
    const onOverwrite = vi.fn();

    render(
      <SaveConflictModal
        visible
        documentName="missing.md"
        error="原文件不存在：/tmp/missing.md"
        issueKind="missing"
        busyAction={null}
        onReload={onReload}
        onSaveAs={onSaveAs}
        onOverwrite={onOverwrite}
      />,
    );

    expect(screen.getByRole('dialog', { name: '原文件已移动或删除' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '重新加载磁盘版本' })).not.toBeInTheDocument();
    expect(screen.getByText('原文件不存在：/tmp/missing.md')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '保留我的版本并另存为' }));
    fireEvent.click(screen.getByRole('button', { name: '在原路径重新创建' }));

    expect(onReload).not.toHaveBeenCalled();
    expect(onSaveAs).toHaveBeenCalledTimes(1);
    expect(onOverwrite).toHaveBeenCalledTimes(1);
  });

  it('locks the actions while a resolution is running', () => {
    render(
      <SaveConflictModal
        visible
        documentName="a.md"
        error={null}
        busyAction="overwrite"
        onReload={vi.fn()}
        onSaveAs={vi.fn()}
        onOverwrite={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: '重新加载磁盘版本' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '保留我的版本并另存为' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '正在覆盖...' })).toBeDisabled();
  });
});
