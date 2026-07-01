import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useDocumentStore } from '../../document/store';
import { useWorkspaceStore } from '../store';
import { OpenFolderButton } from './OpenFolderButton';

const openDialogMock = vi.hoisted(() => vi.fn(async () => '/workspace'));
const grantWorkspaceDirectoryScopeMock = vi.hoisted(() => vi.fn(async () => undefined));
const loadFolderTreeMock = vi.hoisted(() => vi.fn(async () => [
  { kind: 'file', name: 'note.md', path: '/workspace/note.md' },
]));
const openPrismWindowMock = vi.hoisted(() => vi.fn(async () => undefined));
const emitAppEventMock = vi.hoisted(() => vi.fn());

vi.mock('../../../platform/tauri/dialogs', () => ({
  openDialog: openDialogMock,
}));

vi.mock('../../../lib/fileSystemScope', () => ({
  grantWorkspaceDirectoryScope: grantWorkspaceDirectoryScopeMock,
}));

vi.mock('../lib/loadFolderTree', () => ({
  loadFolderTree: loadFolderTreeMock,
}));

vi.mock('../../../lib/openWindow', () => ({
  openPrismWindow: openPrismWindowMock,
}));

vi.mock('../../../platform/events/appEvents', () => ({
  emitAppEvent: emitAppEventMock,
}));

describe('OpenFolderButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useDocumentStore.setState({ currentDocument: null });
    useWorkspaceStore.setState({
      fileTree: [],
      mode: 'single',
      rootPath: null,
      sidebarTab: 'files',
      sidebarVisible: true,
    });
  });

  it('loads the selected folder into the current empty window', async () => {
    render(<OpenFolderButton />);

    fireEvent.click(screen.getByRole('button', { name: '打开文件夹' }));

    await waitFor(() => {
      expect(useWorkspaceStore.getState().rootPath).toBe('/workspace');
    });
    expect(grantWorkspaceDirectoryScopeMock).toHaveBeenCalledWith('/workspace');
    expect(loadFolderTreeMock).toHaveBeenCalledWith('/workspace');
    expect(openPrismWindowMock).not.toHaveBeenCalled();
  });

  it('shows an error toast and leaves the workspace untouched when folder authorization fails', async () => {
    grantWorkspaceDirectoryScopeMock.mockRejectedValueOnce(new Error('permission denied'));

    render(<OpenFolderButton />);

    fireEvent.click(screen.getByRole('button', { name: '打开文件夹' }));

    await waitFor(() => {
      expect(emitAppEventMock).toHaveBeenCalledWith('toast.show', {
        tone: 'error',
        title: '操作失败: permission denied',
      });
    });
    expect(loadFolderTreeMock).not.toHaveBeenCalled();
    expect(openPrismWindowMock).not.toHaveBeenCalled();
    expect(useWorkspaceStore.getState().rootPath).toBeNull();
    expect(useWorkspaceStore.getState().fileTree).toEqual([]);
  });
});
