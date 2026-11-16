import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createFileTreeContextMenuItems } from '../domains/workspace/components/fileTreeContextMenu';
import { useAppWorkspaceContextMenu } from './useAppWorkspaceContextMenu';

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
  const handleCommandAction = vi.fn();
  const handleFileAction = vi.fn();
  const hook = renderHook(() => useAppWorkspaceContextMenu({
    fileSortMode: 'name',
    fileTreeMode: 'tree',
    workspaceTreeScope: 'currentLevel',
    handleCommandAction,
    handleFileAction,
  }));

  return {
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
