import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MenuSection } from './types';

vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({
    minimize: vi.fn(),
    toggleMaximize: vi.fn(),
    close: vi.fn(),
  }),
}));

type RenderTitleBarProps = {
  isDirty?: boolean;
  menuSections?: MenuSection;
  onMenuAction?: (action: string) => void;
  onRenameDocument?: (name: string) => void | Promise<void>;
  saveError?: string | null;
  saveStatus?: 'saved' | 'dirty' | 'saving' | 'failed' | 'conflict';
};

async function renderTitleBarOn(platform: string, props: RenderTitleBarProps = {}) {
  vi.resetModules();
  Object.defineProperty(navigator, 'platform', {
    value: platform,
    configurable: true,
  });

  const { useDocumentStore } = await import('../../domains/document/store');
  useDocumentStore.getState().createNewDocument('', 'proposal.md');
  useDocumentStore.getState().setViewMode('split');

  const { TitleBar } = await import('./TitleBar');
  return render(<TitleBar docName="proposal.md" isDirty={false} {...props} />);
}

afterEach(() => {
  vi.clearAllMocks();
});

describe('TitleBar platform layout', () => {
  it('keeps macOS titles focused on the document name without the app suffix', async () => {
    await renderTitleBarOn('MacIntel');

    expect(screen.getByText('proposal')).toBeInTheDocument();
    expect(screen.queryByText('proposal.md')).not.toBeInTheDocument();
    expect(screen.queryByText('Prism')).not.toBeInTheDocument();
  });

  it('keeps Windows menus on the left and view controls beside the window buttons', async () => {
    const onMenuAction = vi.fn();
    const { container } = await renderTitleBarOn('Win32', {
      menuSections: {
        文件: [{ label: '打开', action: 'openFile' }],
        导航: [],
        帮助: [],
      },
      onMenuAction,
    });

    const titlebar = container.querySelector('.app-titlebar');
    expect(titlebar).not.toBeNull();
    const leftCluster = titlebar?.querySelector('[data-titlebar-section="windows-left-cluster"]');
    const centerTitle = titlebar?.querySelector('[data-titlebar-section="windows-center-title"]');
    const dragSpacer = titlebar?.querySelector('[data-titlebar-section="windows-drag-spacer"]');
    const rightCluster = titlebar?.querySelector('[data-titlebar-section="windows-right-cluster"]');

    expect(leftCluster).not.toBeNull();
    expect(centerTitle).not.toBeNull();
    expect(dragSpacer).not.toBeNull();
    expect(rightCluster).not.toBeNull();

    expect(titlebar).not.toHaveAttribute('data-tauri-drag-region');
    expect(leftCluster).not.toHaveAttribute('data-tauri-drag-region');
    expect(rightCluster).not.toHaveAttribute('data-tauri-drag-region');
    expect(centerTitle).toHaveAttribute('data-tauri-drag-region');
    expect(dragSpacer).toHaveAttribute('data-tauri-drag-region');
    expect(within(leftCluster as HTMLElement).queryByText('Prism')).not.toBeInTheDocument();
    expect(within(leftCluster as HTMLElement).getByRole('button', { name: '文件' })).toBeInTheDocument();
    expect(leftCluster?.firstElementChild?.querySelector('button')?.textContent).toBe('文件');
    fireEvent.click(within(leftCluster as HTMLElement).getByRole('button', { name: '文件' }));
    expect(screen.getByRole('menu')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('menuitem', { name: /打开/ }));
    expect(onMenuAction).toHaveBeenCalledWith('openFile');
    expect(within(leftCluster as HTMLElement).queryByRole('button', { name: '分栏' })).not.toBeInTheDocument();
    expect(within(centerTitle as HTMLElement).getByText('proposal')).toBeInTheDocument();
    expect(within(rightCluster as HTMLElement).getByRole('button', { name: '编辑' })).toBeInTheDocument();
    expect(within(rightCluster as HTMLElement).getByRole('button', { name: '分栏' })).toBeInTheDocument();
    expect(within(rightCluster as HTMLElement).getByRole('button', { name: '预览' })).toBeInTheDocument();
    expect(screen.queryByText('proposal.md')).not.toBeInTheDocument();
  });

  it('allows renaming the current document from the filename area', async () => {
    const onRenameDocument = vi.fn();
    await renderTitleBarOn('MacIntel', { onRenameDocument });

    fireEvent.click(screen.getByRole('button', { name: '重命名当前文稿' }));
    const input = screen.getByRole('textbox', { name: '重命名当前文稿' });
    expect(input).toHaveValue('proposal');

    fireEvent.change(input, { target: { value: 'renamed' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onRenameDocument).toHaveBeenCalledWith('renamed');
  });

  it('shows save feedback beside the document title instead of in the status bar', async () => {
    const { unmount } = await renderTitleBarOn('Win32', {
      saveStatus: 'dirty',
    });

    expect(screen.getByText('proposal')).toBeInTheDocument();
    expect(screen.getByText('未保存')).toBeInTheDocument();
    expect(screen.getByLabelText('已修改，尚未保存')).toBeInTheDocument();

    unmount();
    await renderTitleBarOn('Win32', {
      saveStatus: 'saving',
    });

    expect(screen.getByText('保存中')).toBeInTheDocument();
    expect(screen.getByLabelText('正在保存当前文稿')).toBeInTheDocument();
  });

  it('makes save failures and file conflicts explicit in the filename area', async () => {
    const { unmount } = await renderTitleBarOn('Win32', {
      saveError: 'disk full',
      saveStatus: 'failed',
    });

    expect(screen.getByText('保存失败')).toBeInTheDocument();
    expect(screen.getByLabelText('保存失败：disk full')).toBeInTheDocument();

    unmount();
    await renderTitleBarOn('Win32', {
      saveError: '文件已在磁盘上被外部修改',
      saveStatus: 'conflict',
    });

    expect(screen.getByText('文件冲突')).toBeInTheDocument();
    expect(screen.getByLabelText('文件冲突：文件已在磁盘上被外部修改')).toBeInTheDocument();
  });

  it('does not show a save badge for saved documents', async () => {
    await renderTitleBarOn('Win32', {
      saveStatus: 'saved',
    });

    expect(screen.getByText('proposal')).toBeInTheDocument();
    expect(screen.queryByText('未保存')).not.toBeInTheDocument();
    expect(screen.queryByText('保存中')).not.toBeInTheDocument();
    expect(screen.queryByText('保存失败')).not.toBeInTheDocument();
    expect(screen.queryByText('文件冲突')).not.toBeInTheDocument();
  });
});
