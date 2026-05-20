import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TypographyDiagnosticsPanel } from './TypographyDiagnosticsPanel';

describe('TypographyDiagnosticsPanel', () => {
  it('does not render when hidden', () => {
    render(
      <TypographyDiagnosticsPanel
        visible={false}
        diagnostics={[]}
        onClose={vi.fn()}
        onSelect={vi.fn()}
      />,
    );

    const dialog = screen.queryByRole('dialog', { name: '排版提示' });
    expect(dialog).toBeInTheDocument();
    expect(dialog).not.toHaveClass('is-active');
  });

  it('lists diagnostics and jumps to the selected source line', () => {
    const onSelect = vi.fn();
    render(
      <TypographyDiagnosticsPanel
        visible
        diagnostics={[
          {
            line: 5,
            column: 2,
            kind: 'cjk-latin-spacing',
            message: '中英文之间缺少空格',
            suggestion: '在中文与英文/数字之间补一个半角空格。',
          },
        ]}
        onClose={vi.fn()}
        onSelect={onSelect}
      />,
    );

    expect(screen.getByRole('dialog', { name: '排版提示' })).toBeInTheDocument();
    expect(screen.getByText('间距')).toBeInTheDocument();
    expect(screen.getByText('中英文之间缺少空格')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /中英文之间缺少空格/ }));
    expect(onSelect).toHaveBeenCalledWith(5);
  });

  it('keeps long diagnostic lists navigable and closable', () => {
    const onClose = vi.fn();
    const onSelect = vi.fn();
    const diagnostics = Array.from({ length: 250 }, (_, index) => ({
      line: index + 1,
      column: 3,
      kind: 'cjk-latin-spacing' as const,
      message: `第 ${index + 1} 条排版提示`,
      suggestion: '在中文与英文/数字之间补一个半角空格。',
    }));

    render(
      <TypographyDiagnosticsPanel
        visible
        diagnostics={diagnostics}
        onClose={onClose}
        onSelect={onSelect}
      />,
    );

    expect(screen.getByRole('dialog', { name: '排版提示' })).toBeInTheDocument();
    expect(screen.getByText('第 1 条排版提示')).toBeInTheDocument();
    expect(screen.getByText('第 250 条排版提示')).toBeInTheDocument();
    expect(screen.getByText('250:3')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /第 250 条排版提示/ }));
    expect(onSelect).toHaveBeenCalledWith(250);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
