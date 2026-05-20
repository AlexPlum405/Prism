import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LinkDiagnosticsPanel } from './LinkDiagnosticsPanel';

describe('LinkDiagnosticsPanel', () => {
  it('does not render when hidden', () => {
    render(
      <LinkDiagnosticsPanel
        visible={false}
        diagnostics={[]}
        onClose={vi.fn()}
        onSelect={vi.fn()}
      />,
    );

    const dialog = screen.queryByRole('dialog', { name: '链接问题' });
    expect(dialog).toBeInTheDocument();
    expect(dialog).not.toHaveClass('is-active');
  });

  it('lists diagnostics and jumps to the selected source line', () => {
    const onSelect = vi.fn();
    render(
      <LinkDiagnosticsPanel
        visible
        diagnostics={[
          {
            line: 8,
            column: 3,
            kind: 'missing-file',
            message: '未找到链接文件 docs/missing.md',
            target: 'docs/missing.md',
          },
        ]}
        onClose={vi.fn()}
        onSelect={onSelect}
      />,
    );

    expect(screen.getByRole('dialog', { name: '链接问题' })).toBeInTheDocument();
    expect(screen.getByText('缺失文件')).toBeInTheDocument();
    expect(screen.getByText('未找到链接文件 docs/missing.md')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /未找到链接文件/ }));
    expect(onSelect).toHaveBeenCalledWith(8);
  });
});
