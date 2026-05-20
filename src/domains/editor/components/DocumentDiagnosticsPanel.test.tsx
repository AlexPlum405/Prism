import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { DocumentDiagnosticsPanel } from './DocumentDiagnosticsPanel';

describe('DocumentDiagnosticsPanel', () => {
  it('lists actionable diagnostics and jumps to their source lines', () => {
    const onSelect = vi.fn();
    render(
      <DocumentDiagnosticsPanel
        visible={true}
        diagnostics={[
          {
            action: '修正路径',
            column: 3,
            kind: 'image',
            line: 8,
            message: '未找到图片文件 assets/missing.png',
            reason: '本地图片不存在',
            severity: 'error',
            source: 'image-diagnostics',
          },
        ]}
        onClose={vi.fn()}
        onSelect={onSelect}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /未找到图片文件/ }));

    expect(screen.getByText('1 个问题')).toBeInTheDocument();
    expect(screen.getByText('图片')).toBeInTheDocument();
    expect(screen.getByText('8:3')).toBeInTheDocument();
    expect(onSelect).toHaveBeenCalledWith(8);
  });

  it('closes on Escape', () => {
    const onClose = vi.fn();
    render(
      <DocumentDiagnosticsPanel
        visible={true}
        diagnostics={[]}
        onClose={onClose}
        onSelect={vi.fn()}
      />,
    );

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
