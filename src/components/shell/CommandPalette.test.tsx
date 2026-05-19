import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FileNode } from '../../domains/workspace/types';
import { buildWorkspaceIndex } from '../../domains/workspace/services';
import { CommandPalette, type Command } from './CommandPalette';

const files: FileNode[] = [
  {
    path: '/notes/b',
    name: 'b',
    kind: 'directory',
    children: [
      { path: '/notes/b/z.md', name: 'z.md', kind: 'file', modifiedAt: 20, preview: 'Zeta' },
      { path: '/notes/b/a.md', name: 'a.md', kind: 'file', modifiedAt: 40, preview: 'Alpha' },
    ],
  },
  { path: '/notes/root.md', name: 'root.md', kind: 'file', modifiedAt: 30, preview: 'Root file' },
];

describe('CommandPalette', () => {
  beforeEach(() => {
    const storage = new Map<string, string>();
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: {
        getItem: vi.fn((key: string) => storage.get(key) ?? null),
        setItem: vi.fn((key: string, value: string) => storage.set(key, value)),
        removeItem: vi.fn((key: string) => storage.delete(key)),
      },
    });
  });

  it('keeps command mode compact by default while search still reaches all commands', () => {
    const onExecute = vi.fn();
    const onClose = vi.fn();
    const commands: Command[] = [
      { id: 'quickOpen', label: '快速打开文件', category: '文件', shortcut: '⌘+P' },
      { id: 'workspaceSearch', label: '全文搜索工作区', category: '编辑', shortcut: '⌘+⇧+F' },
      { id: 'exportPdf', label: '导出为 PDF', category: '文件' },
      { id: 'insertTable', label: '插入表格', category: '插入' },
      { id: 'openDocumentProperties', label: '打开文档属性', category: '文件' },
      { id: 'showRelationGraph', label: '查看关系图谱', category: '视图', keywords: ['graph', '图谱'] },
      { id: 'themeNocturne', label: 'Nocturne Dark', category: '主题' },
    ];

    render(
      <CommandPalette
        visible
        commands={commands}
        onClose={onClose}
        onExecute={onExecute}
      />,
    );

    expect(screen.getByPlaceholderText('搜索动作…')).toBeInTheDocument();
    expect(screen.getByText('常用')).toBeInTheDocument();
    expect(screen.getByText('快速打开文件')).toBeInTheDocument();
    expect(screen.getByText('全文搜索工作区')).toBeInTheDocument();
    expect(screen.queryByText('查看关系图谱')).not.toBeInTheDocument();
    expect(screen.queryByText('Nocturne Dark')).not.toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('搜索动作…'), {
      target: { value: '图谱' },
    });

    expect(screen.getByText('查看关系图谱')).toBeInTheDocument();
  });

  it('shows recent commands first after executing from command mode', () => {
    const onExecute = vi.fn();
    const onClose = vi.fn();
    const commands: Command[] = [
      { id: 'quickOpen', label: '快速打开文件', category: '文件', shortcut: '⌘+P' },
      { id: 'exportPdf', label: '导出为 PDF', category: '文件' },
      { id: 'formatTable', label: '格式化当前表格', category: '插入' },
    ];

    const { rerender } = render(
      <CommandPalette
        visible
        commands={commands}
        onClose={onClose}
        onExecute={onExecute}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText('搜索动作…'), {
      target: { value: '表格' },
    });
    fireEvent.click(screen.getByText('格式化当前表格'));

    expect(onExecute).toHaveBeenCalledWith('formatTable');
    expect(onClose).toHaveBeenCalledTimes(1);

    rerender(
      <CommandPalette
        visible={false}
        commands={commands}
        onClose={onClose}
        onExecute={onExecute}
      />,
    );
    rerender(
      <CommandPalette
        visible
        commands={commands}
        onClose={onClose}
        onExecute={onExecute}
      />,
    );

    const labels = screen.getAllByText(/快速打开文件|导出为 PDF|格式化当前表格/);
    expect(labels[0]).toHaveTextContent('格式化当前表格');
    expect(screen.getByText('最近使用')).toBeInTheDocument();
  });

  it('searches workspace files in quick-open mode and executes the selected file action', () => {
    const onExecute = vi.fn();
    const onClose = vi.fn();

    render(
      <CommandPalette
        visible
        commands={[]}
        files={files}
        workspaceRoot="/notes"
        recentFiles={[{ path: '/notes/root.md', lastOpened: 100 }]}
        mode="files"
        onClose={onClose}
        onExecute={onExecute}
      />,
    );

    expect(screen.getByPlaceholderText('搜索工作区文件…')).toBeInTheDocument();
    expect(screen.getAllByText(/\.md$/).map((node) => node.textContent)).toEqual(['root.md', 'a.md', 'z.md']);
    expect(screen.getByText('a.md')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('搜索工作区文件…'), {
      target: { value: 'zeta' },
    });
    expect(screen.getByText('z.md')).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'Enter' });

    expect(onExecute).toHaveBeenCalledWith(`openWorkspaceFile:${encodeURIComponent('/notes/b/z.md')}`);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('uses the workspace index for title-aware quick open and full-text search', () => {
    const onExecute = vi.fn();
    const onClose = vi.fn();
    const workspaceIndex = buildWorkspaceIndex({
      fileTree: files,
      workspaceRoot: '/notes',
      documents: [
        { path: '/notes/b/z.md', content: '---\ntitle: Zeta 方案\n---\n# 背景\n包含全文命中。' },
        { path: '/notes/b/a.md', content: '# Alpha 文档\n普通内容。' },
        { path: '/notes/root.md', content: '# Root file\n根文档。' },
      ],
      recentFiles: [{ path: '/notes/root.md', lastOpened: 100 }],
    });

    const { rerender } = render(
      <CommandPalette
        visible
        commands={[]}
        files={files}
        workspaceRoot="/notes"
        workspaceIndex={workspaceIndex}
        mode="files"
        onClose={onClose}
        onExecute={onExecute}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText('搜索工作区文件…'), {
      target: { value: 'Zeta 方案' },
    });
    expect(screen.getByText('Zeta 方案')).toBeInTheDocument();
    expect(screen.getByText('b/z.md')).toBeInTheDocument();

    rerender(
      <CommandPalette
        visible
        commands={[]}
        files={files}
        workspaceRoot="/notes"
        workspaceIndex={workspaceIndex}
        mode="search"
        onClose={onClose}
        onExecute={onExecute}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText('全文搜索工作区…'), {
      target: { value: '全文命中' },
    });
    expect(screen.getByText('Zeta 方案')).toBeInTheDocument();
    expect(screen.getByText('正文')).toBeInTheDocument();
    expect(screen.getByText(/全文命中/)).toBeInTheDocument();
  });
});
