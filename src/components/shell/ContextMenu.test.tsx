import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ContextMenu } from './ContextMenu';

describe('ContextMenu', () => {
  it('shows disabled reasons without running disabled actions', () => {
    const onAction = vi.fn();
    const onClose = vi.fn();

    render(
      <ContextMenu
        x={24}
        y={32}
        items={[
          {
            label: '导出为 PDF',
            action: 'exportPdf',
            disabled: true,
            disabledReason: '仅 Markdown 文稿可导出',
          },
        ]}
        onAction={onAction}
        onClose={onClose}
      />,
    );

    expect(screen.getByText('导出为 PDF')).toBeInTheDocument();
    expect(screen.getByText('仅 Markdown 文稿可导出')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('menuitem'));

    expect(onAction).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('closes when Escape is pressed', () => {
    const onAction = vi.fn();
    const onClose = vi.fn();

    render(
      <ContextMenu
        x={24}
        y={32}
        items={[{ label: '复制', action: 'copy' }]}
        onAction={onAction}
        onClose={onClose}
      />,
    );

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(onAction).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
