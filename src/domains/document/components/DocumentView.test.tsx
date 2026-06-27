import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useDocumentStore } from '../store';
import { DocumentView } from './DocumentView';

describe('DocumentView', () => {
  beforeEach(() => {
    useDocumentStore.setState({ currentDocument: null });
  });

  it('does not render the removed empty guide page before a document is open', () => {
    const { container } = render(<DocumentView />);

    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByText('PRISM')).not.toBeInTheDocument();
    expect(screen.queryByText('打开一个本地文档开始写作')).not.toBeInTheDocument();
  });
});
