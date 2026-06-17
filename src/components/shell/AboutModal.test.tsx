import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AboutModal } from './AboutModal';

describe('AboutModal', () => {
  it('does not render when hidden', () => {
    render(
      <AboutModal
        visible={false}
        onClose={vi.fn()}
        version="1.4.0"
      />,
    );

    expect(screen.queryByRole('dialog', { name: '关于 Prism' })).not.toBeInTheDocument();
  });

  it('shows the current app version and update action', () => {
    const onCheckUpdate = vi.fn();

    render(
      <AboutModal
        visible
        onClose={vi.fn()}
        onCheckUpdate={onCheckUpdate}
        version="1.4.0"
      />,
    );

    expect(screen.getByRole('dialog', { name: '关于 Prism' })).toBeInTheDocument();
    expect(screen.getByText('PRISM · VERSION 1.4.0')).toBeInTheDocument();
    expect(screen.getByText('安静、清晰、纸感、精确、克制的 Markdown 写作器。')).toBeInTheDocument();
    expect(screen.getByText('Prism 专注单个本地文档：源码保持可控，预览保持完整，导出失败时给出能继续行动的诊断。')).toBeInTheDocument();
    expect(screen.getByText('本地写作')).toBeInTheDocument();
    expect(screen.getByText('完整预览')).toBeInTheDocument();
    expect(screen.getByText('可信导出')).toBeInTheDocument();
    expect(screen.getByText('v1.4.0')).toBeInTheDocument();
    expect(screen.queryByText(/AI|云同步|实时协作/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '检查更新' }));
    expect(onCheckUpdate).toHaveBeenCalledTimes(1);
  });
});
