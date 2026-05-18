import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { BacklinkReference } from '../services';
import { BacklinksPanel } from './BacklinksPanel';

const backlinks: BacklinkReference[] = [
  {
    path: '/repo/source.md',
    title: 'source.md',
    line: 4,
    column: 3,
    excerpt: '这里引用 [[target]]。',
  },
  {
    path: '/repo/source.md',
    title: 'source.md',
    line: 18,
    column: 1,
    excerpt: '[Target](target.md)',
  },
  {
    path: '/repo/other.md',
    title: 'other.md',
    line: 2,
    column: 1,
    excerpt: '另一个引用 [[target]]。',
  },
];

describe('BacklinksPanel', () => {
  it('groups references by source document and selects a clicked mention', () => {
    const onSelect = vi.fn();

    render(
      <BacklinksPanel
        visible
        backlinks={backlinks}
        onClose={vi.fn()}
        onSelect={onSelect}
      />,
    );

    expect(screen.getByText('source.md')).toBeInTheDocument();
    expect(screen.getByText('other.md')).toBeInTheDocument();
    expect(screen.getByText('18:1')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Target/ }));

    expect(onSelect).toHaveBeenCalledWith(backlinks[1]);
  });

  it('closes with Escape while visible', () => {
    const onClose = vi.fn();

    render(
      <BacklinksPanel
        visible
        backlinks={backlinks}
        onClose={onClose}
        onSelect={vi.fn()}
      />,
    );

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
