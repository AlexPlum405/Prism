import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TitleBar } from './TitleBar';

const menuSections = {
  文件: [{ label: '新建文稿', action: 'newDoc' }],
};

describe('TitleBar sidebar toggle', () => {
  it('renders the panel toggle in the titlebar and flips its label with state', () => {
    const onToggleSidebar = vi.fn();
    const { rerender } = render(
      <TitleBar docName="演示.md" menuSections={menuSections} sidebarVisible onToggleSidebar={onToggleSidebar} />,
    );

    const visibleToggle = screen.getByRole('button', { name: '收起侧边栏' });
    expect(visibleToggle).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(visibleToggle);
    expect(onToggleSidebar).toHaveBeenCalledTimes(1);

    rerender(
      <TitleBar docName="演示.md" menuSections={menuSections} sidebarVisible={false} onToggleSidebar={onToggleSidebar} />,
    );
    const hiddenToggle = screen.getByRole('button', { name: '展开侧边栏' });
    expect(hiddenToggle).toHaveAttribute('aria-pressed', 'false');
    // 同一个按钮、同一个位置：状态切换不新增/不移除节点
    expect(screen.getAllByRole('button', { name: /侧边栏/ })).toHaveLength(1);
  });

  it('renders no toggle when no handler is supplied', () => {
    render(<TitleBar docName="演示.md" menuSections={menuSections} />);
    expect(screen.queryByRole('button', { name: /侧边栏/ })).toBeNull();
  });
});
