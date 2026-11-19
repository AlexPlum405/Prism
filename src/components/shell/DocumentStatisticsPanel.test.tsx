import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DocumentStatisticsPanel } from './DocumentStatisticsPanel';
import type { WritingStats } from '../../domains/workspace/services';

const stats: WritingStats = {
  chineseChars: 1200,
  englishWords: 80,
  characters: 1500,
  paragraphCount: 12,
  readingMinutes: 4,
  sentenceCount: 48,
  wordCount: 1280,
};

describe('DocumentStatisticsPanel', () => {
  it('stays hidden when not opened', () => {
    render(<DocumentStatisticsPanel visible={false} stats={stats} onClose={vi.fn()} />);

    expect(screen.queryByRole('dialog', { name: '写作统计' })).not.toBeInTheDocument();
  });

  it('shows every writing dimension without raw engineering terms', () => {
    render(<DocumentStatisticsPanel visible stats={stats} onClose={vi.fn()} />);

    const dialog = screen.getByRole('dialog', { name: '写作统计' });
    expect(dialog).toHaveTextContent('1280');
    expect(dialog).toHaveTextContent('中文字数');
    expect(dialog).toHaveTextContent('1200');
    expect(dialog).toHaveTextContent('段落');
    expect(dialog).toHaveTextContent('12');
    expect(dialog).toHaveTextContent('句子');
    expect(dialog).toHaveTextContent('48');
    expect(dialog).toHaveTextContent('约 4 分钟');
  });

  it('closes on escape, close button and overlay click', () => {
    const onClose = vi.fn();
    render(<DocumentStatisticsPanel visible stats={stats} onClose={onClose} />);

    fireEvent.keyDown(window, { key: 'Escape' });
    fireEvent.click(screen.getByRole('button', { name: '关闭' }));
    fireEvent.click(document.querySelector('.modal-overlay') as HTMLElement);

    expect(onClose).toHaveBeenCalledTimes(3);
  });
});
