import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useIslandLayout } from './useIslandLayout';

/** .island-main 的 clientWidth；扣掉左右各 18 后 available=1440，默认侧栏 268，右缘 286。 */
const CLIENT_WIDTH = 1476;

type LayoutApi = ReturnType<typeof useIslandLayout>;
let api: LayoutApi | null = null;

function Harness({ sidebarVisible, flushLayout = false }: { sidebarVisible: boolean; flushLayout?: boolean }) {
  const layout = useIslandLayout({ paneCount: 2, sidebarVisible, flushLayout });
  api = layout;
  return <div ref={layout.containerRef} />;
}

const edge = () => document.documentElement.style.getPropertyValue('--island-sidebar-edge');

describe('useIslandLayout 侧栏浮岛右缘', () => {
  let originalClientWidth: PropertyDescriptor | undefined;

  beforeEach(() => {
    originalClientWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth');
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
      configurable: true,
      get: () => CLIENT_WIDTH,
    });
    document.documentElement.style.removeProperty('--island-sidebar-edge');
  });

  afterEach(() => {
    if (originalClientWidth) {
      Object.defineProperty(HTMLElement.prototype, 'clientWidth', originalClientWidth);
    }
    document.documentElement.style.removeProperty('--island-sidebar-edge');
  });

  it('把右缘写进 CSS 变量，侧栏宽度变化时跟着更新', () => {
    render(<Harness sidebarVisible />);
    expect(api?.widths.sidebar).toBe(268);
    expect(edge()).toBe('286px');

    act(() => api?.resizeSidebarTo(320));
    expect(api?.widths.sidebar).toBe(320);
    expect(edge()).toBe('338px');
  });

  it('白昼主题去掉外留白后，右缘从 0 起算', () => {
    render(<Harness sidebarVisible flushLayout />);
    expect(api?.widths.sidebar).toBe(268);
    expect(edge()).toBe('268px');
  });

  it('收起侧栏时冻结右缘，重新展开后才恢复跟随', () => {
    const { rerender } = render(<Harness sidebarVisible />);
    expect(edge()).toBe('286px');

    rerender(<Harness sidebarVisible={false} />);
    expect(api?.widths.sidebar).toBe(0);
    expect(edge()).toBe('286px');

    rerender(<Harness sidebarVisible />);
    act(() => api?.resizeSidebarTo(300));
    expect(edge()).toBe('318px');
  });
});
