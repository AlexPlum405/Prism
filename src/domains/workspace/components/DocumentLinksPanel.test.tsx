import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { DocumentLinkReference } from '../services';
import { DocumentLinksPanel } from './DocumentLinksPanel';

const links: DocumentLinkReference[] = [
  {
    kind: 'markdown',
    label: 'Manual',
    target: 'manual.md',
    line: 3,
    column: 1,
  },
  {
    kind: 'wiki',
    label: 'Daily Note',
    target: 'daily',
    line: 8,
    column: 4,
  },
];

describe('DocumentLinksPanel', () => {
  it('lists current document links and selects a clicked target', () => {
    const onSelect = vi.fn();

    render(
      <DocumentLinksPanel
        visible
        links={links}
        onClose={vi.fn()}
        onSelect={onSelect}
      />,
    );

    expect(screen.getByRole('dialog', { name: '当前文档链接' })).toBeInTheDocument();
    expect(screen.getByText('Manual')).toBeInTheDocument();
    expect(screen.getByText('daily')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Daily Note/ }));

    expect(onSelect).toHaveBeenCalledWith(links[1]);
  });

  it('closes with Escape while visible', () => {
    const onClose = vi.fn();

    render(
      <DocumentLinksPanel
        visible
        links={links}
        onClose={onClose}
        onSelect={vi.fn()}
      />,
    );

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
