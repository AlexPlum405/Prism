import { render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({
    minimize: vi.fn(),
    toggleMaximize: vi.fn(),
    close: vi.fn(),
  }),
}));

type RenderTitleBarProps = {
  isDirty?: boolean;
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
  it('keeps Windows view controls on the left with the extensionless document title beside them', async () => {
    const { container } = await renderTitleBarOn('Win32');

    const titlebar = container.querySelector('.app-titlebar');
    expect(titlebar).not.toBeNull();
    const cluster = titlebar?.querySelector('[data-titlebar-section="windows-title-cluster"]');
    expect(cluster).not.toBeNull();

    expect(within(cluster as HTMLElement).getAllByRole('button')).toHaveLength(3);
    expect(within(cluster as HTMLElement).getByText('proposal')).toBeInTheDocument();
    expect(screen.queryByText('proposal.md')).not.toBeInTheDocument();
    expect(screen.queryByText('P')).not.toBeInTheDocument();
    expect(screen.queryByText('Prism')).not.toBeInTheDocument();
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
