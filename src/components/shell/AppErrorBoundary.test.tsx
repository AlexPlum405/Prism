import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppErrorBoundary } from './AppErrorBoundary';

function BrokenChild() {
  throw new Error('Injected render failure');
}

describe('AppErrorBoundary', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows a readable fallback instead of a blank screen when a child render throws', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    render(
      <AppErrorBoundary>
        <BrokenChild />
      </AppErrorBoundary>,
    );

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Prism 渲染失败' })).toBeInTheDocument();
    expect(screen.getByText('React 界面渲染时抛出了错误，已保留诊断信息。')).toBeInTheDocument();
    expect(screen.getByText(/Error: Injected render failure/)).toBeInTheDocument();
    expect(screen.getByText(/Component stack:/)).toBeInTheDocument();
  });
});
