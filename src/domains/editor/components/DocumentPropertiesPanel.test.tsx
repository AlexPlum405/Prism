/**
 * @vitest-environment jsdom
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DocumentPropertiesPanel } from './DocumentPropertiesPanel';

describe('DocumentPropertiesPanel', () => {
  it('edits front matter fields without hiding the markdown source of truth', () => {
    const onApply = vi.fn();
    render(
      <DocumentPropertiesPanel
        visible={true}
        content="# Body"
        onApply={onApply}
        onClose={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText('标题'), { target: { value: '文章标题' } });
    fireEvent.change(screen.getByLabelText('标签'), { target: { value: 'Prism, Markdown' } });
    fireEvent.click(screen.getByRole('button', { name: '应用' }));

    expect(onApply).toHaveBeenCalledWith(expect.stringContaining('title: 文章标题'));
    expect(onApply).toHaveBeenCalledWith(expect.stringContaining('- Prism'));
    expect(onApply).toHaveBeenCalledWith(expect.stringContaining('# Body'));
  });

  it('disables applying when existing front matter is invalid yaml', () => {
    render(
      <DocumentPropertiesPanel
        visible={true}
        content={'---\ntitle: [broken\n---\nBody'}
        onApply={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText('当前 Front Matter 不是有效 YAML，请先回到源码修正后再编辑属性。')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '应用' })).toBeDisabled();
  });
});
