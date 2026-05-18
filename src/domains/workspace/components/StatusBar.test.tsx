import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { StatusBar } from './StatusBar';
import type { WritingStats } from '../services';

const writingStats: WritingStats = {
  chineseChars: 42,
  englishWords: 18,
  characters: 96,
  readingMinutes: 2,
  wordCount: 60,
};

const selectionStats: WritingStats = {
  chineseChars: 4,
  englishWords: 2,
  characters: 14,
  readingMinutes: 1,
  wordCount: 6,
};

describe('StatusBar', () => {
  it('renders writing stats, line and column', () => {
    render(
      <StatusBar
        writingStats={writingStats}
        cursor={{ line: 1, column: 1 }}
        sidebarVisible={true}
        isSidebarHovered={false}
      />
    );

    expect(screen.getByTitle('中文字数 42，英文词数 18，字符数 96，预计阅读 2 分钟')).toBeInTheDocument();
    expect(screen.getByText('中')).toBeInTheDocument();
    expect(screen.getByText('EN')).toBeInTheDocument();
    expect(screen.getByText('字符')).toBeInTheDocument();
    expect(screen.getByText('分钟')).toBeInTheDocument();
    expect(screen.getByText('LN')).toBeInTheDocument();
    expect(screen.getByText('COL')).toBeInTheDocument();
    expect(screen.getByTitle('新建文件')).toBeInTheDocument();
    expect(screen.getByTitle('切换到文档列表')).toBeInTheDocument();
  });

  it('shows selected text stats when a selection is active', () => {
    render(
      <StatusBar
        writingStats={writingStats}
        selectionStats={selectionStats}
        cursor={{ line: 1, column: 1 }}
        sidebarVisible={true}
        isSidebarHovered={false}
      />,
    );

    expect(screen.getByTitle('选区：中文字数 4，英文词数 2，字符数 14，预计阅读 1 分钟')).toBeInTheDocument();
    expect(screen.getByText('选区')).toBeInTheDocument();
  });

  it('renders link diagnostic count when markdown links have issues', () => {
    render(
      <StatusBar
        writingStats={writingStats}
        cursor={{ line: 1, column: 1 }}
        sidebarVisible={true}
        isSidebarHovered={false}
        linkIssueCount={2}
        linkIssueTitle="未找到链接文件 missing.md"
      />
    );

    expect(screen.getByRole('button', { name: 'LINK 2' })).toHaveAttribute(
      'title',
      '未找到链接文件 missing.md',
    );
  });

  it('renders typography diagnostic count when writing style has issues', () => {
    render(
      <StatusBar
        writingStats={writingStats}
        cursor={{ line: 1, column: 1 }}
        sidebarVisible={true}
        isSidebarHovered={false}
        typographyIssueCount={3}
        typographyIssueTitle="中英文之间缺少空格"
      />
    );

    expect(screen.getByRole('button', { name: 'TYPO 3' })).toHaveAttribute(
      'title',
      '中英文之间缺少空格',
    );
  });

  it('renders backlink count as a lightweight navigation entry', () => {
    const onBacklinksClick = vi.fn();
    render(
      <StatusBar
        writingStats={writingStats}
        cursor={{ line: 1, column: 1 }}
        sidebarVisible={true}
        isSidebarHovered={false}
        backlinkCount={4}
        onBacklinksClick={onBacklinksClick}
      />
    );

    const button = screen.getByRole('button', { name: 'BACKLINK 4' });
    fireEvent.click(button);

    expect(button).toHaveAttribute('title', '查看引用当前文档的 Markdown 文件');
    expect(onBacklinksClick).toHaveBeenCalledTimes(1);
  });

  it('shows a recoverable background export status', () => {
    const onShowExportProgress = vi.fn();
    render(
      <StatusBar
        writingStats={writingStats}
        cursor={{ line: 1, column: 1 }}
        sidebarVisible={true}
        isSidebarHovered={false}
        exportProgress="正在生成 PDF 页面 2 / 49"
        exportProgressInBackground={true}
        onShowExportProgress={onShowExportProgress}
      />
    );

    const status = screen.getByRole('button', { name: '导出中' });
    expect(status).toHaveAttribute('title', '导出中：正在生成 PDF 页面 2 / 49');

    fireEvent.click(status);

    expect(onShowExportProgress).toHaveBeenCalledTimes(1);
  });
});
