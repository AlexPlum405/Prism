import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getCommandMenuItems } from '../domains/commands';
import { createFileTreeContextMenuItems } from '../domains/workspace/components/fileTreeContextMenu';
import { useAppWorkspaceContextMenu } from './useAppWorkspaceContextMenu';

vi.mock('../domains/commands', () => ({
  getCommandMenuItems: vi.fn(() => [{ label: '导出 PDF', action: 'exportPdf' }]),
}));

vi.mock('../domains/workspace/components/fileTreeContextMenu', () => ({
  createFileTreeContextMenuItems: vi.fn(() => [{ label: '新建文稿', action: 'newFile' }]),
}));

function createMouseEvent(x = 12, y = 24) {
  return {
    clientX: x,
    clientY: y,
    preventDefault: vi.fn(),
  } as unknown as React.MouseEvent;
}

function renderModel() {
  const createCommandContext = vi.fn(() => ({ editor: {} }) as never);
  const handleCommandAction = vi.fn();
  const handleFileAction = vi.fn();
  const hook = renderHook(() => useAppWorkspaceContextMenu({
    createCommandContext,
    fileSortMode: 'name',
    fileTreeMode: 'tree',
    workspaceTreeScope: 'currentLevel',
    handleCommandAction,
    handleFileAction,
  }));

  return {
    createCommandContext,
    handleCommandAction,
    handleFileAction,
    result: hook.result,
  };
}

describe('useAppWorkspaceContextMenu', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('opens a file context menu from the folder menu event', () => {
    const { result } = renderModel();
    const event = createMouseEvent();

    act(() => {
      result.current.handleFolderContextMenu(event);
    });

    expect(event.preventDefault).toHaveBeenCalledTimes(1);
    expect(createFileTreeContextMenuItems).toHaveBeenCalledWith({
      fileTreeMode: 'tree',
      fileSortMode: 'name',
      workspaceTreeScope: 'currentLevel',
      includeOpenNewWindow: true,
    });
    expect(result.current.globalContextMenu).toMatchObject({
      x: 12,
      y: 24,
      kind: 'file',
      items: [{ label: '新建文稿', action: 'newFile' }],
    });
  });

  it('opens an export command menu with the current command context', () => {
    const { createCommandContext, result } = renderModel();
    const event = createMouseEvent(40, 80);

    act(() => {
      result.current.handleExportContextMenu(event);
    });

    expect(createCommandContext).toHaveBeenCalledTimes(1);
    expect(getCommandMenuItems).toHaveBeenCalledWith(
      ['exportWithPrevious', 'exportOverwritePrevious', 'exportPdf', 'exportDocx', 'exportHtml', 'exportPng'],
      { editor: {} },
    );
    expect(result.current.globalContextMenu).toMatchObject({
      x: 40,
      y: 80,
      kind: 'menu',
      items: [{ label: '导出 PDF', action: 'exportPdf' }],
    });
  });

  it('routes context menu actions by source kind', () => {
    const { handleCommandAction, handleFileAction, result } = renderModel();

    act(() => {
      result.current.handleContextMenuAction('newFile', 'file');
      result.current.handleContextMenuAction('exportPdf', 'menu');
    });

    expect(handleFileAction).toHaveBeenCalledWith('newFile');
    expect(handleCommandAction).toHaveBeenCalledWith('exportPdf');
  });
});
