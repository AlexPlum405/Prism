import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DirtyDocumentSwitchModal } from './DirtyDocumentSwitchModal';

describe('DirtyDocumentSwitchModal', () => {
  it('does not render when hidden', () => {
    render(
      <DirtyDocumentSwitchModal
        visible={false}
        currentName="draft.md"
        targetName="next.md"
        onAction={vi.fn()}
      />,
    );

    expect(screen.queryByRole('dialog', { name: '保存当前文稿？' })).not.toBeInTheDocument();
  });

  it('exposes save, save as, discard, and cancel actions', () => {
    const onAction = vi.fn();

    render(
      <DirtyDocumentSwitchModal
        visible
        currentName="draft.md"
        targetName="next.md"
        onAction={onAction}
      />,
    );

    expect(screen.getByRole('dialog', { name: '保存当前文稿？' })).toBeInTheDocument();
    expect(screen.getByText('draft.md')).toBeInTheDocument();
    expect(screen.getByText('打开“next.md”前，当前文稿“draft.md”还有未保存改动。请选择保存、另存为，或放弃这些改动。')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '保存' }));
    fireEvent.click(screen.getByRole('button', { name: '另存为' }));
    fireEvent.click(screen.getByRole('button', { name: '放弃改动' }));
    fireEvent.click(screen.getByRole('button', { name: '取消' }));

    expect(onAction).toHaveBeenNthCalledWith(1, 'save');
    expect(onAction).toHaveBeenNthCalledWith(2, 'saveAs');
    expect(onAction).toHaveBeenNthCalledWith(3, 'discard');
    expect(onAction).toHaveBeenNthCalledWith(4, 'cancel');
  });
});
