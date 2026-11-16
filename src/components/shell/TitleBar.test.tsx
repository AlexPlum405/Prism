import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TitleBar } from './TitleBar';

vi.mock('../../domains/workspace/services/platform', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../domains/workspace/services/platform')>();
  return { ...actual, getRuntimePlatform: () => 'mac' };
});

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

describe('TitleBar macOS drag regions', () => {
  it('marks blank titlebar areas as draggable without making buttons draggable', () => {
    const { container } = render(
      <TitleBar
        docName="演示.md"
        menuSections={menuSections}
        onMenuAction={vi.fn()}
        sidebarVisible
        onToggleSidebar={vi.fn()}
      />,
    );

    // 根容器、左侧组、菜单容器、菜单项包裹层、空白带、右侧操作区
    expect(container.querySelectorAll('[data-tauri-drag-region]').length).toBeGreaterThanOrEqual(6);

    const menuButton = screen.getByRole('button', { name: '文件' });
    const sidebarToggle = screen.getByRole('button', { name: /侧边栏/ });
    expect(menuButton).not.toHaveAttribute('data-tauri-drag-region');
    expect(sidebarToggle).not.toHaveAttribute('data-tauri-drag-region');

    // 拖动属性只落在容器上，菜单点击仍照常展开
    fireEvent.click(menuButton);
    expect(menuButton).toHaveAttribute('aria-expanded', 'true');
  });
});
