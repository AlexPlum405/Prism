import { render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({
    minimize: vi.fn(),
    toggleMaximize: vi.fn(),
    close: vi.fn(),
  }),
}));

async function renderTitleBarOn(platform: string) {
  vi.resetModules();
  Object.defineProperty(navigator, 'platform', {
    value: platform,
    configurable: true,
  });

  const { useDocumentStore } = await import('../../domains/document/store');
  useDocumentStore.getState().createNewDocument('', 'proposal.md');
  useDocumentStore.getState().setViewMode('split');

  const { TitleBar } = await import('./TitleBar');
  return render(<TitleBar docName="proposal.md" isDirty={false} />);
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
});
