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
        cursor={{ line: 12, column: 8 }}
        sidebarVisible={true}
        isSidebarHovered={false}
      />
    );

    expect(screen.getByTitle('字数 60，行 12，列 8')).toBeInTheDocument();
    expect(screen.getByText('60 字 · 12:8')).toBeInTheDocument();
    expect(screen.queryByText('已保存')).not.toBeInTheDocument();
    expect(screen.queryByText('LN')).not.toBeInTheDocument();
    expect(screen.queryByText('COL')).not.toBeInTheDocument();
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

    expect(screen.getByTitle('选区：字数 6，行 1，列 1')).toBeInTheDocument();
    expect(screen.getByText('选区 6 字 · 1:1')).toBeInTheDocument();
  });

  it('aggregates actionable diagnostics as ERROR count', () => {
    const onDiagnosticsClick = vi.fn();
    render(
      <StatusBar
        writingStats={writingStats}
        cursor={{ line: 1, column: 1 }}
        sidebarVisible={true}
        isSidebarHovered={false}
        linkIssueCount={2}
        linkIssueTitle="未找到链接文件 missing.md"
        onLinkDiagnosticsClick={onDiagnosticsClick}
      />
    );

    const button = screen.getByRole('button', { name: 'ERROR 2' });
    fireEvent.click(button);

    expect(button).toHaveAttribute(
      'title',
      '未找到链接文件 missing.md',
    );
    expect(onDiagnosticsClick).toHaveBeenCalledTimes(1);
  });

  it('does not render typography suggestions as status bar errors', () => {
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

    expect(screen.queryByRole('button', { name: 'TYPO 3' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'ERROR 3' })).not.toBeInTheDocument();
  });

  it('does not render backlink count in the status bar', () => {
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

    expect(screen.queryByRole('button', { name: 'BACKLINK 4' })).not.toBeInTheDocument();
    expect(onBacklinksClick).not.toHaveBeenCalled();
  });

  it('shows the relation graph button only when the current document has relations', () => {
    const onRelationGraphClick = vi.fn();
    const { rerender } = render(
      <StatusBar
        writingStats={writingStats}
        cursor={{ line: 1, column: 1 }}
        sidebarVisible={true}
        isSidebarHovered={false}
        hasDocumentRelations={false}
        onRelationGraphClick={onRelationGraphClick}
      />
    );

    expect(screen.queryByTitle(/关系图谱/)).not.toBeInTheDocument();

    rerender(
      <StatusBar
        writingStats={writingStats}
        cursor={{ line: 1, column: 1 }}
        sidebarVisible={true}
        isSidebarHovered={false}
        hasDocumentRelations={true}
        onRelationGraphClick={onRelationGraphClick}
      />
    );

    fireEvent.click(screen.getByTitle(/关系图谱/));

    expect(onRelationGraphClick).toHaveBeenCalledTimes(1);
  });

  it('does not render document metadata in the status bar', () => {
    const onDocumentPropertiesClick = vi.fn();
    render(
      <StatusBar
        writingStats={writingStats}
        cursor={{ line: 1, column: 1 }}
        sidebarVisible={true}
        isSidebarHovered={false}
        onDocumentPropertiesClick={onDocumentPropertiesClick}
      />
    );

    expect(screen.queryByRole('button', { name: 'META' })).not.toBeInTheDocument();
    expect(onDocumentPropertiesClick).not.toHaveBeenCalled();
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
    expect(status).toHaveAttribute('title', '后台导出：正在生成 PDF 页面 2 / 49。点击查看前台进度。');

    fireEvent.click(status);

    expect(onShowExportProgress).toHaveBeenCalledTimes(1);
  });
});
