import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useDocumentStore } from '../store';
import { DocumentView } from './DocumentView';

describe('DocumentView', () => {
  beforeEach(() => {
    useDocumentStore.setState({ currentDocument: null });
  });

  it('shows the Prism brand empty state before a document is open', () => {
    render(<DocumentView />);

    expect(screen.getByRole('status', { name: '打开一个本地文档开始写作' })).toBeInTheDocument();
    expect(screen.getByText('PRISM')).toBeInTheDocument();
    expect(screen.getByText(/Prism 不接管你的文件/)).toBeInTheDocument();
    expect(screen.getByText('本地写作')).toBeInTheDocument();
    expect(screen.getByText('完整预览')).toBeInTheDocument();
    expect(screen.getByText('可信导出')).toBeInTheDocument();
    expect(screen.queryByText(/AI|云同步|实时协作/)).not.toBeInTheDocument();
  });
});
